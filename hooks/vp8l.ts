// WebP lossless (VP8L, RFC 9649) decoding, to ARGB words. Also decodes the
// headerless image stream a lossy WebP's alpha chunk carries. Follows
// libwebp's decoder (vp8l_dec.c, lossless.c), whose behaviour at the edges
// (first row and column predictors, colour-cache timing, palette tail) is
// the format's.

import { CODE_LENGTH_CODE_ORDER, CODE_TO_PLANE } from "./webp-tables";

const NUM_LITERAL = 256;
const NUM_LENGTH = 24;
/** Alphabet sizes: green (with lengths), red, blue, alpha, distance. */
const ALPHABET = [NUM_LITERAL + NUM_LENGTH, NUM_LITERAL, NUM_LITERAL, NUM_LITERAL, 40];
const COLOR_HASH = 0x1e35a7bd;

/** Bits least significant first; reads past the end are zeros. */
export class LsbBits {
  readonly data: Uint8Array;
  pos: number;
  buf = 0;
  cnt = 0;

  constructor(data: Uint8Array, pos = 0) {
    this.data = data;
    this.pos = pos;
  }

  fill() {
    const data = this.data;
    while (this.cnt <= 24) {
      this.buf |= (this.pos < data.length ? data[this.pos]! : 0) << this.cnt;
      this.pos++;
      this.cnt += 8;
    }
  }

  read(n: number): number {
    if (n === 0) return 0;
    if (this.cnt < n) this.fill();
    const v = this.buf & ((1 << n) - 1);
    this.buf >>>= n;
    this.cnt -= n;
    return v;
  }

  /** True once more bits were taken than the data holds. */
  get overrun(): boolean {
    return this.pos - (this.cnt >> 3) > this.data.length;
  }
}

/** A canonical prefix code: an 8-bit lookup for short codes, counting for long ones. */
type Code = {
  /** The symbol of a one-symbol code, which takes no bits; else -1. */
  single: number;
  /** By the next 8 bits: `(length << 16) | symbol` for codes up to 8 bits, else 0. */
  root: Int32Array;
  count: Int32Array;
  first: Int32Array;
  index: Int32Array;
  sorted: Int32Array;
};

function buildCode(lengths: Uint8Array): Code {
  const count = new Int32Array(16);
  let used = 0;
  let last = 0;
  for (let s = 0; s < lengths.length; s++) {
    if (lengths[s]) {
      count[lengths[s]!]!++;
      used++;
      last = s;
    }
  }
  if (used === 0) throw new Error("empty WebP prefix code");
  const empty = new Int32Array(0);
  if (used === 1) {
    return { single: last, root: empty, count, first: empty, index: empty, sorted: empty };
  }
  const first = new Int32Array(16);
  const index = new Int32Array(16);
  for (let len = 1, code = 0, idx = 0; len <= 15; len++) {
    first[len] = code;
    index[len] = idx;
    if (code + count[len]! > 1 << len) throw new Error("bad WebP prefix code");
    code = (code + count[len]!) << 1;
    idx += count[len]!;
  }
  const sorted = new Int32Array(used);
  const next = index.slice();
  for (let s = 0; s < lengths.length; s++) if (lengths[s]) sorted[next[lengths[s]!]!++] = s;

  const root = new Int32Array(256);
  for (let len = 1; len <= 8; len++) {
    for (let k = 0; k < count[len]!; k++) {
      let code = first[len]! + k;
      let reversed = 0;
      for (let i = 0; i < len; i++) {
        reversed = (reversed << 1) | (code & 1);
        code >>= 1;
      }
      for (let j = reversed; j < 256; j += 1 << len) root[j] = (len << 16) | sorted[index[len]! + k]!;
    }
  }

  return { single: -1, root, count, first, index, sorted };
}

function readSymbol(code: Code, br: LsbBits): number {
  if (code.single >= 0) return code.single;
  if (br.cnt < 15) br.fill();
  const e = code.root[br.buf & 255]!;
  if (e) {
    const len = e >>> 16;
    br.buf >>>= len;
    br.cnt -= len;
    return e & 0xffff;
  }
  // Longer than 8 bits: the code read most significant bit first.
  let c = 0;
  for (let i = 0; i < 8; i++) c = (c << 1) | ((br.buf >>> i) & 1);
  for (let len = 9; len <= 15; len++) {
    c = (c << 1) | ((br.buf >>> (len - 1)) & 1);
    const off = c - code.first[len]!;
    if (off >= 0 && off < code.count[len]!) {
      br.buf >>>= len;
      br.cnt -= len;
      return code.sorted[code.index[len]! + off]!;
    }
  }
  throw new Error("bad WebP prefix code");
}

