import { useEffect, useRef, useState } from "react";
import { AlertTriangle, PencilLine, RotateCcw, Undo2 } from "lucide-react";
import type { DesignItem, InstanceOverride, RecordMeta, RecordRow, Sheet } from "../types";
import { PX_PER_IN, valueFor } from "../lib/data";
import { ID } from "../lib/records";
import { hasEdits } from "../lib/instances";
import { instanceIssues, recordLabel } from "../lib/audit";
import { fontStack } from "../lib/fonts";
import { fontSizePx } from "../lib/text";
import { incomingFromDrop, type Incoming } from "../lib/importImages";
import { TemplateThumbnail } from "./ItemShape";

export type InstanceInfo = { variantId: string; items: DesignItem[]; override?: InstanceOverride };
export type InstanceSelection = { recordId: string; itemId: string };

type Props = {
  sheet: Sheet;
  templateWidth: number;
  templateHeight: number;
  records: RecordRow[];
  /** Index into `records` for each slot on this sheet. */
  slotRecord: (slot: number) => number;
  /** The items one record actually renders: its template (chosen by the alternating rules) plus any hand edits. */
  instanceFor: (record: RecordRow, index: number, slot: number) => InstanceInfo;
  pageNumber: number;
  pageCount: number;
  showGrid: boolean;
  /** Preview / print: no flags, outlines or editing. */
  preview: boolean;
  /** Edit mode: pick items inside a slot, double-click to edit, drop pictures onto picture boxes. */
  edit?: boolean;
  zoom?: number;
  /** Printer calibration: shifts every slot (and the crop marks) by this many inches. */
  offset?: { x: number; y: number };
  selected?: InstanceSelection | null;
  editing?: InstanceSelection | null;
  onSelect?: (selection: InstanceSelection | null) => void;
  onStartEdit?: (selection: InstanceSelection) => void;
  onCommitText?: (value: string) => void;
  onCancelEdit?: () => void;
  onDropFiles?: (recordId: string, itemId: string | null, files: Incoming[]) => void;
  onToggleOff?: (recordId: string) => void;
  onResetInstance?: (recordId: string) => void;
};

/** Slots are placed at their true physical positions (margin + column × (size + gap)) in inches. */
export function LayoutStage(p: Props) {
  const { sheet, templateWidth, templateHeight, records, preview } = p;
  const slots = sheet.columns * sheet.rows;
  const ox = p.offset?.x ?? 0, oy = p.offset?.y ?? 0;
  const marks = sheet.cropMarks && preview ? cropMarks(sheet, templateWidth, templateHeight) : [];
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [dropOver, setDropOver] = useState<string | null>(null);
  useEffect(() => { if (preview) setMenuFor(null); }, [preview]);

  return (
    <div className="layout-page" style={{ width: sheet.pageWidth * PX_PER_IN, height: sheet.pageHeight * PX_PER_IN }}>
      {Array.from({ length: slots }, (_, slot) => {
        const col = slot % sheet.columns;
        const row = Math.floor(slot / sheet.columns);
        const index = p.slotRecord(slot);
        const record = records[index];
        const meta: RecordMeta | null = record ? { recordNumber: index + 1, pageNumber: p.pageNumber, recordCount: records.length, pageCount: p.pageCount } : null;
        const info = record ? p.instanceFor(record, index, slot) : null;
        const id = record?.[ID] as string | undefined;
        const edited = !preview && hasEdits(info?.override);
        const reverted = edited && !!info?.override?.off;
        const issues = !preview && info && record && meta ? instanceIssues(info.items, record, meta) : [];
        const overriddenIds = edited && !reverted ? new Set(Object.keys(info!.override!.items)) : undefined;
        const sel = p.selected && p.selected.recordId === id ? p.selected.itemId : null;
        const editingHere = p.editing && p.editing.recordId === id ? info?.items.find((i) => i.id === p.editing!.itemId) : undefined;

        const itemAt = (target: EventTarget | null) => (target as Element | null)?.closest?.("[data-item-id]")?.getAttribute("data-item-id") ?? null;
        const classes = ["layout-slot"];
        if (showOutline(p, preview)) classes.push("outlined");
        if (edited) classes.push(reverted ? "reverted" : "edited");
        if (dropOver === id && id) classes.push("drop-target");

        return (
          <div
            key={slot}
            className={classes.join(" ")}
            data-no-pan={p.edit ? "" : undefined}
            style={{ left: (sheet.marginX + ox + col * (templateWidth + sheet.gapX)) * PX_PER_IN, top: (sheet.marginY + oy + row * (templateHeight + sheet.gapY)) * PX_PER_IN, width: templateWidth * PX_PER_IN, height: templateHeight * PX_PER_IN }}
            onClick={p.edit && id ? (e) => { const itemId = itemAt(e.target); p.onSelect?.(itemId ? { recordId: id, itemId } : null); } : undefined}
            onDoubleClick={p.edit && id ? (e) => { const itemId = itemAt(e.target); if (itemId) p.onStartEdit?.({ recordId: id, itemId }); } : undefined}
            onDragOver={p.edit && id ? (e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDropOver(id); } } : undefined}
            onDragLeave={p.edit ? () => setDropOver(null) : undefined}
            onDrop={p.edit && id ? async (e) => {
              e.preventDefault(); setDropOver(null);
              const target = itemAt(e.target);
              const files = await incomingFromDrop(e.dataTransfer);
              if (files.length) p.onDropFiles?.(id, target, files);
            } : undefined}
          >
            {record && meta && info
              ? <TemplateThumbnail items={info.items} record={record} width={templateWidth} height={templateHeight} meta={meta} interactive={p.edit && !preview} selectedItemId={sel} overriddenIds={overriddenIds} zoom={p.zoom} />
              : <span className="empty-slot">Empty</span>}
            {!preview && <span className="slot-number">#{index + 1}</span>}

            {edited && id && (
              <>
                <button className={reverted ? "slot-badge reverted" : "slot-badge"} data-no-pan
                  title={reverted ? "Hand edits are switched off for this record — click for options" : "This record has hand edits — click for options"}
                  onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === id ? null : id); }}>
                  {reverted ? <Undo2 size={12} /> : <PencilLine size={12} />}
                </button>
                {menuFor === id && (
                  <>
                    <div className="menu-scrim" onClick={(e) => { e.stopPropagation(); setMenuFor(null); }} />
                    <div className="menu slot-menu" role="menu" data-no-pan onClick={(e) => e.stopPropagation()}>
                      <strong>{recordLabel(record!)}</strong>
                      <button role="menuitem" onClick={() => { p.onToggleOff?.(id); setMenuFor(null); }}>{reverted ? <><PencilLine size={14} /> Use my edits again</> : <><Undo2 size={14} /> Show the template version</>}</button>
                      <button role="menuitem" className="danger" onClick={() => { p.onResetInstance?.(id); setMenuFor(null); }}><RotateCcw size={14} /> Discard these edits</button>
                    </div>
                  </>
                )}
              </>
            )}
            {issues.length > 0 && id && (
              <button className="slot-warning" data-no-pan title={issues.map((i) => `${i.kind === "truncated" ? "Cut off" : "Doesn’t fit"}: ${i.item.field ?? i.item.text ?? "text"}`).join("\n")}
                onClick={(e) => { e.stopPropagation(); p.onSelect?.({ recordId: id, itemId: issues[0].item.id }); }}>
                <AlertTriangle size={12} /> {issues.length}
              </button>
            )}

            {editingHere && record && meta && id && <InlineTextEditor item={editingHere} initial={valueFor(editingHere, record, meta)} onCommit={(v) => p.onCommitText?.(v)} onCancel={() => p.onCancelEdit?.()} />}
          </div>
        );
      })}
      {marks.length > 0 && (
        <svg className="crop-marks" width={sheet.pageWidth * PX_PER_IN} height={sheet.pageHeight * PX_PER_IN} viewBox={`0 0 ${sheet.pageWidth} ${sheet.pageHeight}`}>
          {marks.map((m, i) => <line key={i} x1={m[0] + ox} y1={m[1] + oy} x2={m[2] + ox} y2={m[3] + oy} />)}
        </svg>
      )}
    </div>
  );
}

