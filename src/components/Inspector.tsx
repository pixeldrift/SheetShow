import { useRef, useState } from "react";
import { kindIcon } from "./LayersPanel";
import type { DrawerChrome } from "./DrawerChrome";
import {
  ChevronDown, FileText, LayoutTemplate, Shapes, Group, Ungroup,
  AlignCenter, AlignLeft, AlignRight, AlertTriangle, BadgeCheck, ChevronRight, Copy, Eye, EyeOff, FileImage,
  CaseUpper, Hash, Image as ImageIcon, Italic, Underline, Layers, TextCursorInput, Link2Off, ListFilter, Lock, RotateCcw, RotateCw, Search, SlidersHorizontal, Square, Trash2, Type, Unlock,
  X, Filter,
} from "lucide-react";
import type { Bleed, DesignItem, LabelPreset, Sheet } from "../types";
import { inchLabel } from "../lib/bleed";
import { averyPresets, fieldDisplayName, prettyField, specialFields } from "../lib/data";
import type { FontLibrary } from "../hooks/useFontLibrary";
import { NumberField, Pair, Section } from "./Fields";
import { FontPicker } from "./FontPicker";
import { EffectsSection, ImageColorSection, PictureSection, ShapeStyleSection, type ImageTools } from "./ItemStyleSections";
import { VariantsSection } from "./VariantSections";
import { ConditionsSection } from "./ConditionsSection";
import { PrinterCalibrationSection } from "./PrinterCalibrationSection";
import { defaultImageSource } from "../lib/images";
import { mergeIssues } from "../lib/merge";
import { TokenEditor } from "./TokenEditor";
import { TokenModeToggle } from "./TokenModeToggle";
import { useTokenMode } from "../lib/tokenMode";
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
  bleed?: Bleed; bleedInfo: { max: number; effective: number; standard: boolean }; onBleed: (bleed: Bleed | undefined) => void;
  templateMargins?: { top: number; right: number; bottom: number; left: number }; onTemplateMargins: (margins: { top: number; right: number; bottom: number; left: number }) => void;
  templateHeight: number;
  onTemplateSize: (width: number, height: number) => void;
  onPreset: (preset: LabelPreset) => void;
  sheet: Sheet;
  onSheet: (patch: Partial<Sheet>) => void;
  pageCount: number;
  overflow: boolean;
  onClose: () => void;
  chrome: DrawerChrome;
};

