import { renameTokens, tokenFields } from "./merge";
import type { DesignItem } from "../types";
import { fieldDisplayName } from "./data";
import { ruleFields } from "./conditions";

/** Distinct data fields the template is linked to (automatic `__` fields excluded), in first-use order. */
export const boundFields = (items: DesignItem[]): string[] =>
  [...new Set(items.flatMap((item) => [...(item.field ? [item.field] : tokenFields(item.text ?? "")), ...ruleFields(item)].filter((f) => !f.startsWith("__"))))];

/** "Hatched" → "hatch", "Bands" → "band": enough stemming to line up ordinary header variations. */
const stem = (word: string) => word.replace(/(ing|ed|es|s)$/, (m, _s, offset) => (offset >= 3 ? "" : m));

/** Splits on punctuation, spaces, underscores and camelCase: "Leg Band #" → ["leg", "band"]. */
const tokens = (text: string) =>
  text.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map(stem);

const squash = (text: string) => tokens(text).join("");

function editSimilarity(a: string, b: string) {
  if (!a || !b) return 0;
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = row[j];
      row[j] = next;
    }
  }
  return 1 - row[b.length] / Math.max(a.length, b.length);
}

/** 0–1: how likely two column names mean the same thing. */
export function nameSimilarity(a: string, b: string): number {
  const sa = squash(a), sb = squash(b);
  if (!sa || !sb) return 0;
  if (sa === sb) return 1;
  const ta = new Set(tokens(a)), tb = new Set(tokens(b));
  const shared = [...ta].filter((t) => tb.has(t)).length;
  const overlap = shared / (ta.size + tb.size - shared);
  // One name wholly inside the other ("name" in "bird name"): a good sign, weighted by how much of the longer it covers.
  const contained = sa.includes(sb) || sb.includes(sa) ? 0.6 + 0.4 * (Math.min(sa.length, sb.length) / Math.max(sa.length, sb.length)) : 0;
  const subset = shared > 0 && (shared === ta.size || shared === tb.size) ? 0.55 + 0.45 * overlap : 0;
  return Math.max(overlap, contained, subset, editSimilarity(sa, sb));
}

export type Suggestion = { column: string | null; score: number };
export const MATCH_THRESHOLD = 0.58;

/**
 * Pairs each template field with its most likely column. Exact names win first, then the best remaining
 * scores; a column is never used twice, and weak matches are left unmatched for the person to decide.
 */
export function suggestMapping(templateFields: string[], columns: string[]): Record<string, Suggestion> {
  const result: Record<string, Suggestion> = Object.fromEntries(templateFields.map((f) => [f, { column: null, score: 0 }]));
  const pairs = templateFields.flatMap((field) => columns.map((column) => ({ field, column, score: column === field ? 2 : nameSimilarity(field, column) })))
    .filter((pair) => pair.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score);
  const usedColumns = new Set<string>();
  for (const { field, column, score } of pairs) {
    if (result[field].column || usedColumns.has(column)) continue;
    result[field] = { column, score: Math.min(1, score) };
    usedColumns.add(column);
  }
  return result;
}

/** Re-points linked text, and the fields used in conditional rules, at the chosen columns. Placeholder text that was just the old field name follows the new one. */
export function applyMapping(items: DesignItem[], mapping: Record<string, string | null>): DesignItem[] {
  return items.map((item) => {
    let next = item;
    const target = item.field ? mapping[item.field] : undefined;
    if (item.field && target && target !== item.field) {
      const wasPlaceholder = item.text === fieldDisplayName(item.field);
      next = { ...next, field: target, text: wasPlaceholder ? fieldDisplayName(target) : item.text };
    }
    if (!item.field && item.text) { const t = renameTokens(item.text, mapping); if (t !== item.text) next = { ...next, text: t }; }
    if (item.imageSource?.mode === "pattern") { const p = renameTokens(item.imageSource.pattern, mapping); if (p !== item.imageSource.pattern) next = { ...next, imageSource: { mode: "pattern", pattern: p } }; }
    if (item.imageSource?.mode === "column" && mapping[item.imageSource.column] && mapping[item.imageSource.column] !== item.imageSource.column) next = { ...next, imageSource: { mode: "column", column: mapping[item.imageSource.column]! } };
    if (item.rules?.some((r) => r.when?.conditions.some((c) => mapping[c.field] && mapping[c.field] !== c.field))) {
      next = { ...next, rules: item.rules.map((r) => (r.when ? { ...r, when: { ...r.when, conditions: r.when.conditions.map((c) => ({ ...c, field: mapping[c.field] || c.field })) } } : r)) };
    }
    return next;
  });
}
