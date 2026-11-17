import type { LabelPreset, Sheet } from "../types";
import { averyPresets } from "./data";

export type Paper = { id: string; name: string; width: number; height: number };

/** Common sheet and card sizes, in inches (portrait). */
export const PAPER_SIZES: Paper[] = [
  { id: "letter", name: "Letter", width: 8.5, height: 11 },
  { id: "legal", name: "Legal", width: 8.5, height: 14 },
  { id: "tabloid", name: "Tabloid", width: 11, height: 17 },
  { id: "a4", name: "A4", width: 8.27, height: 11.69 },
  { id: "a5", name: "A5", width: 5.83, height: 8.27 },
  { id: "a6", name: "A6", width: 4.13, height: 5.83 },
  { id: "5x7", name: "5 × 7 card", width: 5, height: 7 },
  { id: "4x6", name: "4 × 6 card", width: 4, height: 6 },
];

const near = (a: number, b: number) => Math.abs(a - b) < 0.006;
/** The paper a width and height describe, in either orientation. */
export const paperMatch = (w: number, h: number): Paper | undefined => PAPER_SIZES.find((p) => (near(p.width, w) && near(p.height, h)) || (near(p.width, h) && near(p.height, w)));
export const sizeText = (w: number, h: number) => `${Number(w.toFixed(3))} × ${Number(h.toFixed(3))} in`;
export const paperLabel = (p: Paper) => `${p.name} (${sizeText(p.width, p.height)})`;

/** The page layout for one design filling a whole page of the given size. */
export const wholePage = (width: number, height: number, base: Sheet): Sheet => ({ ...base, pageWidth: width, pageHeight: height, columns: 1, rows: 1, gapX: 0, gapY: 0, marginX: 0, marginY: 0 });

/** The page layout for a label stock sheet. */
export const stockSheet = (preset: LabelPreset, base: Sheet): Sheet => ({ ...base, pageWidth: 8.5, pageHeight: 11, columns: preset.columns, rows: preset.rows, gapX: preset.gapX, gapY: preset.gapY, marginX: preset.marginX, marginY: preset.marginY });

/** A letter page with as many copies of a w × h item as fit (or a page the size of the item when it is bigger than a letter sheet). */
export function customSheet(width: number, height: number, base: Sheet): Sheet {
  if (width > 8 || height > 10.5) return wholePage(width, height, base);
  const margin = 0.25;
  return { ...base, pageWidth: 8.5, pageHeight: 11, columns: Math.max(1, Math.floor((8.5 - margin * 2) / width)), rows: Math.max(1, Math.floor((11 - margin * 2) / height)), gapX: 0, gapY: 0, marginX: margin, marginY: margin };
}

/** What the current template and page layout are, in words: a label stock, a paper size, or custom. */
export function describeSize(width: number, height: number, sheet: Sheet): { title: string; detail: string; kind: "stock" | "paper" | "custom" } {
  const stock = sheet.placements ? undefined : averyPresets.find((p) => near(p.width, width) && near(p.height, height) && p.columns === sheet.columns && p.rows === sheet.rows && near(p.gapX, sheet.gapX) && near(p.gapY, sheet.gapY) && near(p.marginX, sheet.marginX) && near(p.marginY, sheet.marginY) && near(8.5, sheet.pageWidth) && near(11, sheet.pageHeight));
  if (stock) return { title: `Avery ${stock.code}`, detail: stock.name, kind: "stock" };
  const paper = paperMatch(width, height);
  const count = sheet.placements?.length ?? sheet.columns * sheet.rows;
  if (paper && count === 1) return { title: paperLabel(paper), detail: "One design fills each page.", kind: "paper" };
  return { title: "Custom", detail: `${sizeText(width, height)} · ${count} per sheet.`, kind: "custom" };
}
