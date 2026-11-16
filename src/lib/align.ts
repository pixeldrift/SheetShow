import type { DesignItem } from "../types";

export type AlignMode = "left" | "center" | "right" | "top" | "middle" | "bottom";
export type Box = { x: number; y: number; w: number; h: number };

/** Axis-aligned bounds of an item, accounting for rotation. */
export function aabb(item: DesignItem): Box {
  const r = ((item.rotation ?? 0) * Math.PI) / 180;
  if (!r) return { x: item.x, y: item.y, w: item.w, h: item.h };
  const cos = Math.abs(Math.cos(r)), sin = Math.abs(Math.sin(r));
  const w = item.w * cos + item.h * sin, h = item.w * sin + item.h * cos;
  return { x: item.x + item.w / 2 - w / 2, y: item.y + item.h / 2 - h / 2, w, h };
}

export const boundsOf = (items: DesignItem[]): Box => {
  const boxes = items.map(aabb);
  const x = Math.min(...boxes.map((b) => b.x)), y = Math.min(...boxes.map((b) => b.y));
  return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
};

/** Aligns the given items to `within` (the selection's bounds, or the template when one item is selected). */
export function alignItems(list: DesignItem[], ids: string[], mode: AlignMode, within: Box): DesignItem[] {
  const round = (n: number) => Number(n.toFixed(3));
  return list.map((item) => {
    if (!ids.includes(item.id) || item.locked) return item;
    const box = aabb(item);
    switch (mode) {
      case "left": return { ...item, x: round(item.x + within.x - box.x) };
      case "center": return { ...item, x: round(item.x + within.x + (within.w - box.w) / 2 - box.x) };
      case "right": return { ...item, x: round(item.x + within.x + within.w - box.w - box.x) };
      case "top": return { ...item, y: round(item.y + within.y - box.y) };
      case "middle": return { ...item, y: round(item.y + within.y + (within.h - box.h) / 2 - box.y) };
      case "bottom": return { ...item, y: round(item.y + within.y + within.h - box.h - box.y) };
    }
  });
}

/** Evenly spaces the gaps between items (needs three or more). */
export function distributeItems(list: DesignItem[], ids: string[], axis: "x" | "y"): DesignItem[] {
  const size = axis === "x" ? "w" : "h";
  const picked = list.filter((i) => ids.includes(i.id)).map((item) => ({ item, box: aabb(item) })).sort((a, b) => a.box[axis] - b.box[axis]);
  if (picked.length < 3) return list;
  const first = picked[0].box, last = picked[picked.length - 1].box;
  const total = last[axis] + last[size] - first[axis];
  const gap = (total - picked.reduce((sum, p) => sum + p.box[size], 0)) / (picked.length - 1);
  const shifts = new Map<string, number>();
  let cursor = first[axis];
  for (const { item, box } of picked) { shifts.set(item.id, cursor - box[axis]); cursor += box[size] + gap; }
  return list.map((item) => (shifts.has(item.id) && !item.locked ? { ...item, [axis]: Number((item[axis] + shifts.get(item.id)!).toFixed(3)) } : item));
}

export type Transform = { id: string; x: number; y: number; rotation: number };

/** Normalises an angle to (-180, 180]. */
export const normAngle = (deg: number) => { const r = (((deg + 180) % 360) + 360) % 360 - 180; return r === -180 ? 180 : r; };

/**
 * Rotates items by `delta` degrees as a temporary group: each item turns about its own center by the same angle
 * and its center orbits `center`. Pass the items as they were when the gesture began so repeated calls don't accumulate error.
 */
export function rotateAbout(items: DesignItem[], delta: number, center: { x: number; y: number }): Transform[] {
  const r = (delta * Math.PI) / 180, cos = Math.cos(r), sin = Math.sin(r);
  return items.filter((item) => !item.locked).map((item) => {
    const dx = item.x + item.w / 2 - center.x, dy = item.y + item.h / 2 - center.y;
    const cx = center.x + dx * cos - dy * sin, cy = center.y + dx * sin + dy * cos;
    return { id: item.id, x: Number((cx - item.w / 2).toFixed(3)), y: Number((cy - item.h / 2).toFixed(3)), rotation: Number(normAngle((item.rotation ?? 0) + delta).toFixed(1)) };
  });
}

export const centerOf = (box: Box) => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });
