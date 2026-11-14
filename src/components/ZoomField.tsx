import { useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";

type Props = { zoom: number; onZoom: (zoom: number) => void; onPreset: () => void };

const TAP_MS = 300;

/**
 * The zoom percentage as a field: tap to flip between fit and 100%, double-tap to type a value,
 * drag left or right to scrub. The − and + buttons sit tight against the number to save toolbar space.
 */
export function ZoomField({ zoom, onZoom, onPreset }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const lastTap = useRef(0);
  const pending = useRef<number | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select(); } }, [editing]);
  useEffect(() => () => window.clearTimeout(pending.current), []);

  const startEditing = () => { setDraft(String(Math.round(zoom * 100))); setEditing(true); };
  const commit = () => {
    const n = parseFloat(draft.replace("%", ""));
    if (Number.isFinite(n) && n > 0) onZoom(n / 100);
    setEditing(false);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const startX = event.clientX, startPercent = zoom * 100;
    let moved = false;
    const move = (e: PointerEvent) => {
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) < 4) return;
      moved = true;
      window.clearTimeout(pending.current);
      onZoom(Math.max(1, startPercent + dx / 2) / 100); // 1% per 2px
    };
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
      if (moved) return;
      const now = Date.now();
      if (now - lastTap.current < TAP_MS) { window.clearTimeout(pending.current); lastTap.current = 0; startEditing(); return; }
      lastTap.current = now;
      // A single tap flips fit/100%, but waits a moment in case it's the first half of a double-tap.
      pending.current = window.setTimeout(onPreset, TAP_MS);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  };

  return (
    <div className="zoom-field">
      <button className="tool-button" title="Zoom out" aria-label="Zoom out" onClick={() => onZoom(zoom / 1.25)}><ZoomOut size={15} /></button>
      {editing ? (
        <input
          ref={inputRef} className="zoom-input" inputMode="decimal" aria-label="Zoom percentage" value={draft}
          onChange={(e) => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); else if (e.key === "Escape") setEditing(false); }}
        />
      ) : (
        <button className="zoom-percent" onPointerDown={onPointerDown} title="Tap: fit or 100% · Double-tap: type a value · Drag: scrub">{Math.round(zoom * 100)}%</button>
      )}
      <button className="tool-button" title="Zoom in" aria-label="Zoom in" onClick={() => onZoom(zoom * 1.25)}><ZoomIn size={15} /></button>
    </div>
  );
}
