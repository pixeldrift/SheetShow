import { ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

type ScrubStart = (event: React.PointerEvent) => void;
/** Lets a field's label start a drag-to-scrub on the number field next to it. */
const ScrubContext = createContext<((start: ScrubStart | null) => void) | null>(null);

const PIXELS_PER_STEP = 5;

/**
 * Number input that lets you type freely (e.g. "1.") and only commits valid numbers.
 * - Up/down arrows (click, or hold to repeat; Shift = ×10).
 * - Drag the label, the unit or the number itself (when not being edited) left and right to scrub the value (Shift = ×10, Alt = fine); tap the number to type.
 * While you're typing it shows your draft; otherwise it always shows the real value. A change from elsewhere
 * (undo, a ±90° button) is adopted even if this field still has focus, as Safari doesn't blur it on button clicks.
 */
export function NumberField({ value, onChange, min, max, step = 0.01, unit, places = 3 }: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; unit?: string; places?: number }) {
  const format = (n: number) => String(Number(n.toFixed(places)));
  const [draft, setDraft] = useState<string | null>(null); // null = not editing
  const lastCommitted = useRef<number | null>(null);
  const register = useContext(ScrubContext);
  const latest = useRef({ value, min, max, step, places, onChange });
  latest.current = { value, min, max, step, places, onChange };

  useEffect(() => {
    if (value !== lastCommitted.current) { lastCommitted.current = null; setDraft((d) => (d === null ? null : format(value))); }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = useCallback((n: number) => {
    const { min: lo, max: hi, places: p, onChange: change } = latest.current;
    const clamped = Number(Math.min(hi ?? Infinity, Math.max(lo ?? -Infinity, n)).toFixed(p));
    lastCommitted.current = clamped;
    change(clamped);
  }, []);

  /**
   * Drag to scrub. Pointer moves are tracked on the window so the drag survives leaving the label.
   * With `threshold`, a press that never moves that far counts as a tap and calls `onTap` (used by the number box itself: tap to type, drag to scrub).
   */
  const beginScrub = useCallback((event: React.PointerEvent, threshold = 0, onTap?: () => void) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX, startValue = latest.current.value;
    let dragging = threshold === 0;
    if (dragging) document.body.classList.add("scrubbing");
    const move = (e: PointerEvent) => {
      if (!dragging) { if (Math.abs(e.clientX - startX) < threshold) return; dragging = true; document.body.classList.add("scrubbing"); }
      const multiplier = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
      commit(startValue + Math.round((e.clientX - startX) / PIXELS_PER_STEP) * latest.current.step * multiplier);
    };
    const up = () => {
      document.body.classList.remove("scrubbing");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (!dragging) onTap?.();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }, [commit]);
  const startScrub: ScrubStart = useCallback((event) => beginScrub(event), [beginScrub]);

  useEffect(() => { register?.(startScrub); return () => register?.(null); }, [register, startScrub]);

  /** Click an arrow to nudge; hold it to keep going. */
  const press = (direction: 1 | -1) => (event: React.PointerEvent) => {
    event.preventDefault();
    const multiplier = event.shiftKey ? 10 : 1;
    const bump = () => commit(latest.current.value + direction * latest.current.step * multiplier);
    bump();
    let interval: number | undefined;
    const delay = window.setTimeout(() => { interval = window.setInterval(bump, 70); }, 380);
    const stop = () => { window.clearTimeout(delay); window.clearInterval(interval); window.removeEventListener("pointerup", stop); window.removeEventListener("pointercancel", stop); };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  return (
    <div className="number-input">
      <input
        type="number" inputMode="decimal" step={step} min={min} max={max} value={draft ?? format(value)}
        style={{ width: `calc(${Math.max(1, [...String(draft ?? format(value))].reduce((w, c) => w + (c === "." ? 0.28 : c === "-" ? 0.36 : 0.56), 0)).toFixed(2)}em + 2px)` }}
        onPointerDown={(e) => {
          // Not editing yet: drag scrubs the value, a plain tap focuses the box for typing.
          const input = e.currentTarget;
          if (e.button !== 0 || document.activeElement === input) return;
          beginScrub(e, 4, () => { input.focus(); input.select(); });
        }}
        onFocus={() => setDraft(format(value))}
        onBlur={() => setDraft(null)}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = parseFloat(e.target.value);
          if (Number.isFinite(n)) commit(n);
        }}
      />
      {unit && <small className="scrub-unit" onPointerDown={startScrub} title="Drag to adjust">{unit}</small>}
      <span className="stepper">
        <button type="button" tabIndex={-1} aria-label="Increase" onPointerDown={press(1)}><ChevronUp size={11} /></button>
        <button type="button" tabIndex={-1} aria-label="Decrease" onPointerDown={press(-1)}><ChevronDown size={11} /></button>
      </span>
    </div>
  );
}

/** Which sections the user has collapsed; remembered by title so they stay shut when the selection changes. */
const collapsed = new Set<string>();

/** A properties section. Open by default; tap the heading to fold it away. */
export function Section({ title, unit, children }: { title: string; unit?: string; children: ReactNode }) {
  const [open, setOpen] = useState(!collapsed.has(title));
  const toggle = () => { if (open) collapsed.add(title); else collapsed.delete(title); setOpen(!open); };
  return (
    <section className={"property-section" + (open ? "" : " folded")}>
      <h3><button type="button" className="section-toggle" aria-expanded={open} onClick={toggle}>
        <ChevronDown size={12} className="section-chevron" />{title}{unit && <span className="unit-label">{unit}</span>}
      </button></h3>
      {open && children}
    </section>
  );
}

/** A label above a field. If the field is a number, dragging the label scrubs its value. */
export function Pair({ label, children }: { label: string; children: ReactNode }) {
  const start = useRef<ScrubStart | null>(null);
  const [scrubbable, setScrubbable] = useState(false);
  const register = useCallback((fn: ScrubStart | null) => { start.current = fn; setScrubbable(!!fn); }, []);
  return (
    <ScrubContext.Provider value={register}>
      <div className="pair">
        <span className={scrubbable ? "scrub-label" : undefined} onPointerDown={scrubbable ? (e) => start.current?.(e) : undefined} title={scrubbable ? "Drag to adjust" : undefined}>{label}</span>
        {children}
      </div>
    </ScrubContext.Provider>
  );
}
