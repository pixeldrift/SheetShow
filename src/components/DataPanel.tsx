import { useEffect, useRef, useState } from "react";
import { ClipboardPaste, Sheet, Upload, BadgeCheck, Braces, ChevronDown, ChevronLeft, Database, FileText, Hash, GripVertical, LayoutTemplate, Layers, Plus, MousePointer2, Search, Type } from "lucide-react";
import { specialFields, prettyField } from "../lib/data";
import type { DrawerChrome } from "./DrawerChrome";

type Props = {
  fileName: string;
  fields: string[];
  recordCount: number;
  totalRecords: number;
  hasTextSelected: boolean;
  onImport: (file: File) => void;
  onField: (field: string) => void;
  /** Starts a pointer drag (mouse immediately, touch after a long-press). */
  onFieldPointerDown: (field: string, event: React.PointerEvent) => void;
  dragging: boolean;
  onClose: () => void;
  /** Page layout swaps the Fields tab for Templates: the individual templates, to drag onto the sheet. */
  workspace?: "template" | "layout";
  templates?: { id: string; name: string; letter: string; count: number }[];
  onAddTemplate?: (id: string) => void;
  cardCount?: number; perSheet?: number;
  onPasteData: () => void;
  onGoogleSheet: () => void;
  /** Gestures: drag the edge or the header to resize, flick toward the screen edge to close. */
  chrome: DrawerChrome;
  /** The layer list, shown on its own tab beside the fields. */
  layers: React.ReactNode;
  layerCount: number;
};

