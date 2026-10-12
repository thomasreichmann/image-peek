import { expect, test } from "claude-code/testing";

import { readLook } from "../hooks/options";
import { cells, findImages, fit } from "../hooks/pixels";
import type { Pixmap } from "../hooks/pixels";
import { DEFAULT, DEFAULT_ASPECT, render as renderAt, strips } from "../hooks/render";
import type { RenderOptions } from "../hooks/render";
import { FIXTURES, WEBP } from "./fixtures";

// 2×2: red, green / transparent, blue.
const PIXELS = [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 0, 0, 0, 0, 255, 255];

const READ_OUTPUT = {
  type: "image",
  file: {
    base64: "aGVsbG8=",
    type: "image/png",
    originalSize: 30324,
    dimensions: { originalWidth: 640, originalHeight: 360 },
  },
};

test("finds images in Read, API and MCP shapes, not in text", () => {
  expect(findImages(READ_OUTPUT)).toEqual([
    {
      base64: "aGVsbG8=",
      mediaType: "image/png",
      bytes: 30324,
      width: 640,
      height: 360,
    },
  ]);
  expect(
    findImages([
      { type: "text", text: "shot" },
      { type: "image", source: { type: "base64", data: "QQ==", media_type: "image/jpeg" } },
      { type: "image", data: "Qg==", mimeType: "image/webp" },
    ]).map((f) => f.base64),
  ).toEqual(["QQ==", "Qg=="]);
  expect(findImages({ type: "text", file: { content: "x" } })).toEqual([]);
  expect(findImages("plain text")).toEqual([]);
});

test("fits the box: never wider than the pixels, aspect kept, rows capped", () => {
  expect(fit({ width: 640, height: 360 }, 64, 18)).toEqual({ columns: 64, rows: 18 });
  expect(fit({ width: 640, height: 360 }, 40, 18)).toEqual({ columns: 40, rows: 12 });
  expect(fit({ width: 10, height: 10 }, 64, 18)).toEqual({ columns: 10, rows: 5 });
  expect(fit({ width: 100, height: 1000 }, 64, 18)).toEqual({ columns: 4, rows: 18 });
});

test("packs half blocks, transparency as the terminal's own colour", () => {
  const img: Pixmap = { width: 2, height: 2, rgba: Uint8Array.from(PIXELS) };
  const bytes = Uint8Array.fromBase64(cells(img, 2, 1));
  const words = Array.from(new Uint32Array(bytes.buffer, bytes.byteOffset, 6));
  // Left cell: red over transparent. Right cell: green over blue.
  expect(words).toEqual([0x2580, 0xff0000, 0x01000000, 0x2580, 0x00ff00, 0x0000ff]);
});

test("reads the options, each falling back to its default", () => {
  expect(readLook({})).toEqual({
    maxColumns: 64,
    maxRows: 18,
    renderer: "cells",
    glyphs: "blocks",
    aspect: DEFAULT_ASPECT,
    background: undefined,
  });
  const look = readLook({ glyphs: "wedges", cellAspect: 2.2, background: " #1E1E2E " });
  expect([look.glyphs, look.aspect, look.background]).toEqual(["wedges", 2.2, 0x1e1e2e]);
  expect(readLook({ cellAspect: 0, background: "navy" })).toMatchObject({ aspect: 2, background: undefined });
});

// The cell tests draw pictures 10 × 22 px a cell, so cells 2.2 times as tall
// as wide hold them exactly.
const CELL = { aspect: 2.2 };
const render = (img: Pixmap, columns: number, rows: number, options: RenderOptions = {}) =>
  renderAt(img, columns, rows, { ...CELL, ...options });

/** A picture one cell's shape (10 × 22 px), each pixel from `at(x, y)`. */
function cell(at: (x: number, y: number) => number[]): Pixmap {
  const width = 10, height = 22;
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) rgba.set(at(x, y), (y * width + x) * 4);
  }

  return { width, height, rgba };
}

const RED = [255, 0, 0, 255];
const BLUE = [0, 0, 255, 255];
const NONE = [0, 0, 0, 0];

/** Glyph, foreground and background of the first cell, colours ±1 per channel. */
function first(words: Uint32Array) {
  return Array.from(words.slice(0, 3));
}

function near(a: number, b: number) {
  return [16, 8, 0].every((s) => Math.abs(((a >> s) & 255) - ((b >> s) & 255)) <= 1);
}

test("cells: boxes are fitted to the cell's aspect, 2 unless set", () => {
  expect(DEFAULT_ASPECT).toBe(2);
  expect(fit({ width: 640, height: 360 }, 64, 18, DEFAULT_ASPECT)).toEqual({ columns: 64, rows: 18 });
  expect(fit({ width: 640, height: 360 }, 64, 18, 2.2)).toEqual({ columns: 64, rows: 17 });
});

