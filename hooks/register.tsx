import type {
  EngineInterface,
  Register,
  RenderViewport,
  ResolveInput,
} from "claude-code";

import { decode, shrink } from "./decode";
import { readLook } from "./options";
import type { Look } from "./options";
import { caption, cells, findImages, fit } from "./pixels";
import type { Found, Pixmap } from "./pixels";
import { render, strips } from "./render";
import type { Backdrop } from "./render";

// Image Reads fold into a ToolGroup line ("read 2 files"), which hides them.
// A group holding an image is unfolded, so each call becomes a ToolUse row,
// and an image call's row is drawn here: the engine's header and result line,
// then the picture. A standalone call's result (ToolResult) gets the same
// picture under its line.
//
// PNG, JPEG, GIF and WebP are decoded in the module (decode.ts): it runs no
// program and needs nothing installed. Pictures are kept at most 768 px a
// side and drawn per box size by render.ts, ~25 ms, kept, so a scroll redraw
// costs nothing.

const INDENT = 5; // "  ⎿  "
const MARGIN = 6; // kept free right of a picture
const DECODE_PX = 768;
/** Decoded pictures kept (each up to 768² RGBA, 2.4 MB). */
const KEEP_DECODED = 24;
/** Drawn boxes kept (a few KB each). */
const KEEP_DRAWN = 48;

/** A decoded picture, or why there is none. */
type Decoded = Pixmap | string;

// Caches, not state: a reload decodes and draws again on the next draw.
const decoded = new Map<string, Decoded>();
const drawn = new Map<string, Uint32Array>();
// Calls whose group this mod unfolded: their ToolUse rows carry the picture.
const unfolded = new Set<string>();

function keep<V>(cache: Map<string, V>, key: string, value: V, size: number) {
  cache.set(key, value);
  while (cache.size > size) cache.delete(cache.keys().next().value as string);
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

function runDecode(found: Found): Decoded {
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.fromBase64(found.base64);
  } catch {
    return "unreadable base64";
  }
  try {
    return shrink(decode(bytes), DECODE_PX);
  } catch (error) {
    return message(error);
  }
}

function decodeOnce(key: string, found: Found): Decoded {
  let known = decoded.get(key);
  if (known === undefined) {
    known = runDecode(found);
    keep(decoded, key, known, KEEP_DECODED);
  }

  return known;
}

/** The picture's cells for a box, drawn once per key, size and look. */
function cellWords(
  key: string,
  pic: Pixmap,
  columns: number,
  rows: number,
  look: Look,
  background: Backdrop,
) {
  const at = [key, columns, rows, look.glyphs, look.aspect, background.color, background.exact].join(":");
  let known = drawn.get(at);
  if (known === undefined) {
    known = render(pic, columns, rows, { glyphs: look.glyphs, aspect: look.aspect, background });
    keep(drawn, at, known, KEEP_DRAWN);
  }

  return known;
}

/**
 * The terminal's background: the person's colour when given, exact; else a
 * dark grey (the default theme is dark), used only to blend see-through
 * edges. Claude Code's theme setting is not read: reading settings puts the
 * mod on a directory review hold.
 */
function backdrop(look: Look): Backdrop {
  return look.background !== undefined
    ? { color: look.background, exact: true }
    : { color: 0x1e1e1e, exact: false };
}

function shortPath(path: string, cwd: string): string {
  return path.startsWith(`${cwd}/`) ? path.slice(cwd.length + 1) : path;
}

