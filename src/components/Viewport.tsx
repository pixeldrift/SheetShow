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
  | { kind: "pinch"; startDistance: number; startZoom: number };

/**
 * Pan / zoom surface. The page is centred in the viewport and offset by `view.pan`,
 * so a pan of (0, 0) is always "centred" regardless of drawer state or zoom.
 */
export function Viewport({ containerRef, view, onView, widthIn, heightIn, showRulers, guides, onGuides, onRulerDoubleClick, onBackgroundClick, marqueeMode, onMarquee, children, paperClassName }: Props) {
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

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("[data-no-pan]")) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()];
    if (points.length >= 2) {
      gesture.current = { kind: "pinch", startDistance: Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)), startZoom: view.zoom };
    } else if ((marqueeMode || event.shiftKey) && onMarquee) {
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
    if (g.kind === "pinch") {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      onView({ zoom: clamp(g.startZoom * Math.hypot(a.x - b.x, a.y - b.y) / g.startDistance, MIN_ZOOM, MAX_ZOOM) });
    } else if (g.kind === "marquee") {
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
      if ((axis === "x" ? p.x : p.y) < 0) onGuides((current) => current.filter((g) => g.id !== id));
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
    onGuides((current) => [...current, { id, axis, position: Math.max(0, axis === "x" ? p.x : p.y) }]);
    dragGuide(id, axis);
  };

  return (
    <div
      ref={containerRef}
      className="viewport"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {marquee && <div className="marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />}
      <div className="stage" style={{ transform: `translate(calc(-50% + ${view.pan.x}px), calc(-50% + ${view.pan.y}px))`, width: paperW, height: paperH }}>
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

