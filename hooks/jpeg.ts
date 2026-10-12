// JPEG decoding: baseline, extended and progressive Huffman-coded JPEG at
// 8 bits, any sampling factors, restart intervals; greyscale, YCbCr, RGB and
// Adobe CMYK/YCCK. Arithmetic coding, 12-bit, lossless and hierarchical JPEG
// are refused (the caller falls back to ffmpeg). Chroma is upsampled by
// replication, as libjpeg does with fancy upsampling off. EXIF orientation is
// not applied (neither did the ffmpeg decode this replaces).

import type { Pixmap } from "./pixels";

/** Zigzag index to natural (row-major) index, padded for a corrupt run past 63. */
const ZIGZAG = Int32Array.from([
  0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20,
  13, 6, 7, 14, 21, 28, 35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52,
  45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63, ...Array.from({ length: 16 }, () => 63),
]);

/** The 1-D IDCT basis, COS[x * 8 + u] = C(u)/2 · cos((2x+1)uπ/16). */
const COS = Float32Array.from({ length: 64 }, (_, i) => {
  const x = i >> 3, u = i & 7;
  return ((u === 0 ? Math.SQRT1_2 : 1) * Math.cos(((2 * x + 1) * u * Math.PI) / 16)) / 2;
});

type Huffman = {
  /** By the next 8 bits: `(length << 8) | value` for codes up to 8 bits, else 0. */
  lookup: Uint16Array;
  maxcode: Int32Array;
  valptr: Int32Array;
  mincode: Int32Array;
  values: Uint8Array;
};

type Component = {
  id: number;
  h: number;
  v: number;
  tq: number;
  /** Blocks across and down that hold picture (a non-interleaved scan's MCUs). */
  blocksPerLine: number;
  blocksPerColumn: number;
  /** Blocks across and down as stored: whole MCUs. */
  stride: number;
  rowsStored: number;
  coefs: Int16Array;
  dc?: Huffman;
  ac?: Huffman;
  pred: number;
};

type Frame = {
  progressive: boolean;
  width: number;
  height: number;
  components: Component[];
  maxH: number;
  maxV: number;
  mcusPerLine: number;
  mcusPerColumn: number;
};

