import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Database, LayoutTemplate, Minus, PencilLine, Plus, RotateCcw, RotateCw, Undo2 } from "lucide-react";
import type { DesignItem, InstanceOverride, Placement, RecordMeta, RecordRow, Sheet } from "../types";
import { PX_PER_IN, valueFor } from "../lib/data";
import { ID } from "../lib/records";
import { hasEdits } from "../lib/instances";
import { instanceIssues, recordLabel } from "../lib/audit";
import { fontStack } from "../lib/fonts";
import { fontSizePx } from "../lib/text";
import { incomingFromDrop, type Incoming } from "../lib/importImages";
import { TemplateThumbnail } from "./ItemShape";
import { cropMarkLines, footprint, placementsOf, recordAt, sequence } from "../lib/placements";
import { smartSnap } from "../lib/smartSnap";

export type InstanceInfo = { variantId: string; items: DesignItem[]; override?: InstanceOverride };
export type InstanceSelection = { recordId: string; itemId: string };

type Props = {
  sheet: Sheet;
  templateWidth: number;
  templateHeight: number;
  records: RecordRow[];
  /** The items one record actually renders: its template (chosen by the alternating rules) plus any hand edits. */
  instanceFor: (record: RecordRow, index: number, slot: number, variantId?: string) => InstanceInfo;
  pageNumber: number;
  pageCount: number;
  showGrid: boolean;
  /** Preview / print: no flags, outlines or editing. */
  preview: boolean;
  /** Edit mode: pick items inside a slot, double-click to edit, drop pictures onto picture boxes. */
  edit?: boolean;
  zoom?: number;
  /** Bleed in inches: each card's artwork runs this far past its trim edge, into the gaps. */
  bleed?: number;
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
  /** Arrange mode (page layout, not override): pick a card to move it, or change which record it shows. */
  arrange?: boolean;
  selectedCard?: string | null;
  onSelectCard?: (id: string | null) => void;
  onMoveCard?: (id: string, x: number, y: number) => void;
  onNumberCard?: (id: string, number: number) => void;
  onRotateCard?: (id: string) => void;
  onCardDragEnd?: () => void;
  /** Thin arrows from card to card in the order their records come. */
  showOrder?: boolean;
};

