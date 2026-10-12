// Pure picture logic: finding images in a tool's output, fitting and
// resampling a picture, and packing it into half-block Raster cells.

// The runtime has these (ES2026); TypeScript 5's lib does not declare them yet.
declare global {
  interface Uint8Array {
    toBase64(): string;
  }
  interface Uint8ArrayConstructor {
    fromBase64(text: string): Uint8Array;
  }
}

export type Found = {
  base64: string;
  mediaType?: string;
  /** Size of the file the tool read, in bytes (Read only). */
  bytes?: number;
  /** The picture's own size before any resize for the model (Read only). */
  width?: number;
  height?: number;
};

export type Pixmap = { width: number; height: number; rgba: Uint8Array };

const MAX_DEPTH = 6;

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v !== "" ? v : undefined;

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

function one(o: Obj): Found | undefined {
  // Read: { type: "image", file: { base64, type, originalSize, dimensions } }
  if (o.type === "image" && isObj(o.file)) {
    const base64 = str(o.file.base64);
    if (base64 === undefined) return undefined;
    const dims = isObj(o.file.dimensions) ? o.file.dimensions : {};

    return {
      base64,
      mediaType: str(o.file.type),
      bytes: num(o.file.originalSize),
      width: num(dims.originalWidth) ?? num(dims.displayWidth),
      height: num(dims.originalHeight) ?? num(dims.displayHeight),
    };
  }
  // Messages API block: { type: "image", source: { type: "base64", data, media_type } }
  if (o.type === "image" && isObj(o.source)) {
    const base64 = str(o.source.data);

    return base64 === undefined
      ? undefined
      : { base64, mediaType: str(o.source.media_type) };
  }
  // MCP content block: { type: "image", data, mimeType }
  if (o.type === "image") {
    const base64 = str(o.data);

    return base64 === undefined
      ? undefined
      : { base64, mediaType: str(o.mimeType) };
  }
  // Read's PDF page images: { base64, mediaType }
  const mediaType = str(o.mediaType);
  const base64 = str(o.base64);
  if (base64 !== undefined && mediaType?.startsWith("image/")) {
    return { base64, mediaType };
  }

  return undefined;
}

/** Every base64 image in a tool's output, in order. */
export function findImages(output: unknown, depth = 0): Found[] {
  if (depth > MAX_DEPTH) return [];
  if (Array.isArray(output)) {
    return output.flatMap((item) => findImages(item, depth + 1));
  }
  if (!isObj(output)) return [];

  const found = one(output);
  if (found !== undefined) return [found];

  return Object.values(output).flatMap((v) => findImages(v, depth + 1));
}

/**
 * The cell box a picture is drawn in: as wide as allowed, never wider than
 * its pixels, aspect kept with a cell `aspect` times as tall as wide.
 */
export function fit(
  img: { width: number; height: number },
  maxColumns: number,
  maxRows: number,
  aspect = 2,
): { columns: number; rows: number } {
  const maxC = Math.max(1, Math.floor(maxColumns));
  const maxR = Math.max(1, Math.floor(maxRows));
  let columns = Math.min(maxC, img.width);
  let rows = Math.ceil((columns * img.height) / img.width / aspect);
  if (rows > maxR) {
    rows = maxR;
    columns = Math.min(maxC, Math.max(1, Math.ceil((rows * aspect * img.width) / img.height)));
  }

  return { columns, rows: Math.max(1, rows) };
}

/** Box-filter downscale (area average, alpha-weighted colour). */
export function resample(img: Pixmap, width: number, height: number): Pixmap {
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor((y * img.height) / height);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * img.height) / height));
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor((x * img.width) / width);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * img.width) / width));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = y0; sy < y1 && sy < img.height; sy++) {
        for (let sx = x0; sx < x1 && sx < img.width; sx++) {
          const i = (sy * img.width + sx) * 4;
          const alpha = img.rgba[i + 3]!;
          r += img.rgba[i]! * alpha;
          g += img.rgba[i + 1]! * alpha;
          b += img.rgba[i + 2]! * alpha;
          a += alpha;
          n++;
        }
      }
      const o = (y * width + x) * 4;
      if (a > 0) {
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
      }
      out[o + 3] = n > 0 ? Math.round(a / n) : 0;
    }
  }

  return { width, height, rgba: out };
}

const UPPER = 0x2580; // ▀
const LOWER = 0x2584; // ▄
const SPACE = 0x20;
const DEFAULT = 0x01000000; // the terminal's own colour
const OPAQUE = 128;

/**
 * Raster cells for a picture: one half block per cell, the top pixel as its
 * foreground and the bottom as its background; transparent pixels show the
 * terminal's own background.
 */
export function cells(img: Pixmap, columns: number, rows: number): string {
  const px = resample(img, columns, rows * 2);
  const words = new Uint32Array(columns * rows * 3);
  const colour = (i: number) =>
    (px.rgba[i]! << 16) | (px.rgba[i + 1]! << 8) | px.rgba[i + 2]!;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const top = ((row * 2) * columns + col) * 4;
      const bottom = ((row * 2 + 1) * columns + col) * 4;
      const hasTop = px.rgba[top + 3]! >= OPAQUE;
      const hasBottom = px.rgba[bottom + 3]! >= OPAQUE;
      const w = (row * columns + col) * 3;
      if (hasTop) {
        words[w] = UPPER;
        words[w + 1] = colour(top);
        words[w + 2] = hasBottom ? colour(bottom) : DEFAULT;
      } else if (hasBottom) {
        words[w] = LOWER;
        words[w + 1] = colour(bottom);
        words[w + 2] = DEFAULT;
      } else {
        words[w] = SPACE;
        words[w + 1] = DEFAULT;
        words[w + 2] = DEFAULT;
      }
    }
  }

  return new Uint8Array(words.buffer).toBase64();
}

/** `Read image (28.2KB) · 640×360`, as much of it as is known. */
export function caption(found: Found): string {
  const parts: string[] = [];
  parts.push(
    found.bytes === undefined
      ? "Image"
      : `Read image (${(found.bytes / 1024).toFixed(1)}KB)`,
  );
  if (found.width !== undefined && found.height !== undefined) {
    parts.push(`${found.width}×${found.height}`);
  }

  return parts.join(" · ");
}
