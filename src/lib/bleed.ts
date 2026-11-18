import type { Sheet, Template } from "../types";
import { footprint, placementsOf } from "./placements";

/**
 * What limits the bleed: half the clearance between cards (two bleeds must not overlap), and the room between the outer cards and the page edge.
 * It works from where the cards really are, so a hand-arranged page is held to its tightest spot.
 */
export function bleedLimits(sheet: Sheet | Sheet[], w: number, h: number) {
  const sheets = Array.isArray(sheet) ? sheet : [sheet];
  const per = sheets.map((sh) => limitsOf(sh, w, h));
  return { gap: Math.min(...per.map((l) => l.gap)), edge: Math.min(...per.map((l) => l.edge)) };
}

function limitsOf(sheet: Sheet, w: number, h: number) {
  const list = placementsOf(sheet, w, h);
  let gap = Infinity;
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j], fa = footprint(a, w, h), fb = footprint(b, w, h);
    const sepX = Math.max(b.x - (a.x + fa.w), a.x - (b.x + fb.w)), sepY = Math.max(b.y - (a.y + fa.h), a.y - (b.y + fb.h));
    gap = Math.min(gap, Math.max(0, Math.max(sepX, sepY)) / 2);
  }
  const edge = list.length ? Math.min(...list.map((p) => { const f = footprint(p, w, h); return Math.min(p.x, p.y, sheet.pageWidth - (p.x + f.w), sheet.pageHeight - (p.y + f.h)); })) : 0;
  return { gap: Number.isFinite(gap) ? gap : Infinity, edge: Math.max(0, Number(edge.toFixed(4))) };
}

/** Largest bleed (inches) the sheet can take: bleed never overlaps a neighbor's and never runs off the page. */
export function maxBleed(sheet: Sheet | Sheet[], w: number, h: number): number {
  const { gap, edge } = bleedLimits(sheet, w, h);
  return Number(Math.max(0, Math.min(gap, edge)).toFixed(4));
}

/**
 * The bleed actually used. "Automatic" is the largest that fits. A manual amount is held to that maximum on a standard
 * (Avery) sheet or when the layout is set to limit it; on a custom layout set to "widen", the gaps grow instead (see `gapsFor`).
 * Either way it is never allowed past the page edge.
 */
export function effectiveBleed(template: Template, sheet: Sheet | Sheet[], standard: boolean): number {
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
