import { useCallback, useRef, useState } from "react";

export type Side = "left" | "right";
const KEY = "sheetshow.drawerWidths";
const MIN = 168;          // narrowest a drawer is left at
const CLOSE_BELOW = 110;  // dragged narrower than this, it closes
const OPEN_ABOVE = 80;    // dragged open at least this far, it stays open
const FLICK = 0.6;        // px per ms toward the edge counts as a swipe to close

const load = (): { left?: number; right?: number } => { try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; } };
const GAP = 12; // always leave this much room between the two drawers
const maxWidth = () => Math.min(window.innerWidth * 0.85, 480);
/** Widest this drawer may get: the screen minus the other drawer (if it is showing) and a little breathing room. */
const roomFor = (side: Side) => {
  const other = document.querySelector<HTMLElement>(`.drawer-slot.${side === "left" ? "right" : "left"}.open`);
  const used = other ? other.getBoundingClientRect().width : 0;
  return Math.max(MIN, Math.min(maxWidth(), window.innerWidth - used - GAP));
};

/**
 * Drag a drawer's edge to resize it (the width is remembered), flick it toward its edge of the screen to close it, or drag
 * from the sliver at the screen edge to pull it open. One gesture handles all three: where it ends decides which it was.
 */
export function useDrawerGestures(setOpen: (side: Side, open: boolean) => void) {
  const [saved, setSaved] = useState(load);
  const [live, setLive] = useState<{ side: Side; width: number; mode: "open" | "resize" } | null>(null);
  const swiped = useRef(false);

  const save = (side: Side, width: number) => {
    const next = { ...saved, [side]: Math.round(Math.min(maxWidth(), Math.max(MIN, width))) };
    setSaved(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  };

  /** `open` starts from a closed drawer; `resize` grabs the sliver of an open one (it changes the width); `swipe` (from the header) can only close the drawer, never change its width. `threshold` is how far the pointer must travel before it counts as a drag rather than a tap. */
  const start = useCallback((side: Side, event: React.PointerEvent, mode: "open" | "resize" | "swipe", threshold = 4) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const panel = document.querySelector<HTMLElement>(side === "left" ? ".left-panel" : ".right-panel");
    const panelW = panel?.getBoundingClientRect().width ?? MIN; // the panel keeps its own width even while it is slid out of sight
    const startW = mode === "open" ? 0 : panelW;
    const startX = event.clientX;
    const dir = side === "left" ? 1 : -1; // moving this way makes the drawer wider
    const samples: { t: number; x: number }[] = [{ t: performance.now(), x: startX }];
    let moved = false;
    const room = roomFor(side);
    const widthAt = (x: number) => Math.max(0, Math.min(mode === "open" ? Math.min(panelW, room) : room, startW + (x - startX) * dir));
    const move = (e: PointerEvent) => {
      if (!moved) {
        if (Math.abs(e.clientX - startX) < threshold) return;
        moved = true;
        document.body.classList.add("scrubbing");
        if (mode === "open") setOpen(side, true);
      }
      samples.push({ t: performance.now(), x: e.clientX });
      if (samples.length > 8) samples.shift();
      if (mode !== "swipe") setLive({ side, width: widthAt(e.clientX), mode });
    };
    const up = (e: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      document.body.classList.remove("scrubbing");
      setLive(null);
      if (!moved) { if (mode === "open") setOpen(side, true); else if (mode === "resize") setOpen(side, false); return; } // a tap on the sliver opens or closes the drawer
      swiped.current = true; // the click that follows a drag must not also press a button under the pointer
      window.setTimeout(() => { swiped.current = false; }, 150);
      const width = widthAt(e.clientX);
      const now = performance.now();
      const from = samples.find((s) => now - s.t < 140) ?? samples[0];
      const velocity = ((e.clientX - from.x) * dir) / Math.max(1, now - from.t); // negative: heading for the edge
      if (mode === "open") { setOpen(side, width >= OPEN_ABOVE); return; } // pulling a drawer open slides it; it never changes its width
      if (width < CLOSE_BELOW || (velocity < -FLICK && startW - width > 24)) setOpen(side, false);
      else if (mode === "resize") save(side, width);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }, [setOpen, saved]); // eslint-disable-line react-hooks/exhaustive-deps

  // --x-w is the drawer's own width; --x-vis is how much of it is showing (the whole drawer is slid in or out, never squeezed).
  const vars: Record<string, string> = {};
  for (const side of ["left", "right"] as const) {
    const own = live?.side === side && live.mode === "resize" ? live.width : saved[side];
    if (own) vars[`--${side}-w`] = `${own}px`;
    if (live?.side === side) vars[`--${side}-vis`] = `${live.width}px`;
  }

  return { start, vars: vars as React.CSSProperties, live: !!live, consumeSwipe: () => { const was = swiped.current; swiped.current = false; return was; } };
}
