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