/** One prefix code from the stream (simple or normal form). */
function readCode(br: LsbBits, alphabet: number): Code {
  const lengths = new Uint8Array(alphabet);
  if (br.read(1)) {
    // Simple: one or two symbols, each one bit long.
    const two = br.read(1);
    const s0 = br.read(br.read(1) ? 8 : 1);
    if (s0 >= alphabet) throw new Error("bad WebP prefix code");
    lengths[s0] = 1;
    if (two) {
      const s1 = br.read(8);
      if (s1 >= alphabet) throw new Error("bad WebP prefix code");
      lengths[s1] = 1;
    }
  } else {
    const clLengths = new Uint8Array(19);
    const n = br.read(4) + 4;
    for (let i = 0; i < n; i++) clLengths[CODE_LENGTH_CODE_ORDER[i]!] = br.read(3);
    const cl = buildCode(clLengths);
    let max = alphabet;
    if (br.read(1)) {
      max = 2 + br.read(2 + 2 * br.read(3));
      if (max > alphabet) throw new Error("bad WebP code lengths");
    }
    let prev = 8;
    for (let s = 0; s < alphabet; ) {
      if (max-- === 0) break;
      const len = readSymbol(cl, br);
      if (len < 16) {
        lengths[s++] = len;
        if (len !== 0) prev = len;
        continue;
      }
      const repeat = len === 16 ? 3 + br.read(2) : len === 17 ? 3 + br.read(3) : 11 + br.read(7);
      if (s + repeat > alphabet) throw new Error("bad WebP code lengths");
      lengths.fill(len === 16 ? prev : 0, s, s + repeat);
      s += repeat;
    }
  }
  if (br.overrun) throw new Error("WebP data ends early");

  return buildCode(lengths);
}

const subSample = (size: number, bits: number) => (size + (1 << bits) - 1) >> bits;

/** Length and distance values: a prefix symbol plus extra bits. */
function prefixValue(symbol: number, br: LsbBits): number {
  if (symbol < 4) return symbol + 1;
  const extra = (symbol - 2) >> 1;
  return ((2 + (symbol & 1)) << extra) + br.read(extra) + 1;
}

function planeToDistance(width: number, code: number): number {
  if (code > 120) return code - 120;
  const d = CODE_TO_PLANE[code - 1]!;
  const dist = (d >> 4) * width + (8 - (d & 15));

  return dist >= 1 ? dist : 1;
}

type Transform = { type: number; bits: number; xsize: number; data: Uint32Array };

/**
 * An entropy-coded image of `width × height` pixels (`level0`: the main
 * image, with transforms and meta prefix codes). Returns its pixels, still
 * transformed, and the transforms to undo, in reading order.
 */
function imageStream(
  br: LsbBits,
  xsize: number,
  ysize: number,
  level0: boolean,
  maxPixels: number,
): { pixels: Uint32Array; transforms: Transform[] } {
  const transforms: Transform[] = [];
  let width = xsize;
  if (level0) {
    let seen = 0;
    while (br.read(1)) {
      const type = br.read(2);
      if (seen & (1 << type)) throw new Error("repeated WebP transform");
      seen |= 1 << type;
      if (type === 0 || type === 1) {
        const bits = br.read(3) + 2;
        const data = imageStream(br, subSample(width, bits), subSample(ysize, bits), false, maxPixels).pixels;
        transforms.push({ type, bits, xsize: width, data });
      } else if (type === 3) {
        const colors = br.read(8) + 1;
        const bits = colors > 16 ? 0 : colors > 4 ? 1 : colors > 2 ? 2 : 3;
        const table = imageStream(br, colors, 1, false, maxPixels).pixels;
        // Delta-coded per channel; the rest of the 2^(8 >> bits) entries are zero.
        const map = new Uint32Array(1 << (8 >> bits));
        let prev = 0;
        for (let i = 0; i < colors && i < map.length; i++) {
          prev = addPixels(table[i]!, prev);
          map[i] = prev;
        }
        transforms.push({ type, bits, xsize: width, data: map });
        width = subSample(width, bits);
      } else {
        transforms.push({ type, bits: 0, xsize: width, data: new Uint32Array(0) });
      }
    }
  }

  let cacheBits = 0;
  if (br.read(1)) {
    cacheBits = br.read(4);
    if (cacheBits < 1 || cacheBits > 11) throw new Error("bad WebP colour cache");
  }

  // Meta prefix codes: which group of codes each tile uses.
  let metaBits = 0;
  let metaWidth = 0;
  let meta: Uint32Array | undefined;
  let groupCount = 1;
  if (level0 && br.read(1)) {
    metaBits = br.read(3) + 2;
    metaWidth = subSample(width, metaBits);
    meta = imageStream(br, metaWidth, subSample(ysize, metaBits), false, maxPixels).pixels;
    for (let i = 0; i < meta.length; i++) {
      meta[i] = (meta[i]! >> 8) & 0xffff;
      if (meta[i]! >= groupCount) groupCount = meta[i]! + 1;
    }
  }
  const used = new Uint8Array(groupCount);
  if (meta) for (const g of meta) used[g] = 1;
  else used[0] = 1;
  const groups: Code[][] = new Array(groupCount);
  for (let g = 0; g < groupCount; g++) {
    const codes: Code[] = [];
    for (let j = 0; j < 5; j++) {
      codes.push(readCode(br, ALPHABET[j]! + (j === 0 && cacheBits ? 1 << cacheBits : 0)));
    }
    if (used[g]) groups[g] = codes;
  }

  if (width * ysize > maxPixels) throw new Error("WebP image too large");
  const pixels = imageData(br, width, ysize, groups, meta, metaBits, metaWidth, cacheBits);

  return { pixels, transforms };
}

