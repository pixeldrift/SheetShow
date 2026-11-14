import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Check, X } from "lucide-react";
import type { RecordRow } from "../types";
import { prettyField } from "../lib/data";
import { suggestMapping } from "../lib/mapping";

type Props = {
  fileName: string;
  templateFields: string[];
  records: RecordRow[];
  onApply: (mapping: Record<string, string | null>) => void;
  onCancel: () => void;
};

/** Shown when a newly imported file doesn't have every column the template is linked to. */
export function MappingDialog({ fileName, templateFields, records, onApply, onCancel }: Props) {
  const columns = useMemo(() => Object.keys(records[0] ?? {}), [records]);
  const suggestions = useMemo(() => suggestMapping(templateFields, columns), [templateFields, columns]);
  const [choice, setChoice] = useState<Record<string, string | null>>(() => Object.fromEntries(templateFields.map((f) => [f, suggestions[f].column])));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const used = new Set(Object.values(choice).filter(Boolean));
  const unmatched = templateFields.filter((f) => !choice[f]).length;
  const unusedColumns = columns.filter((c) => !used.has(c));

  return (
    <div className="dialog-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="map-title">
        <div className="dialog-head">
          <div><h2 id="map-title">Match your columns</h2><p><strong>{fileName}</strong> doesn’t have every field your template uses. We’ve matched what we could — check the guesses and fix any that are off.</p></div>
          <button className="icon-button" aria-label="Cancel import" onClick={onCancel}><X size={17} /></button>
        </div>

        <div className="dialog-body" data-scroll>
          <div className="map-header"><span>TEMPLATE FIELD</span><span /><span>COLUMN IN NEW FILE</span></div>
          {templateFields.map((field) => {
            const picked = choice[field];
            const confident = !!picked && (picked === field || suggestions[field].column === picked);
            return (
              <div className="map-row" key={field}>
                <span className="map-field">{prettyField(field)}</span>
                <ArrowRight size={14} className="map-arrow" />
                <div className="map-target">
                  <select className="select" value={picked ?? ""} aria-label={`Column for ${prettyField(field)}`}
                    onChange={(e) => {
                      const value = e.target.value || null;
                      // A column feeds one field: picking it here releases it from any other row.
                      setChoice((current) => Object.fromEntries(Object.entries({ ...current, [field]: value }).map(([f, c]) => [f, f !== field && c && c === value ? null : c])));
                    }}>
                    <option value="">— No column (shows “—”) —</option>
                    {columns.map((column) => <option key={column} value={column}>{column}</option>)}
                  </select>
                  <span className={picked ? "map-sample" : "map-sample warn"}>
                    {picked
                      ? <>{confident ? <Check size={12} /> : null} e.g. “{String(records[0]?.[picked] ?? "").slice(0, 40) || "(empty)"}”</>
                      : <><AlertTriangle size={12} /> Nothing will appear here</>}
                  </span>
                </div>
              </div>
            );
          })}
          {unusedColumns.length > 0 && (
            <p className="map-unused"><strong>Not used by the template:</strong> {unusedColumns.slice(0, 8).join(", ")}{unusedColumns.length > 8 ? ` and ${unusedColumns.length - 8} more` : ""}. They’ll still be available in the Data fields list.</p>
          )}
        </div>

        <div className="dialog-foot">
          <span className={unmatched ? "map-status warn" : "map-status"}>{unmatched ? `${unmatched} field${unmatched > 1 ? "s" : ""} unmatched` : "All fields matched"}</span>
          <button className="button" onClick={onCancel}>Cancel</button>
          <button className="button button-primary" onClick={() => onApply(choice)}>Use this data</button>
        </div>
      </div>
    </div>
  );
}
