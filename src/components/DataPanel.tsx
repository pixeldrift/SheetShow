import { useRef, useState } from "react";
import { BadgeCheck, ChevronDown, ChevronLeft, Database, FileText, Hash, MousePointer2, Plus, Search, Type } from "lucide-react";
import { specialFields, prettyField } from "../lib/data";

type Props = {
  fileName: string;
  fields: string[];
  recordCount: number;
  hasTextSelected: boolean;
  onImport: (file: File) => void;
  onField: (field: string) => void;
  onClose: () => void;
};

export function DataPanel({ fileName, fields, recordCount, hasTextSelected, onImport, onField, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const visible = fields.filter((field) => prettyField(field).toLowerCase().includes(query));
  const visibleSpecial = specialFields.filter((field) => field.label.toLowerCase().includes(query));

  const dragStart = (event: React.DragEvent, field: string) => {
    event.dataTransfer.setData("text/plain", field);
    event.dataTransfer.effectAllowed = "copy";
  };

  const row = (field: string, label: string, icon: React.ReactNode, special = false) => (
    <button key={field} className={special ? "field-row special" : "field-row"} draggable onDragStart={(e) => dragStart(e, field)} onClick={() => onField(field)}
      title={hasTextSelected ? "Click to bind the selected text" : "Click to add as a new text object"}>
      <span className="field-grip" aria-hidden>⠿</span>
      <span className="field-type">{icon}</span>
      <span className="field-name">{label}</span>
      <span className="field-add"><Plus size={13} /></span>
    </button>
  );

  return (
    <aside className="panel left-panel" aria-label="Data fields">
      <div className="panel-heading">
        <h2>Data fields</h2>
        <button className="icon-button" title="Collapse data fields" aria-label="Collapse data fields" onClick={onClose}><ChevronLeft size={17} /></button>
      </div>
      {/* Everything below the heading scrolls. */}
      <div className="panel-body" data-scroll>
        <div className="section-title"><Database size={14} /> DATA SOURCE <button className="text-action" onClick={() => fileRef.current?.click()}>Change</button></div>
        <div className="source-card">
          <div className="file-icon"><FileText size={17} /></div>
          <div className="source-meta"><strong>{fileName}</strong><span>{recordCount} records · {fields.length} fields</span></div>
          <BadgeCheck size={15} className="success-icon" />
        </div>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) onImport(file); e.target.value = ""; }} />
        <div className="field-search"><Search size={14} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a field…" aria-label="Find a field" /></div>

        <div className="field-group-label"><ChevronDown size={12} /> IMPORTED DATA <span>{visible.length}</span></div>
        <div className="field-list">{visible.map((field) => row(field, prettyField(field), <Type size={12} />))}</div>

        <div className="field-divider" />
        <div className="field-group-label special">SPECIAL FIELDS <span>{visibleSpecial.length}</span></div>
        <div className="field-list">{visibleSpecial.map((field) => row(field.key, field.label, <Hash size={12} />, true))}</div>

        <div className="drag-hint"><MousePointer2 size={13} /> Drag a field onto your design, or select text and tap a field to link it.</div>
      </div>
    </aside>
  );
}
