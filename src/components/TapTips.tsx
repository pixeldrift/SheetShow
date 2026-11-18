import { useEffect, useRef, useState } from "react";
import { useGuide } from "../lib/guide";

type Tip = { text: string; x: number; y: number; below: boolean };
const TAPPABLE = 'button, [role="tab"], [role="button"], [role="menuitem"], [data-tip]';

/**
 * On a touch screen there is no hover, so a tap on a button also floats a little label above it for a moment ("Show rulers",
 * "Turn a quarter"). It never blocks the tap. Switch it off in Help › Guides and tips.
 */
export function TapTips() {
  const { tapTips } = useGuide();
  const [tip, setTip] = useState<Tip | null>(null);
  const timer = useRef<number>();
  useEffect(() => {
    if (!tapTips) { setTip(null); return; }
    let start: { x: number; y: number; t: number } | null = null;
    const down = (e: PointerEvent) => { window.clearTimeout(timer.current); setTip(null); start = e.pointerType === "mouse" ? null : { x: e.clientX, y: e.clientY, t: performance.now() }; };
    const up = (e: PointerEvent) => {
      if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 12 || performance.now() - start.t > 700) { start = null; return; }
      start = null;
      const el = (e.target as Element | null)?.closest<HTMLElement>(TAPPABLE);
      if (!el || el.closest(".tap-tip")) return;
      const raw = el.dataset.tip || el.getAttribute("title") || el.getAttribute("aria-label") || "";
      const text = raw.replace(/\s+/g, " ").trim();
      if (!text || text.length < 2) return;
      const r = el.getBoundingClientRect();
      const below = r.top < 90;
      setTip({ text: text.length > 120 ? text.slice(0, 117).trimEnd() + "…" : text, x: Math.min(Math.max(r.left + r.width / 2, 130), window.innerWidth - 130), y: below ? r.bottom + 8 : r.top - 8, below });
      timer.current = window.setTimeout(() => setTip(null), 2200);
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    return () => { window.removeEventListener("pointerdown", down, true); window.removeEventListener("pointerup", up, true); window.clearTimeout(timer.current); };
  }, [tapTips]);
  if (!tip) return null;
  return <div className={tip.below ? "tap-tip below" : "tap-tip"} role="status" style={{ left: tip.x, top: tip.y }}><span aria-hidden>✦</span> {tip.text}</div>;
}
