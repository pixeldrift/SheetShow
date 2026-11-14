import { useState } from "react";
import {
  AlignCenter, AlignLeft, AlignRight, AlertTriangle, ArrowDown, ArrowUp, BadgeCheck, ChevronRight, Copy, Eye, EyeOff, FileImage,
  Hash, Layers, Link2Off, ListFilter, Lock, Search, SlidersHorizontal, Square, Trash2, Type, Unlock,
} from "lucide-react";
import type { DesignItem, LabelPreset, Sheet } from "../types";
import { averyPresets, fieldDisplayName } from "../lib/data";
import { NumberField, Pair, Section } from "./Fields";

type Props = {
  workspace: "template" | "layout";
  items: DesignItem[];
  selected: DesignItem | null;
  onSelect: (id: string | null) => void;
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
  const { workspace, items, selected, onSelect, onUpdate, onClose } = props;
  const [tab, setTab] = useState<"properties" | "layers">("properties");
  const title = tab === "layers" ? "Layers" : selected ? "Item properties" : workspace === "template" ? "Template setup" : "Page setup";

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
              <div key={item.id} className={selected?.id === item.id ? "layer-row selected" : "layer-row"} onClick={() => { onSelect(item.id); setTab("properties"); }}>
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
        ) : selected ? (
          <ItemProperties item={selected} onUpdate={onUpdate} onDuplicate={props.onDuplicate} onDelete={props.onDelete} />
        ) : workspace === "template" ? (
          <TemplateSetup {...props} />
        ) : (
          <PageSetup {...props} />
        )}
      </div>
    </aside>
  );
}

function ItemProperties({ item, onUpdate, onDuplicate, onDelete }: { item: DesignItem; onUpdate: Props["onUpdate"]; onDuplicate: () => void; onDelete: () => void }) {
  const patch = (p: Partial<DesignItem>, key?: string) => onUpdate(item.id, p, key ?? `prop:${item.id}:${Object.keys(p).join()}`);
  return (
    <>
      <div className="property-heading">
        <div className="property-icon">{kindIcon(item, 17)}</div>
        <div><strong>{item.type === "text" ? "Text object" : item.type === "image" ? "Image object" : "Shape object"}</strong><span>{item.field ? `Linked to ${fieldDisplayName(item.field)}` : "Static content"}</span></div>
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
              <input className="property-input" value={item.text ?? ""} onChange={(e) => patch({ text: e.target.value })} placeholder="Enter text…" />
            )}
            {!item.field && <p className="hint">Pick a field in the data drawer to link this text to your data.</p>}
          </Section>
          <Section title="TYPOGRAPHY">
            <div className="two-col">
              <Pair label="Font size"><NumberField value={item.fontSize ?? 12} min={4} max={200} step={1} unit="pt" onChange={(n) => patch({ fontSize: n })} /></Pair>
              <Pair label="Weight">
                <select className="select" value={item.weight ?? 500} onChange={(e) => patch({ weight: Number(e.target.value) })}>
                  <option value="400">Regular</option><option value="500">Medium</option><option value="600">Semibold</option><option value="700">Bold</option>
                </select>
              </Pair>
            </div>
            <div className="align-buttons">
              {([["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]] as const).map(([value, Icon]) => (
                <button key={value} aria-label={`Align ${value}`} className={(item.align ?? "left") === value ? "active" : ""} onClick={() => patch({ align: value })}><Icon size={15} /></button>
              ))}
            </div>
            <div className="color-row"><span>Text color</span><input type="color" value={item.color ?? "#34443d"} onChange={(e) => patch({ color: e.target.value })} /></div>
          </Section>
        </>
      )}

      {item.type === "rect" && (
        <Section title="APPEARANCE">
          <div className="color-row"><span>Fill color</span><input type="color" value={item.fill ?? "#e9eee9"} onChange={(e) => patch({ fill: e.target.value })} /></div>
          <div className="color-row"><span>Border color</span><input type="color" value={item.stroke && item.stroke !== "none" ? item.stroke : "#ffffff"} onChange={(e) => patch({ stroke: e.target.value })} /></div>
        </Section>
      )}

      <Section title="POSITION & SIZE" unit="INCHES">
        <div className="two-col">
          <Pair label="X"><NumberField value={item.x} onChange={(n) => patch({ x: n })} /></Pair>
          <Pair label="Y"><NumberField value={item.y} onChange={(n) => patch({ y: n })} /></Pair>
          <Pair label="Width"><NumberField value={item.w} min={0.01} onChange={(n) => patch({ w: n })} /></Pair>
          <Pair label="Height"><NumberField value={item.h} min={0.01} onChange={(n) => patch({ h: n })} /></Pair>
        </div>
      </Section>

      <div className="property-actions">
        <button onClick={onDuplicate}><Copy size={14} /> Duplicate</button>
        <button onClick={() => onUpdate(item.id, { locked: !item.locked })}>{item.locked ? <Unlock size={14} /> : <Lock size={14} />} {item.locked ? "Unlock" : "Lock"}</button>
        <button className="danger" onClick={onDelete}><Trash2 size={14} /> Delete</button>
      </div>
    </>
  );
}

function TemplateSetup({ templateWidth, templateHeight, onTemplateSize, onPreset }: Props) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = averyPresets
    .map((preset) => ({ preset, error: Math.abs(preset.width - templateWidth) + Math.abs(preset.height - templateHeight) }))
    .filter(({ preset, error }) => (q ? `${preset.code} ${preset.name} ${preset.width}x${preset.height}`.toLowerCase().includes(q) : error <= 1.25))
    .sort((a, b) => a.error - b.error)
    .slice(0, 8);
  return (
    <>
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

function PageSetup({ sheet, onSheet, pageCount, overflow }: Props) {
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