function imageData(
  br: LsbBits,
  width: number,
  height: number,
  groups: Code[][],
  meta: Uint32Array | undefined,
  metaBits: number,
  metaWidth: number,
  cacheBits: number,
): Uint32Array {
  const total = width * height;
  const out = new Uint32Array(total);
  const cache = cacheBits ? new Uint32Array(1 << cacheBits) : undefined;
  const shift = 32 - cacheBits;
  const mask = metaBits ? (1 << metaBits) - 1 : -1;
  const groupAt = (x: number, y: number) =>
    meta ? groups[meta[(y >> metaBits) * metaWidth + (x >> metaBits)]!]! : groups[0]!;

  let x = 0;
  let y = 0;
  let pos = 0;
  let cached = 0;
  let group = groupAt(0, 0);
  while (pos < total) {
    if ((x & mask) === 0) group = groupAt(x, y);
    const green = readSymbol(group[0]!, br);
    if (green < NUM_LITERAL) {
      const red = readSymbol(group[1]!, br);
      const blue = readSymbol(group[2]!, br);
      const alpha = readSymbol(group[3]!, br);
      out[pos++] = ((alpha << 24) | (red << 16) | (green << 8) | blue) >>> 0;
      if (++x >= width) {
        x = 0;
        y++;
      }
    } else if (green < NUM_LITERAL + NUM_LENGTH) {
      const length = prefixValue(green - NUM_LITERAL, br);
      const dist = planeToDistance(width, prefixValue(readSymbol(group[4]!, br), br));
      if (dist > pos || length > total - pos) throw new Error("bad WebP back-reference");
      for (let k = 0; k < length; k++) out[pos + k] = out[pos + k - dist]!;
      pos += length;
      x += length;
      while (x >= width) {
        x -= width;
        y++;
      }
      if (x & mask && pos < total) group = groupAt(x, y);
    } else {
      if (cache === undefined) throw new Error("bad WebP colour cache code");
      while (cached < pos) {
        const v = out[cached++]!;
        cache[Math.imul(v, COLOR_HASH) >>> shift] = v;
      }
      const key = green - NUM_LITERAL - NUM_LENGTH;
      if (key >= cache.length) throw new Error("bad WebP colour cache code");
      out[pos++] = cache[key]!;
      if (++x >= width) {
        x = 0;
        y++;
      }
    }
    if (br.overrun) throw new Error("WebP data ends early");
  }

  return out;
}

/** Per-channel sum mod 256 of two ARGB words. */
function addPixels(a: number, b: number): number {
  const ag = ((a & 0xff00ff00) + (b & 0xff00ff00)) & 0xff00ff00;
  const rb = ((a & 0x00ff00ff) + (b & 0x00ff00ff)) & 0x00ff00ff;

  return (ag | rb) >>> 0;
}

const average2 = (a: number, b: number) => ((((a ^ b) & 0xfefefefe) >>> 1) + ((a & b) >>> 0)) >>> 0;

const clip255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

function select(t: number, l: number, tl: number): number {
  let d = 0;
  for (let s = 0; s < 32; s += 8) {
    const a = (t >>> s) & 255, b = (l >>> s) & 255, c = (tl >>> s) & 255;
    d += Math.abs(b - c) - Math.abs(a - c);
  }

  return d <= 0 ? t : l;
}

function addSubtractFull(l: number, t: number, tl: number): number {
  let out = 0;
  for (let s = 0; s < 32; s += 8) {
    out |= clip255(((l >>> s) & 255) + ((t >>> s) & 255) - ((tl >>> s) & 255)) << s;
  }

  return out >>> 0;
}

function addSubtractHalf(l: number, t: number, tl: number): number {
  const ave = average2(l, t);
  let out = 0;
  for (let s = 0; s < 32; s += 8) {
    const a = (ave >>> s) & 255;
    out |= clip255(a + Math.trunc((a - ((tl >>> s) & 255)) / 2)) << s;
  }

  return out >>> 0;
}

