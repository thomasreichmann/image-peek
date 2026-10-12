// The plugin's options (`userConfig` in plugin.json) as the module uses them,
// each falling back to its default when unset or out of range.

import { DEFAULT_ASPECT } from "./render";
import type { Glyphs } from "./render";

export type Look = {
  maxColumns: number;
  maxRows: number;
  renderer: "cells" | "half" | "image";
  glyphs: Glyphs;
  /** A cell's height over its width. */
  aspect: number;
  /** The terminal's background as the person gave it; unset, unknown. */
  background: number | undefined;
};

/** `#rrggbb` (or `rrggbb`) as a colour; anything else is unset. */
export function parseColor(text: unknown): number | undefined {
  const m = typeof text === "string" ? /^#?([0-9a-f]{6})$/i.exec(text.trim()) : null;

  return m ? parseInt(m[1]!, 16) : undefined;
}

export function readLook(options: Readonly<Record<string, unknown>>): Look {
  const aspect = Number(options.cellAspect);

  return {
    maxColumns: Number(options.maxColumns) || 64,
    maxRows: Number(options.maxRows) || 18,
    renderer: options.renderer === "image" || options.renderer === "half" ? options.renderer : "cells",
    glyphs: options.glyphs === "wedges" ? "wedges" : "blocks",
    aspect: aspect >= 1 && aspect <= 4 ? aspect : DEFAULT_ASPECT,
    background: parseColor(options.background),
  };
}
