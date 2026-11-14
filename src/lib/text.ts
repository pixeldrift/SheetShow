import type { DesignItem } from "../types";
import { PX_PER_IN } from "./data";
import { fontStack } from "./fonts";

let context: CanvasRenderingContext2D | null = null;
const measure = () => (context ??= document.createElement("canvas").getContext("2d")!);

export const fontSizePx = (item: DesignItem) => (item.fontSize ?? 12) * PX_PER_IN / 72;
export const cssFont = (item: DesignItem) => `${item.italic ? "italic " : ""}${item.weight ?? 500} ${fontSizePx(item)}px ${fontStack(item.fontFamily)}`;

/** Splits text into lines: explicit line breaks always, plus greedy word wrapping to maxWidth (px) when enabled. */
export function layoutLines(text: string, item: DesignItem, maxWidth: number): string[] {
  const paragraphs = text.split(/\r?\n/);
  if (item.wrap === false) return paragraphs;
  const ctx = measure();
  ctx.font = cssFont(item);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    let line = "";
    for (const word of paragraph.split(/(\s+)/)) {
      const candidate = line + word;
      if (line && ctx.measureText(candidate.trimEnd()).width > maxWidth) { lines.push(line.trimEnd()); line = word.trimStart(); }
      else line = candidate;
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

const widest = (lines: string[], item: DesignItem) => {
  const ctx = measure();
  ctx.font = cssFont(item);
  return Math.max(0, ...lines.map((line) => ctx.measureText(line).width));
};

/** Height (px) the given lines need, measured the way CSS does: lines × font size × line height. */
export const textHeight = (lineCount: number, fontPx: number, lineHeight = 1.2) => lineCount * fontPx * lineHeight;

export type TextIssue = "spill" | "truncated";
export type TextLayout = {
  /** The item with its final font size (after any auto-fit). */
  item: DesignItem;
  lines: string[];
  fontPx: number;
  /** Height the text wants, px. */
  needH: number;
  /** null when it fits. "spill" runs past the box; "truncated" was cut off with an ellipsis. */
  issue: TextIssue | null;
  /** A shrinking mode reached its minimum size and the text still doesn't fit. */
  atMin: boolean;
};

const TOL = 0.5;
const sizeCache = new Map<string, { size: number; atMin: boolean }>();

/** Shortens text to the box: as many lines as fit, with the last one ending in "…"; over-wide lines are trimmed too. */
function truncate(lines: string[], item: DesignItem, w: number, h: number, ignoreHeight: boolean): string[] {
  const fontPx = fontSizePx(item), lh = item.lineHeight ?? 1.2;
  let keep = lines.length;
  if (!ignoreHeight) while (keep > 1 && textHeight(keep, fontPx, lh) > h + TOL) keep--;
  const ctx = measure();
  ctx.font = cssFont(item);
  const ellipsize = (line: string) => {
    if (ctx.measureText(line).width <= w + TOL) return line;
    let text = line.trimEnd();
    while (text.length > 1 && ctx.measureText(text + "…").width > w) text = text.slice(0, -1).trimEnd();
    return text + "…";
  };
  const out = lines.slice(0, keep).map((line, i) => (i === keep - 1 && keep < lines.length ? ellipsize(line + " …") : ellipsize(line)));
  return out;
}

/**
 * Lays text out in a w × h (px) box and decides what happens when it doesn't fit.
 * Auto-fit modes pick the largest size that fits (never below the minimum); "overflow" decides what to do if it still won't.
 */
export function layoutText(source: DesignItem, text: string, outerW: number, outerH: number): TextLayout {
  // Padding insets the text from its box (a text box with a background): lay out in the inner area, report the outer height.
  const pad = Math.max(0, (source.padding ?? 0) * PX_PER_IN);
  const w = Math.max(8, outerW - 2 * pad), h = Math.max(8, outerH - 2 * pad);
  const mode = source.autoFit ?? "off";
  const lh = source.lineHeight ?? 1.2;
  let item: DesignItem = mode === "width" ? { ...source, wrap: false } : source;
  let atMin = false;
  if (mode !== "off") {
    const min = Math.max(2, source.minFontSize ?? 4);
    const max = Math.max(min, mode === "fit" ? 300 : (source.fontSize ?? 12));
    const key = [text, mode, min, max, item.fontFamily, item.weight, item.italic, lh, Math.round(w), Math.round(h)].join("|");
    let found = sizeCache.get(key);
    if (!found) {
      const fits = (pt: number) => {
        const trial = { ...item, fontSize: pt };
        const lines = layoutLines(text, trial, w);
        const wideEnough = widest(lines, trial) <= w + TOL;
        return mode === "width" ? wideEnough : wideEnough && textHeight(lines.length, fontSizePx(trial), lh) <= h + TOL;
      };
      let size: number;
      if (fits(max)) size = max;
      else if (!fits(min)) { size = min; atMin = true; }
      else { let lo = min, hi = max; for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; } size = lo; }
      // Round down: rounding up could push a snug fit a pixel or two past the box and report a false overflow.
      found = { size: Math.max(min, Math.floor(size * 10) / 10), atMin: size === min && atMin };
      if (sizeCache.size > 4000) sizeCache.clear();
      sizeCache.set(key, found);
    }
    item = { ...item, fontSize: found.size };
    atMin = found.atMin;
  }
  let lines = layoutLines(text, item, w);
  const fontPx = fontSizePx(item);
  const needH = textHeight(lines.length, fontPx, lh);
  const tooWide = widest(lines, item) > w + TOL;
  const tooTall = mode !== "width" && needH > h + TOL;
  let issue: TextIssue | null = null;
  if (tooWide || tooTall) {
    if (source.overflow === "truncate") { lines = truncate(lines, item, w, h, mode === "width"); issue = "truncated"; }
    else issue = "spill";
  }
  return { item, lines, fontPx, needH: needH + 2 * pad, issue, atMin };
}