export function isJpeg(bytes: Uint8Array): boolean {
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

const u16 = (b: Uint8Array, i: number) => (b[i]! << 8) | b[i + 1]!;

function huffman(counts: Uint8Array, values: Uint8Array): Huffman {
  const lookup = new Uint16Array(256);
  const maxcode = new Int32Array(18).fill(-1);
  const valptr = new Int32Array(17);
  const mincode = new Int32Array(17);
  let code = 0;
  let k = 0;
  for (let len = 1; len <= 16; len++) {
    const n = counts[len - 1]!;
    valptr[len] = k;
    mincode[len] = code;
    for (let i = 0; i < n; i++, k++, code++) {
      if (code >= 1 << len) throw new Error("bad JPEG Huffman table");
      if (len <= 8) {
        const shift = 8 - len;
        for (let j = 0; j < 1 << shift; j++) lookup[(code << shift) | j] = (len << 8) | values[k]!;
      }
    }
    if (n) maxcode[len] = code - 1;
    code <<= 1;
  }

  return { lookup, maxcode, valptr, mincode, values };
}

/** Entropy-coded bits, most significant first, byte stuffing undone. */
class Bits {
  readonly data: Uint8Array;
  pos: number;
  buf = 0;
  cnt = 0;
  /** A marker was reached: zeros are read from there on. */
  atMarker = false;

  constructor(data: Uint8Array, pos: number) {
    this.data = data;
    this.pos = pos;
  }

  fill() {
    const data = this.data;
    while (this.cnt <= 24) {
      let b = 0;
      if (!this.atMarker && this.pos < data.length) {
        b = data[this.pos]!;
        if (b === 0xff) {
          if (data[this.pos + 1] === 0) {
            this.pos += 2;
          } else {
            this.atMarker = true;
            b = 0;
          }
        } else {
          this.pos++;
        }
      }
      this.buf = (this.buf << 8) | b;
      this.cnt += 8;
    }
  }

  bits(n: number): number {
    if (this.cnt < n) this.fill();
    this.cnt -= n;
    return (this.buf >>> this.cnt) & ((1 << n) - 1);
  }

  /** `bits(s)` read as a signed coefficient (the JPEG EXTEND procedure). */
  extend(s: number): number {
    if (s === 0) return 0;
    if (s > 16) throw new Error("bad JPEG coefficient size");
    const v = this.bits(s);
    return v < 1 << (s - 1) ? v - (1 << s) + 1 : v;
  }

  decode(h: Huffman): number {
    if (this.cnt < 16) this.fill();
    const e = h.lookup[(this.buf >>> (this.cnt - 8)) & 255]!;
    if (e) {
      this.cnt -= e >> 8;
      return e & 255;
    }
    for (let len = 9; len <= 16; len++) {
      const code = (this.buf >>> (this.cnt - len)) & ((1 << len) - 1);
      if (code <= h.maxcode[len]!) {
        this.cnt -= len;
        return h.values[h.valptr[len]! + code - h.mincode[len]!]!;
      }
    }
    throw new Error("bad JPEG Huffman code");
  }

  /** Where the next marker starts, from the current position on. */
  nextMarker(): number {
    const data = this.data;
    let p = this.pos;
    while (p + 1 < data.length) {
      const n = data[p + 1]!;
      if (data[p] === 0xff && n !== 0 && n !== 0xff && !(n >= 0xd0 && n <= 0xd7)) break;
      p++;
    }

    return p;
  }

  /** Drops the bits left before a restart marker, and the marker. */
  restart() {
    const data = this.data;
    let p = this.pos;
    while (p + 1 < data.length && !(data[p] === 0xff && data[p + 1] !== 0 && data[p + 1] !== 0xff)) p++;
    if (data[p + 1]! >= 0xd0 && data[p + 1]! <= 0xd7) p += 2;
    this.pos = p;
    this.buf = 0;
    this.cnt = 0;
    this.atMarker = false;
  }
}

/** Decodes a JPEG; `maxPixels` refuses anything bigger before decoding. */
export function decodeJpeg(bytes: Uint8Array, maxPixels: number): Pixmap {
  if (!isJpeg(bytes)) throw new Error("not a JPEG");

  const quant: (Int32Array | undefined)[] = [];
  const dcTables: (Huffman | undefined)[] = [];
  const acTables: (Huffman | undefined)[] = [];
  let frame: Frame | undefined;
  let restartInterval = 0;
  let adobe: number | undefined;
  let decodedAny = false;

  let pos = 2;
  for (;;) {
    while (pos < bytes.length && bytes[pos] !== 0xff) pos++;
    while (pos < bytes.length && bytes[pos] === 0xff) pos++;
    if (pos >= bytes.length) break;
    const marker = bytes[pos++]!;
    if (marker === 0xd9) break;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;

    const length = u16(bytes, pos);
    const seg = bytes.subarray(pos + 2, pos + length);
    if (seg.length !== length - 2) break;
    pos += length;

    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      frame = readFrame(seg, marker === 0xc2, maxPixels);
    } else if (marker === 0xc4) {
      for (let p = 0; p < seg.length; ) {
        const tc = seg[p]! >> 4, th = seg[p]! & 15;
        const counts = seg.subarray(p + 1, p + 17);
        const total = counts.reduce((a, b) => a + b, 0);
        const table = huffman(counts, seg.subarray(p + 17, p + 17 + total));
        (tc === 0 ? dcTables : acTables)[th] = table;
        p += 17 + total;
      }
    } else if (marker === 0xdb) {
      for (let p = 0; p < seg.length; ) {
        const wide = seg[p]! >> 4, tq = seg[p]! & 15;
        const table = new Int32Array(64);
        for (let i = 0; i < 64; i++) {
          table[ZIGZAG[i]!] = wide ? u16(seg, p + 1 + i * 2) : seg[p + 1 + i]!;
        }
        quant[tq] = table;
        p += 1 + (wide ? 128 : 64);
      }
    } else if (marker === 0xdd) {
      restartInterval = u16(seg, 0);
    } else if (marker === 0xee) {
      if (String.fromCharCode(...seg.subarray(0, 5)) === "Adobe" && seg.length >= 12) adobe = seg[11]!;
    } else if (marker === 0xda) {
      if (frame === undefined) throw new Error("JPEG scan before its frame");
      const n = seg[0]!;
      const scan: Component[] = [];
      for (let i = 0; i < n; i++) {
        const id = seg[1 + i * 2]!, tables = seg[2 + i * 2]!;
        const c = frame.components.find((c) => c.id === id);
        if (c === undefined) throw new Error("JPEG scan names no component");
        c.dc = dcTables[tables >> 4];
        c.ac = acTables[tables & 15];
        scan.push(c);
      }
      const at = 1 + n * 2;
      const ss = seg[at]!, se = seg[at + 1]!, ah = seg[at + 2]! >> 4, al = seg[at + 2]! & 15;
      const bits = new Bits(bytes, pos);
      try {
        decodeScan(bits, frame, scan, restartInterval, ss, se, ah, al);
        decodedAny = true;
      } catch (error) {
        // A damaged or cut-off file: draw what came before, as viewers do.
        if (!decodedAny && !bits.atMarker && bits.pos < bytes.length) throw error;
        decodedAny = true;
        break;
      }
      pos = bits.nextMarker();
    } else if (
      (marker >= 0xc3 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      throw new Error(marker >= 0xc9 ? "arithmetic-coded JPEG" : "lossless or hierarchical JPEG");
    }
  }

  if (frame === undefined || !decodedAny) throw new Error("JPEG has no image data");

  return output(frame, quant, adobe);
}

function readFrame(seg: Uint8Array, progressive: boolean, maxPixels: number): Frame {
  if (seg[0] !== 8) throw new Error(`${seg[0]}-bit JPEG`);
  const height = u16(seg, 1);
  const width = u16(seg, 3);
  if (!(width > 0 && height > 0)) throw new Error("JPEG has no size");
  if (width * height > maxPixels) throw new Error(`${width}×${height} is too large to preview`);
  const n = seg[5]!;
  if (n !== 1 && n !== 3 && n !== 4) throw new Error(`JPEG with ${n} components`);

  const parts = Array.from({ length: n }, (_, i) => ({
    id: seg[6 + i * 3]!,
    h: seg[7 + i * 3]! >> 4,
    v: seg[7 + i * 3]! & 15,
    tq: seg[8 + i * 3]!,
  }));
  if (parts.some((p) => p.h < 1 || p.h > 4 || p.v < 1 || p.v > 4)) throw new Error("bad JPEG sampling");
  const maxH = Math.max(...parts.map((p) => p.h));
  const maxV = Math.max(...parts.map((p) => p.v));
  const mcusPerLine = Math.ceil(width / (8 * maxH));
  const mcusPerColumn = Math.ceil(height / (8 * maxV));
  const components = parts.map((p): Component => {
    const stride = mcusPerLine * p.h;
    const rowsStored = mcusPerColumn * p.v;
    return {
      ...p,
      blocksPerLine: Math.ceil(Math.ceil((width * p.h) / maxH) / 8),
      blocksPerColumn: Math.ceil(Math.ceil((height * p.v) / maxV) / 8),
      stride,
      rowsStored,
      coefs: new Int16Array(stride * rowsStored * 64),
      pred: 0,
    };
  });

  return { progressive, width, height, components, maxH, maxV, mcusPerLine, mcusPerColumn };
}

function decodeScan(
  bits: Bits,
  frame: Frame,
  scan: Component[],
  restartInterval: number,
  ss: number,
  se: number,
  ah: number,
  al: number,
) {
  let eobrun = 0;
  const table = (h: Huffman | undefined) => {
    if (h === undefined) throw new Error("JPEG Huffman table missing");
    return h;
  };

  const baseline = (c: Component, at: number) => {
    const b = c.coefs;
    const t = bits.decode(table(c.dc));
    c.pred += bits.extend(t);
    b[at] = c.pred;
    const ac = table(c.ac);
    for (let k = 1; k < 64; ) {
      const rs = bits.decode(ac);
      const s = rs & 15, r = rs >> 4;
      if (s === 0) {
        if (r < 15) break;
        k += 16;
        continue;
      }
      k += r;
      if (k > 63) break;
      b[at + ZIGZAG[k]!] = bits.extend(s);
      k++;
    }
  };
  const dcFirst = (c: Component, at: number) => {
    const t = bits.decode(table(c.dc));
    c.pred += bits.extend(t);
    c.coefs[at] = c.pred * (1 << al);
  };
  const dcRefine = (c: Component, at: number) => {
    if (bits.bits(1)) c.coefs[at]! |= 1 << al;
  };
  const acFirst = (c: Component, at: number) => {
    if (eobrun > 0) {
      eobrun--;
      return;
    }
    const b = c.coefs;
    const ac = table(c.ac);
    for (let k = ss; k <= se; ) {
      const rs = bits.decode(ac);
      const s = rs & 15, r = rs >> 4;
      if (s === 0) {
        if (r < 15) {
          eobrun = (1 << r) - 1 + (r ? bits.bits(r) : 0);
          break;
        }
        k += 16;
        continue;
      }
      k += r;
      if (k > 63) break;
      b[at + ZIGZAG[k]!] = bits.extend(s) * (1 << al);
      k++;
    }
  };
  // Successive approximation of AC coefficients: libjpeg's decode_mcu_AC_refine.
  const acRefine = (c: Component, at: number) => {
    const b = c.coefs;
    const p1 = 1 << al;
    const m1 = -1 << al;
    let k = ss;
    if (eobrun <= 0) {
      const ac = table(c.ac);
      for (; k <= se; k++) {
        const rs = bits.decode(ac);
        let r = rs >> 4;
        let s = rs & 15;
        if (s) {
          s = bits.bits(1) ? p1 : m1;
        } else if (r !== 15) {
          eobrun = (1 << r) + (r ? bits.bits(r) : 0);
          break;
        }
        do {
          const z = at + ZIGZAG[k]!;
          if (b[z] !== 0) {
            if (bits.bits(1) && (b[z]! & p1) === 0) b[z]! += b[z]! >= 0 ? p1 : m1;
          } else if (--r < 0) {
            break;
          }
          k++;
        } while (k <= se);
        if (s && k <= 63) b[at + ZIGZAG[k]!] = s;
      }
    }
    if (eobrun > 0) {
      for (; k <= se; k++) {
        const z = at + ZIGZAG[k]!;
        if (b[z] !== 0 && bits.bits(1) && (b[z]! & p1) === 0) b[z]! += b[z]! >= 0 ? p1 : m1;
      }
      eobrun--;
    }
  };

  const block = !frame.progressive
    ? baseline
    : ss === 0
      ? ah === 0
        ? dcFirst
        : dcRefine
      : ah === 0
        ? acFirst
        : acRefine;
  if (frame.progressive && ss === 0 && se !== 0) throw new Error("bad progressive JPEG scan");

  for (const c of scan) c.pred = 0;
  const single = scan.length === 1 ? scan[0]! : undefined;
  const total = single
    ? single.blocksPerLine * single.blocksPerColumn
    : frame.mcusPerLine * frame.mcusPerColumn;

  for (let n = 0; n < total; ) {
    const stop = restartInterval > 0 ? Math.min(total, n + restartInterval) : total;
    for (; n < stop; n++) {
      if (single) {
        const row = (n / single.blocksPerLine) | 0;
        const col = n % single.blocksPerLine;
        block(single, (row * single.stride + col) * 64);
      } else {
        const mr = (n / frame.mcusPerLine) | 0;
        const mc = n % frame.mcusPerLine;
        for (const c of scan) {
          for (let v = 0; v < c.v; v++) {
            for (let h = 0; h < c.h; h++) {
              block(c, ((mr * c.v + v) * c.stride + mc * c.h + h) * 64);
            }
          }
        }
      }
    }
    if (n < total) {
      bits.restart();
      eobrun = 0;
      for (const c of scan) c.pred = 0;
    }
  }
}

/** Dequantizes and inverse-transforms one component into 8-bit samples. */
function plane(c: Component, q: Int32Array): Uint8Array {
  const width = c.stride * 8;
  const out = new Uint8Array(width * c.rowsStored * 8);
  const f = new Float32Array(64);
  const t = new Float32Array(64);
  for (let by = 0; by < c.rowsStored; by++) {
    for (let bx = 0; bx < c.stride; bx++) {
      const at = (by * c.stride + bx) * 64;
      const base = by * 8 * width + bx * 8;
      let flat = true;
      for (let i = 1; i < 64; i++) {
        if (c.coefs[at + i] !== 0) {
          flat = false;
          break;
        }
      }
      if (flat) {
        const v = clamp((c.coefs[at]! * q[0]!) / 8 + 128);
        for (let y = 0; y < 8; y++) out.fill(v, base + y * width, base + y * width + 8);
        continue;
      }
      for (let i = 0; i < 64; i++) f[i] = c.coefs[at + i]! * q[i]!;
      // Rows: t[v][x] = Σu COS[x][u] · F[v][u].
      for (let v = 0; v < 8; v++) {
        const r = v * 8;
        for (let x = 0; x < 8; x++) {
          const k = x * 8;
          t[r + x] =
            COS[k]! * f[r]! + COS[k + 1]! * f[r + 1]! + COS[k + 2]! * f[r + 2]! + COS[k + 3]! * f[r + 3]! +
            COS[k + 4]! * f[r + 4]! + COS[k + 5]! * f[r + 5]! + COS[k + 6]! * f[r + 6]! + COS[k + 7]! * f[r + 7]!;
        }
      }
      // Columns: out[y][x] = Σv COS[y][v] · t[v][x].
      for (let y = 0; y < 8; y++) {
        const k = y * 8;
        const o = base + y * width;
        for (let x = 0; x < 8; x++) {
          out[o + x] = clamp(
            COS[k]! * t[x]! + COS[k + 1]! * t[8 + x]! + COS[k + 2]! * t[16 + x]! + COS[k + 3]! * t[24 + x]! +
              COS[k + 4]! * t[32 + x]! + COS[k + 5]! * t[40 + x]! + COS[k + 6]! * t[48 + x]! +
              COS[k + 7]! * t[56 + x]! + 128,
          );
        }
      }
    }
  }

  return out;
}

const clamp = (v: number) => (v <= 0 ? 0 : v >= 255 ? 255 : Math.round(v));

function output(frame: Frame, quant: (Int32Array | undefined)[], adobe: number | undefined): Pixmap {
  const { width, height, components, maxH, maxV } = frame;
  const planes = components.map((c) => {
    const q = quant[c.tq];
    if (q === undefined) throw new Error("JPEG quantization table missing");
    const stride = c.stride * 8;
    return {
      data: plane(c, q),
      stride,
      xs: Int32Array.from({ length: width }, (_, x) => Math.min(stride - 1, ((x * c.h) / maxH) | 0)),
      ys: Int32Array.from({ length: height }, (_, y) => ((y * c.v) / maxV) | 0),
    };
  });

  const ids = components.map((c) => c.id);
  const n = components.length;
  // Three components are RGB when an Adobe marker says so (transform 0) or,
  // without one, when they are named R, G, B; YCbCr otherwise. Four are
  // Adobe's inverted CMYK, as YCCK under transform 2.
  const rgb = n === 3 && (adobe === 0 || (adobe === undefined && ids.join() === "82,71,66"));
  const ycc = (n === 3 && !rgb) || (n === 4 && adobe === 2);
  const inverted = n === 4 && adobe !== undefined;

  const rgba = new Uint8Array(width * height * 4);
  const [p0, p1, p2, p3] = planes;
  for (let y = 0; y < height; y++) {
    const r0 = p0!.ys[y]! * p0!.stride;
    const r1 = p1 ? p1.ys[y]! * p1.stride : 0;
    const r2 = p2 ? p2.ys[y]! * p2.stride : 0;
    const r3 = p3 ? p3.ys[y]! * p3.stride : 0;
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const a = p0!.data[r0 + p0!.xs[x]!]!;
      if (n === 1) {
        rgba[o] = rgba[o + 1] = rgba[o + 2] = a;
        rgba[o + 3] = 255;
        continue;
      }
      const b = p1!.data[r1 + p1!.xs[x]!]!;
      const c = p2!.data[r2 + p2!.xs[x]!]!;
      let r = a, g = b, bl = c;
      if (ycc) {
        r = clamp(a + 1.402 * (c - 128));
        g = clamp(a - 0.344136 * (b - 128) - 0.714136 * (c - 128));
        bl = clamp(a + 1.772 * (b - 128));
      }
      if (n === 4) {
        const k = p3!.data[r3 + p3!.xs[x]!]!;
        // Ink to light: inverted values multiply straight; YCCK's colour
        // channels come out as ink, so they are flipped first.
        const [cc, mm, yy] = ycc ? [255 - r, 255 - g, 255 - bl] : [r, g, bl];
        if (inverted) {
          r = Math.round((cc * k) / 255);
          g = Math.round((mm * k) / 255);
          bl = Math.round((yy * k) / 255);
        } else {
          r = Math.round(((255 - cc) * (255 - k)) / 255);
          g = Math.round(((255 - mm) * (255 - k)) / 255);
          bl = Math.round(((255 - yy) * (255 - k)) / 255);
        }
      }
      rgba[o] = r;
      rgba[o + 1] = g;
      rgba[o + 2] = bl;
      rgba[o + 3] = 255;
    }
  }

  return { width, height, rgba };
}