test("cells: a half split is a half block with both colours exact", () => {
  const [glyph, fg, bg] = first(render(cell((_x, y) => (y < 11 ? RED : BLUE)), 1, 1));
  expect(glyph).toBe(0x2584); // ▄: ink below
  expect(near(fg!, 0x0000ff) && near(bg!, 0xff0000)).toBe(true);
});

test("cells: an eighth split lands on its eighth", () => {
  // Top 3/8 red (8.25 of 22 px: 8 px plus a quarter blend row is close enough).
  const [glyph] = first(render(cell((_x, y) => (y < 8 ? RED : BLUE)), 1, 1));
  expect(glyph).toBe(0x2585); // ▅: lower five eighths
});

test("cells: transparency is the terminal's own colour, on the glyph's background", () => {
  // Left half clear: ▌ would need the clear side as ink, so its inverse ▐.
  const [glyph, fg, bg] = first(render(cell((x) => (x < 5 ? NONE : BLUE)), 1, 1));
  expect(glyph).toBe(0x2590);
  expect(near(fg!, 0x0000ff)).toBe(true);
  expect(bg).toBe(DEFAULT);
  expect(first(render(cell(() => NONE), 1, 1))).toEqual([0x20, DEFAULT, DEFAULT]);
});

test("cells: a diagonal is a wedge when asked, else the best block", () => {
  const diagonal = cell((x, y) => (x / 10 < y / 22 ? RED : BLUE));
  expect(first(render(diagonal, 1, 1, { glyphs: "wedges" }))[0]).toBe(0xe0b8);
  expect(first(render(diagonal, 1, 1))[0]).not.toBe(0xe0b8);
});

test("cells: a flat cell is a plain space in its colour", () => {
  const [glyph, fg, bg] = first(render(cell(() => RED), 1, 1));
  expect(glyph).toBe(0x20);
  expect(fg).toBe(DEFAULT);
  expect(near(bg!, 0xff0000)).toBe(true);
});

/** A `w × h` cell picture (10 × 22 px a cell), each pixel from `at(x, y)`. */
function picture(w: number, h: number, at: (x: number, y: number) => number[]): Pixmap {
  const width = 10 * w, height = 22 * h;
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) rgba.set(at(x, y), (y * width + x) * 4);
  }

  return { width, height, rgba };
}

const colours = (words: Uint32Array) =>
  Array.from(words).filter((_, i) => i % 3 !== 0 && words[i] !== DEFAULT);
const onLattice = (v: number) => [16, 8, 0].every((s) => ((v >> s) & 255) % 17 === 0);

test("cells: every colour is on a Raster's 4-bit lattice, unless asked for exact", () => {
  const ramp = picture(16, 4, (x) => [40 + (x >> 1), 90, 160, 255]);
  expect(colours(render(ramp, 16, 4)).every(onLattice)).toBe(true);
  expect(colours(render(ramp, 16, 4, { lattice: false })).every(onLattice)).toBe(false);
});

test("cells: a flat fill off the lattice is one plain colour, not a dither", () => {
  const words = render(picture(6, 3, () => [0x31, 0x32, 0x44, 255]), 6, 3);
  const cells = Array.from({ length: 18 }, (_, c) => first(words.subarray(c * 3)).join());
  expect(new Set(cells).size).toBe(1);
  expect(cells[0]).toBe([0x20, DEFAULT, 0x333344].join());
});

test("cells: a known background, or within a hair of it, is the terminal's own colour", () => {
  const shot = picture(4, 2, () => [0x1f, 0x1e, 0x2e, 255]);
  expect(colours(render(shot, 4, 2, { background: { color: 0x1e1e2e, exact: true } }))).toEqual([]);
  // A guessed background is never drawn as the terminal's: it may be wrong.
  expect(colours(render(shot, 4, 2, { background: { color: 0x1e1e2e, exact: false } })).length).toBeGreaterThan(0);
});

test("cells: see-through edges blend over the background given", () => {
  const half = picture(1, 1, () => [255, 255, 255, 128]);
  const [, , onDark] = first(render(half, 1, 1, { background: { color: 0x000000, exact: false } }));
  const [, , onLight] = first(render(half, 1, 1, { background: { color: 0xffffff, exact: false } }));
  expect(((onDark! >> 16) & 255) < ((onLight! >> 16) & 255)).toBe(true);
});

