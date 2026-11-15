import { useState } from "react";
import {
  ChevronDown, ChevronsUpDown, Group, Ungroup,
  AlignCenter, AlignLeft, AlignRight, AlertTriangle, BadgeCheck, ChevronRight, Copy, Eye, EyeOff, FileImage,
  Hash, Image as ImageIcon, Italic, Underline, Layers, TextCursorInput, Link2Off, ListFilter, Lock, RotateCcw, RotateCw, Search, SlidersHorizontal, Square, Trash2, Type, Unlock,
  X, Filter,
} from "lucide-react";
import type { DesignItem, LabelPreset, Sheet } from "../types";
import { averyPresets, fieldDisplayName, prettyField } from "../lib/data";
import type { FontLibrary } from "../hooks/useFontLibrary";
import { NumberField, Pair, Section } from "./Fields";
import { FontPicker } from "./FontPicker";
import { EffectsSection, PictureSection, ShapeStyleSection, type ImageTools } from "./ItemStyleSections";
import { VariantsSection } from "./VariantSections";
import { ConditionsSection } from "./ConditionsSection";
import { PrinterCalibrationSection } from "./PrinterCalibrationSection";
import { defaultImageSource } from "../lib/images";
import { StockPicker } from "./StockPicker";
import type { PrinterCalibration } from "../hooks/usePrinterCalibration";

