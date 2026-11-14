import { Braces, ChevronLeft, ChevronRight, ChevronUp, Rows3, Variable } from "lucide-react";

type Props = {
  label: string; position: number; total: number;
  /** The current record's values as one line of text, so you can see the template really is linked to this data. */
  preview: string;
  onStep: (delta: number) => void;
  drawerOpen: boolean; onToggleDrawer: () => void;
  /** Show {field} names instead of values (template view only). */
  showNames?: boolean; onToggleNames?: () => void;
};

export function RecordBar({ label, position, total, preview, onStep, drawerOpen, onToggleDrawer, showNames, onToggleNames }: Props) {
  return (
    <div className="record-bar">
      <button className="record-peek" onClick={onToggleDrawer} aria-expanded={drawerOpen} aria-label="Show all records" title="Tap to open the full list of records and pick one to preview">
        <span className="record-icon"><Rows3 size={15} /></span>
        <span className="peek-text">
          <span className="peek-label">{label} {position} of {total} · linked data</span>
          <span className="peek-values" title={preview}>{preview || "No data in this record"}</span>
        </span>
        <ChevronUp size={15} className={drawerOpen ? "peek-chevron open" : "peek-chevron"} />
      </button>
      <div className="record-controls">
        <button className="tool-button" aria-label={`Previous ${label.toLowerCase()}`} onClick={() => onStep(-1)} disabled={position <= 1}><ChevronLeft size={17} /></button>
        <div className="record-select"><strong>{String(position).padStart(2, "0")}</strong><span>/ {total}</span></div>
        <button className="tool-button" aria-label={`Next ${label.toLowerCase()}`} onClick={() => onStep(1)} disabled={position >= total}><ChevronRight size={17} /></button>
      </div>
      {onToggleNames && (
        <button className="tool-button toggle names-toggle" aria-pressed={!!showNames} onClick={onToggleNames} title={showNames ? "Showing field names. Switch back to the record's values" : "Show field names instead of values, to see what is variable"} aria-label="Show field names">
          {showNames ? <Braces size={16} /> : <Variable size={16} />}
        </button>
      )}
    </div>
  );
}
