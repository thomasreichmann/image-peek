import { expect, test } from "claude-code/testing";

import { decode, format, MAX_PIXELS, shrink } from "../hooks/decode";
import { inflate } from "../hooks/inflate";
import { decodePng } from "../hooks/png";
import { FIXTURES, WEBP } from "./fixtures";

const bytes = (b64: string) => Uint8Array.fromBase64(b64);

/** Largest channel difference; RGB only where the truth is opaque, alpha exact. */
function worst(got: Uint8Array, truth: Uint8Array): number {
  let max = 0;
  for (let i = 0; i < truth.length; i += 4) {
    if (got[i + 3] !== truth[i + 3]) return 255;
    if (truth[i + 3] === 0) continue;
    for (let c = 0; c < 3; c++) max = Math.max(max, Math.abs(got[i + c]! - truth[i + c]!));
  }

  return max;
}

for (const f of FIXTURES) {
  test(`decodes ${f.name}`, () => {
    const pic = decode(bytes(f.file));
    expect([pic.width, pic.height]).toEqual([f.width, f.height]);
    expect(worst(pic.rgba, bytes(f.rgba))).toBeLessThanOrEqual(f.tolerance);
  });
}

test("progressive and restart-marker JPEGs decode exactly as the baseline one", () => {
  const of = (name: string) => Array.from(decode(bytes(FIXTURES.find((f) => f.name === name)!.file)).rgba);
  const baseline = of("jpeg: baseline 4:2:0");
  expect(of("jpeg: progressive 4:2:0")).toEqual(baseline);
  expect(of("jpeg: progressive, restart markers")).toEqual(baseline);
});

test("sniffs the format from the bytes, not the name", () => {
  const kinds = FIXTURES.map((f) => format(bytes(f.file)));
  expect(kinds).toEqual([
    ...["png", "png", "png", "png"],
    ...["jpeg", "jpeg", "jpeg", "jpeg", "jpeg"],
    "gif",
    ...["webp", "webp", "webp", "webp", "webp"],
  ]);
  expect(format(bytes(WEBP))).toBe("webp");
  expect(format(new TextEncoder().encode("hello"))).toBe("other");
  expect(() => decode(new TextEncoder().encode("hello"))).toThrow("not a PNG, JPEG, GIF or WebP");
});

test("decodes a tiny lossless WebP to its one colour", () => {
  const pic = decode(bytes(WEBP));
  expect([pic.width, pic.height]).toEqual([2, 2]);
  expect(Array.from(pic.rgba.slice(0, 4))).toEqual([200, 30, 30, 255]);
});

test("names the JPEG kinds it refuses", () => {
  // SOI, then a SOF9 (arithmetic coding) segment.
  const arithmetic = Uint8Array.of(0xff, 0xd8, 0xff, 0xc9, 0, 11, 8, 0, 1, 0, 1, 1, 1, 0x11, 0);
  expect(() => decode(arithmetic)).toThrow("arithmetic-coded JPEG");
});

test("a cut-off or damaged file throws an Error or decodes, never hangs", () => {
  for (const f of FIXTURES) {
    const whole = bytes(f.file);
    for (let cut = 0; cut < whole.length; cut += Math.max(1, whole.length >> 4)) {
      try {
        decode(whole.subarray(0, cut));
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    }
    const damaged = whole.slice();
    for (let i = 20; i < damaged.length; i += 7) damaged[i] = damaged[i]! ^ 0x5a;
    try {
      decode(damaged);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  }
});

test("refuses a picture past the pixel cap before decoding it", () => {
  // A PNG header claiming 70000 × 70000, and nothing else.
  const head = Uint8Array.of(
    137, 80, 78, 71, 13, 10, 26, 10,
    0, 0, 0, 13, 73, 72, 68, 82,
    0, 1, 0x11, 0x70, 0, 1, 0x11, 0x70, 8, 6, 0, 0, 0,
    0, 0, 0, 0,
  );
  expect(() => decodePng(head, MAX_PIXELS)).toThrow();
});

test("inflates stored and fixed-code deflate blocks", () => {
  // zlib.compress(b"abc", 0) and zlib.compress(b"abcabcabcabc", 1); the PNG
  // fixtures carry dynamic blocks.
  const stored = Uint8Array.of(0x78, 0x01, 0x01, 0x03, 0x00, 0xfc, 0xff, 0x61, 0x62, 0x63, 0x02, 0x4d, 0x01, 0x27);
  expect(new TextDecoder().decode(inflate(stored, 3))).toBe("abc");
  const fixed = Uint8Array.of(0x78, 0x01, 0x4b, 0x4c, 0x4a, 0x4e, 0x84, 0x21, 0x00, 0x1d, 0xe0, 0x04, 0x99);
  expect(new TextDecoder().decode(inflate(fixed, 12))).toBe("abcabcabcabc");
  expect(() => inflate(fixed.subarray(0, 6), 12)).toThrow();
});

test("shrinks to the longer side, keeping the shape", () => {
  const pic = { width: 1600, height: 900, rgba: new Uint8Array(1600 * 900 * 4) };
  const small = shrink(pic, 768);
  expect([small.width, small.height]).toEqual([768, 432]);
  expect(shrink({ width: 10, height: 5, rgba: new Uint8Array(200) }, 768).width).toBe(10);
});
