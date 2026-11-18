import type { Placement, Sheet } from "../types";

/** Reading order: top to bottom, then left to right (cards within 0.05″ of the same height count as one row). */
export function readingOrder<T extends { x: number; y: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => (Math.abs(a.y - b.y) > 0.05 ? a.y - b.y : a.x - b.x));
}

/** The cards a columns-and-rows grid describes. Numbers follow the sheet's "one record per sheet" / "each card a new record" setting. */
export function gridPlacements(sheet: Sheet, w: number, h: number): Placement[] {
  const out: Placement[] = [];
  for (let r = 0; r < sheet.rows; r++) for (let c = 0; c < sheet.columns; c++) {
    const i = r * sheet.columns + c;
    out.push({ id: `g${i}`, x: Number((sheet.marginX + c * (w + sheet.gapX)).toFixed(4)), y: Number((sheet.marginY + r * (h + sheet.gapY)).toFixed(4)), number: sheet.repeatMode === "same" ? 1 : i + 1 });
  }
  return out;
}

/** The space a card takes on the page: the template size, swapped when it is turned a quarter. */
export const footprint = (p: Placement, w: number, h: number) => (p.rotation === 90 || p.rotation === 270 ? { w: h, h: w } : { w, h });

export const isCustomLayout = (sheet: Sheet) => !!sheet.placements;
/** Every card on a page, whether it came from the grid or was placed by hand. */
export const placementsOf = (sheet: Sheet, w: number, h: number): Placement[] => (sheet.placements ?? gridPlacements(sheet, w, h));

/** How many different records one sheet shows, and which rank (1, 2, 3…) each number has once gaps are closed up. */
export function numbering(list: Placement[]) {
  const distinct = [...new Set(list.map((p) => Math.max(1, Math.round(p.number))))].sort((a, b) => a - b);
  const rank = new Map(distinct.map((n, i) => [n, i + 1]));
  return { perSheet: Math.max(1, distinct.length), rankOf: (p: Placement) => rank.get(Math.max(1, Math.round(p.number))) ?? 1 };
}

/** The index of the record a card shows on a sheet whose first record is `base` (0-based); may be past the end of the data. */
export const recordAt = (list: Placement[], p: Placement, base: number): number => base + numbering(list).rankOf(p) - 1;

/** How the numbers are arranged: every card the same record, each card its own (in reading order), or something else. */
export function numberingMode(list: Placement[]): "same" | "each" | "custom" {
  if (list.length && list.every((p) => p.number === 1)) return "same";
  const ordered = readingOrder(list);
  return ordered.every((p, i) => p.number === i + 1) ? "each" : "custom";
}

/** Renumbers every card: all 1, or 1, 2, 3… in reading order. */
export function renumber(list: Placement[], mode: "same" | "each"): Placement[] {
  if (mode === "same") return list.map((p) => ({ ...p, number: 1 }));
  const order = new Map(readingOrder(list).map((p, i) => [p.id, i + 1]));
  return list.map((p) => ({ ...p, number: order.get(p.id) ?? p.number }));
}

/** Cards in the order their records come: by number, then by reading order. Used to draw the order arrows. */
export const sequence = (list: Placement[]): Placement[] => {
  const order = new Map(readingOrder(list).map((p, i) => [p.id, i]));
  return [...list].sort((a, b) => a.number - b.number || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
};

/** The next empty spot for a card of this size: first free grid position in reading order, or the page corner. */
export function freeSpot(list: Placement[], w: number, h: number, pageW: number, pageH: number, step = 0.25): { x: number; y: number } {
  const hits = (x: number, y: number) => list.some((p) => { const f = footprint(p, w, h); return x < p.x + f.w - 0.01 && x + w > p.x + 0.01 && y < p.y + f.h - 0.01 && y + h > p.y + 0.01; });
  for (let y = 0; y + h <= pageH + 1e-6; y += step) for (let x = 0; x + w <= pageW + 1e-6; x += step) if (!hits(x, y)) return { x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) };
  return { x: 0, y: 0 };
}

/**
 * Crop marks sit in the page margins, in line with every card edge, so they never touch the artwork. Coordinates are in inches.
 */
export function cropMarkLines(list: Placement[], w: number, h: number, pageW: number, pageH: number): [number, number, number, number][] {
  if (!list.length) return [];
  const out: [number, number, number, number][] = [];
  const offset = 0.04;
  const fp = list.map((p) => ({ p, f: footprint(p, w, h) }));
  const xs = [...new Set(fp.flatMap(({ p, f }) => [p.x, p.x + f.w]))], ys = [...new Set(fp.flatMap(({ p, f }) => [p.y, p.y + f.h]))];
  const gridLeft = Math.min(...list.map((p) => p.x)), gridTop = Math.min(...list.map((p) => p.y));
  const gridRight = Math.max(...fp.map(({ p, f }) => p.x + f.w)), gridBottom = Math.max(...fp.map(({ p, f }) => p.y + f.h));
  const room = (space: number) => Math.min(0.15, Math.max(0, space - offset - 0.02));
  const top = room(gridTop), left = room(gridLeft), bottom = room(pageH - gridBottom), right = room(pageW - gridRight);
  for (const x of xs) {
    if (top > 0) out.push([x, gridTop - offset - top, x, gridTop - offset]);
    if (bottom > 0) out.push([x, gridBottom + offset, x, gridBottom + offset + bottom]);
  }
  for (const y of ys) {
    if (left > 0) out.push([gridLeft - offset - left, y, gridLeft - offset, y]);
    if (right > 0) out.push([gridRight + offset, y, gridRight + offset + right, y]);
  }
  return out;
}
