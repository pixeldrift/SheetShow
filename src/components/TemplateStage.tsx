import { PointerEvent, RefObject, useRef } from "react";
import type { DesignItem, Guide, RecordMeta, RecordRow } from "../types";
import { PX_PER_IN, round } from "../lib/data";
import type { Box } from "../lib/align";
import { ItemShape } from "./ItemShape";

type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const CURSORS: Record<Handle, string> = { nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize", n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize" };

type Props = {
  items: DesignItem[];
  record: RecordRow;
  meta: RecordMeta;
  width: number;
  height: number;
  zoom: number;
  selectedIds: string[];
  showGrid: boolean;
  snap: boolean;
  guides: Guide[];
  /** Tapping toggles selection (multi-select mode) instead of replacing it. */
  multi: boolean;
  /** When true, editing is paused and the output is clipped to the template. */
  preview: boolean;
  svgRef: RefObject<SVGSVGElement>;
  onSelect: (ids: string[]) => void;
  onMove: (updates: { id: string; x: number; y: number }[]) => void;
  onResize: (id: string, box: Box) => void;
  onDragEnd: () => void;
};

type Drag =
  | { kind: "move"; primary: string; startX: number; startY: number; origins: Map<string, { x: number; y: number }>; w: number; h: number }
  | { kind: "resize"; id: string; handle: Handle; startX: number; startY: number; box: Box; keepAspect: boolean };

const SNAP_STEP = 0.05;
const GUIDE_REACH = 0.08;
const MIN_SIZE = 0.05;

