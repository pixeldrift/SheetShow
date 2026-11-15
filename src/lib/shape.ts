import type { DesignItem } from "../types";

export type Radii = [number, number, number, number];

/** Corner radii in px for a w × h box, each limited to half the shorter side. */
export function cornerRadii(item: DesignItem, w: number, h: number): Radii {
  const max = Math.min(w, h) / 2;
  const toPx = (v: number) => Math.min(max, Math.max(0, item.radiusUnit === "px" ? v : (Math.min(w, h) * v) / 100));
  const r = item.radius ?? 0;
  const base = item.radii ?? [r, r, r, r];
  return base.map(toPx) as Radii;
}

export const isUniform = (radii: Radii) => radii.every((r) => r === radii[0]);

/** A rectangle with a different radius on each corner (top-left, top-right, bottom-right, bottom-left). */
export function roundedRectPath(x: number, y: number, w: number, h: number, [tl, tr, br, bl]: Radii): string {
  return `M${x + tl} ${y}H${x + w - tr}A${tr} ${tr} 0 0 1 ${x + w} ${y + tr}V${y + h - br}A${br} ${br} 0 0 1 ${x + w - br} ${y + h}H${x + bl}A${bl} ${bl} 0 0 1 ${x} ${y + h - bl}V${y + tl}A${tl} ${tl} 0 0 1 ${x + tl} ${y}Z`;
}

/** Converts a radius value between units so a shape keeps its look when the unit is switched. */
export function convertRadius(value: number, from: "pct" | "px", to: "pct" | "px", sidePx: number): number {
  if (from === to) return value;
  return to === "px" ? Math.round((value / 100) * sidePx * 10) / 10 : Math.min(50, Math.round((value / Math.max(1, sidePx)) * 1000) / 10);
}

/** Padding (inches) as top, right, bottom, left. */
export const paddingsOf = (item: DesignItem): [number, number, number, number] => {
  const p = Math.max(0, item.padding ?? 0);
  return item.paddings ?? [p, p, p, p];
};
