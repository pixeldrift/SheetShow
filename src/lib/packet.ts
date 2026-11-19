import type { Plan, Sheet } from "../types";
import { numbering, placementsOf } from "./placements";

/** One printed sheet: which page design, and which records it shows (from `base`, up to but not past `limit`). */
export type SheetRef = { pageId: string; base: number; limit: number; group: number };

export const defaultPlan = (firstPageId: string): Plan => ({ group: 0, steps: [{ id: "s1", pageId: firstPageId }] });

/** How many different records one sheet of this page design shows. */
export const perSheetOf = (sheet: Sheet, w: number, h: number) => numbering(placementsOf(sheet, w, h)).perSheet;

/**
 * Every sheet that prints, in order. Records go in packets of `plan.group` (all of them when 0); within a packet, each step prints
 * as many sheets of its page design as the packet's records need, so a letter (one record per sheet) prints once per person and a
 * badge sheet once per eight.
 */
export function buildSequence(plan: Plan, sheets: Record<string, Sheet>, w: number, h: number, recordCount: number): SheetRef[] {
  const steps = plan.steps.filter((s) => sheets[s.pageId]);
  if (!steps.length) return [];
  if (recordCount === 0) return [{ pageId: steps[0].pageId, base: 0, limit: 0, group: 0 }];
  const per = new Map(Object.entries(sheets).map(([id, s]) => [id, perSheetOf(s, w, h)]));
  const size = plan.group > 0 ? plan.group : recordCount;
  const out: SheetRef[] = [];
  for (let start = 0, packet = 0; start < recordCount; start += size, packet++) {
    const count = Math.min(size, recordCount - start);
    for (const step of steps) {
      if (step.when && !(packet + 1 >= step.when.start && (packet + 1 - step.when.start) % Math.max(1, step.when.every) === 0)) continue;
      const k = per.get(step.pageId) ?? 1;
      for (let j = 0; j < Math.ceil(count / k); j++) out.push({ pageId: step.pageId, base: start + j * k, limit: start + count, group: packet });
    }
  }
  return out.length ? out : [{ pageId: steps[0].pageId, base: 0, limit: recordCount, group: 0 }];
}

/** The first sheet that shows a record, or -1. */
export const sheetIndexOf = (seq: SheetRef[], recordIndex: number, perSheet: (pageId: string) => number): number =>
  seq.findIndex((s) => recordIndex >= s.base && recordIndex < Math.min(s.limit, s.base + perSheet(s.pageId)));

/** One plain sentence about what will print, for the Output tab and the top of the page layout settings. */
export function describePlan(plan: Plan, pageName: (id: string) => string, sheetCount: number, recordCount: number): string {
  const names = plan.steps.map((s) => pageName(s.pageId));
  const sheets = `${sheetCount} ${sheetCount === 1 ? "sheet" : "sheets"}`;
  const people = `${recordCount} ${recordCount === 1 ? "record" : "records"}`;
  if (plan.steps.length === 1) return `Prints ${people} on ${sheets} · ${names[0]}`;
  if (plan.group === 1) return `Each record gets ${plan.steps.length} pages (${names.join(", ")}) · ${sheets} in all`;
  if (plan.group > 1) return `In sets of ${plan.group} records: ${names.join(", ")} · ${sheets} in all`;
  return `${names.join(", then ")}, each for all ${people} · ${sheets} in all`;
}