export function DataPanel({ fileName, fields, recordCount, totalRecords, hasTextSelected, onImport, onField, onFieldPointerDown, dragging, onClose, layers, layerCount, onPasteData, onGoogleSheet, chrome, workspace = "template", templates = [], onAddTemplate, cardCount = 0, perSheet = 1 }: Props) {
  const [sourceMenu, setSourceMenu] = useState<{ x: number; y: number } | null>(null);
  const sourceRef = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<"fields" | "templates" | "layers">("fields");
  const onPage = workspace === "layout";
  useEffect(() => { if (onPage && tab === "fields") setTab("templates"); else if (!onPage && tab === "templates") setTab("fields"); }, [onPage, tab]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const visible = fields.filter((field) => prettyField(field).toLowerCase().includes(query));
  const visibleSpecial = specialFields.filter((field) => field.label.toLowerCase().includes(query));

  const row = (field: string, label: string, icon: React.ReactNode, special = false) => (
    <button key={field} className={special ? "field-row special" : "field-row"} onPointerDown={(e) => onFieldPointerDown(field, e)} onClick={() => onField(field)}
      title={hasTextSelected ? "Click to bind the selected text" : "Click to add as a new text object"}>
      <span className="field-type">{icon}</span>
      <span className="field-name">{label}</span>
      <span className="field-grip" aria-hidden><GripVertical size={14} /></span>
    </button>
  );

  return (
    <aside className={dragging ? "panel left-panel dragging" : "panel left-panel"} aria-label="Data fields">
      <div className="panel-heading tabs-heading" role="tablist" onPointerDown={chrome.header} onClickCapture={(e) => { if (chrome.consumeSwipe()) { e.stopPropagation(); e.preventDefault(); } }}>
        {onPage
          ? <button role="tab" aria-selected={tab === "templates"} className={tab === "templates" ? "head-tab active" : "head-tab"} onClick={() => setTab("templates")} title="Your individual templates: drag one onto the sheet"><LayoutTemplate size={14} /> Templates</button>
          : <button role="tab" aria-selected={tab === "fields"} className={tab === "fields" ? "head-tab active" : "head-tab"} onClick={() => setTab("fields")} title="Your data columns: drag one onto the design"><Braces size={14} /> Fields</button>}
        <button role="tab" aria-selected={tab === "layers"} className={tab === "layers" ? "head-tab active" : "head-tab"} onClick={() => setTab("layers")} title="Every object in the design, front to back"><Layers size={14} /> Layers <span className="count-pill">{layerCount}</span></button>
        <button type="button" className="icon-button head-close" title="Close this drawer" aria-label="Close drawer" onClick={onClose}><ChevronLeft size={17} /></button>
      </div>
      {/* Everything below the heading scrolls. */}
      {tab === "layers" ? <div className="panel-body" data-scroll>{layers}</div> : onPage ? (
      <div className="panel-body" data-scroll>
        <div className="section-title"><LayoutTemplate size={14} /> INDIVIDUAL TEMPLATES</div>
        <p className="hint first">Drag a template onto the sheet (touch: press and hold, then drag), or tap <strong>Add</strong>. Each card gets a number: cards with the same number show the same record.</p>
        <div className="field-list">
          {templates.map((t) => (
            <div key={t.id} className="field-row template-row" onPointerDown={(e) => { if (!(e.target as HTMLElement).closest(".row-add")) onFieldPointerDown(`@tpl:${t.id}`, e); }} title="Drag onto the sheet">
              <span className="field-type template-letter">{t.letter}</span>
              <span className="field-name">{t.name}</span>
              <button type="button" className="row-add" aria-label={`Add ${t.name} to the sheet`} onClick={() => onAddTemplate?.(t.id)}><Plus size={14} /></button>
              <span className="field-grip" aria-hidden><GripVertical size={14} /></span>
            </div>
          ))}
        </div>
        <div className="source-card">
          <div className="file-icon"><FileText size={17} /></div>
          <div className="source-meta"><strong>{cardCount === 1 ? "1 card" : `${cardCount} cards`} per sheet</strong><span>{perSheet === 1 ? "One record fills the sheet" : `${perSheet} records per sheet`}</span></div>
        </div>
        <div className="drag-hint"><MousePointer2 size={13} /> Pick a card on the sheet to move it, renumber it or give it a different template.</div>
      </div>
      ) : (
      <div className="panel-body" data-scroll>
        <div className="section-title"><Database size={14} /> DATA SOURCE <button ref={sourceRef} className="text-action" aria-haspopup="menu" aria-expanded={!!sourceMenu} onClick={() => { const r = sourceRef.current?.getBoundingClientRect(); setSourceMenu(sourceMenu || !r ? null : { x: Math.max(8, r.right - 210), y: r.bottom + 4 }); }}>Change</button></div>
        {sourceMenu && (
          <>
            <div className="menu-scrim" onClick={() => setSourceMenu(null)} />
            <div className="menu" role="menu" style={{ position: "fixed", left: sourceMenu.x, top: sourceMenu.y, minWidth: 210 }}>
              <button role="menuitem" onClick={() => { setSourceMenu(null); fileRef.current?.click(); }}><Upload size={14} /> <span>Open a CSV file…</span></button>
              <button role="menuitem" onClick={() => { setSourceMenu(null); onPasteData(); }}><ClipboardPaste size={14} /> <span>Paste data…</span></button>
              <button role="menuitem" onClick={() => { setSourceMenu(null); onGoogleSheet(); }}><Sheet size={14} /> <span>Google Sheet…</span></button>
            </div>
          </>
        )}
        <div className="source-card">
          <div className="file-icon"><FileText size={17} /></div>
          <div className="source-meta"><strong>{fileName}</strong><span>{recordCount === totalRecords ? `${recordCount} records` : `${recordCount} of ${totalRecords} records`} · {fields.length} fields</span></div>
          <BadgeCheck size={15} className="success-icon" />
        </div>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) onImport(file); e.target.value = ""; }} />
        <div className="field-search"><Search size={14} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a field…" aria-label="Find a field" /></div>

        <div className="field-group-label"><ChevronDown size={12} /> IMPORTED DATA <span>{visible.length}</span></div>
        <div className="field-list">{visible.map((field) => row(field, prettyField(field), <Type size={12} />))}</div>

        <div className="field-divider" />
        <div className="field-group-label special">SPECIAL FIELDS <span>{visibleSpecial.length}</span></div>
        <div className="field-list">{visibleSpecial.map((field) => row(field.key, field.label, <Hash size={12} />, true))}</div>

        <div className="drag-hint"><MousePointer2 size={13} /> Drag (touch: press and hold, then drag) a field onto your design, or select text and tap a field to link it.</div>
      </div>
      )}
    </aside>
  );
}
