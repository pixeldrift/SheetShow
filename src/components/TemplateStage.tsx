import { PointerEvent, RefObject, useEffect, useRef, useState } from "react";
import type { DesignItem, Guide, RecordMeta, RecordRow } from "../types";
import { PX_PER_IN, round } from "../lib/data";
import { aabb, boundsOf, centerOf, rotateAbout, type Box, type Transform } from "../lib/align";
import { ItemShape, itemFrame } from "./ItemShape";
import { smartSnap, type SnapLine, type SnapOptions } from "../lib/smartSnap";

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
  /** Inner safe area in inches: drawn as a dashed guide, never printed. */
  margins?: { top: number; right: number; bottom: number; left: number };
  /** Bleed in inches: artwork may run this far past the trim edge. */
  bleed?: number;
  snap: boolean;
  /** Which kinds of snapping are on (while `snap`, the master switch, is on). */
  snapOptions: SnapOptions;
  /** A text object a dragged field would link to if dropped now: drawn with a highlighted border and a link badge. */
  dropTargetId?: string | null;
  /** Texts that will cause trouble for some records (cut off, off the card, out of a visible box): each gets a warning icon you can tap. */
  warnings?: Map<string, { index: number; kind: string }[]>;
  onWarning?: (itemId: string, clientX: number, clientY: number) => void;
  guides: Guide[];
  /** Tapping toggles selection (multi-select mode) instead of replacing it. */
  multi: boolean;
  /** When true, editing is paused and the output is clipped to the template. */
  preview: boolean;
  /** Show {field} names instead of values. */
  rawFields?: boolean;
  svgRef: RefObject<SVGSVGElement>;
  onSelect: (ids: string[]) => void;
  onMove: (updates: { id: string; x: number; y: number }[]) => void;
  onResize: (id: string, box: Box) => void;
  onRotate: (id: string, degrees: number) => void;
  onRotateGroup: (updates: Transform[]) => void;
  /** Resizing a selection of several objects (or a group): new boxes, and font sizes when scaling proportionally. */
  onScaleGroup: (updates: { id: string; x: number; y: number; w: number; h: number; fontSize?: number }[]) => void;
  onDragEnd: () => void;
  /** Double-tap on a text object: edit its words right on the canvas. */
  onEditText?: (id: string) => void;
};

type Drag =
  | { kind: "move"; primary: string; startX: number; startY: number; origins: Map<string, { x: number; y: number }>; w: number; h: number; box: Box; targets: Box[]; spacing?: Box[]; began?: boolean }
  | { kind: "resize"; id: string; handle: Handle; startX: number; startY: number; box: Box; rotation: number; keepAspect: boolean; targets: Box[] }
  | { kind: "rotate"; id: string }
  | { kind: "scale-group"; handle: Handle; startX: number; startY: number; box: Box; origins: DesignItem[]; keepAspect: boolean }
  | { kind: "rotate-group"; origins: DesignItem[]; center: { x: number; y: number }; startAngle: number };

/** Pointer-down handlers call preventDefault (to avoid text selection and scrolling), which also stops the browser
 *  from blurring a focused inspector field, so keyboard shortcuts would keep going into that field. Blur it ourselves. */
const releaseFocus = () => {
  const active = document.activeElement as HTMLElement | null;
  if (active && (/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) || active.isContentEditable)) active.blur();
};

const SNAP_STEP = 0.05;
const GUIDE_REACH = 0.08;
const MIN_SIZE = 0.05;

