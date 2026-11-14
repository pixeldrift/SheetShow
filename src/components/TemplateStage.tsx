import { DragEvent, PointerEvent, RefObject, useRef } from "react";
import type { DesignItem, Guide, RecordMeta, RecordRow } from "../types";
import { PX_PER_IN, fieldDisplayName, round } from "../lib/data";
import { ItemShape } from "./ItemShape";

type Props = {
  items: DesignItem[];
  record: RecordRow;
  meta: RecordMeta;
  width: number;
  height: number;
  zoom: number;
  selectedId: string | null;
  showGrid: boolean;
  snap: boolean;
  guides: Guide[];
  /** When true, editing is paused and the output is clipped to the template. */
  preview: boolean;
  svgRef: RefObject<SVGSVGElement>;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDragEnd: () => void;
  onBind: (id: string, field: string) => void;
  onDropField: (field: string, x: number, y: number) => void;
};

const SNAP_STEP = 0.05;
const GUIDE_REACH = 0.08;

/** Editable template canvas. Items may be dragged anywhere, including past the template edge and over the rulers. */
export function TemplateStage({ items, record, meta, width, height, zoom, selectedId, showGrid, snap, guides, preview, svgRef, onSelect, onMove, onDragEnd, onBind, onDropField }: Props) {
  const drag = useRef<{ id: string; startX: number; startY: number; itemX: number; itemY: number; w: number } | null>(null);

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
    onSelect(item.id);
    if (item.locked) return;
    event.preventDefault();
    drag.current = { id: item.id, startX: event.clientX, startY: event.clientY, itemX: item.x, itemY: item.y, w: item.w };
    (event.currentTarget as SVGGElement).setPointerCapture(event.pointerId);
  };

  const moveItem = (event: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const item = items.find((candidate) => candidate.id === d.id);
    if (!item) return;
    const scale = PX_PER_IN * zoom;
    let x = d.itemX + (event.clientX - d.startX) / scale;
    let y = d.itemY + (event.clientY - d.startY) / scale;
    if (snap) { x = snapAxis(x, item.w, "x"); y = snapAxis(y, item.h, "y"); }
    onMove(d.id, round(x), round(y));
  };

  const endDrag = () => { if (drag.current) { drag.current = null; onDragEnd(); } };

  const onDrop = (event: DragEvent<SVGSVGElement>) => {
    event.preventDefault();
    const field = event.dataTransfer.getData("text/plain");
    const svg = svgRef.current;
    if (!field || !svg) return;
    const targetId = (event.target as Element).closest("[data-item-id]")?.getAttribute("data-item-id");
    const target = items.find((item) => item.id === targetId);
    if (target?.type === "text") { onBind(target.id, field); return; }
    const rect = svg.getBoundingClientRect();
    const scale = PX_PER_IN * zoom;
    onDropField(field, round((event.clientX - rect.left) / scale, 2), round((event.clientY - rect.top) / scale, 2));
  };

  return (
    <svg
      ref={svgRef}
      className={preview ? "template-svg clip" : "template-svg"}
      width={width * PX_PER_IN}
      height={height * PX_PER_IN}
      viewBox={`0 0 ${width * PX_PER_IN} ${height * PX_PER_IN}`}
      onPointerMove={moveItem}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      {showGrid && (
        <>
          <defs><pattern id="gridPattern" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M 12 0 L 0 0 0 12" fill="none" stroke="#e3e8e3" strokeWidth="0.7" /></pattern></defs>
          <rect width={width * PX_PER_IN} height={height * PX_PER_IN} fill="url(#gridPattern)" pointerEvents="none" />
        </>
      )}
      {items.filter((item) => item.visible !== false).map((item) => (
        <ItemShape key={item.id} item={item} record={record} meta={meta} selected={!preview && selectedId === item.id} onPointerDown={(event) => startMove(event, item)} />
      ))}
    </svg>
  );
}

export const defaultTextLabel = (field?: string) => (field ? fieldDisplayName(field) : "Your text");
