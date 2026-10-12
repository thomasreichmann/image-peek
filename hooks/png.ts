// PNG decoding: every colour type and bit depth, tRNS, all five filters and
// Adam7 interlacing, to 8-bit RGBA. Gamma and colour profiles are ignored (the
// picture is drawn as sRGB). CRCs are not checked.

import { inflate } from "./inflate";
import type { Pixmap } from "./pixels";

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

type Pass = readonly [x0: number, y0: number, dx: number, dy: number];

/** Adam7: x start, y start, x step, y step of each pass. */
const ADAM7: readonly Pass[] = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
];
const WHOLE: readonly Pass[] = [[0, 0, 1, 1]];

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const DEPTHS: Record<number, number[]> = {
  0: [1, 2, 4, 8, 16],
  2: [8, 16],
  3: [1, 2, 4, 8],
  4: [8, 16],
  6: [8, 16],
};

export function isPng(bytes: Uint8Array): boolean {
  return SIGNATURE.every((b, i) => bytes[i] === b);
}

const u32 = (b: Uint8Array, i: number) =>
  ((b[i]! << 24) | (b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!) >>> 0;

/** Decodes a PNG; `maxPixels` refuses anything bigger before inflating. */
export function decodePng(bytes: Uint8Array, maxPixels: number): Pixmap {
  if (!isPng(bytes)) throw new Error("not a PNG");

  let width = 0, height = 0, depth = 0, colorType = 0, interlace = 0;
  let palette: Uint8Array | undefined;
  let trns: Uint8Array | undefined;
  const idat: Uint8Array[] = [];
  let idatLength = 0;

  for (let pos = 8; pos + 8 <= bytes.length; ) {
    const length = u32(bytes, pos);
    const type = String.fromCharCode(bytes[pos + 4]!, bytes[pos + 5]!, bytes[pos + 6]!, bytes[pos + 7]!);
    const body = bytes.subarray(pos + 8, pos + 8 + length);
    if (body.length !== length) throw new Error("PNG ends inside a chunk");
    pos += 12 + length;

    if (type === "IHDR") {
      width = u32(body, 0);
      height = u32(body, 4);
      depth = body[8]!;
      colorType = body[9]!;
      interlace = body[12]!;
      if (body[10] !== 0 || body[11] !== 0 || interlace > 1) throw new Error("unknown PNG method");
    } else if (type === "PLTE") {
      palette = body;
    } else if (type === "tRNS") {
      trns = body;
    } else if (type === "IDAT") {
      idat.push(body);
      idatLength += body.length;
    } else if (type === "IEND") {
      break;
    }
  }

  const channels = CHANNELS[colorType];
  if (channels === undefined || !DEPTHS[colorType]!.includes(depth)) {
    throw new Error(`PNG colour type ${colorType} at depth ${depth}`);
  }
  if (!(width > 0 && height > 0)) throw new Error("PNG has no size");
  if (width * height > maxPixels) throw new Error(`${width}×${height} is too large to preview`);
  if (colorType === 3 && palette === undefined) throw new Error("PNG palette missing");
  if (idat.length === 0) throw new Error("PNG has no image data");

  const compressed = new Uint8Array(idatLength);
  for (let i = 0, o = 0; i < idat.length; o += idat[i]!.length, i++) compressed.set(idat[i]!, o);

  const bitsPerPixel = channels * depth;
  const bpp = Math.max(1, bitsPerPixel >> 3);
  const passes = interlace ? ADAM7 : WHOLE;
  const sizes = passes.map(([x0, y0, dx, dy]) => {
    const w = width > x0 ? Math.ceil((width - x0) / dx) : 0;
    const h = height > y0 ? Math.ceil((height - y0) / dy) : 0;
    return { w, h, rowBytes: Math.ceil((w * bitsPerPixel) / 8) };
  });
  const total = sizes.reduce((sum, s) => sum + (s.w && s.h ? s.h * (1 + s.rowBytes) : 0), 0);
  const raw = inflate(compressed, total);

  const rgba = new Uint8Array(width * height * 4);
  const toRgba = converter(colorType, depth, palette, trns);
  let at = 0;
  passes.forEach(([x0, y0, dx, dy], p) => {
    const { w, h, rowBytes } = sizes[p]!;
    if (w === 0 || h === 0) return;
    const row = new Uint8Array(w * 4);
    let prev: Uint8Array | undefined;
    for (let y = 0; y < h; y++) {
      const filter = raw[at]!;
      const line = raw.subarray(at + 1, at + 1 + rowBytes);
      at += 1 + rowBytes;
      unfilter(filter, line, prev, bpp);
      prev = line;
      toRgba(line, w, row);
      const oy = y0 + y * dy;
      if (dx === 1) {
        rgba.set(row, oy * width * 4);
      } else {
        for (let x = 0; x < w; x++) {
          const o = (oy * width + x0 + x * dx) * 4;
          rgba[o] = row[x * 4]!;
          rgba[o + 1] = row[x * 4 + 1]!;
          rgba[o + 2] = row[x * 4 + 2]!;
          rgba[o + 3] = row[x * 4 + 3]!;
        }
      }
    }
  });

  return { width, height, rgba };
}

function unfilter(filter: number, line: Uint8Array, prev: Uint8Array | undefined, bpp: number) {
  const n = line.length;
  switch (filter) {
    case 0:
      return;
    case 1:
      for (let i = bpp; i < n; i++) line[i] = (line[i]! + line[i - bpp]!) & 255;
      return;
    case 2:
      if (prev) for (let i = 0; i < n; i++) line[i] = (line[i]! + prev[i]!) & 255;
      return;
    case 3:
      for (let i = 0; i < n; i++) {
        const left = i >= bpp ? line[i - bpp]! : 0;
        const up = prev ? prev[i]! : 0;
        line[i] = (line[i]! + ((left + up) >> 1)) & 255;
      }
      return;
    case 4:
      for (let i = 0; i < n; i++) {
        const a = i >= bpp ? line[i - bpp]! : 0;
        const b = prev ? prev[i]! : 0;
        const c = i >= bpp && prev ? prev[i - bpp]! : 0;
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        line[i] = (line[i]! + pred) & 255;
      }
      return;
    default:
      throw new Error(`unknown PNG filter ${filter}`);
  }
}

/** A function that writes `w` pixels of an unfiltered line as RGBA. */
function converter(
  colorType: number,
  depth: number,
  palette: Uint8Array | undefined,
  trns: Uint8Array | undefined,
): (line: Uint8Array, w: number, out: Uint8Array) => void {
  // A sample of `depth` bits: index i of the line's samples.
  const sample =
    depth === 8
      ? (line: Uint8Array, i: number) => line[i]!
      : depth === 16
        ? (line: Uint8Array, i: number) => (line[i * 2]! << 8) | line[i * 2 + 1]!
        : (line: Uint8Array, i: number) => {
            const bit = i * depth;
            return (line[bit >> 3]! >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
          };
  const max = (1 << depth) - 1;
  const to8 = (v: number) => (depth === 16 ? v >> 8 : depth === 8 ? v : Math.round((v * 255) / max));
  const key = (i: number) => (trns && trns.length >= i * 2 + 2 ? (trns[i * 2]! << 8) | trns[i * 2 + 1]! : -1);

  switch (colorType) {
    case 0: {
      const clear = key(0);
      return (line, w, out) => {
        for (let x = 0; x < w; x++) {
          const v = sample(line, x);
          const g = to8(v);
          out[x * 4] = out[x * 4 + 1] = out[x * 4 + 2] = g;
          out[x * 4 + 3] = v === clear ? 0 : 255;
        }
      };
    }
    case 2: {
      const [kr, kg, kb] = [key(0), key(1), key(2)];
      return (line, w, out) => {
        for (let x = 0; x < w; x++) {
          const r = sample(line, x * 3), g = sample(line, x * 3 + 1), b = sample(line, x * 3 + 2);
          out[x * 4] = to8(r);
          out[x * 4 + 1] = to8(g);
          out[x * 4 + 2] = to8(b);
          out[x * 4 + 3] = r === kr && g === kg && b === kb ? 0 : 255;
        }
      };
    }
    case 3: {
      const pal = palette!;
      const entries = Math.floor(pal.length / 3);
      return (line, w, out) => {
        for (let x = 0; x < w; x++) {
          const i = sample(line, x);
          if (i < entries) {
            out[x * 4] = pal[i * 3]!;
            out[x * 4 + 1] = pal[i * 3 + 1]!;
            out[x * 4 + 2] = pal[i * 3 + 2]!;
          } else {
            out[x * 4] = out[x * 4 + 1] = out[x * 4 + 2] = 0;
          }
          out[x * 4 + 3] = trns && i < trns.length ? trns[i]! : 255;
        }
      };
    }
    case 4:
      return (line, w, out) => {
        for (let x = 0; x < w; x++) {
          const g = to8(sample(line, x * 2));
          out[x * 4] = out[x * 4 + 1] = out[x * 4 + 2] = g;
          out[x * 4 + 3] = to8(sample(line, x * 2 + 1));
        }
      };
    default:
      return (line, w, out) => {
        for (let x = 0; x < w; x++) {
          out[x * 4] = to8(sample(line, x * 4));
          out[x * 4 + 1] = to8(sample(line, x * 4 + 1));
          out[x * 4 + 2] = to8(sample(line, x * 4 + 2));
          out[x * 4 + 3] = to8(sample(line, x * 4 + 3));
        }
      };
  }
}
