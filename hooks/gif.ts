// GIF decoding: the first frame, drawn on the logical screen with what is
// not covered transparent (as browsers show it), interlaced or not.

import type { Pixmap } from "./pixels";

export function isGif(bytes: Uint8Array): boolean {
  const head = String.fromCharCode(...bytes.subarray(0, 6));
  return head === "GIF87a" || head === "GIF89a";
}

const u16 = (b: Uint8Array, i: number) => b[i]! | (b[i + 1]! << 8);

/** Decodes a GIF's first frame; `maxPixels` refuses anything bigger. */
export function decodeGif(bytes: Uint8Array, maxPixels: number): Pixmap {
  if (!isGif(bytes)) throw new Error("not a GIF");
  const width = u16(bytes, 6);
  const height = u16(bytes, 8);
  if (!(width > 0 && height > 0)) throw new Error("GIF has no size");
  if (width * height > maxPixels) throw new Error(`${width}×${height} is too large to preview`);

  const flags = bytes[10]!;
  let pos = 13;
  let globalTable: Uint8Array | undefined;
  if (flags & 0x80) {
    const size = 3 << ((flags & 7) + 1);
    globalTable = bytes.subarray(pos, pos + size);
    pos += size;
  }

  let transparent = -1;
  while (pos < bytes.length) {
    const block = bytes[pos++]!;
    if (block === 0x21) {
      const label = bytes[pos++]!;
      if (label === 0xf9 && bytes[pos] === 4) {
        // Graphic Control Extension: its transparency flag and index.
        if (bytes[pos + 1]! & 1) transparent = bytes[pos + 4]!;
      }
      pos = skipBlocks(bytes, pos);
    } else if (block === 0x2c) {
      return frame(bytes, pos, width, height, globalTable, transparent);
    } else if (block === 0x3b) {
      break;
    } else {
      throw new Error("unknown GIF block");
    }
  }
  throw new Error("GIF has no frame");
}

function skipBlocks(bytes: Uint8Array, pos: number): number {
  while (pos < bytes.length) {
    const size = bytes[pos++]!;
    if (size === 0) return pos;
    pos += size;
  }

  return pos;
}

function frame(
  bytes: Uint8Array,
  pos: number,
  width: number,
  height: number,
  globalTable: Uint8Array | undefined,
  transparent: number,
): Pixmap {
  const left = u16(bytes, pos);
  const top = u16(bytes, pos + 2);
  const w = u16(bytes, pos + 4);
  const h = u16(bytes, pos + 6);
  const flags = bytes[pos + 8]!;
  pos += 9;
  let colors = globalTable;
  if (flags & 0x80) {
    const size = 3 << ((flags & 7) + 1);
    colors = bytes.subarray(pos, pos + size);
    pos += size;
  }
  if (colors === undefined) throw new Error("GIF has no colour table");

  const minCodeSize = bytes[pos++]!;
  if (minCodeSize < 2 || minCodeSize > 11) throw new Error("bad GIF code size");
  // The image data's sub-blocks, joined.
  const parts: Uint8Array[] = [];
  let length = 0;
  while (pos < bytes.length) {
    const size = bytes[pos++]!;
    if (size === 0) break;
    const part = bytes.subarray(pos, pos + size);
    parts.push(part);
    length += part.length;
    pos += size;
  }
  const data = new Uint8Array(length);
  for (let i = 0, o = 0; i < parts.length; o += parts[i]!.length, i++) data.set(parts[i]!, o);

  const indices = lzw(data, minCodeSize, w * h);
  const rows = flags & 0x40 ? interlacedRows(h) : Array.from({ length: h }, (_, y) => y);
  const rgba = new Uint8Array(width * height * 4);
  const entries = Math.floor(colors.length / 3);
  for (let r = 0; r < h; r++) {
    const y = top + rows[r]!;
    if (y >= height) continue;
    for (let x = 0; x < w; x++) {
      const ox = left + x;
      if (ox >= width) continue;
      const i = indices[r * w + x]!;
      if (i === transparent || i >= entries) continue;
      const o = (y * width + ox) * 4;
      rgba[o] = colors[i * 3]!;
      rgba[o + 1] = colors[i * 3 + 1]!;
      rgba[o + 2] = colors[i * 3 + 2]!;
      rgba[o + 3] = 255;
    }
  }

  return { width, height, rgba };
}

/** The image row each stored row is, for an interlaced frame `h` rows tall. */
function interlacedRows(h: number): number[] {
  const rows: number[] = [];
  for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]] as const) {
    for (let y = start; y < h; y += step) rows.push(y);
  }

  return rows;
}

/** LZW codes to `count` colour indices; a short stream leaves zeros. */
function lzw(data: Uint8Array, minCodeSize: number, count: number): Uint8Array {
  const out = new Uint8Array(count);
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  const prefix = new Int16Array(4096);
  const suffix = new Uint8Array(4096);
  const first = new Uint8Array(4096);
  const length = new Uint16Array(4096);
  for (let i = 0; i < clear; i++) {
    suffix[i] = i;
    first[i] = i;
    length[i] = 1;
  }

  let size = minCodeSize + 1;
  let next = eoi + 1;
  let prev = -1;
  let o = 0;
  let buf = 0;
  let cnt = 0;
  let pos = 0;
  while (o < count) {
    while (cnt < size) {
      if (pos >= data.length) return out;
      buf |= data[pos++]! << cnt;
      cnt += 8;
    }
    const code = buf & ((1 << size) - 1);
    buf >>>= size;
    cnt -= size;

    if (code === clear) {
      size = minCodeSize + 1;
      next = eoi + 1;
      prev = -1;
      continue;
    }
    if (code === eoi) break;

    if (prev >= 0) {
      // The new entry: the previous string plus the first index of this one
      // (of the previous one, for the code being defined right now).
      if (code > next) throw new Error("bad GIF code");
      if (next < 4096) {
        prefix[next] = prev;
        suffix[next] = code === next ? first[prev]! : first[code]!;
        first[next] = first[prev]!;
        length[next] = length[prev]! + 1;
        next++;
        if (next === 1 << size && size < 12) size++;
      }
    } else if (code >= next) {
      throw new Error("bad GIF code");
    }

    // Write the string of `code`, back to front.
    const n = length[code]!;
    let at = o + n - 1;
    for (let c = code; c >= 0 && at >= o; c = prefix[c]!, at--) {
      if (at < count) out[at] = suffix[c]!;
      if (length[c] === 1) break;
    }
    o += n;
    prev = code;
  }

  return out;
}
