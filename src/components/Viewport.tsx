import { PointerEvent as ReactPointerEvent, ReactNode, RefObject, useEffect, useRef, useState } from "react";
import type { Guide, View } from "../types";
import { PX_PER_IN, clamp } from "../lib/data";
import { Ruler } from "./Ruler";

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;

type Props = {
  containerRef: RefObject<HTMLDivElement>;
  view: View;
  onView: (patch: Partial<View>) => void;
  widthIn: number;
  heightIn: number;
  showRulers: boolean;
  /** Bleed in inches (template page): the rulers and guide lines sit outside it, and guides may be placed within it. */
  bleedIn?: number;
  guides: Guide[];
  onGuides: (update: (guides: Guide[]) => Guide[]) => void;
  onRulerDoubleClick: () => void;
  onBackgroundClick: () => void;
  /** Drag on empty space draws a selection box (otherwise it pans). Shift always does this. */
  marqueeMode?: boolean;
  onMarquee?: (box: { x: number; y: number; w: number; h: number }, additive: boolean) => void;
  /** Page content, laid out at 96px per inch. The viewport scales it. */
  children: ReactNode;
  /** Rendered in the page's coordinate space beneath the guides, e.g. for the edit SVG. */
  paperClassName?: string;
};

type Gesture =
  | { kind: "pan"; pointerId: number; startX: number; startY: number; panX: number; panY: number; moved: boolean }
  | { kind: "marquee"; pointerId: number; startX: number; startY: number; additive: boolean; moved: boolean }


/**
 * Pan / zoom surface. The page is centered in the viewport and offset by `view.pan`,
 * so a pan of (0, 0) is always "centered" regardless of drawer state or zoom.
 */
