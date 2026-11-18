import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { TOURS, TOUR_NAMES, type TourId, type TourStep } from "../lib/tours";
import { guideSettings, updateGuide } from "../lib/guide";

const visibleEl = (selector: string): HTMLElement | null => {
  for (const el of document.querySelectorAll<HTMLElement>(selector)) {
    const r = el.getBoundingClientRect();
    if (r.width > 4 && r.height > 4 && !el.closest("[inert]") && r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth) return el;
  }
  return null;
};
const findTarget = (step: TourStep): HTMLElement | null => { for (const s of step.target) { const el = visibleEl(s); if (el) return el; } return null; };

type Box = { top: number; left: number; width: number; height: number };

/** A spotlight tour of one tab: the page dims, the thing being explained glows, and a small card explains it. */
export function TourOverlay({ tour, onClose }: { tour: TourId; onClose: () => void }) {
  const [steps] = useState(() => TOURS[tour].filter((s) => findTarget(s)));
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [popH, setPopH] = useState(180);
  const pop = useRef<HTMLDivElement>(null);
  const [stop, setStop] = useState(false);
  const last = i === steps.length - 1;
  const finish = () => { const g = guideSettings(); updateGuide({ tourSeen: { ...g.tourSeen, [tour]: true }, ...(stop ? { tours: false } : {}) }); onClose(); };

  useEffect(() => { if (!steps.length) finish(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Follow the target as the layout moves (drawers sliding, the window resizing).
  useEffect(() => {
    const step = steps[i];
    if (!step) return;
    findTarget(step)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    const measure = () => {
      const el = findTarget(step);
      if (!el) { setBox(null); return; }
      const r = el.getBoundingClientRect();
      const next = { top: r.top, left: r.left, width: r.width, height: r.height };
      setBox((b) => (b && b.top === next.top && b.left === next.left && b.width === next.width && b.height === next.height ? b : next));
    };
    measure();
    const timer = window.setInterval(measure, 150);
    window.addEventListener("resize", measure);
    return () => { window.clearInterval(timer); window.removeEventListener("resize", measure); };
  }, [i, steps]);
  useLayoutEffect(() => { const h = pop.current?.offsetHeight; if (h && Math.abs(h - popH) > 2) setPopH(h); });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight" || e.key === "Enter") setI((n) => (n >= steps.length - 1 ? n : n + 1));
      else if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const step = steps[i];
  if (!step) return null;

  const vw = window.innerWidth, vh = window.innerHeight, narrow = vw < 520;
  const popW = Math.min(330, vw - 24);
  const pad = 6;
  const spot = box ? { top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: box.height + pad * 2 } : null;
  let place: { top: number; left: number } = { top: vh - popH - 16, left: (vw - popW) / 2 };
  if (spot && !narrow) {
    const cx = Math.min(Math.max(spot.left + spot.width / 2 - popW / 2, 12), vw - popW - 12);
    const cy = Math.min(Math.max(spot.top + spot.height / 2 - popH / 2, 12), vh - popH - 12);
    if (spot.top + spot.height + 14 + popH <= vh - 8) place = { top: spot.top + spot.height + 14, left: cx };
    else if (spot.top - 14 - popH >= 8) place = { top: spot.top - 14 - popH, left: cx };
    else if (spot.left + spot.width + 14 + popW <= vw - 8) place = { top: cy, left: spot.left + spot.width + 14 };
    else if (spot.left - 14 - popW >= 8) place = { top: cy, left: spot.left - 14 - popW };
  } else if (spot && narrow) {
    place = spot.top + spot.height / 2 > vh / 2 ? { top: 12, left: 12 } : { top: vh - popH - 12, left: 12 };
  }

  return (
    <div className="tour-layer" role="dialog" aria-modal="true" aria-label={`${TOUR_NAMES[tour]} tour`}>
      <div className="tour-block" onPointerDown={(e) => e.stopPropagation()} />
      {spot && <div className="tour-spot" style={spot} />}
      <div className="tour-pop" ref={pop} style={{ ...place, width: popW }}>
        <span className="tour-count">✦ {TOUR_NAMES[tour]} · {i + 1} of {steps.length}</span>
        <h3>{step.title}</h3>
        <p>{step.text}</p>
        <label className="check-row tour-stop"><input type="checkbox" checked={stop} onChange={(e) => setStop(e.target.checked)} /> Don't show tours</label>
        <div className="tour-actions">
          <button className="button" onClick={finish}>{last ? "Close" : "Skip"}</button>
          <span className="spacer" />
          {i > 0 && <button className="button" onClick={() => setI(i - 1)}><ArrowLeft size={14} /> Back</button>}
          {!last && <button className="button button-primary" onClick={() => setI(i + 1)}>Next <ArrowRight size={14} /></button>}
          {last && <button className="button button-primary" onClick={finish}>Done</button>}
        </div>
      </div>
    </div>
  );
}
