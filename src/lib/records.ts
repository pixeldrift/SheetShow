import Papa from "papaparse";
import type { RecordRow } from "../types";
import { uid } from "./data";

/** Hidden per-row bookkeeping stored on each record (keys starting "__" never appear as data fields). */
export const ID = "__id";
export const SKIP = "__skip";

export const isDataKey = (key: string) => !key.startsWith("__");
export const isIncluded = (row: RecordRow) => !row[SKIP];

export const columnsOf = (rows: RecordRow[]): string[] => {
  const columns: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) for (const key of Object.keys(row)) if (isDataKey(key) && !seen.has(key)) { seen.add(key); columns.push(key); }
  return columns;
};

export const withIds = (rows: RecordRow[]): RecordRow[] => rows.map((row) => (row[ID] ? row : { ...row, [ID]: uid() }));

export const blankRow = (columns: string[]): RecordRow => ({ ...Object.fromEntries(columns.map((c) => [c, ""])), [ID]: uid() });

/** A table is never left with zero rows, so its columns are never lost. */
export const keepOneRow = (rows: RecordRow[], columns: string[]) => (rows.length ? rows : [blankRow(columns)]);

export const setCell = (rows: RecordRow[], id: string, column: string, value: string) =>
  rows.map((row) => (row[ID] === id ? { ...row, [column]: value } : row));

export const setIncluded = (rows: RecordRow[], ids: Set<string>, included: boolean) =>
  rows.map((row) => {
    if (!ids.has(row[ID])) return row;
    const { [SKIP]: _skip, ...rest } = row;
    return included ? rest : { ...rest, [SKIP]: "1" };
  });

export const renameColumn = (rows: RecordRow[], from: string, to: string) =>
  rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key === from ? to : key, value])) as RecordRow);

export const removeColumn = (rows: RecordRow[], column: string) =>
  rows.map((row) => { const { [column]: _gone, ...rest } = row; return rest; });

export const addColumn = (rows: RecordRow[], column: string) => rows.map((row) => ({ ...row, [column]: "" }));

/** Numbers sort numerically, text sorts naturally, blanks go last. */
export function sortRows(rows: RecordRow[], column: string, direction: 1 | -1): RecordRow[] {
  return [...rows].sort((a, b) => {
    const x = a[column] ?? "", y = b[column] ?? "";
    if (!x && !y) return 0;
    if (!x) return 1;
    if (!y) return -1;
    return direction * x.localeCompare(y, undefined, { numeric: true, sensitivity: "base" });
  });
}

export function duplicateRows(rows: RecordRow[], ids: Set<string>): RecordRow[] {
  return rows.flatMap((row) => (ids.has(row[ID]) ? [row, { ...row, [ID]: uid() }] : [row]));
}

/** Pastes a block copied from a spreadsheet, starting at a cell and growing the table if the block runs past the end. */
export function pasteGrid(rows: RecordRow[], columns: string[], startId: string, startColumn: string, grid: string[][]): RecordRow[] {
  const startRow = rows.findIndex((row) => row[ID] === startId);
  const startCol = columns.indexOf(startColumn);
  if (startRow < 0 || startCol < 0) return rows;
  const next = [...rows];
  grid.forEach((cells, r) => {
    if (startRow + r >= next.length) next.push(blankRow(columns));
    const target = { ...next[startRow + r] };
    cells.forEach((value, c) => { const column = columns[startCol + c]; if (column) target[column] = value; });
    next[startRow + r] = target;
  });
  return next;
}

export const toCsv = (rows: RecordRow[], columns: string[]) =>
  Papa.unparse({ fields: columns, data: rows.map((row) => columns.map((column) => row[column] ?? "")) });

/** Moves `column` to sit before (or after) `target`. Every row is rebuilt so the new order is what the columns are everywhere. */
export function reorderColumns(rows: RecordRow[], column: string, target: string, after: boolean): RecordRow[] {
  const order = columnsOf(rows).filter((c) => c !== column);
  const at = order.indexOf(target);
  if (at < 0 || column === target) return rows;
  order.splice(after ? at + 1 : at, 0, column);
  return rows.map((row) => {
    const next: RecordRow = {};
    for (const key of Object.keys(row)) if (!order.includes(key)) next[key] = row[key]; // internal keys (id, included) first
    for (const key of order) next[key] = row[key] ?? "";
    return next;
  });
}