const showOutline = (p: Props, preview: boolean) => p.showGrid && !preview;

/** A text box laid over the item so a name can be typed directly on the page. */
function InlineTextEditor({ item, initial, onCommit, onCancel }: { item: DesignItem; initial: string; onCommit: (value: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const finish = (save: boolean) => { if (done.current) return; done.current = true; if (save) onCommit(ref.current?.value ?? initial); else onCancel(); };
  return (
    <textarea
      ref={ref} className="inline-editor" defaultValue={initial} data-no-pan aria-label="Edit text for this record"
      style={{
        left: item.x * PX_PER_IN, top: item.y * PX_PER_IN, width: item.w * PX_PER_IN, minHeight: item.h * PX_PER_IN,
        fontFamily: fontStack(item.fontFamily), fontSize: fontSizePx(item), fontWeight: item.weight ?? 500, fontStyle: item.italic ? "italic" : "normal",
        textAlign: item.align ?? "left", lineHeight: item.lineHeight ?? 1.2, color: item.color ?? "#34443d",
        transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined,
      }}
      onBlur={() => finish(true)}
      onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); finish(false); } else if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); finish(true); } e.stopPropagation(); }}
    />
  );
}

/**
 * Crop marks sit in the page margins, in line with every slot edge, so they never touch the artwork
 * (labels often have no gap between them). Coordinates are in inches.
 */
function cropMarks(sheet: Sheet, w: number, h: number): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  const offset = 0.04;
  const xs = Array.from({ length: sheet.columns }, (_, c) => { const left = sheet.marginX + c * (w + sheet.gapX); return [left, left + w]; }).flat();
  const ys = Array.from({ length: sheet.rows }, (_, r) => { const top = sheet.marginY + r * (h + sheet.gapY); return [top, top + h]; }).flat();
  const gridLeft = sheet.marginX, gridTop = sheet.marginY;
  const gridRight = gridLeft + sheet.columns * w + (sheet.columns - 1) * sheet.gapX;
  const gridBottom = gridTop + sheet.rows * h + (sheet.rows - 1) * sheet.gapY;
  const room = (space: number) => Math.min(0.15, Math.max(0, space - offset - 0.02));
  const top = room(gridTop), left = room(gridLeft), bottom = room(sheet.pageHeight - gridBottom), right = room(sheet.pageWidth - gridRight);
  for (const x of xs) {
    if (top > 0) out.push([x, gridTop - offset - top, x, gridTop - offset]);
    if (bottom > 0) out.push([x, gridBottom + offset, x, gridBottom + offset + bottom]);
  }
  for (const y of ys) {
    if (left > 0) out.push([gridLeft - offset - left, y, gridLeft - offset, y]);
    if (right > 0) out.push([gridRight + offset, y, gridRight + offset + right, y]);
  }
  return out;
}
