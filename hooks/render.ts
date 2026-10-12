// The cell renderer: every terminal cell becomes the glyph and the two colours
// that best reproduce the picture under it.
//
// A cell is sampled 8 × 16 in linear light (so texture finer than a sample
// keeps its brightness), each sample then taken to OKLab (perceptual). Each
// shape the terminal font can draw splits those samples in two, a sample on
// an edge partly each side; the shape kept is the one whose two colours, each
// side's OKLab mean, leave the least error.
//
// Means, not a least-squares fit: that overshoots on edge samples, to black.
// OKLab means, not linear ones: an edge rarely lands on an eighth, and the
// sliver left over brightens a dark side visibly in linear light (a band
// along every edge of a screenshot).
//
// A Raster paints every colour on a 4-bit lattice (16 steps a channel,
// rounded: measured 2026-10-07, every colour of a picture a multiple of 17
// while the theme's colours around it were exact). Rounded as it comes, a
// smooth gradient breaks into blotches, so colours are put on the lattice
// here. A cell on a gradient gets its exact mean by mixing two lattice
// colours inside it (quadrants as a fine dither) and hands what is left on
// to its neighbours (Floyd–Steinberg); a flat cell is its nearest lattice
// colour, plain; a cell with a real edge rounds each side; and, when the
// terminal's background colour is known exactly, a colour within a hair of
// it is the terminal's own colour, which is drawn exactly.
//
// Shapes are the ones Unicode defines: Block Elements tile the cell in
// eighths, halves and quadrants, and the Powerline wedges (U+E0B8–E0BE, Nerd
// Fonts only) fill it corner to corner. Terminals that draw these themselves
// (most do) draw them so; a font's own glyphs can be a hair off.

import type { Pixmap } from "./pixels";

/**
 * A cell's height over its width when nothing says otherwise: about 2 for
 * most monospace fonts (Menlo, SF Mono, Cascadia, DejaVu), 2.2 for JetBrains
 * Mono.
 */
export const DEFAULT_ASPECT = 2;

/** The terminal's own colour, in a Raster's colour words. */
export const DEFAULT = 0x01000000;

/**
 * The terminal's background: what see-through pixels are blended over and,
 * when `exact` (the person gave the colour), what a colour within a hair of
 * it is drawn as: the terminal's own colour, so a screenshot of the same
 * theme has no visible frame. Not exact, it is a guess from the theme.
 */
export type Backdrop = { color: number; exact: boolean };

const DARK: Backdrop = { color: 0x1e1e1e, exact: false };

/**
 * Distinct colour pairs one Raster paints; past that it snaps cells to the
 * nearest it has. Per Raster (measured 2026-10-07: one 100×40 noise picture
 * came out with exactly 1024, two 60×15 ones side by side with 900 each).
 */
const PAIRS = 1024;

const SX = 8;
const SY = 16;
const N = SX * SY;
/** Supersampling of each sample when measuring a shape's coverage. */
const SS = 12;
/**
 * Error a split must save per sample (OKLab, squared) to beat a plain cell:
 * keeps flat areas flat instead of tiling them with near-invisible shapes.
 */
const FLAT = 0.0001;
/** A region less opaque than this shows the terminal's background. */
const CLEAR = 1 / 16;
/**
 * Coverage's weight against OKLab in a fit (L spans 0 to 1): high, so where a
 * picture ends inside a cell the split follows its edge, not a colour edge.
 */
const EDGE = 3;
/** OKLab distance within which a colour is drawn as the terminal's own. */
const NEAR_BACKGROUND = 0.01;
/**
 * OKLab distance within which the nearest lattice colour is drawn plain (its
 * error kept, not handed on): about half a step. Lower, a lone cell off a
 * flat fill dithers and shows as a speck.
 */
const QUIET = 0.012;
/** Beside a flat fill, how far (OKLab) its plain colour is carried on. */
const SEAM = 0.025;
/**
 * Two sides closer than this (OKLab) are drawn as one exact mixed colour:
 * rounded apart they would show the lattice, not the picture.
 */
const FAINT = 0.025;
/**
 * A cell this even inside (OKLab RMS) is flat unless it sits on a gradient:
 * both cells 1, 2 or 3 away along a row or a column differ from it by more
 * than EVEN and less than STEEP (one differing is the side of an edge). Flat is one
 * plain lattice colour, no dither, no error taken or handed on. A flat fill
 * shifted by under half a step reads as the same fill; dithered, a
 * screenshot's panels and backgrounds turn to noise.
 */
