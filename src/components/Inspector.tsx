import { useState } from "react";
import {
  AlignCenter, AlignLeft, AlignRight, AlertTriangle, ArrowDown, ArrowUp, BadgeCheck, ChevronRight, Copy, Eye, EyeOff, FileImage,
  Hash, Italic, Layers, Link2Off, ListFilter, Lock, RotateCcw, RotateCw, Search, SlidersHorizontal, Square, Trash2, Type, Unlock,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter, X,
} from "lucide-react";
import type { DesignItem, LabelPreset, Sheet } from "../types";
import { averyPresets, fieldDisplayName, prettyField } from "../lib/data";
import type { AlignMode } from "../lib/align";
import type { FontLibrary } from "../hooks/useFontLibrary";
import { NumberField, Pair, Section } from "./Fields";
import { FontPicker } from "./FontPicker";
import { EffectsSection, PictureSection, ShapeStyleSection, type ImageTools } from "./ItemStyleSections";
import { VariantsSection } from "./VariantSections";
import { PrinterCalibrationSection } from "./PrinterCalibrationSection";
import type { PrinterCalibration } from "../hooks/usePrinterCalibration";

type Props = {
  workspace: "template" | "layout";
  items: DesignItem[];
  selectedItems: DesignItem[];
  onSelect: (ids: string[], additive?: boolean) => void;
  fontLibrary: FontLibrary;
  onAlign: (mode: AlignMode) => void;
  onDistribute: (axis: "x" | "y") => void;
  onRotateBy: (degrees: number) => void;
  imageTools: ImageTools;
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
  onMoveLayer: (id: string, direction: -1 | 1) => void;
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
  const title = tab === "layers" ? "Layers" : selectedItems.length > 1 ? `${selectedItems.length} items` : selected ? "Item properties" : workspace === "template" ? "Template setup" : "Page setup";

  return (
    <aside className="panel right-panel" aria-label="Properties and layers">
      <div className="panel-heading">
        <h2>{title}</h2>
        <button className="icon-button" title="Collapse inspector" aria-label="Collapse inspector" onClick={onClose}><ChevronRight size={17} /></button>
      </div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "properties"} className={tab === "properties" ? "active" : ""} onClick={() => setTab("properties")}><SlidersHorizontal size={14} /> Properties</button>
        <button role="tab" aria-selected={tab === "layers"} className={tab === "layers" ? "active" : ""} onClick={() => setTab("layers")}><Layers size={14} /> Layers <span className="count-pill">{items.length}</span></button>
      </div>
      <div className="panel-body" data-scroll>
        {tab === "layers" ? (
          <div className="layer-list">
            {[...items].reverse().map((item) => (
              <div key={item.id} className={selectedItems.some((s) => s.id === item.id) ? "layer-row selected" : "layer-row"} onClick={(e) => { if (e.shiftKey || e.metaKey || e.ctrlKey) onSelect(selectedItems.some((s) => s.id === item.id) ? selectedItems.filter((s) => s.id !== item.id).map((s) => s.id) : [...selectedItems.map((s) => s.id), item.id]); else { onSelect([item.id]); setTab("properties"); } }}>
                <span className="layer-kind">{kindIcon(item, 13)}</span>
                <span className="layer-label">{layerLabel(item)}</span>
                <button className="mini-button" title={item.visible === false ? "Show" : "Hide"} onClick={(e) => { e.stopPropagation(); onUpdate(item.id, { visible: item.visible === false }); }}>{item.visible === false ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                <button className="mini-button" title={item.locked ? "Unlock" : "Lock"} onClick={(e) => { e.stopPropagation(); onUpdate(item.id, { locked: !item.locked }); }}>{item.locked ? <Lock size={13} /> : <Unlock size={13} />}</button>
                <button className="mini-button" title="Bring forward" onClick={(e) => { e.stopPropagation(); props.onMoveLayer(item.id, 1); }}><ArrowUp size={13} /></button>
                <button className="mini-button" title="Send backward" onClick={(e) => { e.stopPropagation(); props.onMoveLayer(item.id, -1); }}><ArrowDown size={13} /></button>
              </div>
            ))}
            {!items.length && <p className="empty-note">Nothing on this template yet.</p>}
          </div>
        ) : selectedItems.length > 1 ? (
          <MultiProperties count={selectedItems.length} onRotateBy={props.onRotateBy} onAlign={props.onAlign} onDistribute={props.onDistribute} onDuplicate={props.onDuplicate} onDelete={props.onDelete} />
        ) : selected ? (
          <>
            {props.instance && (
              <div className="banner">
                <span><strong>Editing {props.instance.recordLabel}’s copy.</strong> Changes here affect only this record; everyone else keeps the template.</span>
                <div className="banner-actions">
                  <button className="button" disabled={!props.instance.itemEdited} onClick={props.instance.onRevertItem}>Revert this item</button>
                  <button className="button" onClick={props.instance.onToggleOff}>{props.instance.off ? "Use my edits again" : "Show template version"}</button>
                  <button className="button" onClick={props.instance.onResetInstance}>Discard all edits</button>
                </div>
              </div>
            )}
          <ItemProperties item={selected} onUpdate={onUpdate} onDuplicate={props.onDuplicate} onDelete={props.onDelete} fontLibrary={props.fontLibrary} onAlign={props.onAlign} imageTools={props.imageTools} fitNote={props.fitNote} instanceMode={!!props.instance} onFitReview={() => props.onAudit(selected!.id)} />
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

const ALIGN_BUTTONS: [AlignMode, string, typeof AlignStartVertical][] = [
  ["left", "Align left", AlignStartVertical], ["center", "Align centre horizontally", AlignCenterVertical], ["right", "Align right", AlignEndVertical],
  ["top", "Align top", AlignStartHorizontal], ["middle", "Align centre vertically", AlignCenterHorizontal], ["bottom", "Align bottom", AlignEndHorizontal],
];

function AlignRow({ onAlign, onDistribute, label }: { onAlign: (mode: AlignMode) => void; onDistribute?: (axis: "x" | "y") => void; label: string }) {
  return (
    <Section title="ALIGN" unit={label}>
      <div className="icon-row">
        {ALIGN_BUTTONS.map(([mode, title, Icon]) => <button key={mode} title={title} aria-label={title} onClick={() => onAlign(mode)}><Icon size={16} /></button>)}
        {onDistribute && <>
          <button title="Distribute horizontally" aria-label="Distribute horizontally" onClick={() => onDistribute("x")}><AlignHorizontalDistributeCenter size={16} /></button>
          <button title="Distribute vertically" aria-label="Distribute vertically" onClick={() => onDistribute("y")}><AlignVerticalDistributeCenter size={16} /></button>
        </>}
      </div>
    </Section>
  );
}

function MultiProperties({ count, onAlign, onDistribute, onRotateBy, onDuplicate, onDelete }: { count: number; onRotateBy: (deg: number) => void; onAlign: (m: AlignMode) => void; onDistribute: (a: "x" | "y") => void; onDuplicate: () => void; onDelete: () => void }) {
  return (
    <>
      <div className="property-heading"><div className="property-icon"><Layers size={17} /></div><div><strong>{count} items selected</strong><span>Drag to move them together</span></div></div>
      <Section title="ROTATE AS GROUP">
        <div className="icon-row">
          <button title="Rotate group 90° counter-clockwise" aria-label="Rotate group 90° counter-clockwise" onClick={() => onRotateBy(-90)}><RotateCcw size={16} /></button>
          <button title="Rotate group 90° clockwise" aria-label="Rotate group 90° clockwise" onClick={() => onRotateBy(90)}><RotateCw size={16} /></button>
        </div>
        <p className="hint">Drag the round handle above the selection to turn it freely (Shift for 15° steps). Items turn together around the group’s centre.</p>
      </Section>
      <AlignRow onAlign={onAlign} onDistribute={count >= 3 ? onDistribute : undefined} label="TO SELECTION" />
      <p className="hint">Distribute needs three or more items. Shift-click items or layers to adjust the selection.</p>
      <div className="property-actions"><button onClick={onDuplicate}><Copy size={14} /> Duplicate</button><button className="danger" onClick={onDelete}><Trash2 size={14} /> Delete</button></div>
    </>
  );
}

function ItemProperties({ item, onUpdate, onDuplicate, onDelete, fontLibrary, onAlign, imageTools, fitNote, instanceMode, onFitReview }: { instanceMode?: boolean; onFitReview?: () => void; fitNote?: { text: string; bad: boolean } | null; imageTools: ImageTools; item: DesignItem; onUpdate: Props["onUpdate"]; onDuplicate: () => void; onDelete: () => void; fontLibrary: FontLibrary; onAlign: (m: AlignMode) => void }) {
  const patch = (p: Partial<DesignItem>, key?: string) => onUpdate(item.id, p, key ?? `prop:${item.id}:${Object.keys(p).join()}`);
  return (
    <>
      <div className="property-heading">
        <div className="property-icon">{kindIcon(item, 17)}</div>
        <div><strong>{item.type === "text" ? "Text object" : item.type === "image" ? "Image object" : "Shape object"}</strong><span>{item.field ? `Linked to ${fieldDisplayName(item.field)}` : item.type === "image" ? (item.imageSource ? "Data-driven picture" : "One picture") : "Static content"}</span></div>
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
              <Pair label="Weight">
                <select className="select" value={item.weight ?? 500} onChange={(e) => patch({ weight: Number(e.target.value) })}>
                  <option value="400">Regular</option><option value="500">Medium</option><option value="600">Semibold</option><option value="700">Bold</option>
                </select>
              </Pair>
            </div>
            <div className="two-col spaced">
              <Pair label="Auto scale">
                <select className="select" value={item.autoFit ?? "off"} onChange={(e) => patch({ autoFit: e.target.value as DesignItem["autoFit"] })}>
                  <option value="off">Fixed size</option>
                  <option value="shrink">Shrink to fit box</option>
                  <option value="width">Shrink to fit width (one line)</option>
                  <option value="fit">Fit to box (grow or shrink)</option>
                </select>
              </Pair>
            </div>
            {item.autoFit && item.autoFit !== "off" && (
              <>
                <p className="hint">{item.autoFit === "shrink" ? "Text shrinks below the size above until it fits the box." : item.autoFit === "width" ? "Stays on one line and shrinks until it fits the width. Good for names." : "Text is sized to fill the box. Resize the box to change it."}</p>
                <div className="two-col spaced"><Pair label="Never smaller than"><NumberField value={item.minFontSize ?? 4} min={2} max={200} step={0.5} places={1} unit="pt" onChange={(n) => patch({ minFontSize: n })} /></Pair></div>
              </>
            )}
            <div className="two-col spaced">
              <Pair label="If it still doesn’t fit">
                <select className="select" value={item.overflow ?? "spill"} onChange={(e) => patch({ overflow: e.target.value as DesignItem["overflow"] })}>
                  <option value="spill">Let it spill past the box</option>
                  <option value="truncate">Cut off with “…”</option>
                </select>
              </Pair>
            </div>
            {fitNote && <p className={`hint ${fitNote.bad ? "warn" : ""}`}>{fitNote.text}{fitNote.bad && !instanceMode && <> <button className="link-button" onClick={onFitReview}>Review…</button></>}</p>}
            <div className="align-buttons">
              {([["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]] as const).map(([value, Icon]) => (
                <button key={value} aria-label={`Align ${value}`} className={(item.align ?? "left") === value ? "active" : ""} onClick={() => patch({ align: value })}><Icon size={15} /></button>
              ))}
              <button aria-label="Italic" aria-pressed={!!item.italic} className={item.italic ? "active" : ""} onClick={() => patch({ italic: !item.italic })}><Italic size={15} /></button>
            </div>
            <div className="two-col spaced"><Pair label="Line height"><NumberField value={item.lineHeight ?? 1.2} min={0.6} max={4} step={0.05} places={2} onChange={(n) => patch({ lineHeight: n })} /></Pair></div>
            <div className="color-row"><span>Text color</span><input type="color" value={item.color ?? "#34443d"} onChange={(e) => patch({ color: e.target.value })} /></div>
          </Section>
        </>
      )}

      {item.type === "image" && <PictureSection item={item} patch={patch} tools={imageTools} />}
      {(item.type === "rect" || item.type === "image") && <ShapeStyleSection item={item} patch={patch} />}
      <EffectsSection item={item} patch={patch} />

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

      {!instanceMode && <AlignRow onAlign={onAlign} label="TO TEMPLATE" />}

      {!instanceMode && <div className="property-actions">
        <button onClick={onDuplicate}><Copy size={14} /> Duplicate</button>
        <button onClick={() => onUpdate(item.id, { locked: !item.locked })}>{item.locked ? <Unlock size={14} /> : <Lock size={14} />} {item.locked ? "Unlock" : "Lock"}</button>
        <button className="danger" onClick={onDelete}><Trash2 size={14} /> Delete</button>
      </div>}
    </>
  );
}

function TemplateSetup({ templateWidth, templateHeight, onTemplateSize, onPreset, variants }: Props) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = averyPresets
    .map((preset) => ({ preset, error: Math.abs(preset.width - templateWidth) + Math.abs(preset.height - templateHeight) }))
    .filter(({ preset, error }) => (q ? `${preset.code} ${preset.name} ${preset.width}x${preset.height}`.toLowerCase().includes(q) : error <= 1.25))
    .sort((a, b) => a.error - b.error)
    .slice(0, 8);
  return (
    <>
      <VariantsSection {...variants} />
      <Section title="TEMPLATE SIZE" unit="INCHES">
        <div className="two-col">
          <Pair label="Width"><NumberField value={templateWidth} min={0.1} unit="in" onChange={(n) => onTemplateSize(n, templateHeight)} /></Pair>
          <Pair label="Height"><NumberField value={templateHeight} min={0.1} unit="in" onChange={(n) => onTemplateSize(templateWidth, n)} /></Pair>
        </div>
      </Section>
      <Section title="AVERY LABEL TEMPLATES" unit={`${averyPresets.length} FORMATS`}>
        <div className="field-search"><Search size={14} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by number, name, or size" aria-label="Search label formats" /></div>
        <div className="preset-option current"><span><strong>Custom</strong><small>{templateWidth.toFixed(3)} × {templateHeight.toFixed(3)} in · current size</small></span><BadgeCheck size={14} /></div>
        {matches.length
          ? matches.map(({ preset }) => (
            <button key={preset.code} className="preset-option" onClick={() => { onPreset(preset); setQuery(""); }}>
              <span><strong>Avery {preset.code}</strong><small>{preset.name}</small></span><em>{preset.width} × {preset.height}″</em>
            </button>
          ))
          : <p className="empty-note">No close matches. Try a different size or search by Avery number.</p>}
      </Section>
    </>
  );
}

function PageSetup({ sheet, onSheet, pageCount, overflow, fields, onAudit, auditCount, editedList, onJumpInstance, onResetInstanceById, printer, onCalibrationSheet }: Props) {
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
      <Section title="HAND-EDITED RECORDS" unit={editedList.length ? String(editedList.length) : undefined}>
        {editedList.length === 0 ? <p className="hint first">Turn on <strong>Edit individual records</strong> in the toolbar, then click or double-click anything on a sheet to change just that record — a name, a photo, a colour.</p> : (
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
