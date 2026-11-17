import type { Sheet, Template } from "../types";

/** Largest bleed (inches) the sheet can take: half the gap between neighboring cards, so two cards' bleeds never overlap. */
export function maxBleed(sheet: Sheet): number {
  const limits: number[] = [];
  if (sheet.columns > 1) limits.push(sheet.gapX / 2);
  if (sheet.rows > 1) limits.push(sheet.gapY / 2);
  if (!limits.length) limits.push(Math.min(sheet.marginX, sheet.marginY, 0.25)); // a lone card: keep inside the page margins
  return Math.max(0, Number(Math.min(...limits).toFixed(4)));
}

/**
 * The bleed actually used. "Automatic" is the largest that fits. A manual amount is held to that maximum on a standard
 * (Avery) sheet or when the layout is set to limit it; on a custom layout set to "widen", the layout grows instead (see `gapsFor`).
 */
export function effectiveBleed(template: Template, sheet: Sheet, standard: boolean): number {
  const b = template.bleed;
  if (!b) return 0;
  const max = maxBleed(sheet);
  const wanted = b.auto ? max : Math.max(0, b.amount);
  return standard || b.policy !== "grow" || b.auto ? Math.min(wanted, max) : wanted;
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