const EVEN = 0.004;
const STEEP = 0.05;

type Shape = {
  /** Draws the inside in the foreground colour. */
  glyph: number;
  /** Draws the outside in the foreground colour, where the font has one. */
  inverse?: number;
  /** Coverage of each sample by the inside, 0 to 1. */
  mask: Float32Array;
  /** Σm, the inside's weight; the outside's is N − n. */
  n: number;
  // For the error of a blend m·c1 + (1−m)·c2: Σm², Σm(1−m), Σ(1−m)².
  a: number;
  b: number;
  c: number;
};

function shape(
  glyph: number,
  inverse: number | undefined,
  inside: (x: number, y: number) => boolean,
): Shape {
  const mask = new Float32Array(N);
  for (let sy = 0; sy < SY; sy++) {
    for (let sx = 0; sx < SX; sx++) {
      let hits = 0;
      for (let j = 0; j < SS; j++) {
        for (let i = 0; i < SS; i++) {
          if (inside((sx + (i + 0.5) / SS) / SX, (sy + (j + 0.5) / SS) / SY)) hits++;
        }
      }
      mask[sy * SX + sx] = hits / (SS * SS);
    }
  }
  let n = 0, a = 0, b = 0, c = 0;
  for (const m of mask) {
    n += m;
    a += m * m;
    b += m * (1 - m);
    c += (1 - m) * (1 - m);
  }

  return { glyph, inverse, mask, n, a, b, c };
}

/** Block Elements: any font has these. */
const BLOCKS: Shape[] = [
  // Lower eighths: ink below k/8 from the top.
  ...[1, 2, 3, 4, 5, 6, 7].map((k) =>
    shape(0x2588 - k, k === 4 ? 0x2580 : k === 1 ? 0x2594 : undefined, (_x, y) => y >= k / 8),
  ),
  // Left blocks, in eighths.
  shape(0x258f, undefined, (x) => x < 1 / 8),
  shape(0x258e, undefined, (x) => x < 1 / 4),
  shape(0x258d, undefined, (x) => x < 3 / 8),
  shape(0x258c, 0x2590, (x) => x < 1 / 2),
  shape(0x258b, undefined, (x) => x < 5 / 8),
  shape(0x258a, undefined, (x) => x < 3 / 4),
  shape(0x2589, 0x2595, (x) => x < 7 / 8),
  // Quadrants, each with its three-quadrant complement.
  shape(0x2598, 0x259f, (x, y) => x < 0.5 && y < 0.5),
  shape(0x259d, 0x2599, (x, y) => x >= 0.5 && y < 0.5),
  shape(0x2596, 0x259c, (x, y) => x < 0.5 && y >= 0.5),
  shape(0x2597, 0x259b, (x, y) => x >= 0.5 && y >= 0.5),
  shape(0x259a, 0x259e, (x, y) => x < 0.5 === y < 0.5),
];

/**
 * Powerline wedges (Private Use Area, Nerd Fonts only): diagonal edges. The
 * font's arrows and half-ellipses (U+E0B0–E0B6) were tried and left out: they
 * fit thin diagonal lines as chains of bubbles.
 */
const WEDGES: Shape[] = [
  shape(0xe0b8, 0xe0be, (x, y) => x < y), // lower-left / upper-right
  shape(0xe0ba, 0xe0bc, (x, y) => x >= 1 - y), // lower-right / upper-left
];

const SETS = {
  blocks: BLOCKS,
  wedges: [...BLOCKS, ...WEDGES],
};

export type Glyphs = keyof typeof SETS;

const LINEAR = Float32Array.from({ length: 256 }, (_, i) => {
  const c = i / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});

/** Linear light to sRGB, 0 to 1, clamped. */
function srgb(v: number): number {
  const c = v <= 0 ? 0 : v >= 1 ? 1 : v;
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

/** Linear sRGB to OKLab, written into `out` at `o`. */
function oklab(r: number, g: number, b: number, out: Float32Array | Float64Array, o: number) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  out[o] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  out[o + 1] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  out[o + 2] = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
}

