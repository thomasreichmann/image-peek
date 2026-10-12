import type {
  EngineInterface,
  Register,
  RenderViewport,
  ResolveInput,
} from "claude-code";

import { caption, cells, findImages, fit, parsePam } from "./pixels";
import type { Found, Pixmap } from "./pixels";
import { CELL_ASPECT, render, strips } from "./render";
import type { Glyphs } from "./render";

// Image Reads fold into a ToolGroup line ("read 2 files"), which hides them.
// A group holding an image is unfolded, so each call becomes a ToolUse row,
// and an image call's row is drawn here: the engine's header and result line,
// then the picture. A standalone call's result (ToolResult) gets the same
// picture under its line.
//
// Pictures are decoded once by ffmpeg into a PAM of at most 768 px a side
// (base64 of 768² RGBA is 3 MB, under `process.run`'s 4 MB stdout) and drawn
// per box size by render.ts, ~25 ms, kept, so a scroll redraw costs nothing.

const INDENT = 5; // "  ⎿  "
const MARGIN = 6; // kept free right of a picture
const DECODE_PX = 768;
const KEEP = 48;

const DECODE = [
  "bash",
  "-c",
  "set -o pipefail; base64 -d | ffmpeg -v error -i pipe:0 -frames:v 1" +
    ` -vf "scale='min(${DECODE_PX},iw)':'min(${DECODE_PX},ih)':force_original_aspect_ratio=decrease:flags=area"` +
    " -pix_fmt rgba -c:v pam -f image2pipe pipe:1 | base64 -w0",
];

type Look = {
  maxColumns: number;
  maxRows: number;
  renderer: "cells" | "half" | "image";
  glyphs: Glyphs;
};

/** A decoded picture, or why there is none. */
type Decoded = Pixmap | string;

// Caches, not state: a reload decodes and draws again on the next draw.
const decoded = new Map<string, Promise<Decoded>>();
const drawn = new Map<string, Uint32Array>();
// Calls whose group this mod unfolded: their ToolUse rows carry the picture.
const unfolded = new Set<string>();

async function runDecode($: EngineInterface, found: Found): Promise<Decoded> {
  try {
    const run = await $.process.run(DECODE, {
      stdin: found.base64,
      timeoutMs: 15_000,
    });
    if (run.exitCode !== 0) {
      return run.stderr.trim().split("\n")[0] || `ffmpeg exited ${run.exitCode}`;
    }

    return parsePam(Uint8Array.fromBase64(run.stdout.trim())) ?? "unreadable decode";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function decode($: EngineInterface, key: string, found: Found): Promise<Decoded> {
  const known = decoded.get(key);
  if (known !== undefined) return known;

  const job = runDecode($, found);
  decoded.set(key, job);
  while (decoded.size > KEEP) {
    decoded.delete(decoded.keys().next().value as string);
  }

  return job;
}

/** The picture's cells for a box, drawn once per key, size and glyphs. */
function cellWords(key: string, pic: Pixmap, columns: number, rows: number, glyphs: Glyphs) {
  const at = `${key}:${columns}x${rows}:${glyphs}`;
  let known = drawn.get(at);
  if (known === undefined) {
    known = render(pic, columns, rows, { glyphs });
    drawn.set(at, known);
    while (drawn.size > KEEP) {
      drawn.delete(drawn.keys().next().value as string);
    }
  }

  return known;
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
  const results = await Promise.all(
    found.map((one, i) => decode($, `${id}:${i}`, one)),
  );

  return found.map((one, i) => {
    const pic = results[i] ?? "not decoded";
    const lead = i === 0 ? "  ⎿  " : "     ";
    const key = `${id}:${i}`;
    const maxColumns = Math.min(look.maxColumns, width);
    let body;
    if (typeof pic === "string") {
      body = <Text dimColor>(no preview: {pic})</Text>;
    } else if (look.renderer === "image") {
      const box = fit(pic, maxColumns, look.maxRows, CELL_ASPECT);
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
      const box = fit(pic, maxColumns, look.maxRows, CELL_ASPECT);
      const words = cellWords(key, pic, box.columns, box.rows, look.glyphs);
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
  const look: Look = {
    maxColumns: Number(options.maxColumns) || 64,
    maxRows: Number(options.maxRows) || 18,
    renderer: options.renderer === "image" || options.renderer === "half" ? options.renderer : "cells",
    glyphs: options.glyphs === "blocks" ? "blocks" : "wedges",
  };

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