test("cells: a gentle gradient is dithered inside its cells", () => {
  // 0x40 to 0x60 across 32 columns: 2 lattice steps, rounded it would band.
  const words = render(picture(32, 2, (x) => [64 + (x * 32) / 320, 64, 96, 255]), 32, 2);
  const glyphs = new Set(Array.from(words).filter((_, i) => i % 3 === 0));
  expect([0x259a, 0x259e].some((q) => glyphs.has(q))).toBe(true);
});

test("cells: strips keep every Raster within 1024 cells", () => {
  const words = new Uint32Array(64 * 17 * 3);
  expect(strips(words, 64, 17).map((s) => s.rows)).toEqual([9, 8]);
  expect(strips(words.subarray(0, 64 * 16 * 3), 64, 16).map((s) => s.rows)).toEqual([16]);
  const wide = new Uint32Array(100 * 40 * 3);
  expect(strips(wide, 100, 40).every((s) => s.rows * 100 <= 1024)).toBe(true);
});

/** A Read of `base64`, as its tool row holds it. */
function readCall(id: string, base64: string, type = "image/png") {
  return {
    tool_use_id: id,
    tool: "Read",
    input: { file_path: "/work/shot.png" },
    isRunning: false,
    isErrored: false,
    isInterrupted: false,
    output: { ...READ_OUTPUT, file: { ...READ_OUTPUT.file, base64, type } },
  };
}

test("unfolds a group holding an image and draws the picture on its row", async ($, on) => {
  const seen: boolean[] = [];
  on("ui.render", { component: "ToolGroup" }, ($, e) => {
    seen.push(e.props.isExpanded);
    const { Text } = $.ui.resolve(e);

    return <Text>group</Text>;
  });
  const ran: string[][] = [];
  on("process.run", (_$, e) => {
    ran.push([...e.argv]);
    return { value: { exitCode: 1, stdout: "", stderr: "", isStdoutTruncated: false, isStderrTruncated: false } };
  });
  on("session.cwd", () => ({ value: "/work" }));

  // A 7 × 5 RGBA PNG: decoded in the module, no process run.
  const call = readCall("toolu_1", FIXTURES[0]!.file);
  await $.ui.mount({
    plugin: "image-peek",
    surface: "terminal",
    component: "ToolGroup",
    requestId: "collapsed-1",
    props: { calls: [call], isActive: false, isExpanded: false },
  });
  expect(seen).toEqual([true]);

  const row = await $.ui.mount({
    plugin: "image-peek",
    surface: "terminal",
    component: "ToolUse",
    requestId: "toolu_1",
    props: { ...call },
  });
  expect(await row.find({ type: "Text", text: "(shot.png)" })).toBeDefined();
  expect(
    await row.find({ type: "Text", text: "Read image (29.6KB) · 640×360" }),
  ).toBeDefined();
  const raster = await row.find({ type: "Raster" });
  expect([raster?.props.columns, raster?.props.rows]).toEqual([7, 3]);
  expect(ran).toEqual([]);
});

test("draws a WebP in the module, and says why when there is no picture", async ($, on) => {
  const ran: string[][] = [];
  on("process.run", (_$, e) => {
    ran.push([...e.argv]);
    return { value: { exitCode: 1, stdout: "", stderr: "", isStdoutTruncated: false, isStderrTruncated: false } };
  });

  const result = (id: string, base64: string) =>
    $.ui.mount({
      plugin: "image-peek",
      surface: "terminal",
      component: "ToolResult",
      requestId: id,
      props: { ...readCall(id, base64, "image/webp") },
    });

  const drawn = await result("toolu_webp_1", WEBP);
  expect(await drawn.find({ type: "Raster" })).toBeDefined();

  const garbage = await result("toolu_webp_2", "aGVsbG8=");
  expect(await garbage.find({ type: "Raster" })).toBeUndefined();
  expect(
    await garbage.find({ type: "Text", text: "(no preview: not a PNG, JPEG, GIF or WebP)" }),
  ).toBeDefined();
  expect(ran).toEqual([]);
});

test("leaves a group without images folded", async ($, on) => {
  const seen: boolean[] = [];
  on("ui.render", { component: "ToolGroup" }, ($, e) => {
    seen.push(e.props.isExpanded);
    const { Text } = $.ui.resolve(e);

    return <Text>group</Text>;
  });
  await $.ui.mount({
    plugin: "image-peek",
    surface: "terminal",
    component: "ToolGroup",
    requestId: "collapsed-2",
    props: {
      calls: [
        {
          tool_use_id: "toolu_2",
          tool: "Read",
          input: { file_path: "/work/a.md" },
          isRunning: false,
          isErrored: false,
          isInterrupted: false,
          output: { type: "text", file: { content: "hi" } },
        },
      ],
      isActive: false,
      isExpanded: false,
    },
  });
  expect(seen).toEqual([false]);
});
