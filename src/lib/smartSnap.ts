import type { Box } from "./align";

/** A guide line drawn while snapping: at position `at` on the other axis, spanning `from`..`to` along it (inches). */
export type SnapLine = { axis: "x" | "y"; at: number; from: number; to: number };

export type SnapResult = { dx: number; dy: number; lines: SnapLine[] };

/** Edges and centre of a box, along one axis: [start, middle, end]. */
const anchors = (b: Box, axis: "x" | "y") => (axis === "x" ? [b.x, b.x + b.w / 2, b.x + b.w] : [b.y, b.y + b.h / 2, b.y + b.h]);

const EPS = 0.002;

/**
 * Smart snapping, in the manner of a vector editor: the moving box's edges and centre snap to the edges and centres of
 * other objects, the page, and any ruler guides, whichever is closest within `reach` inches.
 *
 * `use` picks which of the moving box's anchors take part per axis (0 = start edge, 1 = centre, 2 = end edge): all three
 * when moving, only the dragged edge when resizing. Returns the shift to apply and the lines to draw.
 */
export function smartSnap(
  moving: Box,
  targets: Box[],
  guides: { x: number[]; y: number[] },
  reach: number,
  use: { x: number[]; y: number[] } = { x: [0, 1, 2], y: [0, 1, 2] },
): SnapResult {
  const shift = { x: 0, y: 0 };
  for (const axis of ["x", "y"] as const) {
    const mine = anchors(moving, axis);
    const lines = [...guides[axis], ...targets.flatMap((t) => anchors(t, axis))];
    let best = Infinity;
    for (const i of use[axis]) for (const line of lines) {
      const d = line - mine[i];
      if (Math.abs(d) < Math.abs(best) && Math.abs(d) <= reach) best = d;
    }
    if (Number.isFinite(best)) shift[axis] = best;
  }
  const snapped: Box = { x: moving.x + shift.x, y: moving.y + shift.y, w: moving.w, h: moving.h };
  const out: SnapLine[] = [];
  for (const axis of ["x", "y"] as const) {
    if (!use[axis].length) continue;
    const other = axis === "x" ? "y" : "x";
    const mine = anchors(snapped, axis);
    const span = (b: Box) => (other === "x" ? [b.x, b.x + b.w] : [b.y, b.y + b.h]);
    const [m0, m1] = span(snapped);
    const add = (at: number, from: number, to: number) => {
      const existing = out.find((l) => l.axis === axis && Math.abs(l.at - at) < EPS);
      if (existing) { existing.from = Math.min(existing.from, from); existing.to = Math.max(existing.to, to); }
      else out.push({ axis, at, from, to });
    };
    for (const i of use[axis]) {
      if (shift[axis] === 0 && !lineNear(mine[i], axis, targets, guides)) continue;
      for (const g of guides[axis]) if (Math.abs(g - mine[i]) < EPS) add(g, m0, m1);
      for (const t of targets) {
        for (const a of anchors(t, axis)) {
          if (Math.abs(a - mine[i]) < EPS) { const [t0, t1] = span(t); add(a, Math.min(m0, t0), Math.max(m1, t1)); }
        }
      }
    }
  }
  return { dx: shift.x, dy: shift.y, lines: out };
}

const lineNear = (at: number, axis: "x" | "y", targets: Box[], guides: { x: number[]; y: number[] }) =>
  guides[axis].some((g) => Math.abs(g - at) < EPS) || targets.some((t) => anchors(t, axis).some((a) => Math.abs(a - at) < EPS));