/** Editable template canvas. Items may be dragged anywhere, including past the template edge and over the rulers. */
export function TemplateStage({ items, record, meta, width, height, zoom, selectedIds, showGrid, snap, guides, multi, preview, svgRef, onSelect, onMove, onResize, onDragEnd }: Props) {
  const drag = useRef<Drag | null>(null);
  const scale = PX_PER_IN * zoom;

  const snapAxis = (value: number, size: number, axis: "x" | "y") => {
    // Snap the item's start, centre or end to a guide, otherwise to the 0.05" grid.
    const lines = guides.filter((guide) => guide.axis === axis).map((guide) => guide.position);
    for (const offset of [0, size / 2, size]) {
      const hit = lines.find((line) => Math.abs(line - (value + offset)) < GUIDE_REACH);
      if (hit !== undefined) return hit - offset;
    }
    return Math.round(value / SNAP_STEP) * SNAP_STEP;
  };

  const startMove = (event: PointerEvent<SVGGElement>, item: DesignItem) => {
    if (preview) return;
    event.stopPropagation();
    const toggle = multi || event.shiftKey || event.metaKey || event.ctrlKey;
    if (toggle) {
      onSelect(selectedIds.includes(item.id) ? selectedIds.filter((id) => id !== item.id) : [...selectedIds, item.id]);
      return;
    }
    const ids = selectedIds.includes(item.id) ? selectedIds : [item.id];
    if (ids !== selectedIds) onSelect(ids);
    const movable = items.filter((candidate) => ids.includes(candidate.id) && !candidate.locked);
    if (!movable.length || item.locked) return;
    event.preventDefault();
    drag.current = { kind: "move", primary: item.id, startX: event.clientX, startY: event.clientY, w: item.w, h: item.h, origins: new Map(movable.map((m) => [m.id, { x: m.x, y: m.y }])) };
    (event.currentTarget as SVGGElement).setPointerCapture(event.pointerId);
  };

  const startResize = (event: PointerEvent<SVGElement>, item: DesignItem, handle: Handle) => {
    event.stopPropagation();
    event.preventDefault();
    const corner = handle.length === 2;
    drag.current = { kind: "resize", id: item.id, handle, startX: event.clientX, startY: event.clientY, box: { x: item.x, y: item.y, w: item.w, h: item.h }, keepAspect: corner && (item.type === "image" || event.shiftKey) };
    (event.currentTarget as SVGElement).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = (event.clientX - d.startX) / scale;
    const dy = (event.clientY - d.startY) / scale;
    if (d.kind === "move") {
      const origin = d.origins.get(d.primary) ?? [...d.origins.values()][0];
      let x = origin.x + dx, y = origin.y + dy;
      if (snap) { x = snapAxis(x, d.w, "x"); y = snapAxis(y, d.h, "y"); }
      const shiftX = x - origin.x, shiftY = y - origin.y;
      onMove([...d.origins].map(([id, o]) => ({ id, x: round(o.x + shiftX), y: round(o.y + shiftY) })));
      return;
    }
    const { box, handle } = d;
    let { x, y, w, h } = box;
    if (handle.includes("e")) w = box.w + dx;
    if (handle.includes("w")) { x = box.x + dx; w = box.w - dx; }
    if (handle.includes("s")) h = box.h + dy;
    if (handle.includes("n")) { y = box.y + dy; h = box.h - dy; }
    if (d.keepAspect) {
      const factor = Math.max(w / box.w, h / box.h);
      w = box.w * factor; h = box.h * factor;
    }
    w = Math.max(MIN_SIZE, w); h = Math.max(MIN_SIZE, h);
    // Keep the edge opposite the handle fixed.
    if (handle.includes("w")) x = box.x + box.w - w;
    if (handle.includes("n")) y = box.y + box.h - h;
    if (snap && !d.keepAspect) {
      const right = Math.round((x + w) / SNAP_STEP) * SNAP_STEP, bottom = Math.round((y + h) / SNAP_STEP) * SNAP_STEP;
      x = Math.round(x / SNAP_STEP) * SNAP_STEP; y = Math.round(y / SNAP_STEP) * SNAP_STEP;
      w = Math.max(MIN_SIZE, right - x); h = Math.max(MIN_SIZE, bottom - y);
    }
    onResize(d.id, { x: round(x), y: round(y), w: round(w), h: round(h) });
  };

  const endDrag = () => { if (drag.current) { drag.current = null; onDragEnd(); } };

  // Handles stay a constant on-screen size (and finger-sized hit area) at any zoom.
  const visual = 9 / zoom, hit = 26 / zoom;
  const single = selectedIds.length === 1 ? items.find((item) => item.id === selectedIds[0]) : undefined;
  const handlePoint = (item: DesignItem, handle: Handle) => ({
    x: (item.x + (handle.includes("w") ? 0 : handle.includes("e") ? item.w : item.w / 2)) * PX_PER_IN,
    y: (item.y + (handle.includes("n") ? 0 : handle.includes("s") ? item.h : item.h / 2)) * PX_PER_IN,
  });

  return (
    <svg
      ref={svgRef}
      className={preview ? "template-svg clip" : "template-svg"}
      width={width * PX_PER_IN}
      height={height * PX_PER_IN}
      viewBox={`0 0 ${width * PX_PER_IN} ${height * PX_PER_IN}`}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {showGrid && (
        <>
          <defs><pattern id="gridPattern" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M 12 0 L 0 0 0 12" fill="none" stroke="#e3e8e3" strokeWidth="0.7" /></pattern></defs>
          <rect width={width * PX_PER_IN} height={height * PX_PER_IN} fill="url(#gridPattern)" pointerEvents="none" />
        </>
      )}
      {items.filter((item) => item.visible !== false).map((item) => (
        <ItemShape key={item.id} item={item} record={record} meta={meta} selected={!preview && selectedIds.includes(item.id)} onPointerDown={(event) => startMove(event, item)} />
      ))}
      {!preview && single && !single.locked && single.visible !== false && HANDLES.map((handle) => {
        const { x, y } = handlePoint(single, handle);
        return (
          <g key={handle} onPointerDown={(event) => startResize(event, single, handle)} style={{ cursor: CURSORS[handle], touchAction: "none" }}>
            <rect x={x - hit / 2} y={y - hit / 2} width={hit} height={hit} fill="transparent" />
            <rect x={x - visual / 2} y={y - visual / 2} width={visual} height={visual} rx={visual * 0.2} fill="#fff" stroke="#d77d4e" strokeWidth={1.5 / zoom} pointerEvents="none" />
          </g>
        );
      })}
    </svg>
  );
}
