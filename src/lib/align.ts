import type { DesignItem } from "../types";

export type AlignMode = "left" | "center" | "right" | "top" | "middle" | "bottom";
export type Box = { x: number; y: number; w: number; h: number };

export const boundsOf = (items: DesignItem[]): Box => {
  const x = Math.min(...items.map((i) => i.x)), y = Math.min(...items.map((i) => i.y));
  return { x, y, w: Math.max(...items.map((i) => i.x + i.w)) - x, h: Math.max(...items.map((i) => i.y + i.h)) - y };
};

/** Aligns the given items to `within` (the selection's bounds, or the template when one item is selected). */
export function alignItems(list: DesignItem[], ids: string[], mode: AlignMode, within: Box): DesignItem[] {
  const round = (n: number) => Number(n.toFixed(3));
  return list.map((item) => {
    if (!ids.includes(item.id) || item.locked) return item;
    switch (mode) {
      case "left": return { ...item, x: round(within.x) };
      case "center": return { ...item, x: round(within.x + (within.w - item.w) / 2) };
      case "right": return { ...item, x: round(within.x + within.w - item.w) };
      case "top": return { ...item, y: round(within.y) };
      case "middle": return { ...item, y: round(within.y + (within.h - item.h) / 2) };
      case "bottom": return { ...item, y: round(within.y + within.h - item.h) };
    }
  });
}

/** Evenly spaces the gaps between items (needs three or more). */
export function distributeItems(list: DesignItem[], ids: string[], axis: "x" | "y"): DesignItem[] {
  const size = axis === "x" ? "w" : "h";
  const picked = list.filter((i) => ids.includes(i.id)).sort((a, b) => a[axis] - b[axis]);
  if (picked.length < 3) return list;
  const first = picked[0], last = picked[picked.length - 1];
  const total = last[axis] + last[size] - first[axis];
  const gap = (total - picked.reduce((sum, i) => sum + i[size], 0)) / (picked.length - 1);
  const positions = new Map<string, number>();
  let cursor = first[axis];
  for (const item of picked) { positions.set(item.id, Number(cursor.toFixed(3))); cursor += item[size] + gap; }
  return list.map((item) => (positions.has(item.id) && !item.locked ? { ...item, [axis]: positions.get(item.id)! } : item));
}