export function Viewport({ containerRef, view, onView, widthIn, heightIn, showRulers, bleedIn = 0, guides, onGuides, onRulerDoubleClick, onBackgroundClick, marqueeMode, onMarquee, children, paperClassName }: Props) {
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  const paperW = widthIn * PX_PER_IN * view.zoom;
  const paperH = heightIn * PX_PER_IN * view.zoom;

  // Wheel / trackpad: pinch (ctrl+wheel) zooms, plain wheel pans. Needs a non-passive listener.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if ((event.target as HTMLElement).closest("[data-scroll]")) return;
      event.preventDefault();
      const current = viewRef.current;
      if (event.ctrlKey || event.metaKey) {
        onView({ zoom: clamp(current.zoom * Math.exp(-event.deltaY * 0.01), MIN_ZOOM, MAX_ZOOM) });
      } else {
        onView({ pan: { x: current.pan.x - event.deltaX, y: current.pan.y - event.deltaY } });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [containerRef, onView]);

  // ── Two fingers, anywhere on the canvas (over objects too): drag to pan, pinch to zoom ──
  // This runs before objects see the touch, and the second finger never reaches them, so nothing on the page is moved by accident.
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const twoFingers = useRef<{ dist: number; zoom: number; mid: { x: number; y: number }; pan: { x: number; y: number } } | null>(null);
  const midOf = () => { const [a, b] = [...touches.current.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) }; };
  const onPointerDownCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch" || (event.target as HTMLElement).closest("[data-no-pan]")) return;
    touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.current.size < 2) return;
    event.stopPropagation();
    if (touches.current.size === 2) {
      window.dispatchEvent(new Event("canvas-multitouch")); // a drag the first finger had started is dropped
      gesture.current = null; setMarquee(null);
      const m = midOf();
      twoFingers.current = { dist: m.dist, zoom: viewRef.current.zoom, mid: { x: m.x, y: m.y }, pan: { ...viewRef.current.pan } };
    }
  };
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!touches.current.has(e.pointerId)) return;
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const start = twoFingers.current, host = containerRef.current;
      if (!start || touches.current.size !== 2 || !host) return;
      const m = midOf(), box = host.getBoundingClientRect();
      const zoom = clamp(start.zoom * (m.dist / start.dist), MIN_ZOOM, MAX_ZOOM);
      // the spot of the page that was under the fingers stays under them, whatever the zoom does
      const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
      const qx = (start.mid.x - cx - start.pan.x) / start.zoom, qy = (start.mid.y - cy - start.pan.y) / start.zoom;
      onView({ zoom, pan: { x: m.x - cx - qx * zoom, y: m.y - cy - qy * zoom } });
    };
    const end = (e: PointerEvent) => {
      if (!touches.current.delete(e.pointerId)) return;
      if (touches.current.size < 2) twoFingers.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); window.removeEventListener("pointercancel", end); };
  }, [containerRef, onView]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("[data-no-pan]")) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (twoFingers.current) return; // two fingers are panning and zooming: nothing else starts
    if ((marqueeMode || event.shiftKey) && onMarquee) {
      gesture.current = { kind: "marquee", pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, additive: event.shiftKey || !!marqueeMode, moved: false };
    } else {
      gesture.current = { kind: "pan", pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, panX: view.pan.x, panY: view.pan.y, moved: false };
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "marquee") {
      if (g.pointerId !== event.pointerId) return;
      if (!g.moved && Math.hypot(event.clientX - g.startX, event.clientY - g.startY) < 4) return;
      g.moved = true;
      const host = containerRef.current!.getBoundingClientRect();
      setMarquee({ x: Math.min(g.startX, event.clientX) - host.left, y: Math.min(g.startY, event.clientY) - host.top, w: Math.abs(event.clientX - g.startX), h: Math.abs(event.clientY - g.startY) });
    } else if (g.pointerId === event.pointerId) {
      const dx = event.clientX - g.startX;
      const dy = event.clientY - g.startY;
      if (!g.moved && Math.hypot(dx, dy) < 4) return;
      g.moved = true;
      onView({ pan: { x: g.panX + dx, y: g.panY + dy } });
    }
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.delete(event.pointerId);
    const g = gesture.current;
    if (g?.kind === "marquee" && g.moved && event.type === "pointerup" && onMarquee) {
      const a = pageInches(g.startX, g.startY), b = pageInches(event.clientX, event.clientY);
      onMarquee({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) }, g.additive);
    }
    setMarquee(null);
    const wasTap = (g?.kind === "pan" || g?.kind === "marquee") && !g.moved && event.type === "pointerup";
    const remaining = [...pointers.current.entries()];
    if (remaining.length === 1) {
      const [pointerId, point] = remaining[0];
      gesture.current = { kind: "pan", pointerId, startX: point.x, startY: point.y, panX: viewRef.current.pan.x, panY: viewRef.current.pan.y, moved: true };
    } else {
      gesture.current = null;
    }
    if (wasTap) onBackgroundClick();
  };

  /** Pointer → position in inches on the page, based on the page's current on-screen rect. */
  const pageInches = (clientX: number, clientY: number) => {
    const rect = paperRef.current!.getBoundingClientRect();
    const scale = PX_PER_IN * viewRef.current.zoom;
    return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
  };

  /** Drag a guide with window-level listeners so it survives leaving the page. Dropping it back on its ruler deletes it. */
  const dragGuide = (id: string, axis: "x" | "y") => {
    const move = (event: PointerEvent) => {
      const p = pageInches(event.clientX, event.clientY);
      const position = axis === "x" ? p.x : p.y;
      onGuides((current) => current.map((g) => (g.id === id ? { ...g, position } : g)));
    };
    const up = (event: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      const p = pageInches(event.clientX, event.clientY);
      if ((axis === "x" ? p.x : p.y) < -bleedIn) onGuides((current) => current.filter((g) => g.id !== id));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const startGuideFromRuler = (event: ReactPointerEvent<HTMLDivElement>, axis: "x" | "y") => {
    event.preventDefault();
    event.stopPropagation();
    const id = crypto.randomUUID();
    const p = pageInches(event.clientX, event.clientY);
    onGuides((current) => [...current, { id, axis, position: Math.max(-bleedIn, axis === "x" ? p.x : p.y) }]);
    dragGuide(id, axis);
  };

  return (
    <div
      ref={containerRef}
      className="viewport"
      onPointerDownCapture={onPointerDownCapture}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {marquee && <div className="marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />}
      <div className="stage" style={{ transform: `translate(calc(-50% + ${view.pan.x}px), calc(-50% + ${view.pan.y}px))`, width: paperW, height: paperH, ["--bleed" as string]: `${bleedIn * PX_PER_IN * view.zoom}px` }}>
        {showRulers && <div className="ruler-corner" />}
        {showRulers && <Ruler axis="x" lengthIn={widthIn} zoom={view.zoom} onPointerDown={(e) => startGuideFromRuler(e, "y")} onDoubleClick={onRulerDoubleClick} />}
        {showRulers && <Ruler axis="y" lengthIn={heightIn} zoom={view.zoom} onPointerDown={(e) => startGuideFromRuler(e, "x")} onDoubleClick={onRulerDoubleClick} />}
        {/* Paper sits above the rulers so content dragged outside the page remains visible over them. */}
        <div ref={paperRef} className={`paper ${paperClassName ?? ""}`} style={{ width: paperW, height: paperH }}>
          <div className="paper-content" style={{ width: widthIn * PX_PER_IN, height: heightIn * PX_PER_IN, transform: `scale(${view.zoom})` }}>
            {children}
          </div>
          {guides.map((guide) => (
            <div
              key={guide.id}
              data-no-pan
              className={`guide guide-${guide.axis}`}
              style={guide.axis === "x" ? { left: guide.position * PX_PER_IN * view.zoom } : { top: guide.position * PX_PER_IN * view.zoom }}
              onPointerDown={(event) => { event.stopPropagation(); event.preventDefault(); dragGuide(guide.id, guide.axis); }}
              onDoubleClick={() => onGuides((current) => current.filter((g) => g.id !== guide.id))}
              title="Drag to move · drag onto the ruler or double-click to remove"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

