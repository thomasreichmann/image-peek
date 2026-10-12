// WebP: the RIFF container, lossy (VP8) with or without an alpha chunk,
// lossless (VP8L), and an animation's first frame on a transparent canvas.

import type { Pixmap } from "./pixels";
import { decodeVp8, vp8ToRgba } from "./vp8";
import { decodeVp8l, decodeVp8lStream } from "./vp8l";

const ascii = (b: Uint8Array, at: number) => String.fromCharCode(b[at]!, b[at + 1]!, b[at + 2]!, b[at + 3]!);
const u24 = (b: Uint8Array, at: number) => b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16);
const u32 = (b: Uint8Array, at: number) => (u24(b, at) + b[at + 3]! * 0x1000000);

export function isWebp(bytes: Uint8Array): boolean {
  return bytes.length >= 12 && ascii(bytes, 0) === "RIFF" && ascii(bytes, 8) === "WEBP";
}

type Chunk = { id: string; body: Uint8Array };

function* chunks(bytes: Uint8Array, from: number, to: number): Generator<Chunk> {
  for (let pos = from; pos + 8 <= to; ) {
    const size = u32(bytes, pos + 4);
    const body = bytes.subarray(pos + 8, Math.min(to, pos + 8 + size));
    yield { id: ascii(bytes, pos), body };
    pos += 8 + size + (size & 1);
  }
}

/** Decodes a WebP's first image; `maxPixels` refuses anything bigger. */
export function decodeWebp(bytes: Uint8Array, maxPixels: number): Pixmap {
  if (!isWebp(bytes)) throw new Error("not a WebP");
  const end = Math.min(bytes.length, 8 + u32(bytes, 4));
  let alpha: Uint8Array | undefined;
  for (const { id, body } of chunks(bytes, 12, end)) {
    if (id === "ALPH") {
      alpha = body;
    } else if (id === "VP8 " || id === "VP8L") {
      return frame(id, body, alpha, maxPixels);
    } else if (id === "ANMF") {
      return firstFrame(body, maxPixels, bytes);
    }
  }
  throw new Error("WebP has no image");
}

function frame(id: string, body: Uint8Array, alpha: Uint8Array | undefined, maxPixels: number): Pixmap {
  if (id === "VP8L") {
    const { width, height, argb } = decodeVp8l(body, maxPixels);
    const rgba = new Uint8Array(width * height * 4);
    for (let i = 0; i < argb.length; i++) {
      const v = argb[i]!;
      rgba[i * 4] = (v >>> 16) & 255;
      rgba[i * 4 + 1] = (v >>> 8) & 255;
      rgba[i * 4 + 2] = v & 255;
      rgba[i * 4 + 3] = v >>> 24;
    }
    return { width, height, rgba };
  }
  const f = decodeVp8(body, maxPixels);
  const rgba = vp8ToRgba(f);
  if (alpha !== undefined) {
    const a = decodeAlpha(alpha, f.width, f.height, maxPixels);
    for (let i = 0; i < a.length; i++) rgba[i * 4 + 3] = a[i]!;
  }

  return { width: f.width, height: f.height, rgba };
}

/** An ALPH chunk: header byte, then raw or VP8L-coded alpha, then unfiltered. */
function decodeAlpha(chunk: Uint8Array, width: number, height: number, maxPixels: number): Uint8Array {
  if (chunk.length < 2) throw new Error("bad WebP alpha");
  const method = chunk[0]! & 3;
  const filter = (chunk[0]! >> 2) & 3;
  if (method > 1 || chunk[0]! >> 6) throw new Error("bad WebP alpha");
  const data = chunk.subarray(1);
  const out = new Uint8Array(width * height);
  if (method === 0) {
    if (data.length < out.length) throw new Error("WebP alpha ends early");
    out.set(data.subarray(0, out.length));
  } else {
    const argb = decodeVp8lStream(data, width, height, maxPixels);
    for (let i = 0; i < out.length; i++) out[i] = (argb[i]! >>> 8) & 255;
  }
  if (filter === 0) return out;

  // libwebp's unfilters (dsp/filters.c), row by row, in place.
  for (let y = 0; y < height; y++) {
    const row = y * width;
    const prev = row - width;
    if (y === 0 || filter === 1) {
      let pred = y === 0 ? 0 : out[prev]!;
      for (let x = 0; x < width; x++) {
        out[row + x] = (out[row + x]! + pred) & 255;
        pred = out[row + x]!;
      }
    } else if (filter === 2) {
      for (let x = 0; x < width; x++) out[row + x] = (out[row + x]! + out[prev + x]!) & 255;
    } else {
      let topLeft = out[prev]!;
      let left = topLeft;
      for (let x = 0; x < width; x++) {
        const top = out[prev + x]!;
        const g = left + top - topLeft;
        left = (out[row + x]! + (g < 0 ? 0 : g > 255 ? 255 : g)) & 255;
        topLeft = top;
        out[row + x] = left;
      }
    }
  }

  return out;
}

/** An animation's first frame, placed on a transparent canvas. */
function firstFrame(anmf: Uint8Array, maxPixels: number, file: Uint8Array): Pixmap {
  // The canvas size is in the VP8X chunk, which comes first.
  const vp8x = chunks(file, 12, file.length).next().value;
  if (!vp8x || vp8x.id !== "VP8X" || vp8x.body.length < 10) throw new Error("bad animated WebP");
  const width = u24(vp8x.body, 4) + 1;
  const height = u24(vp8x.body, 7) + 1;
  if (width * height > maxPixels) throw new Error(`${width}×${height} is too large to preview`);
  const x0 = u24(anmf, 0) * 2;
  const y0 = u24(anmf, 3) * 2;

  let alpha: Uint8Array | undefined;
  let pic: Pixmap | undefined;
  for (const { id, body } of chunks(anmf, 16, anmf.length)) {
    if (id === "ALPH") alpha = body;
    else if (id === "VP8 " || id === "VP8L") {
      pic = frame(id, body, alpha, maxPixels);
      break;
    }
  }
  if (pic === undefined) throw new Error("animated WebP has no frame");

  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < pic.height && y0 + y < height; y++) {
    const w = Math.min(pic.width, width - x0);
    if (w <= 0) break;
    rgba.set(pic.rgba.subarray(y * pic.width * 4, (y * pic.width + w) * 4), ((y0 + y) * width + x0) * 4);
  }

  return { width, height, rgba };
}
