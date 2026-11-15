import { useRef, useState } from "react";
import { BadgeCheck, Braces, ChevronDown, ChevronLeft, Database, FileText, Hash, GripVertical, Layers, MousePointer2, Search, Type } from "lucide-react";
import { specialFields, prettyField } from "../lib/data";

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
  /** The layer list, shown on its own tab beside the fields. */
  layers: React.ReactNode;
  layerCount: number;
};

export function DataPanel({ fileName, fields, recordCount, totalRecords, hasTextSelected, onImport, onField, onFieldPointerDown, dragging, onClose, layers, layerCount }: Props) {
  const [tab, setTab] = useState<"fields" | "layers">("fields");
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
      <div className="panel-heading tabs-heading" role="tablist">
        <button role="tab" aria-selected={tab === "fields"} className={tab === "fields" ? "head-tab active" : "head-tab"} onClick={() => setTab("fields")} title="Your data columns: drag one onto the design"><Braces size={14} /> Fields</button>
        <button role="tab" aria-selected={tab === "layers"} className={tab === "layers" ? "head-tab active" : "head-tab"} onClick={() => setTab("layers")} title="Every object in the design, front to back"><Layers size={14} /> Layers <span className="count-pill">{layerCount}</span></button>
        <button type="button" className="icon-button head-close" title="Close this drawer" aria-label="Close drawer" onClick={onClose}><ChevronLeft size={17} /></button>
      </div>
      {/* Everything below the heading scrolls. */}
      {tab === "layers" ? <div className="panel-body" data-scroll>{layers}</div> : (
      <div className="panel-body" data-scroll>
        <div className="section-title"><Database size={14} /> DATA SOURCE <button className="text-action" onClick={() => fileRef.current?.click()}>Change</button></div>
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
