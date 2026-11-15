import Papa from "papaparse";
import type { RecordRow } from "../types";

export type Delimiter = "auto" | "\t" | "," | ";" | "|";

/** Rows of cells from pasted text. Cells copied from a spreadsheet arrive tab-separated; a CSV works too. */
export function parseGrid(text: string, delimiter: Delimiter = "auto"): string[][] {
  const trimmed = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n").replace(/\n+$/, "");
  if (!trimmed.trim()) return [];
  const result = Papa.parse<string[]>(trimmed, { delimiter: delimiter === "auto" ? "" : delimiter, skipEmptyLines: "greedy", delimitersToGuess: ["\t", ",", ";", "|"] });
  return result.data.map((row) => row.map((cell) => String(cell ?? "").trim()));
}

/** Turns rows of cells into records. With a header row its cells name the columns; otherwise they are called Column 1, Column 2… */
export function gridToRecords(grid: string[][], firstRowIsHeader: boolean): RecordRow[] {
  if (!grid.length) return [];
  const width = Math.max(...grid.map((r) => r.length));
  const raw = firstRowIsHeader ? grid[0] : [];
  const names: string[] = [];
  for (let i = 0; i < width; i++) {
    let name = (raw[i] ?? "").trim() || `Column ${i + 1}`;
    const base = name;
    for (let n = 2; names.includes(name); n++) name = `${base} ${n}`;
    names.push(name);
  }
  return grid.slice(firstRowIsHeader ? 1 : 0)
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row) => Object.fromEntries(names.map((name, i) => [name, row[i] ?? ""])) as RecordRow);
}
