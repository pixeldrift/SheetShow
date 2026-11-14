import type { RecordRow } from "../types";
import { ID } from "./records";
import { uid } from "./data";
import { suggestMapping } from "./mapping";

/** Where an incoming column goes: an existing column, or "new" (it becomes a new column), or skipped. */
export const NEW_COLUMN = "__new__";
export type ColumnPlan = Record<string, string | null>;
export type Duplicates = "fill" | "update" | "keep";

/** Best guess for each incoming column: the existing column it most likely is, else a new column. */
export function suggestColumns(existing: string[], incoming: string[]): ColumnPlan {
  const guess = suggestMapping(incoming, existing);
  return Object.fromEntries(incoming.map((c) => [c, guess[c].column ?? NEW_COLUMN]));
}

/** A sensible "same person / same item" key: an id-like existing column that the incoming data fills. */
export function suggestKey(existing: string[], plan: ColumnPlan): string[] {
  const filled = new Set(Object.values(plan).filter((v): v is string => !!v && v !== NEW_COLUMN));
  const pool = existing.filter((c) => filled.has(c));
  const idLike = pool.find((c) => /^(id|email|e-?mail|band|sku|number|code|serial|barcode)\b/i.test(c));
  return [idLike ?? pool.find((c) => /^name\b/i.test(c)) ?? pool[0]].filter(Boolean) as string[];
}

const keyOf = (row: RecordRow, key: string[]) => {
  const parts = key.map((k) => (row[k] ?? "").trim().toLowerCase());
  return parts.every((p) => !p) ? null : parts.join("\u0001"); // a row with no key never matches anything
};

export type ImportResult = { rows: RecordRow[]; added: number; merged: number; duplicatesInFile: number; newColumns: string[] };

/** Re-keys incoming rows by the chosen columns. */
const retarget = (row: RecordRow, plan: ColumnPlan): RecordRow => {
  const out: RecordRow = {};
  for (const [from, to] of Object.entries(plan)) {
    if (to === null) continue; // skipped
    const column = to === NEW_COLUMN ? from : to;
    if ((row[from] ?? "") !== "" || out[column] === undefined) out[column] = row[from] ?? "";
  }
  return out;
};

/**
 * Adds incoming rows to the existing ones. With `key` columns (merge), rows that match an existing row — or an
 * earlier incoming row — are combined into it instead of being added again, per `onDuplicate`.
 */
export function planImport(existing: RecordRow[], incoming: RecordRow[], plan: ColumnPlan, key: string[] | null, onDuplicate: Duplicates): ImportResult {
  const rows = existing.map((r) => ({ ...r }));
  const index = new Map<string, number>();
  if (key) rows.forEach((row, i) => { const k = keyOf(row, key); if (k && !index.has(k)) index.set(k, i); });
  const knownColumns = new Set(existing.flatMap((r) => Object.keys(r).filter((c) => !c.startsWith("__"))));
  const newColumns = [...new Set(Object.entries(plan).filter(([, to]) => to === NEW_COLUMN).map(([from]) => from))].filter((c) => !knownColumns.has(c));
  let added = 0, merged = 0, duplicatesInFile = 0;
  const fromThisFile = new Set<number>();
  for (const source of incoming) {
    const row = retarget(source, plan);
    const k = key ? keyOf(row, key) : null;
    const at = k ? index.get(k) : undefined;
    if (at !== undefined) {
      if (fromThisFile.has(at)) duplicatesInFile++; else merged++;
      const target = rows[at];
      if (onDuplicate === "update") for (const [c, v] of Object.entries(row)) { if (v !== "") target[c] = v; }
      else if (onDuplicate === "fill") for (const [c, v] of Object.entries(row)) { if (v !== "" && !(target[c] ?? "").trim()) target[c] = v; }
      continue;
    }
    rows.push({ ...row, [ID]: uid() });
    if (k) index.set(k, rows.length - 1);
    fromThisFile.add(rows.length - 1);
    added++;
  }
  return { rows, added, merged, duplicatesInFile, newColumns };
}
