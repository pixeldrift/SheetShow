import type { DesignItem, RecordMeta, RecordRow } from "../types";
import { PX_PER_IN, fieldDisplayName, valueFor } from "./data";
import { layoutText, type TextIssue } from "./text";

export type Issue = {
  recordId: string;
  recordIndex: number;
  recordLabel: string;
  itemId: string;
  itemLabel: string;
  kind: TextIssue;
  atMin: boolean;
};

export const recordLabel = (record: RecordRow) => record.name || Object.entries(record).find(([k, v]) => !k.startsWith("__") && v)?.[1] || "(empty)";
export const itemLabel = (item: DesignItem) => (item.field ? fieldDisplayName(item.field) : (item.text ?? "").split("\n")[0].slice(0, 28) || "Text");

/** Text objects in one instance whose text doesn't fit its box (or was cut off to make it fit). */
export function instanceIssues(items: DesignItem[], record: RecordRow, meta: RecordMeta): { item: DesignItem; kind: TextIssue; atMin: boolean }[] {
  const out: { item: DesignItem; kind: TextIssue; atMin: boolean }[] = [];
  for (const item of items) {
    if (item.type !== "text" || item.visible === false || item.reference) continue;
    const layout = layoutText(item, valueFor(item, record, meta), item.w * PX_PER_IN, item.h * PX_PER_IN);
    if (layout.issue) out.push({ item, kind: layout.issue, atMin: layout.atMin });
  }
  return out;
}