type Props = {
  workspace: "template" | "layout";
  items: DesignItem[];
  selectedItems: DesignItem[];
  onSelect: (ids: string[], additive?: boolean) => void;
  fontLibrary: FontLibrary;
  onRotateBy: (degrees: number) => void;
  imageTools: ImageTools;
  /** Grouping: the selection is exactly one group / could be grouped, plus the actions. */
  groups: {
    wholeGroup: boolean; canGroup: boolean; onGroup: () => void; onUngroup: () => void;
    onRename: (groupId: string, name: string) => void; onUpdateMany: (ids: string[], patch: Partial<DesignItem>) => void; onSelectGroupOf: (id: string) => void;
  };
  /** Alternating templates editor. */
  variants: React.ComponentProps<typeof VariantsSection>;
  fields: string[];
  /** Set while editing one record's copy of the template in page layout. */
  instance?: { recordLabel: string; itemEdited: boolean; off: boolean; onRevertItem: () => void; onToggleOff: () => void; onResetInstance: () => void } | null;
  editedList: { recordId: string; label: string; off: boolean }[];
  onJumpInstance: (recordId: string) => void;
  onResetInstanceById: (recordId: string) => void;
  onAudit: (itemId?: string | null) => void;
  printer: PrinterCalibration;
  onCalibrationSheet: () => void;
  /** Text-fit problems on the sheet being shown. */
  auditCount: number;
  /** For the selected text: whether it fits, across the records being printed. */
  fitNote?: { text: string; bad: boolean } | null;
  onUpdate: (id: string, patch: Partial<DesignItem>, coalesce?: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /** Drag-and-drop in the layer list: put `id` above/below `targetId`. */
  onReorder: (id: string, targetId: string, above: boolean, asGroup: boolean) => void;
  templateWidth: number;
  templateHeight: number;
  onTemplateSize: (width: number, height: number) => void;
  onPreset: (preset: LabelPreset) => void;
  sheet: Sheet;
  onSheet: (patch: Partial<Sheet>) => void;
  pageCount: number;
  overflow: boolean;
  onClose: () => void;
};

const kindIcon = (item: DesignItem, size = 14) =>
  item.type === "text" ? (item.field?.startsWith("__") ? <Hash size={size} /> : <Type size={size} />) : item.type === "image" ? <FileImage size={size} /> : <Square size={size} />;
const layerLabel = (item: DesignItem) => (item.field ? fieldDisplayName(item.field) : item.text || item.assetName || (item.type === "rect" ? "Shape" : "Item"));

export function Inspector(props: Props) {
  const { workspace, items, selectedItems, onSelect, onUpdate, onClose } = props;
  const selected = selectedItems.length === 1 ? selectedItems[0] : null;
  const [tab, setTab] = useState<"properties" | "layers">("properties");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const flatLayers = !!props.instance; // hand-editing one record: groups aren't offered
  // Drag a layer by its grip: the row under the pointer shows a line where it will land.
  const [drag, setDrag] = useState<{ id: string; over: string; above: boolean } | null>(null);
  const dropClass = (rowId: string) => (drag && drag.over === rowId && drag.id !== rowId ? (drag.above ? " drop-above" : " drop-below") : "");
  const startDrag = (id: string, asGroup: boolean) => (event: React.PointerEvent) => {
    event.preventDefault(); event.stopPropagation();
    const target = (e: PointerEvent) => {
      const row = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-layer-id]");
      if (!row) return null;
      const rect = row.getBoundingClientRect();
      return { over: row.dataset.layerId!, above: e.clientY < rect.top + rect.height / 2 };
    };
    document.body.classList.add("scrubbing");
    let last: { over: string; above: boolean } | null = null;
    const move = (e: PointerEvent) => { last = target(e); setDrag(last ? { id, ...last } : null); };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      document.body.classList.remove("scrubbing");
      setDrag(null);
      // The list is drawn top (front) to bottom (back), so "above" in the list means later in the stacking order.
      if (last && last.over !== id) props.onReorder(id, last.over, last.above, asGroup);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  };
  const title = tab === "layers" ? "Layers" : selectedItems.length > 1 ? (props.groups.wholeGroup ? `Group · ${selectedItems[0].groupName ?? ""}` : `${selectedItems.length} items`) : selected ? "Item properties" : workspace === "template" ? "Template setup" : "Page setup";

  return (
    <aside className="panel right-panel" aria-label="Properties and layers">
      <button type="button" className="panel-heading clickable" title="Close this drawer" aria-label={`Close ${title}`} onClick={onClose}>
        <h2><SlidersHorizontal size={15} className="heading-icon" /> {title}</h2>
        <ChevronRight size={17} className="heading-chevron" />
      </button>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "properties"} className={tab === "properties" ? "active" : ""} onClick={() => setTab("properties")}><SlidersHorizontal size={14} /> Properties</button>
        <button role="tab" aria-selected={tab === "layers"} className={tab === "layers" ? "active" : ""} onClick={() => setTab("layers")}><Layers size={14} /> Layers <span className="count-pill">{items.length}</span></button>
      </div>
      <div className="panel-body" data-scroll>
        {tab === "layers" ? (
          <div className="layer-list">
            {(() => {
              const pick = (ids: string[], e: React.MouseEvent) => { if (e.shiftKey || e.metaKey || e.ctrlKey) { const have = selectedItems.map((x) => x.id); onSelect(ids.every((id) => have.includes(id)) ? have.filter((id) => !ids.includes(id)) : [...new Set([...have, ...ids])]); } else { onSelect(ids); setTab("properties"); } };
              const itemRow = (item: DesignItem, indented: boolean) => (
                <div key={item.id} data-layer-id={item.id} className={`${selectedItems.some((x) => x.id === item.id) ? "layer-row selected" : "layer-row"}${indented ? " nested" : ""}${dropClass(item.id)}`} onClick={(e) => pick([item.id], e)}>
                  <span className="layer-kind">{kindIcon(item, 13)}</span>
                  <span className="layer-label">{layerLabel(item)}{item.reference ? <em className="ref-tag">reference</em> : null}{item.rules?.length ? <Filter size={11} className="layer-rules" aria-label="Has conditional rules" /> : null}</span>
                  <button className="mini-button" title={item.visible === false ? "Show" : "Hide"} onClick={(e) => { e.stopPropagation(); onUpdate(item.id, { visible: item.visible === false }); }}>{item.visible === false ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                  <button className="mini-button" title={item.locked ? "Unlock" : "Lock"} onClick={(e) => { e.stopPropagation(); onUpdate(item.id, { locked: !item.locked }); }}>{item.locked ? <Lock size={13} /> : <Unlock size={13} />}</button>
                  <span className="layer-grip" title="Drag to change the stacking order" aria-label="Drag to reorder" role="button" onClick={(e) => e.stopPropagation()} onPointerDown={startDrag(item.id, false)}><ChevronsUpDown size={14} /></span>
                </div>
              );
              const rows: React.ReactNode[] = [];
              const seen = new Set<string>();
              for (const item of [...items].reverse()) {
                if (!item.groupId || flatLayers) { rows.push(itemRow(item, false)); continue; }
                if (seen.has(item.groupId)) continue;
                seen.add(item.groupId);
                const members = [...items].reverse().filter((m) => m.groupId === item.groupId);
                const ids = members.map((m) => m.id);
                const open = !collapsed.has(item.groupId);
                const allHidden = members.every((m) => m.visible === false), allLocked = members.every((m) => m.locked);
                rows.push(
                  <div key={`g-${item.groupId}`} data-layer-id={ids[0]} className={`${ids.every((id) => selectedItems.some((x) => x.id === id)) ? "layer-row group selected" : "layer-row group"}${dropClass(ids[0])}`} onClick={(e) => pick(ids, e)}>
                    <button className="mini-button chev" aria-label={open ? "Collapse group" : "Expand group"} onClick={(e) => { e.stopPropagation(); setCollapsed((c) => { const n = new Set(c); if (n.has(item.groupId!)) n.delete(item.groupId!); else n.add(item.groupId!); return n; }); }}><ChevronDown size={13} style={{ transform: open ? undefined : "rotate(-90deg)" }} /></button>
                    <span className="layer-kind"><Group size={13} /></span>
                    <span className="layer-label">{item.groupName ?? "Group"} <em>{members.length}</em></span>
                    <button className="mini-button" title={allHidden ? "Show group" : "Hide group"} onClick={(e) => { e.stopPropagation(); props.groups.onUpdateMany(ids, { visible: allHidden }); }}>{allHidden ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                    <button className="mini-button" title={allLocked ? "Unlock group" : "Lock group"} onClick={(e) => { e.stopPropagation(); props.groups.onUpdateMany(ids, { locked: !allLocked }); }}>{allLocked ? <Lock size={13} /> : <Unlock size={13} />}</button>
                    <span className="layer-grip" title="Drag to change the stacking order" aria-label="Drag group to reorder" role="button" onClick={(e) => e.stopPropagation()} onPointerDown={startDrag(ids[0], true)}><ChevronsUpDown size={14} /></span>
                  </div>,
                );
                if (open) members.forEach((m) => rows.push(itemRow(m, true)));
              }
              return rows;
            })()}
            {!items.length && <p className="empty-note">Nothing on this template yet.</p>}
          </div>
        ) : selectedItems.length > 1 ? (
          <MultiProperties group={props.groups.wholeGroup ? { id: selectedItems[0].groupId!, name: selectedItems[0].groupName ?? "" } : null} groups={props.groups} count={selectedItems.length} onRotateBy={props.onRotateBy} onDuplicate={props.onDuplicate} onDelete={props.onDelete} />
        ) : selected ? (
          <>
            {selected.groupId && !props.instance && (
              <div className="banner group-note">
                <span>Part of <strong>{selected.groupName ?? "a group"}</strong>.</span>
                <div className="banner-actions">
                  <button className="button" onClick={() => props.groups.onSelectGroupOf(selected.id)}>Select the whole group</button>
                  <button className="button" onClick={props.groups.onUngroup}>Ungroup</button>
                </div>
              </div>
            )}
            {props.instance && (
              <div className="banner">
                <span><strong>Overriding {props.instance.recordLabel}.</strong> Changes here affect only this record; everyone else keeps the template.</span>
                <div className="banner-actions">
                  <button className="button" disabled={!props.instance.itemEdited} onClick={props.instance.onRevertItem}>Revert this item</button>
                  <button className="button" onClick={props.instance.onToggleOff}>{props.instance.off ? "Use my overrides again" : "Show template version"}</button>
                  <button className="button" onClick={props.instance.onResetInstance}>Discard all overrides</button>
                </div>
              </div>
            )}
          <ItemProperties item={selected} onUpdate={onUpdate} onDuplicate={props.onDuplicate} onDelete={props.onDelete} fontLibrary={props.fontLibrary} imageTools={props.imageTools} fitNote={props.fitNote} instanceMode={!!props.instance} onFitReview={() => props.onAudit(selected!.id)} />
          </>
        ) : workspace === "template" ? (
          <TemplateSetup {...props} />
        ) : (
          <PageSetup {...props} />
        )}
      </div>
    </aside>
  );
}

/** Normalises an angle to (-180, 180]. */
const norm = (deg: number) => { const r = ((deg + 180) % 360 + 360) % 360 - 180; return r === -180 ? 180 : r; };

function MultiProperties({ count, onRotateBy, onDuplicate, onDelete, group, groups }: { group: { id: string; name: string } | null; groups: Props["groups"]; count: number; onRotateBy: (deg: number) => void; onDuplicate: () => void; onDelete: () => void }) {
  return (
    <>
      <div className="property-heading"><div className="property-icon">{group ? <Group size={17} /> : <Layers size={17} />}</div><div><strong>{group ? "Group" : `${count} items selected`}</strong><span>{group ? `${count} items move, turn and resize together` : "Drag to move them together"}</span></div></div>
      {group ? (
        <Section title="GROUP">
          <input className="property-input" value={group.name} aria-label="Group name" onChange={(e) => groups.onRename(group.id, e.target.value)} />
          <button className="button wide" onClick={groups.onUngroup}><Ungroup size={14} /> Ungroup</button>
          <p className="hint">Click a group to select all of it. <strong>Alt/Option-click</strong> or <strong>double-click</strong> an item to pick just that one. Drag the handles to resize the whole group, text included.</p>
        </Section>
      ) : groups.canGroup && (
        <Section title="GROUP">
          <button className="button wide first" onClick={groups.onGroup}><Group size={14} /> Group these {count} items</button>
          <p className="hint">A group moves, turns, scales, aligns and copies as one object. Shortcut: Ctrl/⌘+G.</p>
        </Section>
      )}
      <Section title="ROTATE AS GROUP">
        <div className="icon-row">
          <button title="Rotate group 90° counter-clockwise" aria-label="Rotate group 90° counter-clockwise" onClick={() => onRotateBy(-90)}><RotateCcw size={16} /></button>
          <button title="Rotate group 90° clockwise" aria-label="Rotate group 90° clockwise" onClick={() => onRotateBy(90)}><RotateCw size={16} /></button>
        </div>
        <p className="hint">Drag the round handle above the selection to turn it freely (Shift for 15° steps). Items turn together around the group’s centre.</p>
      </Section>
      <p className="hint">Shift-click items or layers to adjust the selection. Alignment is on the bar at the bottom of the canvas.</p>
      <div className="property-actions"><button onClick={onDuplicate}><Copy size={14} /> Duplicate</button><button className="danger" onClick={onDelete}><Trash2 size={14} /> Delete</button></div>
    </>
  );
}

function ItemProperties({ item, onUpdate, onDuplicate, onDelete, fontLibrary, imageTools, fitNote, instanceMode, onFitReview }: { instanceMode?: boolean; onFitReview?: () => void; fitNote?: { text: string; bad: boolean } | null; imageTools: ImageTools; item: DesignItem; onUpdate: Props["onUpdate"]; onDuplicate: () => void; onDelete: () => void; fontLibrary: FontLibrary }) {
  const patch = (p: Partial<DesignItem>, key?: string) => onUpdate(item.id, p, key ?? `prop:${item.id}:${Object.keys(p).join()}`);
  return (
    <>
      <div className="property-heading">
        <div className="property-icon">{kindIcon(item, 17)}</div>
        <div><strong>{item.type === "text" ? "Text object" : item.type === "image" ? "Image object" : "Shape object"}</strong><span>{item.field ? `Linked to ${fieldDisplayName(item.field)}` : item.type === "image" ? (item.imageSource ? "Data-driven picture" : "One picture") : "Static content"}</span></div>
      </div>

      <div className="convert-row">
        {item.type !== "rect" && <button className="button" onClick={() => patch({ type: "rect", text: undefined, field: undefined, imageSource: undefined, assetId: undefined }, `kind:${item.id}`)}><Square size={14} /> Convert to shape</button>}
        {item.type !== "text" && <button className="button" onClick={() => patch({ type: "text", text: item.text ?? "Text", fontSize: item.fontSize ?? 11, color: item.color ?? "#34443d", weight: item.weight ?? 500, wrap: true, padding: item.padding ?? 0.08, imageSource: undefined, assetId: undefined }, `kind:${item.id}`)}><TextCursorInput size={14} /> Convert to text box</button>}
        {item.type !== "image" && <button className="button" onClick={() => patch({ type: "image", imageSource: defaultImageSource(imageTools.columns), text: undefined, field: undefined }, `kind:${item.id}`)}><ImageIcon size={14} /> Convert to photo box</button>}
      </div>

      {item.type === "text" && (
        <>
          <Section title="CONTENT">
            {item.field ? (
              <div className="binding-chip">
                {item.field.startsWith("__") ? <Hash size={13} /> : <Type size={13} />}<span>{fieldDisplayName(item.field)}</span>
                <button onClick={() => patch({ field: undefined, text: fieldDisplayName(item.field!) })} title="Unlink and keep as static text"><Link2Off size={13} /> Unlink</button>
              </div>
            ) : (
              <textarea className="property-input textarea" rows={3} value={item.text ?? ""} onChange={(e) => patch({ text: e.target.value })} placeholder="Enter text…" />
            )}
            {!item.field && <p className="hint">Press Enter for a new line. Pick a field in the data drawer to link this text, or merge fields into your own wording: <code>{"{city}, {state} {zip}"}</code> or <code>{"${price}"}</code>.</p>}
            <label className="check-row"><input type="checkbox" checked={item.wrap !== false} onChange={(e) => patch({ wrap: e.target.checked })} /> Wrap text to the box width</label>
          </Section>
          <Section title="TYPOGRAPHY">
            <FontPicker value={item.fontFamily} library={fontLibrary} onPick={(family) => patch({ fontFamily: family })} />
            <div className="two-col spaced">
              <Pair label="Font size"><NumberField value={item.fontSize ?? 12} min={4} max={200} step={1} unit="pt" onChange={(n) => patch({ fontSize: n })} /></Pair>
              <Pair label="Text color"><span className="color-chip"><input type="color" aria-label="Text color" value={item.color ?? "#34443d"} onChange={(e) => patch({ color: e.target.value })} /></span></Pair>
            </div>
            <div className="format-row">
              <Pair label="Weight">
                <select className="select" aria-label="Weight (bold)" value={item.weight ?? 500} onChange={(e) => patch({ weight: Number(e.target.value) })}>
                  <option value="400">Regular</option><option value="500">Medium</option><option value="600">Semibold</option><option value="700">Bold</option><option value="800">Extra bold</option>
                </select>
              </Pair>
              <div className="style-buttons" role="group" aria-label="Text style">
                <button aria-label="Italic" title="Italic" aria-pressed={!!item.italic} onClick={() => patch({ italic: !item.italic })}><Italic size={15} /></button>
                <button aria-label="Underline" title="Underline" aria-pressed={!!item.underline} onClick={() => patch({ underline: !item.underline })}><Underline size={15} /></button>
              </div>
            </div>
            <div className="format-row">
              <Pair label="Alignment">
                <div className="align-buttons" role="group" aria-label="Text alignment">
                  {([["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]] as const).map(([value, Icon]) => (
                    <button key={value} aria-label={`Align ${value}`} aria-pressed={(item.align ?? "left") === value} className={(item.align ?? "left") === value ? "active" : ""} onClick={() => patch({ align: value })}><Icon size={15} /></button>
                  ))}
                </div>
              </Pair>
              <Pair label="Line height"><NumberField value={item.lineHeight ?? 1.2} min={0.6} max={4} step={0.05} places={2} onChange={(n) => patch({ lineHeight: n })} /></Pair>
            </div>
            <div className="two-col spaced">
              <Pair label="Autoscale">
                <select className="select" value={item.autoFit ?? "off"} onChange={(e) => patch({ autoFit: e.target.value as DesignItem["autoFit"] })}>
                  <option value="off">Fixed size</option>
                  <option value="shrink">Shrink to box</option>
                  <option value="width">One line</option>
                  <option value="fit">Fill the box</option>
                </select>
              </Pair>
              <Pair label="Overflow">
                <select className="select" value={item.overflow ?? "spill"} onChange={(e) => patch({ overflow: e.target.value as DesignItem["overflow"] })}>
                  <option value="spill">Spill over</option>
                  <option value="clip">Clip</option>
                  <option value="cut">Truncate</option>
                  <option value="truncate">Truncate…</option>
                </select>
              </Pair>
            </div>
            <p className="hint">{(item.autoFit ?? "off") === "off" ? "Text stays at the size above." : item.autoFit === "shrink" ? "Text shrinks below the size above until it fits the box." : item.autoFit === "width" ? "Stays on one line and shrinks until it fits the width. Good for names." : "Text is sized to fill the box. Resize the box to change it."} If it still doesn’t fit: {({ spill: "it spills past the box", clip: "it is clipped at the box edge", cut: "whole words are dropped", truncate: "it is cut off with “…”" } as const)[item.overflow ?? "spill"]}.</p>
            {item.autoFit && item.autoFit !== "off" && (
              <div className="two-col spaced"><Pair label="Never smaller than"><NumberField value={item.minFontSize ?? 4} min={2} max={200} step={0.5} places={1} unit="pt" onChange={(n) => patch({ minFontSize: n })} /></Pair></div>
            )}
            {fitNote && <p className={`hint ${fitNote.bad ? "warn" : ""}`}>{fitNote.text}{fitNote.bad && !instanceMode && <> <button className="link-button" onClick={onFitReview}>Review…</button></>}</p>}
          </Section>
        </>
      )}

      {item.type === "image" && <PictureSection item={item} patch={patch} tools={imageTools} />}
      <ShapeStyleSection item={item} patch={patch} />
      <EffectsSection item={item} patch={patch} />
      {!instanceMode && <ConditionsSection item={item} patch={patch} fields={imageTools.columns} records={imageTools.records} record={imageTools.record} />}

      <Section title="POSITION & SIZE" unit="INCHES">
        <div className="two-col">
          <Pair label="X"><NumberField value={item.x} onChange={(n) => patch({ x: n })} /></Pair>
          <Pair label="Y"><NumberField value={item.y} onChange={(n) => patch({ y: n })} /></Pair>
          <Pair label="Width"><NumberField value={item.w} min={0.01} onChange={(n) => patch({ w: n })} /></Pair>
          <Pair label="Height"><NumberField value={item.h} min={0.01} onChange={(n) => patch({ h: n })} /></Pair>
        </div>
        <div className="rotation-row">
          <Pair label="Rotation"><NumberField value={item.rotation ?? 0} min={-360} max={360} step={1} places={1} unit="°" onChange={(n) => patch({ rotation: n })} /></Pair>
          <button title="Rotate 90° counter-clockwise" aria-label="Rotate 90° counter-clockwise" onClick={() => patch({ rotation: norm((item.rotation ?? 0) - 90) }, `rot:${item.id}`)}><RotateCcw size={16} /></button>
          <button title="Rotate 90° clockwise" aria-label="Rotate 90° clockwise" onClick={() => patch({ rotation: norm((item.rotation ?? 0) + 90) }, `rot:${item.id}`)}><RotateCw size={16} /></button>
        </div>
      </Section>

      {!instanceMode && <div className="property-actions">
        <button onClick={onDuplicate}><Copy size={14} /> Duplicate</button>
        <button onClick={() => onUpdate(item.id, { locked: !item.locked })}>{item.locked ? <Unlock size={14} /> : <Lock size={14} />} {item.locked ? "Unlock" : "Lock"}</button>
        <button className="danger" onClick={onDelete}><Trash2 size={14} /> Delete</button>
      </div>}
    </>
  );
}

function TemplateSetup({ templateWidth, templateHeight, onTemplateSize, onPreset, variants, sheet }: Props) {
  return (
    <>
      <VariantsSection {...variants} />
      <Section title="TEMPLATE SIZE" unit="INCHES">
        <div className="two-col">
          <Pair label="Width"><NumberField value={templateWidth} min={0.1} unit="in" onChange={(n) => onTemplateSize(n, templateHeight)} /></Pair>
          <Pair label="Height"><NumberField value={templateHeight} min={0.1} unit="in" onChange={(n) => onTemplateSize(templateWidth, n)} /></Pair>
        </div>
      </Section>
      <StockPicker templateWidth={templateWidth} templateHeight={templateHeight} sheet={sheet} onPreset={onPreset} />
    </>
  );
}

function PageSetup({ templateWidth, templateHeight, onPreset, sheet, onSheet, pageCount, overflow, fields, onAudit, auditCount, editedList, onJumpInstance, onResetInstanceById, printer, onCalibrationSheet }: Props) {
  const size = sheet.pageWidth === 8.5 && sheet.pageHeight === 11 ? "letter" : sheet.pageWidth === 8.27 && sheet.pageHeight === 11.69 ? "a4" : "custom";
  return (
    <>
      <Section title="PAGE SIZE">
        <select className="select" value={size} onChange={(e) => {
          if (e.target.value === "letter") onSheet({ pageWidth: 8.5, pageHeight: 11 });
          else if (e.target.value === "a4") onSheet({ pageWidth: 8.27, pageHeight: 11.69 });
        }}>
          <option value="letter">US Letter · 8.5 × 11 in</option><option value="a4">A4 · 8.27 × 11.69 in</option><option value="custom">Custom</option>
        </select>
        <div className="two-col spaced">
          <Pair label="Width"><NumberField value={sheet.pageWidth} min={1} unit="in" onChange={(n) => onSheet({ pageWidth: n })} /></Pair>
          <Pair label="Height"><NumberField value={sheet.pageHeight} min={1} unit="in" onChange={(n) => onSheet({ pageHeight: n })} /></Pair>
        </div>
      </Section>
      <StockPicker templateWidth={templateWidth} templateHeight={templateHeight} sheet={sheet} onPreset={onPreset} />
      <Section title="ITEMS PER PAGE">
        <div className="two-col">
          <Pair label="Columns"><NumberField value={sheet.columns} min={1} max={20} step={1} places={0} onChange={(n) => onSheet({ columns: Math.round(n) })} /></Pair>
          <Pair label="Rows"><NumberField value={sheet.rows} min={1} max={30} step={1} places={0} onChange={(n) => onSheet({ rows: Math.round(n) })} /></Pair>
        </div>
      </Section>
      <Section title="PAGE MARGINS" unit="INCHES">
        <div className="two-col">
          <Pair label="Left"><NumberField value={sheet.marginX} min={0} unit="in" onChange={(n) => onSheet({ marginX: n })} /></Pair>
          <Pair label="Top"><NumberField value={sheet.marginY} min={0} unit="in" onChange={(n) => onSheet({ marginY: n })} /></Pair>
        </div>
      </Section>
      <Section title="ITEM SPACING" unit="INCHES">
        <div className="two-col">
          <Pair label="Horizontal"><NumberField value={sheet.gapX} min={0} unit="in" onChange={(n) => onSheet({ gapX: n })} /></Pair>
          <Pair label="Vertical"><NumberField value={sheet.gapY} min={0} unit="in" onChange={(n) => onSheet({ gapY: n })} /></Pair>
        </div>
      </Section>
      <Section title="RECORD ORDER">
        <Pair label="Sort the sheets by">
          <select className="select" value={sheet.sortField ?? ""} onChange={(e) => onSheet({ sortField: e.target.value || undefined })}>
            <option value="">The order in the data table</option>
            {fields.map((f) => <option key={f} value={f}>{prettyField(f)}</option>)}
          </select>
        </Pair>
        {sheet.sortField && (
          <div className="segmented spaced-block">
            <button className={(sheet.sortDir ?? 1) === 1 ? "active" : ""} onClick={() => onSheet({ sortDir: 1 })}>A → Z</button>
            <button className={sheet.sortDir === -1 ? "active" : ""} onClick={() => onSheet({ sortDir: -1 })}>Z → A</button>
          </div>
        )}
        <p className="hint">Only changes the printed and previewed order. Numbers sort as numbers.</p>
      </Section>
      <Section title="TEXT FIT">
        <button className="button wide first" onClick={() => onAudit(null)}><AlertTriangle size={14} /> Check text fit across all records</button>
        <p className="hint">{auditCount ? `${auditCount} text${auditCount === 1 ? "" : "s"} on this sheet ${auditCount === 1 ? "doesn’t" : "don’t"} fit — look for the orange badges.` : "Nothing on this sheet is too long for its box."}</p>
      </Section>
      <Section title="OVERRIDDEN RECORDS" unit={editedList.length ? String(editedList.length) : undefined}>
        {editedList.length === 0 ? <p className="hint first">Turn on <strong>Override</strong> in the toolbar, then click or double-click anything on a sheet to change just that record — a name, a photo, a colour.</p> : (
          <div className="edited-list">
            {editedList.slice(0, 40).map((e) => (
              <div key={e.recordId} className="edited-row">
                <button className="edited-jump" onClick={() => onJumpInstance(e.recordId)} title="Show on the sheet">{e.label}{e.off && <em> · switched off</em>}</button>
                <button className="mini-button" aria-label={`Discard edits for ${e.label}`} title="Discard these edits" onClick={() => onResetInstanceById(e.recordId)}><X size={13} /></button>
              </div>
            ))}
          </div>
        )}
      </Section>
      <PrinterCalibrationSection printer={printer} onTestSheet={onCalibrationSheet} />
      <Section title="PRINT OPTIONS">
        <label className="check-row"><input type="checkbox" checked={sheet.cropMarks} onChange={(e) => onSheet({ cropMarks: e.target.checked })} /> Crop marks in the page margins</label>
        <p className="hint">Shown in print preview and on printed sheets. They need roughly ¼″ of margin to appear.</p>
      </Section>
      <Section title="DATA ASSIGNMENT">
        <div className="mode-options">
          <button className={sheet.repeatMode === "same" ? "mode-option active" : "mode-option"} onClick={() => onSheet({ repeatMode: "same" })}><Copy size={15} /><span><strong>Repeat same record</strong><small>Fill the sheet with one record</small></span></button>
          <button className={sheet.repeatMode === "next" ? "mode-option active" : "mode-option"} onClick={() => onSheet({ repeatMode: "next" })}><ListFilter size={15} /><span><strong>Next record each time</strong><small>Advance through your data</small></span></button>
        </div>
      </Section>
      {overflow && <p className="warning"><AlertTriangle size={14} /> This grid doesn’t fit on the page. Reduce the margins, spacing, or the number of rows and columns.</p>}
      <div className="output-summary"><div><span>Items per sheet</span><strong>{sheet.columns * sheet.rows}</strong></div><div><span>Sheets to print</span><strong>{pageCount}</strong></div></div>
    </>
  );
}