function predict(mode: number, px: Uint32Array, i: number, w: number): number {
  const L = px[i - 1]!, T = px[i - w]!, TR = px[i - w + 1]!, TL = px[i - w - 1]!;
  switch (mode) {
    case 0:
      return 0xff000000;
    case 1:
      return L;
    case 2:
      return T;
    case 3:
      return TR;
    case 4:
      return TL;
    case 5:
      return average2(average2(L, TR), T);
    case 6:
      return average2(L, TL);
    case 7:
      return average2(L, T);
    case 8:
      return average2(TL, T);
    case 9:
      return average2(T, TR);
    case 10:
      return average2(average2(L, TL), average2(T, TR));
    case 11:
      return select(T, L, TL);
    case 12:
      return addSubtractFull(L, T, TL);
    case 13:
      return addSubtractHalf(L, T, TL);
    default:
      return 0xff000000; // 14 and 15 are unused; libwebp predicts black
  }
}

/** Undoes the transforms in place where it can; returns the final pixels. */
function undo(pixels: Uint32Array, transforms: Transform[], height: number): Uint32Array {
  let px = pixels;
  for (let t = transforms.length - 1; t >= 0; t--) {
    const { type, bits, xsize: w, data } = transforms[t]!;
    if (type === 0) {
      px[0] = addPixels(px[0]!, 0xff000000);
      for (let x = 1; x < w; x++) px[x] = addPixels(px[x]!, px[x - 1]!);
      const tiles = subSample(w, bits);
      for (let y = 1; y < height; y++) {
        const row = y * w;
        px[row] = addPixels(px[row]!, px[row - w]!);
        const modes = (y >> bits) * tiles;
        for (let x = 1; x < w; x++) {
          const mode = (data[modes + (x >> bits)]! >> 8) & 15;
          px[row + x] = addPixels(px[row + x]!, predict(mode, px, row + x, w));
        }
      }
    } else if (type === 1) {
      const tiles = subSample(w, bits);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < w; x++) {
          const code = data[(y >> bits) * tiles + (x >> bits)]!;
          const g2r = (code << 24) >> 24, g2b = (code << 16) >> 24, r2b = (code << 8) >> 24;
          const i = y * w + x;
          const argb = px[i]!;
          const green = (argb << 16) >> 24;
          const red = (((argb >>> 16) & 255) + ((g2r * green) >> 5)) & 255;
          let blue = (argb & 255) + ((g2b * green) >> 5);
          blue = (blue + ((r2b * ((red << 24) >> 24)) >> 5)) & 255;
          px[i] = ((argb & 0xff00ff00) | (red << 16) | blue) >>> 0;
        }
      }
    } else if (type === 2) {
      for (let i = 0; i < px.length; i++) {
        const argb = px[i]!;
        const green = (argb >>> 8) & 255;
        const rb = ((argb & 0x00ff00ff) + ((green << 16) | green)) & 0x00ff00ff;
        px[i] = ((argb & 0xff00ff00) | rb) >>> 0;
      }
    } else {
      const packed = subSample(w, bits);
      const out = new Uint32Array(w * height);
      const per = 8 >> bits;
      const countMask = (1 << bits) - 1;
      const bitMask = (1 << per) - 1;
      for (let y = 0; y < height; y++) {
        let src = y * packed;
        let word = 0;
        for (let x = 0; x < w; x++) {
          if ((x & countMask) === 0) word = (px[src++]! >> 8) & 255;
          out[y * w + x] = data[word & bitMask]!;
          word >>= per;
        }
      }
      px = out;
    }
  }

  return px;
}

/** A complete VP8L bitstream (the `VP8L` chunk's payload) to ARGB words. */
export function decodeVp8l(
  data: Uint8Array,
  maxPixels: number,
): { width: number; height: number; argb: Uint32Array } {
  if (data[0] !== 0x2f) throw new Error("not a WebP lossless stream");
  const br = new LsbBits(data, 1);
  const width = br.read(14) + 1;
  const height = br.read(14) + 1;
  br.read(1); // alpha_is_used: a hint only
  if (br.read(3) !== 0) throw new Error("unknown WebP lossless version");
  if (width * height > maxPixels) throw new Error(`${width}×${height} is too large to preview`);
  const { pixels, transforms } = imageStream(br, width, height, true, maxPixels);

  return { width, height, argb: undo(pixels, transforms, height) };
}

/** A headerless VP8L image stream of known size (an ALPH chunk's lossless alpha). */
export function decodeVp8lStream(data: Uint8Array, width: number, height: number, maxPixels: number): Uint32Array {
  const br = new LsbBits(data, 0);
  const { pixels, transforms } = imageStream(br, width, height, true, maxPixels);

  return undo(pixels, transforms, height);
}
