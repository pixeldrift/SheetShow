import { useEffect, useRef, useState } from "react";
import { useGuide } from "../lib/guide";

type Tip = { text: string; x: number; y: number; below: boolean; fading: boolean };
const TAPPABLE = 'button, [role="tab"], [role="button"], [role="menuitem"], [data-tip]';

/** Just the button's name: the part of its description before the first ":", "—", "(" or "." and never more than a few words. */
export function shortLabel(raw: string): string {
  const text = raw.replace(/\s+/g, " ").trim();
  const cut = text.split(/\s*[:—–(.·]\s*/)[0].trim();
  const words = cut.split(" ");
  const label = words.length > 4 ? words.slice(0, 4).join(" ") : cut;
  return label.length > 28 ? label.slice(0, 27).trimEnd() + "…" : label;
}

/**
 * On a touch screen there is no hover, so tapping a button also floats its name above it for a moment ("Show rulers", "Add text"), then it fades by itself.
 * It is only a label: what a feature does lives in the welcome guide, the tours, and the ✦ feature tips. It never blocks the tap.
 * Switch it off in Help › Guides and tips.
 */
export function TapTips() {
  const { tapTips } = useGuide();
  const [tip, setTip] = useState<Tip | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => {
    const clear = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };
    if (!tapTips) { setTip(null); return clear; }
    let start: { x: number; y: number; t: number } | null = null;
    const down = (e: PointerEvent) => { clear(); setTip(null); start = e.pointerType === "mouse" ? null : { x: e.clientX, y: e.clientY, t: performance.now() }; };
    const up = (e: PointerEvent) => {
      if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 12 || performance.now() - start.t > 700) { start = null; return; }
      start = null;
      const el = (e.target as Element | null)?.closest<HTMLElement>(TAPPABLE);
      if (!el || (e.target as Element).closest(".tap-tip, .spark, .spark-tip")) return;
      const label = shortLabel(el.dataset.tip || el.getAttribute("aria-label") || el.getAttribute("title") || "");
      if (label.length < 2) return;
      const r = el.getBoundingClientRect();
      const below = r.top < 90;
      setTip({ text: label, x: Math.min(Math.max(r.left + r.width / 2, 70), window.innerWidth - 70), y: below ? r.bottom + 8 : r.top - 8, below, fading: false });
      timers.current = [window.setTimeout(() => setTip((t) => (t ? { ...t, fading: true } : t)), 1300), window.setTimeout(() => setTip(null), 1650)];
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    return () => { window.removeEventListener("pointerdown", down, true); window.removeEventListener("pointerup", up, true); clear(); };
  }, [tapTips]);
  if (!tip) return null;
  return <div className={`tap-tip${tip.below ? " below" : ""}${tip.fading ? " fading" : ""}`} role="status" style={{ left: tip.x, top: tip.y }}>{tip.text}</div>;
}
