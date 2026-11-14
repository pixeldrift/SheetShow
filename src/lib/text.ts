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
  return Math.max(...lines.map((line) => ctx.measureText(line).width));
};

/** Height (px) the given lines need: first baseline, line steps, and room for descenders. */
export const textHeight = (lineCount: number, fontPx: number, lineHeight = 1.2) => fontPx * 1.4 + (lineCount - 1) * fontPx * lineHeight;

const fitCache = new Map<string, number>();

/**
 * Returns the item with its font size adjusted to fit a w × h (px) box when auto-fit is on.
 * "shrink" never exceeds the size set in the inspector; "fit" also grows text to fill the box.
 */
export function withAutoFit(item: DesignItem, text: string, w: number, h: number): DesignItem {
  if (item.type !== "text" || !item.autoFit || item.autoFit === "off") return item;
  const max = item.autoFit === "shrink" ? (item.fontSize ?? 12) : 300;
  const key = [text, item.autoFit, max, item.fontFamily, item.weight, item.italic, item.lineHeight, item.wrap, Math.round(w), Math.round(h)].join("|");
  let size = fitCache.get(key);
  if (size === undefined) {
    const fits = (pt: number) => {
      const trial = { ...item, fontSize: pt };
      const lines = layoutLines(text, trial, w);
      return textHeight(lines.length, fontSizePx(trial), item.lineHeight ?? 1.2) <= h && widest(lines, trial) <= w + 0.5;
    };
    let lo = 4, hi = Math.max(4, max);
    if (fits(hi)) size = hi;
    else { for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; } size = lo; }
    size = Math.round(size * 10) / 10;
    if (fitCache.size > 3000) fitCache.clear();
    fitCache.set(key, size);
  }
  return { ...item, fontSize: size };
}
