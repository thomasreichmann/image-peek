# Changelog

## 0.4.1 - 2026-10-12

- Claude Code's theme setting is no longer read (reading settings holds a
  directory listing for review). Without the `background` option,
  see-through edges blend over dark grey; on a light theme, set it.
- Internal: no accessor properties.

## 0.4.0 - 2026-10-12

- WebP is decoded inside the mod too: lossy (a port of libwebp's decoder,
  pixel-identical to it), lossless, alpha, and an animation's first frame.
- The mod runs no programs any more: the ffmpeg fallback is gone. A JPEG
  kind it refuses (arithmetic-coded, 12-bit, lossless) says so.
- The tmux hint is gone, and with it every environment-variable read and
  the stored flag; the README covers tmux.
- A listing icon and third-party notices for libwebp.

## 0.3.0 - 2026-10-12

- PNG, JPEG (baseline and progressive) and GIF are decoded inside the mod: no
  ffmpeg needed. ffmpeg is now only the fallback for WebP and rare JPEG kinds,
  run through POSIX `sh` so it also works on macOS.
- New options `cellAspect` (default 2) and `background`. The terminal's
  background is no longer assumed to be `#1e1e2e`: without the option,
  see-through edges blend over a guess from Claude Code's theme and no picture
  colour is drawn as the terminal's own.
- `glyphs` defaults to `blocks`, which every font has; `wedges` needs a Nerd
  Font.
- Left blocks use their Unicode widths (U+258D is three eighths).
- A one-time hint when running in tmux without truecolor.

## 0.2.0 - 2026-10-07

- The cell renderer: per cell the glyph and two colours that fit best, in
  OKLab, with the `Raster` element's 4-bit colours and 1024-pair cap handled.
- Options `renderer` and `glyphs`.

## 0.1.0 - 2026-10-06

- First version: half-block previews under image Reads and image tool results.