/** OKLab to linear sRGB (unclamped), written into `out`. */
function linear(L: number, A: number, B: number, out: Float64Array) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  out[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  out[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  out[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
}

const scratch = new Float64Array(3);

/** OKLab to a 0xRRGGBB colour, clamped to sRGB. */
function packLab(L: number, A: number, B: number): number {
  linear(L, A, B, scratch);
  const byte = (v: number) => Math.round(srgb(v) * 255);

  return (byte(scratch[0]!) << 16) | (byte(scratch[1]!) << 8) | byte(scratch[2]!);
}

/** A backdrop colour in linear light and in OKLab. */
function backdrop(color: number) {
  const lin = [LINEAR[(color >> 16) & 255]!, LINEAR[(color >> 8) & 255]!, LINEAR[color & 255]!] as const;
  const lab = new Float64Array(3);
  oklab(lin[0], lin[1], lin[2], lab, 0);

  return { lin, lab };
}

// The lattice: 16 steps a channel, colour i = (r << 8) | (g << 4) | b.
const STEPS = 16;
const LATTICE_LIN = new Float64Array(STEPS ** 3 * 3);
const LATTICE_LAB = new Float64Array(STEPS ** 3 * 3);
for (let i = 0; i < STEPS ** 3; i++) {
  const r = LINEAR[((i >> 8) & 15) * 17]!;
  const g = LINEAR[((i >> 4) & 15) * 17]!;
  const b = LINEAR[(i & 15) * 17]!;
  LATTICE_LIN[i * 3] = r;
  LATTICE_LIN[i * 3 + 1] = g;
  LATTICE_LIN[i * 3 + 2] = b;
  oklab(r, g, b, LATTICE_LAB, i * 3);
}

const word = (i: number) =>
  ((((i >> 8) & 15) * 17) << 16) | ((((i >> 4) & 15) * 17) << 8) | ((i & 15) * 17);

function distance(lab: Float64Array, o: number, L: number, A: number, B: number) {
  return (lab[o]! - L) ** 2 + (lab[o + 1]! - A) ** 2 + (lab[o + 2]! - B) ** 2;
}

/** The (up to) 8 lattice colours around an OKLab colour, into `out`. */
function corners(L: number, A: number, B: number, out: Int32Array) {
  linear(L, A, B, scratch);
  const lo = [0, 0, 0];
  const hi = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const v = srgb(scratch[c]!) * 15;
    lo[c] = Math.min(15, Math.floor(v));
    hi[c] = Math.min(15, lo[c]! + 1);
  }
  for (let k = 0; k < 8; k++) {
    out[k] =
      ((k & 4 ? hi[0]! : lo[0]!) << 8) | ((k & 2 ? hi[1]! : lo[1]!) << 4) | (k & 1 ? hi[2]! : lo[2]!);
  }
}

const around = new Int32Array(8);

function nearest(L: number, A: number, B: number): number {
  corners(L, A, B, around);
  let best = around[0]!;
  let bestD = Infinity;
  for (const i of around) {
    const d = distance(LATTICE_LAB, i * 3, L, A, B);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }

  return best;
}

const mixed = new Float64Array(3);

/**
 * The glyphs a cell mixes two colours with, and the share the first gets:
 * quadrants, the quarter turning from cell to cell and the checker flipping,
 * so the dither is a fine irregular checker. Lower eighths and left blocks
 * were tried (2026-10-07): neighbours pick alike, and their edges line up
 * into streaks across or down the picture.
 */
function mixers(row: number, col: number) {
  const turn = (row * 3 + col) % 4;

  return [
    [[0x2598, 0x2597, 0x259d, 0x2596][turn]!, 1 / 4],
    [(row + col) % 2 ? 0x259a : 0x259e, 1 / 2],
    [[0x259f, 0x259b, 0x2599, 0x259c][turn]!, 3 / 4],
  ] as const;
}

/**
 * A flat colour on the lattice: the nearest lattice colour, or that and
 * another mixed in the cell (`mixers`), whichever looks closest. Returns what
 * is drawn and its OKLab colour.
 */
function mix(L: number, A: number, B: number, row: number, col: number) {
  const near = nearest(L, A, B);
  let glyph = 0x20, fg = DEFAULT, bg = word(near);
  let bestD = distance(LATTICE_LAB, near * 3, L, A, B);
  let shown = [LATTICE_LAB[near * 3]!, LATTICE_LAB[near * 3 + 1]!, LATTICE_LAB[near * 3 + 2]!];
  if (bestD < QUIET * QUIET) return { glyph, fg, bg, shown, quiet: true };

  for (const other of around) {
    if (other === near) continue;
    for (const [mixer, f] of mixers(row, col)) {
      oklab(
        f * LATTICE_LIN[near * 3]! + (1 - f) * LATTICE_LIN[other * 3]!,
        f * LATTICE_LIN[near * 3 + 1]! + (1 - f) * LATTICE_LIN[other * 3 + 1]!,
        f * LATTICE_LIN[near * 3 + 2]! + (1 - f) * LATTICE_LIN[other * 3 + 2]!,
        mixed,
        0,
      );
      const d = distance(mixed, 0, L, A, B);
      if (d < bestD) {
        bestD = d;
        glyph = mixer;
        fg = word(near);
        bg = word(other);
        shown = [mixed[0]!, mixed[1]!, mixed[2]!];
      }
    }
  }

  return { glyph, fg, bg, shown, quiet: false };
}

/**
 * Box-filter taps along one axis: output `i` covers source
 * `[i·step, (i+1)·step)`, clipped to the picture; weights in output units, so
 * a sample wholly inside the picture sums to 1 and one past it to 0.
 */
function taps(size: number, count: number, step: number) {
  const offset = new Int32Array(count + 1);
  const index: number[] = [];
  const weight: number[] = [];
  for (let i = 0; i < count; i++) {
    offset[i] = index.length;
    const from = i * step;
    const to = Math.min((i + 1) * step, size);
    for (let s = Math.floor(from); s < to; s++) {
      const w = (Math.min(to, s + 1) - Math.max(from, s)) / step;
      if (w > 0) {
        index.push(s);
        weight.push(w);
      }
    }
  }
  offset[count] = index.length;

  return { offset, index: Int32Array.from(index), weight: Float32Array.from(weight) };
}

/**
 * The samples of a `columns × rows` box with the picture placed at its top
 * left, aspect exact for cells `aspect` times as tall as wide (a part row or
 * column past it is transparent): OKLab of the picture over `bg` (linear
 * light), and coverage.
 */
function sample(img: Pixmap, columns: number, rows: number, aspect: number, bg: readonly number[]) {
  const ratio = (aspect * img.width) / img.height;
  const wide = Math.min(columns, rows * ratio);
  // Ending on a half row (at most 1/4 row of stretch): the only glyphs with
  // ink at a cell's top are ▀ and ▔, so a picture ending at 3/8 of a row
  // could only show its edge as a blend.
  const tall = Math.min(rows, Math.max(0.5, Math.round((wide / ratio) * 2) / 2));
  const gw = columns * SX;
  const gh = rows * SY;
  const xs = taps(img.width, gw, img.width / (wide * SX));
  const ys = taps(img.height, gh, img.height / (tall * SY));
  const px = img.rgba;

  // Across first: every source row, premultiplied linear RGBA.
  const across = new Float32Array(img.height * gw * 4);
  for (let y = 0; y < img.height; y++) {
    for (let gx = 0; gx < gw; gx++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let t = xs.offset[gx]!; t < xs.offset[gx + 1]!; t++) {
        const i = (y * img.width + xs.index[t]!) * 4;
        const w = (xs.weight[t]! * px[i + 3]!) / 255;
        r += w * LINEAR[px[i]!]!;
        g += w * LINEAR[px[i + 1]!]!;
        b += w * LINEAR[px[i + 2]!]!;
        a += w;
      }
      const o = (y * gw + gx) * 4;
      across[o] = r;
      across[o + 1] = g;
      across[o + 2] = b;
      across[o + 3] = a;
    }
  }

  const lab = new Float32Array(gw * gh * 3);
  const alpha = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let t = ys.offset[gy]!; t < ys.offset[gy + 1]!; t++) {
        const o = (ys.index[t]! * gw + gx) * 4;
        const w = ys.weight[t]!;
        r += w * across[o]!;
        g += w * across[o + 1]!;
        b += w * across[o + 2]!;
        a += w * across[o + 3]!;
      }
      a = Math.min(1, a);
      const s = gy * gw + gx;
      alpha[s] = a;
      oklab(r + bg[0]! * (1 - a), g + bg[1]! * (1 - a), b + bg[2]! * (1 - a), lab, s * 3);
    }
  }

  return { gw, lab, alpha };
}