/** Slots are placed at their true physical positions (margin + column × (size + gap)) in inches. */
export function LayoutStage(p: Props) {
  const { sheet, templateWidth, templateHeight, records, preview } = p;
  const slots = sheet.columns * sheet.rows;
  const ox = p.offset?.x ?? 0, oy = p.offset?.y ?? 0;
  const list = placementsOf(sheet, templateWidth, templateHeight);
  const marks = sheet.cropMarks && preview ? cropMarkLines(list, templateWidth, templateHeight, sheet.pageWidth, sheet.pageHeight) : [];
  const page = p.pageNumber - 1;
  const scale = PX_PER_IN * (p.zoom ?? 1);
  /** Drag a card across the sheet. It snaps to the page edges and to the edges and centers of the other cards (hold Ctrl/⌘ to move freely). */
  const startCardDrag = (event: React.PointerEvent, card: Placement) => {
    if (!p.arrange || (event.pointerType === "mouse" && event.button !== 0)) return;
    if ((event.target as HTMLElement).closest("button")) return;
    p.onSelectCard?.(card.id);
    const startX = event.clientX, startY = event.clientY;
    const others = list.filter((o) => o.id !== card.id).map((o) => ({ x: o.x, y: o.y, ...footprint(o, templateWidth, templateHeight) }));
    const mine = footprint(card, templateWidth, templateHeight);
    const targets = [{ x: 0, y: 0, w: sheet.pageWidth, h: sheet.pageHeight }, ...others];
    let moved = false;
    const move = (e: PointerEvent) => {
      const dx = (e.clientX - startX) / scale, dy = (e.clientY - startY) / scale;
      if (!moved && Math.hypot(dx, dy) * scale < (e.pointerType === "mouse" ? 3 : 8)) return;
      moved = true;
      let x = card.x + dx, y = card.y + dy;
      if (!(e.ctrlKey || e.metaKey)) {
        const snap = smartSnap({ x, y, w: mine.w, h: mine.h }, targets, { x: [], y: [] }, 7 / scale);
        x += snap.dx; y += snap.dy;
      }
      p.onMoveCard?.(card.id, Number(x.toFixed(3)), Number(y.toFixed(3)));
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); if (moved) p.onCardDragEnd?.(); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [dropOver, setDropOver] = useState<string | null>(null);
  useEffect(() => { if (preview) setMenuFor(null); }, [preview]);

  return (
    <div className="layout-page" style={{ width: sheet.pageWidth * PX_PER_IN, height: sheet.pageHeight * PX_PER_IN }}>
      {list.map((card, slot) => {
        const index = recordAt(list, card, page);
        const fp = footprint(card, templateWidth, templateHeight);
        const turned = !!card.rotation;
        const record = records[index];
        const meta: RecordMeta | null = record ? { recordNumber: index + 1, pageNumber: p.pageNumber, recordCount: records.length, pageCount: p.pageCount } : null;
        const info = record ? p.instanceFor(record, index, slot, card.variantId) : null;
        const id = record?.[ID] as string | undefined;
        const edited = !preview && hasEdits(info?.override);
        const reverted = edited && !!info?.override?.off;
        const issues = !preview && info && record && meta ? instanceIssues(info.items, record, meta, { w: templateWidth, h: templateHeight }) : [];
        const overriddenIds = edited && !reverted ? new Set(Object.keys(info!.override!.items)) : undefined;
        const sel = p.selected && p.selected.recordId === id ? p.selected.itemId : null;
        const editingHere = p.editing && p.editing.recordId === id ? info?.items.find((i) => i.id === p.editing!.itemId) : undefined;

        const itemAt = (target: EventTarget | null) => (target as Element | null)?.closest?.("[data-item-id]")?.getAttribute("data-item-id") ?? null;
        const classes = ["layout-slot"];
        if (showOutline(p, preview)) classes.push("outlined");
        if (edited) classes.push(reverted ? "reverted" : "edited");
        if (dropOver === id && id) classes.push("drop-target");
        if (p.arrange) classes.push("arrangeable");
        if (p.arrange && p.selectedCard === card.id) classes.push("card-selected");

        return (
          <div
            key={card.id}
            className={classes.join(" ")}
            data-no-pan={p.edit || p.arrange ? "" : undefined}
            style={{ left: (card.x + ox) * PX_PER_IN, top: (card.y + oy) * PX_PER_IN, width: fp.w * PX_PER_IN, height: fp.h * PX_PER_IN }}
            onPointerDown={p.arrange ? (e) => startCardDrag(e, card) : undefined}
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
            {(() => {
              const inner = (
                <>
              {record && meta && info
              ? <TemplateThumbnail items={info.items} record={record} width={templateWidth} height={templateHeight} bleed={p.bleed} meta={meta} interactive={p.edit && !preview} selectedItemId={sel} overriddenIds={overriddenIds} zoom={p.zoom} />
              : <span className="empty-slot">Empty</span>}
              {editingHere && record && meta && id && <InlineTextEditor item={editingHere} initial={valueFor(editingHere, record, meta)} onCommit={(v) => p.onCommitText?.(v)} onCancel={() => p.onCancelEdit?.()} />}
                </>
              );
              return turned
                ? <div className="card-rotor" style={{ left: ((fp.w - templateWidth) / 2) * PX_PER_IN, top: ((fp.h - templateHeight) / 2) * PX_PER_IN, width: templateWidth * PX_PER_IN, height: templateHeight * PX_PER_IN, transform: `rotate(${card.rotation}deg)` }}>{inner}</div>
                : inner;
            })()}
            {p.arrange && p.selectedCard === card.id && !preview && (
              <button type="button" className="card-rotate" data-no-pan aria-label="Turn the card a quarter" title="Turn a quarter (R)" onClick={(e) => { e.stopPropagation(); p.onRotateCard?.(card.id); }}><RotateCw size={13} /></button>
            )}
            {!preview && record && <span className="slot-number" title={`This is record ${index + 1} of your data`}><Database size={10} />{index + 1}</span>}
            {!preview && (
              <span className={p.arrange && p.selectedCard === card.id ? "slot-position editing" : "slot-position"} data-no-pan title={`Record ${card.number} on this sheet. Cards with the same number show the same record.`}>
                {p.arrange && p.selectedCard === card.id && <button type="button" aria-label="Lower the record number" onClick={(e) => { e.stopPropagation(); p.onNumberCard?.(card.id, Math.max(1, card.number - 1)); }}><Minus size={10} /></button>}
                <LayoutTemplate size={11} /><b>{card.number}</b>
                {p.arrange && p.selectedCard === card.id && <button type="button" aria-label="Raise the record number" onClick={(e) => { e.stopPropagation(); p.onNumberCard?.(card.id, card.number + 1); }}><Plus size={10} /></button>}
              </span>
            )}

            {edited && id && (
              <>
                <button className={reverted ? "slot-badge reverted" : "slot-badge"} data-no-pan
                  title={reverted ? "Overrides are switched off for this record — click for options" : "This record has overrides — click for options"}
                  onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === id ? null : id); }}>
                  {reverted ? <Undo2 size={12} /> : <PencilLine size={12} />}
                </button>
                {menuFor === id && (
                  <>
                    <div className="menu-scrim" onClick={(e) => { e.stopPropagation(); setMenuFor(null); }} />
                    <div className="menu slot-menu" role="menu" data-no-pan onClick={(e) => e.stopPropagation()}>
                      <strong>{recordLabel(record!)}</strong>
                      <button role="menuitem" onClick={() => { p.onToggleOff?.(id); setMenuFor(null); }}>{reverted ? <><PencilLine size={14} /> Use my overrides again</> : <><Undo2 size={14} /> Show the template version</>}</button>
                      <button role="menuitem" className="danger" onClick={() => { p.onResetInstance?.(id); setMenuFor(null); }}><RotateCcw size={14} /> Discard these overrides</button>
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

          </div>
        );
      })}
      {p.showOrder && !preview && <OrderArrows list={list} w={templateWidth} h={templateHeight} pageW={sheet.pageWidth} pageH={sheet.pageHeight} ox={ox} oy={oy} />}
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

/** Thin arrows from card to card in the order their records come: solid to a new record, dotted between copies of the same record. */
function OrderArrows({ list, w, h, pageW, pageH, ox, oy }: { list: ReturnType<typeof placementsOf>; w: number; h: number; pageW: number; pageH: number; ox: number; oy: number }) {
  const order = sequence(list);
  return (
    <svg className="order-arrows" width={pageW * PX_PER_IN} height={pageH * PX_PER_IN} viewBox={`0 0 ${pageW} ${pageH}`} aria-hidden>
      <defs><marker id="order-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M1 1 9 5 1 9" fill="none" stroke="#7c5cdb" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></marker></defs>
      {order.slice(0, -1).map((a, i) => {
        const b = order[i + 1];
        const fa = footprint(a, w, h), fb = footprint(b, w, h);
        const x1 = a.x + fa.w / 2 + ox, y1 = a.y + fa.h / 2 + oy, x2 = b.x + fb.w / 2 + ox, y2 = b.y + fb.h / 2 + oy;
        const len = Math.hypot(x2 - x1, y2 - y1) || 1;
        const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
        const trim = Math.min(0.18, len / 3); // keep the line off the badges at the card centers
        return <line key={a.id + b.id} x1={x1 + ux * trim} y1={y1 + uy * trim} x2={x2 - ux * trim} y2={y2 - uy * trim}
          stroke="#7c5cdb" strokeOpacity="0.55" strokeWidth={0.014} strokeDasharray={a.number === b.number ? "0.03 0.03" : undefined} markerEnd="url(#order-head)" />;
      })}
    </svg>
  );
}

