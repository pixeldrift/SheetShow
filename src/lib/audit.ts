import type { DesignItem, RecordMeta, RecordRow } from "../types";
import { PX_PER_IN, fieldDisplayName, valueFor } from "./data";
import { layoutText, type TextIssue } from "./text";
import { paddingsOf } from "./shape";

export type TextProblemKind = TextIssue | "outside";
export type Issue = {
  recordId: string;
  recordIndex: number;
  recordLabel: string;
  itemId: string;
  itemLabel: string;
  kind: TextProblemKind;
  atMin: boolean;
};

export const recordLabel = (record: RecordRow) => record.name || Object.entries(record).find(([k, v]) => !k.startsWith("__") && v)?.[1] || "(empty)";
export const itemLabel = (item: DesignItem) => (item.field ? fieldDisplayName(item.field) : (item.text ?? "").split("\n")[0].slice(0, 28) || "Text");

/**
 * Whether a text will actually cause trouble when printed. Text that runs past its own (invisible) box but stays on the card is
 * fine and isn't flagged; these are: text that is cut off, text that runs off the edge of the card, and text that spills out of
 * a box you can see (one with a background or frame).
 */
export function textProblem(item: DesignItem, record: RecordRow, meta: RecordMeta, card: { w: number; h: number }): { kind: TextProblemKind; atMin: boolean } | null {
  const layout = layoutText(item, valueFor(item, record, meta), item.w * PX_PER_IN, item.h * PX_PER_IN);
  if (!layout.issue) return null;
  if (layout.issue === "truncated") return { kind: "truncated", atMin: layout.atMin };
  if (item.rotation) return null; // the extents of turned text aren't measured here
  const [, pr, , pl] = paddingsOf(item);
  const innerL = item.x + pl, innerW = item.w - pl - pr, textW = layout.textW / PX_PER_IN;
  const left = item.align === "center" ? innerL + innerW / 2 - textW / 2 : item.align === "right" ? innerL + innerW - textW : innerL;
  const right = left + textW, bottom = item.y + layout.needH / PX_PER_IN, tol = 0.01;
  if (left < -tol || right > card.w + tol || bottom > card.h + tol || item.y < -tol) return { kind: "outside", atMin: layout.atMin };
  const visibleBox = !!item.fill || (!!item.stroke && item.stroke !== "none");
  return visibleBox ? { kind: "spill", atMin: layout.atMin } : null;
}

/** Text objects in one instance that will cause trouble (see textProblem). */
export function instanceIssues(items: DesignItem[], record: RecordRow, meta: RecordMeta, card: { w: number; h: number }): { item: DesignItem; kind: TextProblemKind; atMin: boolean }[] {
  const out: { item: DesignItem; kind: TextProblemKind; atMin: boolean }[] = [];
  for (const item of items) {
    if (item.type !== "text" || item.visible === false || item.reference) continue;
    const problem = textProblem(item, record, meta, card);
    if (problem) out.push({ item, ...problem });
  }
  return out;
}