/** 1 for each opaque cell that is even inside and on no gradient (EVEN, STEEP). */
function flatCells(lab: Float32Array, alpha: Float32Array, gw: number, columns: number, rows: number) {
  const mean = new Float64Array(columns * rows * 3);
  const even = new Uint8Array(columns * rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      let l = 0, a = 0, b = 0, sq = 0, cover = 0;
      for (let k = 0; k < N; k++) {
        const s = (row * SY + ((k / SX) | 0)) * gw + col * SX + (k % SX);
        const L = lab[s * 3]!, A = lab[s * 3 + 1]!, B = lab[s * 3 + 2]!;
        l += L;
        a += A;
        b += B;
        sq += L * L + A * A + B * B;
        cover += alpha[s]!;
      }
      const c = row * columns + col;
      mean[c * 3] = l / N;
      mean[c * 3 + 1] = a / N;
      mean[c * 3 + 2] = b / N;
      const spread = sq / N - (l * l + a * a + b * b) / (N * N);
      even[c] = cover > N * 0.999 && spread < EVEN * EVEN ? 1 : 0;
    }
  }
  const flat = new Uint8Array(columns * rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const c = row * columns + col;
      if (!even[c]) continue;
      // Whether a neighbour differs gently (a slope); a missing one mirrors
      // the other, so a gradient reaches the picture's edge.
      const slope = (r: number, k: number): boolean | undefined => {
        if (r < 0 || r >= rows || k < 0 || k >= columns) return undefined;
        const d = distance(mean, (r * columns + k) * 3, mean[c * 3]!, mean[c * 3 + 1]!, mean[c * 3 + 2]!);
        return d >= EVEN * EVEN && d < STEEP * STEEP;
      };
      const axis = (a: boolean | undefined, b: boolean | undefined) => (a ?? b ?? false) && (b ?? a ?? false);
      // Up to 3 cells away: a gradient of one sRGB step a cell is under EVEN
      // next door and would band.
      let onGradient = false;
      for (let k = 1; k <= 3 && !onGradient; k++) {
        onGradient =
          axis(slope(row, col - k), slope(row, col + k)) || axis(slope(row - k, col), slope(row + k, col));
      }
      flat[c] = onGradient ? 0 : 1;
    }
  }

  // What each flat cell is drawn as: its nearest lattice colour.
  const fill = new Int32Array(columns * rows).fill(-1);
  for (let c = 0; c < columns * rows; c++) {
    if (flat[c]) fill[c] = nearest(mean[c * 3]!, mean[c * 3 + 1]!, mean[c * 3 + 2]!);
  }

  return { flat, fill };
}

