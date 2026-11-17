import type { Sheet, Template } from "../types";

/** What limits the bleed: half the gap between neighboring cards, and the room between the outer cards and the page edge. */
export function bleedLimits(sheet: Sheet, w: number, h: number) {
  const gap = Math.min(sheet.columns > 1 ? sheet.gapX / 2 : Infinity, sheet.rows > 1 ? sheet.gapY / 2 : Infinity);
  const gridW = sheet.columns * w + (sheet.columns - 1) * sheet.gapX, gridH = sheet.rows * h + (sheet.rows - 1) * sheet.gapY;
  const edge = Math.min(sheet.marginX, sheet.marginY, sheet.pageWidth - sheet.marginX - gridW, sheet.pageHeight - sheet.marginY - gridH);
  return { gap: Number.isFinite(gap) ? Math.max(0, gap) : Infinity, edge: Math.max(0, Number(edge.toFixed(4))) };
}

/** Largest bleed (inches) the sheet can take: bleed never overlaps a neighbor's and never runs off the page. */
export function maxBleed(sheet: Sheet, w: number, h: number): number {
  const { gap, edge } = bleedLimits(sheet, w, h);
  return Number(Math.max(0, Math.min(gap, edge)).toFixed(4));
}

/**
 * The bleed actually used. "Automatic" is the largest that fits. A manual amount is held to that maximum on a standard
 * (Avery) sheet or when the layout is set to limit it; on a custom layout set to "widen", the gaps grow instead (see `gapsFor`).
 * Either way it is never allowed past the page edge.
 */
export function effectiveBleed(template: Template, sheet: Sheet, standard: boolean): number {
  const b = template.bleed;
  if (!b) return 0;
  const max = maxBleed(sheet, template.width, template.height);
  const { edge } = bleedLimits(sheet, template.width, template.height);
  const wanted = b.auto ? max : Math.max(0, b.amount);
  return standard || b.policy !== "grow" || b.auto ? Math.min(wanted, max) : Math.min(wanted, edge);
}

/** The gaps a layout needs so a bleed of this size fits between cards (never smaller than what it already has). */
export const gapsFor = (sheet: Sheet, amount: number) => ({
  gapX: sheet.columns > 1 ? Math.max(sheet.gapX, Number((amount * 2).toFixed(4))) : sheet.gapX,
  gapY: sheet.rows > 1 ? Math.max(sheet.gapY, Number((amount * 2).toFixed(4))) : sheet.gapY,
});

/** 0.125 → "⅛″", 0.25 → "¼″", otherwise a plain decimal. */
export function inchLabel(n: number): string {
  const eighths = Math.round(n * 8);
  const glyph: Record<number, string> = { 1: "⅛", 2: "¼", 3: "⅜", 4: "½", 5: "⅝", 6: "¾", 7: "⅞" };
  if (Math.abs(n * 8 - eighths) < 0.01 && glyph[eighths]) return `${glyph[eighths]}″`;
  return `${Number(n.toFixed(3))}″`;
}
