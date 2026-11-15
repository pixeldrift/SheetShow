import type { Box } from "./align";

/** A guide line drawn while snapping: at position `at` on the other axis, spanning `from`..`to` along it (inches). */
export type SnapLine = {
  axis: "x" | "y"; at: number; from: number; to: number;
  /** An equal-spacing marker: a measured gap along `axis`, drawn at `at` on the other axis with end ticks. */
  gap?: boolean;
};

/** Which kinds of snapping are on. */
export type SnapOptions = { objects: boolean; spacing: boolean; page: boolean; guides: boolean; grid: boolean };
export const DEFAULT_SNAP_OPTIONS: SnapOptions = { objects: true, spacing: true, page: true, guides: true, grid: true };

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
  /** Objects to measure equal gaps against (moving only); omit to leave equal-spacing snapping off. */
  spacingTargets?: Box[],
): SnapResult {
  const shift = { x: 0, y: 0 };
  const gapLines: SnapLine[] = [];
  for (const axis of ["x", "y"] as const) {
    const mine = anchors(moving, axis);
    const lines = [...guides[axis], ...targets.flatMap((t) => anchors(t, axis))];
    let best = Infinity;
    for (const i of use[axis]) for (const line of lines) {
      const d = line - mine[i];
      if (Math.abs(d) < Math.abs(best) && Math.abs(d) <= reach) best = d;
    }
    if (Number.isFinite(best)) shift[axis] = best;
    // Equal spacing is the more deliberate alignment, so it wins over an incidental edge snap.
    if (spacingTargets && use[axis].length === 3) {
      const eq = equalSpacing(moving, spacingTargets, axis, reach);
      if (eq) { shift[axis] = eq.delta; gapLines.push(...eq.gaps); }
    }
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
  return { dx: shift.x, dy: shift.y, lines: [...out, ...gapLines] };
}

/**
 * Equal spacing along one axis, between objects that overlap the moving box on the other axis. Two cases, as in a vector editor:
 * the box sits exactly midway between its neighbours on either side, or it repeats the gap between two objects beside it.
 */
function equalSpacing(moving: Box, boxes: Box[], axis: "x" | "y", reach: number): { delta: number; gaps: SnapLine[] } | null {
  const along = (b: Box) => (axis === "x" ? [b.x, b.x + b.w] : [b.y, b.y + b.h]);
  const across = (b: Box) => (axis === "x" ? [b.y, b.y + b.h] : [b.x, b.x + b.w]);
  const [m0, m1] = along(moving), size = m1 - m0, mc = (m0 + m1) / 2;
  const [c0, c1] = across(moving), at = (c0 + c1) / 2;
  const beside = boxes.filter((b) => { const [a0, a1] = across(b); return Math.min(a1, c1) - Math.max(a0, c0) > 0; })
    .sort((a, b) => along(a)[0] - along(b)[0]);
  if (!beside.length) return null;
  const gapAt = (from: number, to: number): SnapLine => ({ axis, at, from, to, gap: true });
  let best: { delta: number; gaps: SnapLine[] } | null = null;
  const consider = (start: number, gaps: SnapLine[]) => {
    const delta = start - m0;
    if (Math.abs(delta) <= reach && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, gaps };
  };
  // Midway between the nearest neighbour on each side.
  const left = beside.filter((b) => along(b)[1] <= mc).sort((a, b) => along(b)[1] - along(a)[1])[0];
  const right = beside.filter((b) => along(b)[0] >= mc).sort((a, b) => along(a)[0] - along(b)[0])[0];
  if (left && right) {
    const room = along(right)[0] - along(left)[1] - size;
    if (room > EPS) { const start = along(left)[1] + room / 2; consider(start, [gapAt(along(left)[1], start), gapAt(start + size, along(right)[0])]); }
  }
  // Repeat the gap between two neighbouring objects, on either side of them.
  for (let i = 0; i + 1 < beside.length; i++) {
    const [, aEnd] = along(beside[i]), [bStart, bEnd] = along(beside[i + 1]);
    const g = bStart - aEnd;
    if (g <= EPS) continue;
    if (mc > bEnd) consider(bEnd + g, [gapAt(aEnd, bStart), gapAt(bEnd, bEnd + g)]);
    const aStart = along(beside[i])[0];
    if (mc < aStart) consider(aStart - g - size, [gapAt(aStart - g, aStart), gapAt(aEnd, bStart)]);
  }
  return best;
}

const lineNear = (at: number, axis: "x" | "y", targets: Box[], guides: { x: number[]; y: number[] }) =>
  guides[axis].some((g) => Math.abs(g - at) < EPS) || targets.some((t) => anchors(t, axis).some((a) => Math.abs(a - at) < EPS));