export function Inspector(props: Props) {
  const { workspace, items, selectedItems, onSelect, onUpdate, onClose } = props;
  const selected = selectedItems.length === 1 ? selectedItems[0] : null;
  // The header names what the drawer is showing: the selected object, the template, or the page.
  const head = selectedItems.length > 1
    ? { icon: props.groups.wholeGroup ? <Group size={16} /> : <Layers size={16} />, title: props.groups.wholeGroup ? `Group · ${selectedItems[0].groupName ?? ""}` : `${selectedItems.length} objects`, sub: props.groups.wholeGroup ? "Moves and resizes as one" : "Selected together" }
    : selected
      ? { icon: kindIcon(selected, 16), title: selected.name?.trim() || (selected.type === "text" ? "Text" : selected.type === "image" ? "Picture" : "Shape"), sub: selected.field ? `Linked to ${fieldDisplayName(selected.field)}` : selected.type === "image" ? (selected.imageSource ? "Different for each record" : "One picture") : selected.type === "text" ? "Typed text" : "Fill, border and corners" }
      : workspace === "template"
        ? { icon: <LayoutTemplate size={16} />, title: "Template", sub: "Size and label stock" }
        : { icon: <FileText size={16} />, title: "Page", sub: "Sheet, margins and printing" };

  return (
    <aside className="panel right-panel" aria-label="Properties">
      <button type="button" className="panel-heading clickable two-line" title="Close this drawer (or flick it toward the edge)" aria-label={`Close ${head.title} properties`} onPointerDown={props.chrome.header} onClick={(e) => { if (props.chrome.consumeSwipe()) { e.preventDefault(); return; } onClose(); }}>
        <span className="head-icon">{head.icon}</span>
        <span className="head-text"><strong>{head.title}</strong><small>{head.sub}</small></span>
        <ChevronRight size={17} className="heading-chevron" />
      </button>
      <div className="panel-body" data-scroll>
        {selectedItems.length > 1 ? (
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
        <p className="hint">Drag the round handle above the selection to turn it freely (Shift for 15° steps). Items turn together around the group’s center.</p>
      </Section>
      <p className="hint">Shift-click items or layers to adjust the selection, or turn on multi-select in the toolbar and just tap. Alignment is on the bar at the bottom of the canvas.</p>
      <div className="property-actions"><button onClick={onDuplicate}><Copy size={14} /> Duplicate</button><button className="danger" onClick={onDelete}><Trash2 size={14} /> Delete</button></div>
    </>
  );
}

function ItemProperties({ item, onUpdate, onDuplicate, onDelete, fontLibrary, imageTools, fitNote, instanceMode, onFitReview }: { instanceMode?: boolean; onFitReview?: () => void; fitNote?: { text: string; bad: boolean } | null; imageTools: ImageTools; item: DesignItem; onUpdate: Props["onUpdate"]; onDuplicate: () => void; onDelete: () => void; fontLibrary: FontLibrary }) {
  const patch = (p: Partial<DesignItem>, key?: string) => onUpdate(item.id, p, key ?? `prop:${item.id}:${Object.keys(p).join()}`);
  const [tokenMode, toggleTokenMode] = useTokenMode();
  const [convertAt, setConvertAt] = useState<{ x: number; y: number; w: number } | null>(null);
  const convertRef = useRef<HTMLButtonElement>(null);
  const convert = (action: () => void) => { setConvertAt(null); action(); };
  return (
    <>
      <div className="convert-row">
        <button ref={convertRef} className="button wide with-chevron" aria-haspopup="menu" aria-expanded={!!convertAt} onClick={() => { const r = convertRef.current?.getBoundingClientRect(); setConvertAt(convertAt || !r ? null : { x: r.left, y: r.bottom + 4, w: r.width }); }}>
          <Shapes size={14} /> Convert to… <ChevronDown size={13} className="caret" />
        </button>
        {convertAt && (
          <>
            <div className="menu-scrim" onClick={() => setConvertAt(null)} />
            <div className="menu" role="menu" style={{ position: "fixed", left: convertAt.x, top: convertAt.y, minWidth: convertAt.w }}>
              {item.type !== "rect" && <button role="menuitem" onClick={() => convert(() => patch({ type: "rect", text: undefined, field: undefined, imageSource: undefined, assetId: undefined }, `kind:${item.id}`))}><Square size={14} /> <span>Shape</span></button>}
              {item.type !== "text" && <button role="menuitem" onClick={() => convert(() => patch({ type: "text", text: item.text ?? "Text", fontSize: item.fontSize ?? 11, color: item.color ?? "#34443d", weight: item.weight ?? 500, wrap: true, padding: item.padding ?? 0.08, imageSource: undefined, assetId: undefined }, `kind:${item.id}`))}><TextCursorInput size={14} /> <span>Text box</span></button>}
              {item.type !== "image" && <button role="menuitem" onClick={() => convert(() => patch({ type: "image", imageSource: defaultImageSource(imageTools.columns), text: undefined, field: undefined }, `kind:${item.id}`))}><ImageIcon size={14} /> <span>Photo box</span></button>}
            </div>
          </>
        )}
      </div>

      {item.type === "text" && (
        <>
          <Section title="CONTENT">
            {/* The contents box is always here. Text linked to a field shows that field as a chip, and typing over it turns the link into ordinary text. */}
            <div className="token-box">
              <TokenEditor className="property-input textarea" value={item.field ? `{{${item.field.startsWith("__") ? fieldDisplayName(item.field) : item.field}}}` : item.text ?? ""}
                onChange={(text) => {
                  if (!item.field) { patch({ text }); return; }
                  const whole = text.trim().match(/^\{\{\s*([^{}|#^/?]+?)\s*\}\}$/);
                  const named = whole && [...imageTools.columns, ...specialFields.map((f) => f.key)].find((f) => f === whole[1] || fieldDisplayName(f).toLowerCase() === whole[1].toLowerCase());
                  if (named) { if (named !== item.field) patch({ field: named, text: fieldDisplayName(named) }); } else patch({ field: undefined, text });
                }}
                mode={item.field ? "chips" : tokenMode} fields={imageTools.columns} ariaLabel="Text" placeholder="Enter text…" />
              <TokenModeToggle mode={tokenMode} onToggle={toggleTokenMode} />
            </div>
            {item.field && (
              <div className="binding-note"><span>Linked to <strong>{fieldDisplayName(item.field)}</strong>. Type to add your own wording around it.</span>
                <button className="link-button" onClick={() => patch({ field: undefined, text: fieldDisplayName(item.field!) })} title="Unlink and keep as static text"><Link2Off size={12} /> Unlink</button></div>
            )}
            {!item.field && (
              <>
                <p className="hint">Press Enter for a new line. Pick a field in the Fields drawer to link this text, or write your own wording with fields in double braces: <code>{"{{city}}, {{state}} {{zip}}"}</code>. Extra spaces tidy themselves.</p>
                <p className="hint">Only when there is a value: <code>{"{{first}} {{last}}{{?title}}, {{title}}{{/}}"}</code>. Compare with <code>=</code> <code>!=</code> <code>contains</code> <code>starts</code> <code>ends</code> (add <code>!</code> to negate a word), put <code>~</code> before a quoted value to match loosely (ignoring spaces and punctuation), join with <code>and</code> / <code>or</code>, and use <code>{"{{else}}"}</code>: <code>{"{{?type = \"VIP\"}}★{{else}}·{{/}}"}</code>.</p>
                {mergeIssues(item.text ?? "", imageTools.columns).map((issue) => <p key={issue} className="hint warn">{issue}</p>)}
              </>
            )}
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
                <button aria-label="All caps" title="All caps" aria-pressed={!!item.caps} onClick={() => patch({ caps: !item.caps })}><CaseUpper size={15} /></button>
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
              <Pair label="Tracking"><NumberField value={item.letterSpacing ?? 0} min={-200} max={1000} step={5} places={0} unit="‰" onChange={(v) => patch({ letterSpacing: v || undefined })} /></Pair>
              <Pair label="Pair kerning">
                <select className="select" aria-label="Pair kerning" value={item.kerning === false ? "off" : "on"} onChange={(e) => patch({ kerning: e.target.value === "off" ? false : undefined })}>
                  <option value="on">Auto</option><option value="off">Off</option>
                </select>
              </Pair>
            </div>
            <div className="two-col stack-narrow spaced">
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
      {item.type === "image" && <ImageColorSection item={item} patch={patch} />}
      <ShapeStyleSection item={item} patch={patch} />
      <EffectsSection item={item} patch={patch} />
      {!instanceMode && <ConditionsSection item={item} patch={patch} fields={imageTools.columns} records={imageTools.records} record={imageTools.record} />}

      <Section title="POSITION & SIZE">
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

function TemplateSetup({ templateWidth, templateHeight, bleed, bleedInfo, onBleed, templateMargins, onTemplateMargins, onTemplateSize, onPreset, variants, sheet }: Props) {
  return (
    <>
      <VariantsSection {...variants} />
      <Section title="TEMPLATE SIZE">
        <div className="two-col">
          <Pair label="Width"><NumberField value={templateWidth} min={0.1} step={0.05} unit="in" onChange={(n) => onTemplateSize(n, templateHeight)} /></Pair>
          <Pair label="Height"><NumberField value={templateHeight} min={0.1} step={0.05} unit="in" onChange={(n) => onTemplateSize(templateWidth, n)} /></Pair>
        </div>
      </Section>
      <Section title="MARGINS">
        <div className="two-col">
          {(["top", "right", "bottom", "left"] as const).map((side) => {
            const m = templateMargins ?? { top: 0, right: 0, bottom: 0, left: 0 };
            return <Pair key={side} label={side[0].toUpperCase() + side.slice(1)}><NumberField value={m[side]} min={0} step={0.05} unit="in" onChange={(n) => onTemplateMargins({ ...m, [side]: n })} /></Pair>;
          })}
        </div>
        <p className="hint">A dashed violet guide on the template marks the safe area. It never prints.</p>
      </Section>
      <Section title="BLEED">
        {(() => {
          const b: Bleed = bleed ?? { amount: 0, auto: false, policy: "limit" };
          const set = (change: Partial<Bleed>) => onBleed({ ...b, ...change });
          const shown = !bleed ? 0 : b.auto ? bleedInfo.max : b.amount;
          return (
            <>
              <Pair label="Bleed (inches)">
                <NumberField value={shown} min={0} step={0.0625} places={3} onChange={(n) => set({ amount: n, auto: false })} />
              </Pair>
              <label className="check-row bleed-auto"><input type="checkbox" checked={!!bleed && b.auto} onChange={(e) => set({ auto: e.target.checked, amount: e.target.checked ? b.amount : Math.min(b.amount || bleedInfo.max, bleedInfo.max) })} /> Automatic: the largest that fits</label>
              {!bleedInfo.standard && !b.auto && (
                <div className="bleed-policy" role="radiogroup" aria-label="If the bleed does not fit">
                  <span>If the bleed doesn't fit the layout:</span>
                  <label className="check-row"><input type="radio" name="bleed-policy" checked={b.policy === "limit"} onChange={() => set({ policy: "limit" })} /> Limit the bleed to the gap</label>
                  <label className="check-row"><input type="radio" name="bleed-policy" checked={b.policy === "grow"} onChange={() => set({ policy: "grow" })} /> Widen the gaps to make room</label>
                </div>
              )}
              <p className="hint">
                {bleedInfo.max > 0
                  ? <>Most the layout holds: <strong>{inchLabel(bleedInfo.max)}</strong>, half the gap between cards. </>
                  : <>There is no gap between cards, so there is no room for bleed. </>}
                {bleedInfo.standard ? "Avery sheets always keep the bleed inside that." : b.auto ? "" : b.policy === "grow" ? "The gaps on the page layout widen to fit what you enter." : "A larger number is held to that."}{!b.auto && bleed && b.amount > bleedInfo.max + 0.0005 && bleedInfo.effective < b.amount - 0.0005 && <> You entered {inchLabel(b.amount)}.</>}
                {bleedInfo.effective > 0 && <> Printing with <strong>{inchLabel(bleedInfo.effective)}</strong> of bleed. A dashed teal line on the template shows where it ends; extend artwork to it.</>}
              </p>
            </>
          );
        })()}
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
          <Pair label="Width"><NumberField value={sheet.pageWidth} min={1} step={0.05} unit="in" onChange={(n) => onSheet({ pageWidth: n })} /></Pair>
          <Pair label="Height"><NumberField value={sheet.pageHeight} min={1} step={0.05} unit="in" onChange={(n) => onSheet({ pageHeight: n })} /></Pair>
        </div>
      </Section>
      <StockPicker templateWidth={templateWidth} templateHeight={templateHeight} sheet={sheet} onPreset={onPreset} />
      <Section title="ITEMS PER PAGE">
        <div className="two-col">
          <Pair label="Columns"><NumberField value={sheet.columns} min={1} max={20} step={1} places={0} onChange={(n) => onSheet({ columns: Math.round(n) })} /></Pair>
          <Pair label="Rows"><NumberField value={sheet.rows} min={1} max={30} step={1} places={0} onChange={(n) => onSheet({ rows: Math.round(n) })} /></Pair>
        </div>
      </Section>
      <Section title="PAGE MARGINS">
        <div className="two-col">
          <Pair label="Left"><NumberField value={sheet.marginX} min={0} unit="in" onChange={(n) => onSheet({ marginX: n })} /></Pair>
          <Pair label="Top"><NumberField value={sheet.marginY} min={0} unit="in" onChange={(n) => onSheet({ marginY: n })} /></Pair>
        </div>
      </Section>
      <Section title="ITEM SPACING">
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
        {editedList.length === 0 ? <p className="hint first">Turn on <strong>Override</strong> in the toolbar, then click or double-click anything on a sheet to change just that record — a name, a photo, a color.</p> : (
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
          <button className={sheet.repeatMode === "same" ? "mode-option active" : "mode-option"} onClick={() => onSheet({ repeatMode: "same" })}><Copy size={15} /><span><strong>One record per sheet</strong><small>Fill each sheet with one record, a sheet for every record</small></span></button>
          <button className={sheet.repeatMode === "next" ? "mode-option active" : "mode-option"} onClick={() => onSheet({ repeatMode: "next" })}><ListFilter size={15} /><span><strong>Next record each time</strong><small>Fill the sheet with consecutive records</small></span></button>
        </div>
      </Section>
      {overflow && <p className="warning"><AlertTriangle size={14} /> This grid doesn’t fit on the page. Reduce the margins, spacing, or the number of rows and columns.</p>}
      <div className="output-summary"><div><span>Items per sheet</span><strong>{sheet.columns * sheet.rows}</strong></div><div><span>Sheets to print</span><strong>{pageCount}</strong></div></div>
    </>
  );
}