/** Editable template canvas. Items may be dragged anywhere, including past the template edge and over the rulers. */
export function TemplateStage({ items, record, meta, width, height, zoom, selectedIds, showGrid, margins, bleed = 0, snap, snapOptions, dropTargetId, warnings, onWarning, guides, multi, preview, rawFields, svgRef, onSelect, onMove, onResize, onRotate, onRotateGroup, onScaleGroup, onDragEnd, onEditText }: Props) {
  const drag = useRef<Drag | null>(null);
  const lastTap = useRef<{ id: string; at: number } | null>(null);
  /** A double-click on a grouped object picks just that object, but only once the pointer is released without having moved (otherwise it was a quick click-and-drag of the group). */
  const pendingSingle = useRef<string | null>(null);
  const scale = PX_PER_IN * zoom;
  const wantKeyboard = useRef(false);
  const summonKeyboard = () => {
    if (!wantKeyboard.current) return;
    const editor = document.querySelector<HTMLElement>(".inline-editor");
    if (editor) { editor.focus({ preventScroll: true }); wantKeyboard.current = false; }
  };
  // A second finger on the canvas means pan and zoom: drop any drag the first finger had started.
  useEffect(() => {
    const cancel = () => { drag.current = null; pendingSingle.current = null; setSnapLines([]); };
    window.addEventListener("canvas-multitouch", cancel);
    return () => window.removeEventListener("canvas-multitouch", cancel);
  }, []);
  /** Smart-snap guide lines shown while dragging. */
  const [snapLines, setSnapLines] = useState<SnapLine[]>([]);
  /** An item's box as drawn (text can be taller than its box), including rotation. */
  const framedBox = (item: DesignItem): Box => aabb(item.type === "text" ? { ...item, h: itemFrame(item, record, meta, rawFields).h / PX_PER_IN } : item);
  /** Everything a dragged object can snap to: the page, and every other visible, non-reference object. */
  const snapTargets = (exclude: string[]): Box[] => [
    ...(snapOptions.page ? [{ x: 0, y: 0, w: width, h: height }] : []),
    ...(snapOptions.page && bleed > 0 ? [{ x: -bleed, y: -bleed, w: width + bleed * 2, h: height + bleed * 2 }] : []),
    ...(snapOptions.margins && margins && (margins.top || margins.right || margins.bottom || margins.left)
      ? [{ x: margins.left, y: margins.top, w: Math.max(0, width - margins.left - margins.right), h: Math.max(0, height - margins.top - margins.bottom) }] : []),
    ...(snapOptions.objects ? items.filter((i) => i.visible !== false && !i.reference && !exclude.includes(i.id)).map(framedBox) : []),
  ];
  /** Objects that equal-spacing snapping measures gaps against. */
  const spacingTargets = (exclude: string[]): Box[] | undefined =>
    snapOptions.spacing ? items.filter((i) => i.visible !== false && !i.reference && !exclude.includes(i.id)).map(framedBox) : undefined;
  const guideLines = snapOptions.guides
    ? { x: guides.filter((g) => g.axis === "x").map((g) => g.position), y: guides.filter((g) => g.axis === "y").map((g) => g.position) }
    : { x: [] as number[], y: [] as number[] };
  const gridOn = showGrid && snapOptions.grid;
  const reach = 6 / scale; // snapping pulls from 6 screen pixels away, at any zoom

  /** Grid snapping, used only while the grid is showing. */
  const gridSnap = (value: number) => Math.round(value / SNAP_STEP) * SNAP_STEP;

  const startMove = (event: PointerEvent<SVGGElement>, item: DesignItem) => {
    if (preview) return;
    event.stopPropagation();
    releaseFocus();
    const toggle = multi || event.shiftKey || event.metaKey || event.ctrlKey;
    // Clicking a grouped object selects its whole group; Alt-click, or a double-click on a selected one, picks just that object.
    const now = Date.now();
    const doubleTap = !!lastTap.current && lastTap.current.id === item.id && now - lastTap.current.at < 400;
    lastTap.current = { id: item.id, at: now };
    const justThis = !!item.groupId && event.altKey;
    // Double-tap a text object (one that is already selected on its own) to edit its words in place.
    if (doubleTap && item.type === "text" && !item.locked && !(multi || event.shiftKey || event.metaKey || event.ctrlKey) && selectedIds.length === 1 && selectedIds[0] === item.id && onEditText) {
      event.preventDefault();
      lastTap.current = null;
      wantKeyboard.current = true; // the phone's keyboard only opens from a touch event, so the editor is focused again when this tap lifts
      onEditText(item.id);
      return;
    }
    pendingSingle.current = item.groupId && doubleTap && selectedIds.includes(item.id) && !toggle ? item.id : null;
    const base = justThis ? [item.id] : items.filter((i) => i.visible !== false && (item.groupId ? i.groupId === item.groupId : i.id === item.id)).map((i) => i.id);
    if (toggle) {
      onSelect(base.every((id) => selectedIds.includes(id)) ? selectedIds.filter((id) => !base.includes(id)) : [...new Set([...selectedIds, ...base])]);
      return;
    }
    const ids = selectedIds.includes(item.id) && !justThis ? selectedIds : base;
    if (ids !== selectedIds) onSelect(ids);
    const movable = items.filter((candidate) => ids.includes(candidate.id) && !candidate.locked);
    if (!movable.length || item.locked) return;
    event.preventDefault();
    drag.current = { kind: "move", primary: item.id, startX: event.clientX, startY: event.clientY, w: item.w, h: item.h, origins: new Map(movable.map((m) => [m.id, { x: m.x, y: m.y }])), box: boundsOf(movable.map((m) => ({ ...m, ...(m.type === "text" ? { h: itemFrame(m, record, meta, rawFields).h / PX_PER_IN } : {}) }))), targets: snapTargets(movable.map((m) => m.id)), spacing: spacingTargets(movable.map((m) => m.id)) };
    (event.currentTarget as SVGGElement).setPointerCapture(event.pointerId);
  };

  const startResize = (event: PointerEvent<SVGElement>, item: DesignItem, handle: Handle) => {
    event.stopPropagation();
    releaseFocus();
    event.preventDefault();
    const corner = handle.length === 2;
    const frame = itemFrame(item, record, meta, rawFields); // start from what's drawn, which can be taller than item.h for wrapped text
    drag.current = { kind: "resize", id: item.id, handle, startX: event.clientX, startY: event.clientY, box: { x: item.x, y: item.y, w: item.w, h: frame.h / PX_PER_IN }, rotation: item.rotation ?? 0, keepAspect: corner && (item.type === "image" || event.shiftKey), targets: snapTargets([item.id]) };
    (event.currentTarget as SVGElement).setPointerCapture(event.pointerId);
  };

  const startRotate = (event: PointerEvent<SVGElement>, item: DesignItem) => {
    event.stopPropagation();
    releaseFocus();
    event.preventDefault();
    drag.current = { kind: "rotate", id: item.id };
    (event.currentTarget as SVGElement).setPointerCapture(event.pointerId);
  };

  const startScaleGroup = (event: PointerEvent<SVGElement>, handle: Handle, box: Box, members: DesignItem[]) => {
    event.stopPropagation();
    event.preventDefault();
    releaseFocus();
    const origins = items.filter((i) => members.some((m) => m.id === i.id));
    drag.current = { kind: "scale-group", handle, startX: event.clientX, startY: event.clientY, box, origins, keepAspect: handle.length === 2 && !event.shiftKey };
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
      const frame = itemFrame(item, record, meta, rawFields);
      const cx = rect.left + (item.x + item.w / 2) * scale, cy = rect.top + (item.y + frame.h / PX_PER_IN / 2) * scale;
      let degrees = (Math.atan2(event.clientY - cy, event.clientX - cx) * 180) / Math.PI + 90; // handle sits above the item
      if (event.shiftKey || snap) degrees = Math.round(degrees / 15) * 15;
      else for (const stop of [0, 90, 180, -90]) if (Math.abs(((degrees - stop + 540) % 360) - 180) < 3) degrees = stop; // gentle magnet at right angles
      onRotate(d.id, round(((degrees + 540) % 360) - 180, 1));
      return;
    }
    const dx = (event.clientX - d.startX) / scale;
    const dy = (event.clientY - d.startY) / scale;
    if (d.kind === "move") {
      // On a touch screen an object only starts to move after the finger has travelled a few pixels, so a second finger landing for a
      // two-finger pan or zoom doesn't nudge it first.
      if (!d.began) { if (event.pointerType === "touch" && Math.hypot(event.clientX - d.startX, event.clientY - d.startY) < 7) return; d.began = true; }
      if (pendingSingle.current && Math.hypot(event.clientX - d.startX, event.clientY - d.startY) > 4) pendingSingle.current = null;
      const origin = d.origins.get(d.primary) ?? [...d.origins.values()][0];
      let x = origin.x + dx, y = origin.y + dy;
      const smart = snap && !event.ctrlKey && !event.metaKey; // hold Ctrl/⌘ to move freely
      if (smart) {
        // Snap the whole selection's edges and center to other objects, the page and guides; the grid only when it is showing.
        const r = smartSnap({ x: d.box.x + dx, y: d.box.y + dy, w: d.box.w, h: d.box.h }, d.targets, guideLines, reach, undefined, d.spacing);
        x += r.dx; y += r.dy;
        if (gridOn && r.dx === 0) x = gridSnap(x);
        if (gridOn && r.dy === 0) y = gridSnap(y);
        setSnapLines(r.lines);
      } else if (snapLines.length) setSnapLines([]);
      const shiftX = x - origin.x, shiftY = y - origin.y;
      onMove([...d.origins].map(([id, o]) => ({ id, x: round(o.x + shiftX), y: round(o.y + shiftY) })));
      return;
    }
    if (d.kind === "scale-group") {
      const { box, handle, origins } = d;
      let w = box.w + (handle.includes("e") ? dx : handle.includes("w") ? -dx : 0);
      let h = box.h + (handle.includes("s") ? dy : handle.includes("n") ? -dy : 0);
      if (d.keepAspect) { const f = Math.max(w / box.w, h / box.h); w = box.w * f; h = box.h * f; }
      w = Math.max(MIN_SIZE, w); h = Math.max(MIN_SIZE, h);
      const x = handle.includes("w") ? box.x + box.w - w : box.x;
      const y = handle.includes("n") ? box.y + box.h - h : box.y;
      const sx = w / box.w, sy = h / box.h, fontScale = d.keepAspect ? Math.min(sx, sy) : 1;
      onScaleGroup(origins.filter((i) => !i.locked).map((i) => ({
        id: i.id, x: round(x + (i.x - box.x) * sx), y: round(y + (i.y - box.y) * sy), w: round(i.w * sx), h: round(i.h * sy),
        ...(i.type === "text" && fontScale !== 1 ? { fontSize: Math.round((i.fontSize ?? 12) * fontScale * 10) / 10 } : {}),
      })));
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
    if (snap && !d.keepAspect && !rotation && !event.ctrlKey && !event.metaKey) {
      // Only the edges being dragged snap: to other objects, the page and guides, else to the grid when it is showing.
      const use = { x: handle.includes("e") ? [2] : handle.includes("w") ? [0] : [], y: handle.includes("s") ? [2] : handle.includes("n") ? [0] : [] };
      const r = smartSnap({ x, y, w, h }, d.targets, guideLines, reach, use);
      let left = x, top = y, right = x + w, bottom = y + h;
      if (handle.includes("e")) right += r.dx; if (handle.includes("w")) left += r.dx;
      if (handle.includes("s")) bottom += r.dy; if (handle.includes("n")) top += r.dy;
      if (gridOn) {
        if (r.dx === 0) { if (handle.includes("e")) right = gridSnap(right); if (handle.includes("w")) left = gridSnap(left); }
        if (r.dy === 0) { if (handle.includes("s")) bottom = gridSnap(bottom); if (handle.includes("n")) top = gridSnap(top); }
      }
      x = left; y = top; w = Math.max(MIN_SIZE, right - left); h = Math.max(MIN_SIZE, bottom - top);
      setSnapLines(r.lines);
    } else if (snapLines.length) setSnapLines([]);
    onResize(d.id, { x: round(x), y: round(y), w: round(w), h: round(h) });
  };

  const endDrag = () => {
    if (pendingSingle.current) { onSelect([pendingSingle.current]); pendingSingle.current = null; }
    if (snapLines.length) setSnapLines([]);
    if (drag.current) { drag.current = null; onDragEnd(); }
  };

  // Handles stay a constant on-screen size (and finger-sized hit area) at any zoom.
  const visual = 9 / zoom, hit = 26 / zoom;
  // Group bounds use each item's drawn frame (see itemFrame), so the group outline wraps the member outlines exactly.
  const group = items.filter((item) => selectedIds.includes(item.id) && item.visible !== false && !item.locked)
    .map((item) => (item.type === "text" ? { ...item, h: itemFrame(item, record, meta, rawFields).h / PX_PER_IN } : item));
  const single = selectedIds.length === 1 ? items.find((item) => item.id === selectedIds[0]) : undefined;
  return (
    <svg
      ref={svgRef}
      className={preview && !bleed ? "template-svg clip" : "template-svg"}
      style={preview && bleed ? { clipPath: `inset(${-bleed * PX_PER_IN}px)` } : undefined}
      width={width * PX_PER_IN}
      height={height * PX_PER_IN}
      viewBox={`0 0 ${width * PX_PER_IN} ${height * PX_PER_IN}`}
      onPointerMove={onPointerMove}
      onPointerUp={() => { endDrag(); summonKeyboard(); }}
      onClick={summonKeyboard}
      onPointerCancel={endDrag}
    >
      {showGrid && (
        <>
          <defs><pattern id="gridPattern" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M 12 0 L 0 0 0 12" fill="none" stroke="#e3e8e3" strokeWidth="0.7" /></pattern></defs>
          <rect width={width * PX_PER_IN} height={height * PX_PER_IN} fill="url(#gridPattern)" pointerEvents="none" />
        </>
      )}
      {!preview && margins && (margins.top || margins.right || margins.bottom || margins.left) ? (
        <rect x={margins.left * PX_PER_IN} y={margins.top * PX_PER_IN} width={Math.max(0, width - margins.left - margins.right) * PX_PER_IN} height={Math.max(0, height - margins.top - margins.bottom) * PX_PER_IN}
          fill="none" stroke="#7c5cdb" strokeWidth="1" strokeDasharray="5 4" opacity="0.7" pointerEvents="none" />
      ) : null}
      {items.filter((item) => item.visible !== false && !(preview && item.reference)).map((item) => (
        <ItemShape key={item.id} item={item} record={record} meta={meta} outline={!preview && selectedIds.includes(item.id) ? (selectedIds.length === 1 ? "primary" : "member") : undefined} zoom={zoom} raw={rawFields} badge={!preview} onPointerDown={(event) => startMove(event, item)} />
      ))}
      {!preview && bleed > 0 && (
        // Drawn over the artwork so the edge is always visible, with a pale halo under teal dashes: distinct from the orange selection, the pink snap lines and the violet margin guide.
        <g fill="none" pointerEvents="none">
          <rect x={-bleed * PX_PER_IN} y={-bleed * PX_PER_IN} width={(width + bleed * 2) * PX_PER_IN} height={(height + bleed * 2) * PX_PER_IN} stroke="#fff" strokeOpacity="0.85" strokeWidth={3 / zoom} />
          <rect x={-bleed * PX_PER_IN} y={-bleed * PX_PER_IN} width={(width + bleed * 2) * PX_PER_IN} height={(height + bleed * 2) * PX_PER_IN} stroke="#0e8fa8" strokeWidth={1.5 / zoom} strokeDasharray={`${9 / zoom} ${5 / zoom}`} />
        </g>
      )}
      {dropTargetId && (() => {
        const target = items.find((i) => i.id === dropTargetId);
        if (!target) return null;
        const { w, h } = itemFrame(target, record, meta, rawFields);
        const b = 22 / zoom; // link badge on the top-right corner
        return (
          <g transform={`translate(${target.x * PX_PER_IN} ${target.y * PX_PER_IN})${target.rotation ? ` rotate(${target.rotation} ${w / 2} ${h / 2})` : ""}`} pointerEvents="none">
            <rect width={w} height={h} fill="#d77d4e22" stroke="#d77d4e" strokeWidth={2.5 / zoom} rx={3 / zoom} />
            <g transform={`translate(${w - b * 0.6} ${-b * 0.6}) scale(${b / 24})`}>
              <circle cx="12" cy="12" r="13" fill="#d77d4e" stroke="#fff" strokeWidth="2" />
              <g fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" transform="translate(3.5 3.5) scale(.71)"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></g>
            </g>
          </g>
        );
      })()}
      {/* Smart-snap guides while dragging: a thin line wherever an edge or center lines up with something else. */}
      {snapLines.map((l, i) => l.gap ? (
        // An equal-spacing marker: the measured gap with a tick at each end.
        <path key={i} d={l.axis === "x"
          ? `M${l.from * PX_PER_IN} ${l.at * PX_PER_IN}H${l.to * PX_PER_IN}M${l.from * PX_PER_IN} ${l.at * PX_PER_IN - 4 / zoom}v${8 / zoom}M${l.to * PX_PER_IN} ${l.at * PX_PER_IN - 4 / zoom}v${8 / zoom}`
          : `M${l.at * PX_PER_IN} ${l.from * PX_PER_IN}V${l.to * PX_PER_IN}M${l.at * PX_PER_IN - 4 / zoom} ${l.from * PX_PER_IN}h${8 / zoom}M${l.at * PX_PER_IN - 4 / zoom} ${l.to * PX_PER_IN}h${8 / zoom}`}
          fill="none" stroke="#e2337f" strokeWidth={1 / zoom} pointerEvents="none" />
      ) : l.axis === "x"
        ? <line key={i} x1={l.at * PX_PER_IN} x2={l.at * PX_PER_IN} y1={l.from * PX_PER_IN} y2={l.to * PX_PER_IN} stroke="#e2337f" strokeWidth={1 / zoom} pointerEvents="none" />
        : <line key={i} y1={l.at * PX_PER_IN} y2={l.at * PX_PER_IN} x1={l.from * PX_PER_IN} x2={l.to * PX_PER_IN} stroke="#e2337f" strokeWidth={1 / zoom} pointerEvents="none" />)}
      {!preview && group.length > 1 && (() => {
        const box = boundsOf(group), reach = 30 / zoom;
        const x = box.x * PX_PER_IN, y = box.y * PX_PER_IN, w = box.w * PX_PER_IN, h = box.h * PX_PER_IN;
        return (
          <g>
            <rect x={x} y={y} width={w} height={h} fill="none" stroke="#d77d4e" strokeWidth={1.5 / zoom} pointerEvents="none" />
            <line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y - reach} stroke="#d77d4e" strokeWidth={1.2 / zoom} pointerEvents="none" />
            <g onPointerDown={(event) => startRotateGroup(event, group)} style={{ cursor: "grab", touchAction: "none" }}>
              <circle cx={x + w / 2} cy={y - reach} r={hit / 2} fill="transparent" />
              <circle cx={x + w / 2} cy={y - reach} r={visual * 0.62} fill="#fff" stroke="#d77d4e" strokeWidth={1.5 / zoom} pointerEvents="none" />
            </g>
            {HANDLES.map((handle) => {
              const hx = x + (handle.includes("w") ? 0 : handle.includes("e") ? w : w / 2), hy = y + (handle.includes("n") ? 0 : handle.includes("s") ? h : h / 2);
              return (
                <g key={handle} onPointerDown={(event) => startScaleGroup(event, handle, box, group)} style={{ cursor: cursorFor(handle, 0), touchAction: "none" }}>
                  <rect x={hx - hit / 2} y={hy - hit / 2} width={hit} height={hit} fill="transparent" />
                  <rect x={hx - visual / 2} y={hy - visual / 2} width={visual} height={visual} rx={visual * 0.2} fill="#fff" stroke="#d77d4e" strokeWidth={1.5 / zoom} pointerEvents="none" />
                </g>
              );
            })}
          </g>
        );
      })()}
      {!preview && single && !single.locked && single.visible !== false && (() => {
        const { w, h } = itemFrame(single, record, meta, rawFields), rotation = single.rotation ?? 0;
        const reach = 30 / zoom;
        return (
          <g transform={`translate(${single.x * PX_PER_IN} ${single.y * PX_PER_IN}) rotate(${rotation} ${w / 2} ${h / 2})`}>
            <line x1={w / 2} y1={0} x2={w / 2} y2={-reach} stroke="#d77d4e" strokeWidth={1.2 / zoom} pointerEvents="none" />
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
      {!preview && warnings && onWarning && items.filter((i) => warnings.has(i.id) && i.visible !== false).map((item) => {
        const { w, h } = itemFrame(item, record, meta, rawFields);
        const s = 20 / zoom; // a constant on-screen size, at the top-right corner of the box
        return (
          <g key={`warn-${item.id}`} transform={`translate(${item.x * PX_PER_IN} ${item.y * PX_PER_IN})${item.rotation ? ` rotate(${item.rotation} ${w / 2} ${h / 2})` : ""}`}>
            <g transform={`translate(${w - s * 0.2} ${-s * 0.8}) scale(${s / 24})`} style={{ cursor: "pointer", touchAction: "none" }}
              onPointerDown={(e) => { e.stopPropagation(); }} onClick={(e) => { e.stopPropagation(); onWarning(item.id, e.clientX, e.clientY); }}>
              <title>Some records don’t fit this text. Tap to see which.</title>
              <circle cx="12" cy="12" r="15" fill="transparent" />
              <path d="M12 2.6 22.4 20.6H1.6Z" fill="#f2a43a" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
              <path d="M12 9.2v5.2" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" /><circle cx="12" cy="17.4" r="1.4" fill="#fff" />
            </g>
          </g>
        );
      })}
    </svg>
  );
}