export type RenderOptions = {
  /** Block Elements only (the default), or with the Powerline wedges. */
  glyphs?: Glyphs;
  /** Colours on a Raster's 4-bit lattice (the default), or exact. */
  lattice?: boolean;
  /** A cell's height over its width (DEFAULT_ASPECT). */
  aspect?: number;
  /** The terminal's background (a dark guess by default). */
  background?: Backdrop;
};

/**
 * Raster words for a picture in a `columns × rows` box: per cell a glyph,
 * a foreground and a background (`[codePoint, fg, bg]`, colours 0xRRGGBB or
 * DEFAULT), row-major.
 */
export function render(
  img: Pixmap,
  columns: number,
  rows: number,
  options: RenderOptions = {},
): Uint32Array {
  const shapes = SETS[options.glyphs ?? "blocks"];
  const onLattice = options.lattice !== false;
  const background = options.background ?? DARK;
  const { lin: BG, lab: BG_LAB } = backdrop(background.color);
  const { gw, lab, alpha } = sample(img, columns, rows, options.aspect ?? DEFAULT_ASPECT, BG);
  const words = new Uint32Array(columns * rows * 3);
  // Per sample: L, a, b and coverage, the last so a picture's edge is a
  // split of its own and transparency never merges with a dark colour.
  const cell = new Float32Array(N * 4);
  const t = new Float64Array(4);
  const p = new Float64Array(4);
  // Error handed on (OKLab), this row and the next, a column of margin each side.
  let err = new Float64Array((columns + 2) * 3);
  let next = new Float64Array((columns + 2) * 3);
  const { flat, fill } = onLattice
    ? flatCells(lab, alpha, gw, columns, rows)
    : { flat: new Uint8Array(columns * rows), fill: new Int32Array(columns * rows).fill(-1) };
  /** A flat neighbour drawn as lattice colour `i`. */
  const besideFill = (row: number, col: number, i: number) =>
    [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dr, dc]) => {
      const r = row + dr!, k = col + dc!;
      return r >= 0 && r < rows && k >= 0 && k < columns && fill[r * columns + k] === i;
    });

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const e = (col + 1) * 3;
      const isFlat = flat[row * columns + col] === 1;
      t.fill(0);
      let sq = 0;
      for (let k = 0; k < N; k++) {
        const s = (row * SY + ((k / SX) | 0)) * gw + col * SX + (k % SX);
        const a = alpha[s]!;
        for (let ch = 0; ch < 4; ch++) {
          const v = ch < 3 ? lab[s * 3 + ch]! + (isFlat ? 0 : err[e + ch]! * a) : a * EDGE;
          cell[k * 4 + ch] = v;
          t[ch]! += v;
          sq += v * v;
        }
      }
      const w = (row * columns + col) * 3;
      const opaque = t[3]! > N * EDGE * 0.999;

      // The best split, against a plain cell. Scores are Σ|x|² less the
      // error left; a plain cell leaves Σ|x − mean|².
      let best: Shape | undefined;
      let bestScore = (t[0]! ** 2 + t[1]! ** 2 + t[2]! ** 2 + t[3]! ** 2) / N + N * FLAT;
      if (sq - bestScore + N * FLAT > 1e-9) {
        for (const sh of shapes) {
          const m = sh.mask;
          p.fill(0);
          for (let k = 0; k < N; k++) {
            const v = m[k]!;
            if (v === 0) continue;
            p[0]! += v * cell[k * 4]!;
            p[1]! += v * cell[k * 4 + 1]!;
            p[2]! += v * cell[k * 4 + 2]!;
            p[3]! += v * cell[k * 4 + 3]!;
          }
          const n1 = sh.n, n2 = N - sh.n;
          // A clear inside needs the inverse glyph to show the terminal's colour.
          if (!opaque && sh.inverse === undefined && p[3]! / n1 < CLEAR * EDGE) continue;
          // Means c1 = P/n, c2 = Q/(N−n); the blend m·c1 + (1−m)·c2 leaves
          // Σ|x|² − (2c1·P + 2c2·Q − a|c1|² − 2b c1·c2 − c|c2|²).
          let score = 0;
          for (let ch = 0; ch < 4; ch++) {
            const pin = p[ch]!, pout = t[ch]! - pin;
            const c1 = pin / n1, c2 = pout / n2;
            score += 2 * c1 * pin + 2 * c2 * pout - sh.a * c1 * c1 - 2 * sh.b * c1 * c2 - sh.c * c2 * c2;
          }
          if (score > bestScore) {
            bestScore = score;
            best = sh;
          }
        }
      }

      // The sides: OKLab means and coverage (one side for a plain cell).
      let n1 = N, n2 = 0;
      p.set(t);
      if (best !== undefined) {
        p.fill(0);
        const m = best.mask;
        for (let k = 0; k < N; k++) {
          const v = m[k]!;
          if (v === 0) continue;
          for (let ch = 0; ch < 4; ch++) p[ch]! += v * cell[k * 4 + ch]!;
        }
        n1 = best.n;
        n2 = N - best.n;
      }
      const in0 = p[0]! / n1, in1 = p[1]! / n1, in2 = p[2]! / n1;
      const out0 = n2 ? (t[0]! - p[0]!) / n2 : 0;
      const out1 = n2 ? (t[1]! - p[1]!) / n2 : 0;
      const out2 = n2 ? (t[2]! - p[2]!) / n2 : 0;
      const inClear = p[3]! / n1 < CLEAR * EDGE;
      const outClear = n2 === 0 || (t[3]! - p[3]!) / n2 < CLEAR * EDGE;
      const mean0 = t[0]! / N, mean1 = t[1]! / N, mean2 = t[2]! / N;
      // Judged on the picture's own colour, before the error handed in: a
      // background beside an edge stays the background, the error dropped.
      const [e0, e1, e2] = isFlat ? [0, 0, 0] : [err[e]!, err[e + 1]!, err[e + 2]!];
      const nearBackground = (L: number, A: number, B: number) =>
        background.exact &&
        distance(BG_LAB, 0, L - e0, A - e1, B - e2) < NEAR_BACKGROUND * NEAR_BACKGROUND;

      // What is drawn, and the error a dithered cell leaves (handed on).
      let glyph: number, fg: number, bg: number;
      let r0 = 0, r1 = 0, r2 = 0;

      const faint =
        best !== undefined &&
        (in0 - out0) ** 2 + (in1 - out1) ** 2 + (in2 - out2) ** 2 < FAINT * FAINT;
      if (inClear && outClear) {
        glyph = 0x20;
        fg = DEFAULT;
        bg = DEFAULT;
      } else if (best === undefined || (opaque && onLattice && faint)) {
        // One colour: the cell's mean.
        if (nearBackground(mean0, mean1, mean2)) {
          glyph = 0x20;
          fg = DEFAULT;
          bg = DEFAULT;
        } else if (isFlat) {
          glyph = 0x20;
          fg = DEFAULT;
          bg = word(nearest(mean0, mean1, mean2));
        } else if (
          onLattice &&
          besideFill(row, col, nearest(mean0, mean1, mean2)) &&
          distance(LATTICE_LAB, nearest(mean0, mean1, mean2) * 3, mean0, mean1, mean2) < SEAM * SEAM
        ) {
          // A gradient leaving a flat fill: carry on the fill's plain colour
          // until the gradient has moved off it; dithered at once, the first
          // cells off the fill show as specks.
          glyph = 0x20;
          fg = DEFAULT;
          bg = word(nearest(mean0, mean1, mean2));
        } else if (onLattice) {
          const drawn = mix(mean0, mean1, mean2, row, col);
          ({ glyph, fg, bg } = drawn);
          if (!drawn.quiet) {
            r0 = mean0 - drawn.shown[0]!;
            r1 = mean1 - drawn.shown[1]!;
            r2 = mean2 - drawn.shown[2]!;
          }
        } else {
          glyph = 0x20;
          fg = DEFAULT;
          bg = packLab(mean0, mean1, mean2);
        }
      } else {
        // Two sides. Each: the terminal's colour (clear, or next to it), or
        // the nearest lattice colour (or the exact one). The rounding stays
        // here: handed on along an edge, it beads the edge's neighbours.
        const side = (clear: boolean, L: number, A: number, B: number) => {
          if (clear || nearBackground(L, A, B)) return DEFAULT;
          return onLattice ? word(nearest(L, A, B)) : packLab(L, A, B);
        };
        const inside = side(inClear, in0, in1, in2);
        const outside = side(outClear, out0, out1, out2);
        const sh = best!;
        if (inside === DEFAULT && sh.inverse !== undefined) {
          glyph = sh.inverse;
          fg = outside;
          bg = DEFAULT;
        } else {
          glyph = sh.glyph;
          // The terminal's colour as ink: only an explicit colour can say it.
          fg =
            inside === DEFAULT
              ? onLattice
                ? word(nearest(BG_LAB[0]!, BG_LAB[1]!, BG_LAB[2]!))
                : background.color
              : inside;
          bg = outside;
        }
      }

      words[w] = glyph;
      words[w + 1] = fg;
      words[w + 2] = bg;

      // Floyd–Steinberg: 7/16 right, 3/16 below left, 5/16 below, 1/16 below right.
      if (onLattice && !isFlat && t[3]! > N * EDGE * 0.5) {
        const rs = [r0, r1, r2].map((v) => Math.max(-0.05, Math.min(0.05, v)));
        for (let ch = 0; ch < 3; ch++) {
          const v = rs[ch]!;
          err[e + 3 + ch]! += (v * 7) / 16;
          next[e - 3 + ch]! += (v * 3) / 16;
          next[e + ch]! += (v * 5) / 16;
          next[e + 3 + ch]! += v / 16;
        }
      }
    }
    [err, next] = [next, err];
    next.fill(0);
  }

  return words;
}

/**
 * The words cut into stacked Rasters' `cells`, each at most PAIRS cells (so
 * at most PAIRS pairs: nothing is snapped), strips as even as that allows.
 */
export function strips(
  words: Uint32Array,
  columns: number,
  rows: number,
): { rows: number; cells: string }[] {
  const count = Math.ceil((columns * rows) / PAIRS);
  const each = Math.max(1, Math.min(Math.ceil(rows / count), Math.floor(PAIRS / columns)));
  const out: { rows: number; cells: string }[] = [];
  for (let top = 0; top < rows; top += each) {
    const n = Math.min(each, rows - top);
    const part = words.subarray(top * columns * 3, (top + n) * columns * 3);
    out.push({
      rows: n,
      cells: new Uint8Array(part.buffer, part.byteOffset, part.byteLength).toBase64(),
    });
  }

  return out;
}
