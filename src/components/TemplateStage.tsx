import { PointerEvent, RefObject, useRef } from "react";
import type { DesignItem, Guide, RecordMeta, RecordRow } from "../types";
import { PX_PER_IN, round } from "../lib/data";
import { boundsOf, centerOf, rotateAbout, type Box, type Transform } from "../lib/align";
import { ItemShape } from "./ItemShape";

type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const BASE_ANGLE: Record<Handle, number> = { e: 0, se: 45, s: 90, sw: 135, w: 180, nw: 225, n: 270, ne: 315 };
/** Resize cursor that follows the item's rotation. */
const cursorFor = (handle: Handle, rotation: number) =>
  (["ew-resize", "nwse-resize", "ns-resize", "nesw-resize"] as const)[((Math.round(((BASE_ANGLE[handle] + rotation) % 180 + 180) % 180 / 45)) % 4)];

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
  onRotate: (id: string, degrees: number) => void;
  onRotateGroup: (updates: Transform[]) => void;
  onDragEnd: () => void;
};

type Drag =
  | { kind: "move"; primary: string; startX: number; startY: number; origins: Map<string, { x: number; y: number }>; w: number; h: number }
  | { kind: "resize"; id: string; handle: Handle; startX: number; startY: number; box: Box; rotation: number; keepAspect: boolean }
  | { kind: "rotate"; id: string }
  | { kind: "rotate-group"; origins: DesignItem[]; center: { x: number; y: number }; startAngle: number };

/** Pointer-down handlers call preventDefault (to avoid text selection and scrolling), which also stops the browser
 *  from blurring a focused inspector field, so keyboard shortcuts would keep going into that field. Blur it ourselves. */
const releaseFocus = () => {
  const active = document.activeElement as HTMLElement | null;
  if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) active.blur();
};

const SNAP_STEP = 0.05;
const GUIDE_REACH = 0.08;
const MIN_SIZE = 0.05;