/** One `⎿ caption` line and its picture per image. */
async function pictures(
  $: EngineInterface,
  e: ResolveInput<"ToolUse" | "ToolResult", "terminal"> & { viewport?: RenderViewport },
  id: string,
  found: Found[],
  look: Look,
) {
  const { Box, Text, Raster, Image } = $.ui.resolve(e);
  const width = (e.viewport?.columns ?? 80) - INDENT - MARGIN;
  const background = backdrop(look);
  const results = found.map((one, i) => decodeOnce(`${id}:${i}`, one));

  return found.map((one, i) => {
    const pic = results[i] ?? "not decoded";
    const lead = i === 0 ? "  ⎿  " : "     ";
    const key = `${id}:${i}`;
    const maxColumns = Math.min(look.maxColumns, width);
    let body;
    if (typeof pic === "string") {
      body = <Text dimColor>(no preview: {pic})</Text>;
    } else if (look.renderer === "image") {
      const box = fit(pic, maxColumns, look.maxRows, look.aspect);
      body = (
        <Image
          source={{ rgba: pic.rgba.toBase64(), width: pic.width, height: pic.height }}
          columns={box.columns}
          rows={box.rows}
          alt={caption(one)}
        />
      );
    } else if (look.renderer === "half") {
      const box = fit(pic, maxColumns, look.maxRows);
      body = (
        <Raster key={key} columns={box.columns} rows={box.rows} cells={cells(pic, box.columns, box.rows)} />
      );
    } else {
      const box = fit(pic, maxColumns, look.maxRows, look.aspect);
      const words = cellWords(key, pic, box.columns, box.rows, look, background);
      // Stacked strips: a Raster paints at most 1024 colour pairs.
      body = (
        <Box flexDirection="column">
          {strips(words, box.columns, box.rows).map((strip, s) => (
            <Raster
              key={`${key}:${s}`}
              columns={box.columns}
              rows={strip.rows}
              cells={strip.cells}
            />
          ))}
        </Box>
      );
    }

    return (
      <Box key={`${id}:${i}`} flexDirection="column">
        <Box>
          <Text dimColor>{lead}</Text>
          <Text>{caption(one)}</Text>
        </Box>
        <Box marginLeft={INDENT}>{body}</Box>
      </Box>
    );
  });
}

export const register: Register = (on, options) => {
  const look = readLook(options);

  on("ui.render", { component: "ToolGroup" }, async ($, e, next) => {
    if (e.surface !== "terminal") return next(e);

    const withImages = e.props.calls.filter(
      (call) =>
        !call.isRunning &&
        call.tool_use_id !== undefined &&
        findImages(call.output).length > 0,
    );
    if (withImages.length === 0) return next(e);

    for (const call of withImages) unfolded.add(call.tool_use_id as string);

    return next({ ...e, props: { ...e.props, isExpanded: true } });
  }).catch(($, e, next) => next(e));

  on("ui.render", { component: "ToolUse" }, async ($, e, next) => {
    if (e.surface !== "terminal" || !unfolded.has(e.props.tool_use_id)) {
      return next(e);
    }
    const found = findImages(e.props.output);
    if (found.length === 0) return next(e);

    const { Box, Text } = $.ui.resolve(e);
    const input = (e.props.input ?? {}) as Record<string, unknown>;
    const path = typeof input.file_path === "string" ? input.file_path : undefined;
    const arg = path === undefined ? "" : `(${shortPath(path, await $.session.cwd())})`;
    const drawn = await pictures($, e, e.props.tool_use_id, found, look);

    return (
      <Box flexDirection="column">
        <Box>
          <Text color={e.props.isErrored ? "error" : "success"}>● </Text>
          <Text bold>{e.props.tool}</Text>
          <Text wrap="truncate-middle">{arg}</Text>
        </Box>
        {drawn}
      </Box>
    );
  }).catch(($, e, next) => next(e));

  on("ui.render", { component: "ToolResult" }, async ($, e, next) => {
    if (e.surface !== "terminal" || e.props.isErrored) return next(e);
    const found = findImages(e.props.output);
    if (found.length === 0) return next(e);

    const { Box } = $.ui.resolve(e);
    const drawn = await pictures($, e, e.props.tool_use_id, found, look);

    return <Box flexDirection="column">{drawn}</Box>;
  }).catch(($, e, next) => next(e));
};
