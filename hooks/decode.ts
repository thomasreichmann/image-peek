// Picture bytes to pixels. PNG, JPEG and GIF are decoded here in plain code,
// so nothing has to be installed; anything else (WebP, or a JPEG kind the
// decoder refuses: arithmetic-coded, 12-bit, lossless) is left to ffmpeg by
// the caller, when the host has it.

import { decodeGif, isGif } from "./gif";
import { decodeJpeg, isJpeg } from "./jpeg";
import { resample } from "./pixels";
import type { Pixmap } from "./pixels";
import { decodePng, isPng } from "./png";

/** The largest picture decoded here: 16.8 megapixels (a 12 MP photo, a 4K screen). */
export const MAX_PIXELS = 1 << 24;

export type Format = "png" | "jpeg" | "gif" | "webp" | "other";

const ascii = (bytes: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...bytes.subarray(from, to));

/** The format by the file's first bytes, whatever it was called. */
export function format(bytes: Uint8Array): Format {
  if (isPng(bytes)) return "png";
  if (isJpeg(bytes)) return "jpeg";
  if (isGif(bytes)) return "gif";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "webp";

  return "other";
}

/** Decodes a PNG, JPEG or GIF (its first frame); throws for anything else. */
export function decode(bytes: Uint8Array): Pixmap {
  switch (format(bytes)) {
    case "png":
      return decodePng(bytes, MAX_PIXELS);
    case "jpeg":
      return decodeJpeg(bytes, MAX_PIXELS);
    case "gif":
      return decodeGif(bytes, MAX_PIXELS);
    default:
      throw new Error("not a PNG, JPEG or GIF");
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