/** Editable template canvas. Items may be dragged anywhere, including past the template edge and over the rulers. */
export function TemplateStage({ items, record, meta, width, height, zoom, selectedIds, showGrid, snap, guides, multi, preview, svgRef, onSelect, onMove, onResize, onRotate, onRotateGroup, onDragEnd }: Props) {
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
    releaseFocus();
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
    releaseFocus();
    event.preventDefault();
    const corner = handle.length === 2;
    drag.current = { kind: "resize", id: item.id, handle, startX: event.clientX, startY: event.clientY, box: { x: item.x, y: item.y, w: item.w, h: item.h }, rotation: item.rotation ?? 0, keepAspect: corner && (item.type === "image" || event.shiftKey) };
    (event.currentTarget as SVGElement).setPointerCapture(event.pointerId);
  };

  const startRotate = (event: PointerEvent<SVGElement>, item: DesignItem) => {
    event.stopPropagation();
    releaseFocus();
    event.preventDefault();
    drag.current = { kind: "rotate", id: item.id };
    (event.currentTarget as SVGElement).setPointerCapture(event.pointerId);
  };

  const pointerAngle = (clientX: number, clientY: number, center: { x: number; y: number }) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return (Math.atan2(clientY - (rect.top + center.y * scale), clientX - (rect.left + center.x * scale)) * 180) / Math.PI;
  };

  /** Treats the selection as a temporary group: it turns about the middle of its combined bounds. */
  const startRotateGroup = (event: PointerEvent<SVGElement>, members: DesignItem[]) => {
    event.stopPropagation();
    event.preventDefault();
    releaseFocus();
    const center = centerOf(boundsOf(members));
    drag.current = { kind: "rotate-group", origins: members.map((m) => ({ ...m })), center, startAngle: pointerAngle(event.clientX, event.clientY, center) };
    (event.currentTarget as SVGElement).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === "rotate-group") {
      let delta = pointerAngle(event.clientX, event.clientY, d.center) - d.startAngle;
      if (event.shiftKey || snap) delta = Math.round(delta / 15) * 15;
      onRotateGroup(rotateAbout(d.origins, delta, d.center));
      return;
    }
    if (d.kind === "rotate") {
      const item = items.find((candidate) => candidate.id === d.id);
      const rect = svgRef.current?.getBoundingClientRect();
      if (!item || !rect) return;
      const cx = rect.left + (item.x + item.w / 2) * scale, cy = rect.top + (item.y + item.h / 2) * scale;
      let degrees = (Math.atan2(event.clientY - cy, event.clientX - cx) * 180) / Math.PI + 90; // handle sits above the item
      if (event.shiftKey || snap) degrees = Math.round(degrees / 15) * 15;
      else for (const stop of [0, 90, 180, -90]) if (Math.abs(((degrees - stop + 540) % 360) - 180) < 3) degrees = stop; // gentle magnet at right angles
      onRotate(d.id, round(((degrees + 540) % 360) - 180, 1));
      return;
    }
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
    const { box, handle, rotation } = d;
    // Work in the item's own (unrotated) frame, keeping the corner/edge opposite the handle fixed on screen.
    const theta = (rotation * Math.PI) / 180, cos = Math.cos(theta), sin = Math.sin(theta);
    const lx = dx * cos + dy * sin, ly = -dx * sin + dy * cos;
    let w = box.w + (handle.includes("e") ? lx : handle.includes("w") ? -lx : 0);
    let h = box.h + (handle.includes("s") ? ly : handle.includes("n") ? -ly : 0);
    if (d.keepAspect) {
      const factor = Math.max(w / box.w, h / box.h);
      w = box.w * factor; h = box.h * factor;
    }
    w = Math.max(MIN_SIZE, w); h = Math.max(MIN_SIZE, h);
    const anchor = (width: number, height: number) => ({ x: handle.includes("e") ? -width / 2 : handle.includes("w") ? width / 2 : 0, y: handle.includes("s") ? -height / 2 : handle.includes("n") ? height / 2 : 0 });
    const turn = (p: { x: number; y: number }) => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos });
    const before = turn(anchor(box.w, box.h)), after = turn(anchor(w, h));
    const cx = box.x + box.w / 2 + before.x - after.x, cy = box.y + box.h / 2 + before.y - after.y;
    let x = cx - w / 2, y = cy - h / 2;
    if (snap && !d.keepAspect && !rotation) {
      const right = Math.round((x + w) / SNAP_STEP) * SNAP_STEP, bottom = Math.round((y + h) / SNAP_STEP) * SNAP_STEP;
      x = Math.round(x / SNAP_STEP) * SNAP_STEP; y = Math.round(y / SNAP_STEP) * SNAP_STEP;
      w = Math.max(MIN_SIZE, right - x); h = Math.max(MIN_SIZE, bottom - y);
    }
    onResize(d.id, { x: round(x), y: round(y), w: round(w), h: round(h) });
  };

  const endDrag = () => { if (drag.current) { drag.current = null; onDragEnd(); } };

  // Handles stay a constant on-screen size (and finger-sized hit area) at any zoom.
  const visual = 9 / zoom, hit = 26 / zoom;
  const group = items.filter((item) => selectedIds.includes(item.id) && item.visible !== false && !item.locked);
  const single = selectedIds.length === 1 ? items.find((item) => item.id === selectedIds[0]) : undefined;
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
      {!preview && group.length > 1 && (() => {
        const box = boundsOf(group), reach = 30 / zoom;
        const x = box.x * PX_PER_IN, y = box.y * PX_PER_IN, w = box.w * PX_PER_IN, h = box.h * PX_PER_IN;
        return (
          <g>
            <rect x={x - 6} y={y - 6} width={w + 12} height={h + 12} fill="none" stroke="#d77d4e" strokeWidth={1.2 / zoom} strokeDasharray={`${4 / zoom} ${3 / zoom}`} pointerEvents="none" />
            <line x1={x + w / 2} y1={y - 6} x2={x + w / 2} y2={y - reach} stroke="#d77d4e" strokeWidth={1.2 / zoom} pointerEvents="none" />
            <g onPointerDown={(event) => startRotateGroup(event, group)} style={{ cursor: "grab", touchAction: "none" }}>
              <circle cx={x + w / 2} cy={y - reach} r={hit / 2} fill="transparent" />
              <circle cx={x + w / 2} cy={y - reach} r={visual * 0.62} fill="#fff" stroke="#d77d4e" strokeWidth={1.5 / zoom} pointerEvents="none" />
            </g>
          </g>
        );
      })()}
      {!preview && single && !single.locked && single.visible !== false && (() => {
        const w = single.w * PX_PER_IN, h = single.h * PX_PER_IN, rotation = single.rotation ?? 0;
        const reach = 30 / zoom;
        return (
          <g transform={`translate(${single.x * PX_PER_IN} ${single.y * PX_PER_IN}) rotate(${rotation} ${w / 2} ${h / 2})`}>
            <line x1={w / 2} y1={-4} x2={w / 2} y2={-reach} stroke="#d77d4e" strokeWidth={1.2 / zoom} pointerEvents="none" />
            <g onPointerDown={(event) => startRotate(event, single)} style={{ cursor: "grab", touchAction: "none" }}>
              <circle cx={w / 2} cy={-reach} r={hit / 2} fill="transparent" />
              <circle cx={w / 2} cy={-reach} r={visual * 0.62} fill="#fff" stroke="#d77d4e" strokeWidth={1.5 / zoom} pointerEvents="none" />
            </g>
            {HANDLES.map((handle) => {
              const x = (handle.includes("w") ? 0 : handle.includes("e") ? w : w / 2), y = (handle.includes("n") ? 0 : handle.includes("s") ? h : h / 2);
              return (
                <g key={handle} onPointerDown={(event) => startResize(event, single, handle)} style={{ cursor: cursorFor(handle, rotation), touchAction: "none" }}>
                  <rect x={x - hit / 2} y={y - hit / 2} width={hit} height={hit} fill="transparent" />
                  <rect x={x - visual / 2} y={y - visual / 2} width={visual} height={visual} rx={visual * 0.2} fill="#fff" stroke="#d77d4e" strokeWidth={1.5 / zoom} pointerEvents="none" />
                </g>
              );
            })}
          </g>
        );
      })()}
    </svg>
  );
}
