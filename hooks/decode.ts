// Picture bytes to pixels: PNG, JPEG, GIF and WebP, decoded here in plain
// code, so nothing has to be installed and no program is run. A JPEG kind the
// decoder refuses (arithmetic-coded, 12-bit, lossless) gets no preview.

import { decodeGif, isGif } from "./gif";
import { decodeJpeg, isJpeg } from "./jpeg";
import { resample } from "./pixels";
import type { Pixmap } from "./pixels";
import { decodePng, isPng } from "./png";
import { decodeWebp, isWebp } from "./webp";

/** The largest picture decoded here: 16.8 megapixels (a 12 MP photo, a 4K screen). */
export const MAX_PIXELS = 1 << 24;

export type Format = "png" | "jpeg" | "gif" | "webp" | "other";

/** The format by the file's first bytes, whatever it was called. */
export function format(bytes: Uint8Array): Format {
  if (isPng(bytes)) return "png";
  if (isJpeg(bytes)) return "jpeg";
  if (isGif(bytes)) return "gif";
  if (isWebp(bytes)) return "webp";

  return "other";
}

/** Decodes a PNG, JPEG, GIF or WebP (the first frame); throws for anything else. */
export function decode(bytes: Uint8Array): Pixmap {
  switch (format(bytes)) {
    case "png":
      return decodePng(bytes, MAX_PIXELS);
    case "jpeg":
      return decodeJpeg(bytes, MAX_PIXELS);
    case "gif":
      return decodeGif(bytes, MAX_PIXELS);
    case "webp":
      return decodeWebp(bytes, MAX_PIXELS);
    default:
      throw new Error("not a PNG, JPEG, GIF or WebP");
  }
}

/** The picture with its longer side at most `side` pixels, box-filtered. */
export function shrink(img: Pixmap, side: number): Pixmap {
  const scale = side / Math.max(img.width, img.height);
  if (scale >= 1) return img;

  return resample(
    img,
    Math.max(1, Math.round(img.width * scale)),
    Math.max(1, Math.round(img.height * scale)),
  );
}
