import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Check, X } from "lucide-react";
import type { RecordRow } from "../types";
import { NEW_COLUMN, planImport, suggestColumns, suggestKey, type ColumnPlan, type Duplicates } from "../lib/importPlan";
import { prettyField } from "../lib/data";

type Mode = "replace" | "add" | "merge";
type Props = {
  fileName: string;
  incoming: RecordRow[];
  existing: RecordRow[];
  existingColumns: string[];
  /** Replace everything with the new file (the template's links are checked next). */
  onReplace: () => void;
  /** Add or merge: the finished list of records. */
  onCombine: (rows: RecordRow[]) => void;
  onCancel: () => void;
};

/** Asks what to do with a newly opened data file: replace the records, add to them, or merge without duplicates. */
export function ImportDialog({ fileName, incoming, existing, existingColumns, onReplace, onCombine, onCancel }: Props) {
  const incomingColumns = useMemo(() => Object.keys(incoming[0] ?? {}).filter((c) => !c.startsWith("__")), [incoming]);
  const [plan, setPlan] = useState<ColumnPlan>(() => suggestColumns(existingColumns, incomingColumns));
  const matched = incomingColumns.filter((c) => plan[c] && plan[c] !== NEW_COLUMN).length;
  const recommended: Mode = matched >= Math.ceil(incomingColumns.length / 2) ? "merge" : "replace";
  const [mode, setMode] = useState<Mode>(recommended);
  const [key, setKey] = useState<string[]>(() => suggestKey(existingColumns, suggestColumns(existingColumns, incomingColumns)));
  const [onDuplicate, setOnDuplicate] = useState<Duplicates>("fill");

  useEffect(() => {
    const onEsc = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onCancel]);

  const result = useMemo(() => (mode === "replace" ? null : planImport(existing, incoming, plan, mode === "merge" ? key : null, onDuplicate)), [mode, existing, incoming, plan, key, onDuplicate]);
  const targets = [...new Set(Object.values(plan).filter((v): v is string => !!v && v !== NEW_COLUMN))];
  const needsKey = mode === "merge" && key.length === 0;

  const choice = (id: Mode, title: string, text: string) => (
    <button className={mode === id ? "import-option active" : "import-option"} role="radio" aria-checked={mode === id} onClick={() => setMode(id)}>
      <span className="radio-dot" />
      <span><strong>{title}{recommended === id && <em className="suggested">Suggested</em>}</strong><small>{text}</small></span>
    </button>
  );

  return (
    <div className="dialog-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="dialog import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <div className="dialog-head">
          <div><h2 id="import-title">Import {fileName}</h2><p>{incoming.length} record{incoming.length === 1 ? "" : "s"} and {incomingColumns.length} column{incomingColumns.length === 1 ? "" : "s"} found. You currently have {existing.length}. What should happen?</p></div>
          <button className="icon-button" aria-label="Cancel import" onClick={onCancel}><X size={17} /></button>
        </div>

        <div className="dialog-body" data-scroll>
          <div className="import-options" role="radiogroup" aria-label="What to do with the new records">
            {choice("replace", "Replace my records", `Throw away the current ${existing.length} and use only the new file.`)}
            {choice("add", "Add to my records", "Put the new records after the current ones. Nothing is removed.")}
            {choice("merge", "Merge and remove duplicates", "Combine both lists. A record that appears in both is kept once.")}
          </div>

          {mode === "replace" ? (
            <p className="import-note">If your template uses fields the new file doesn’t have, you’ll be asked to match them to the new columns next.</p>
          ) : (
            <>
              <div className="import-section">
                <h3>Match the columns</h3>
                <p className="import-note">{matched} of {incomingColumns.length} columns look like ones you already have. Fix any that are wrong. Anything not matched becomes a new column, and rows missing a column are left blank.</p>
                <div className="map-header"><span>COLUMN IN THE NEW FILE</span><span /><span>GOES INTO</span></div>
                {incomingColumns.map((column) => {
                  const to = plan[column];
                  return (
                    <div className="map-row" key={column}>
                      <span className="map-field">{prettyField(column)}<small>e.g. “{String(incoming[0]?.[column] ?? "").slice(0, 28) || "(empty)"}”</small></span>
                      <ArrowRight size={14} className="map-arrow" />
                      <div className="map-target">
                        <select className="select" value={to === null ? "" : to} aria-label={`Where ${column} goes`} onChange={(e) => setPlan((p) => ({ ...p, [column]: e.target.value === "" ? null : e.target.value }))}>
                          {existingColumns.map((c) => <option key={c} value={c}>{prettyField(c)}</option>)}
                          <option value={NEW_COLUMN}>New column “{column}”</option>
                          <option value="">Skip this column</option>
                        </select>
                        <span className={to && to !== NEW_COLUMN ? "map-sample" : "map-sample neutral"}>{to && to !== NEW_COLUMN ? <><Check size={12} /> matches your “{prettyField(to)}”</> : to === NEW_COLUMN ? "Added as a new column" : "Not imported"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {mode === "merge" && (
                <div className="import-section">
                  <h3>What counts as a duplicate?</h3>
                  <p className="import-note">Two records are the same when these match (ignoring capitals and spaces). An ID, email or band number is best; names can repeat.</p>
                  <div className="chip-row">
                    {targets.map((c) => <button key={c} className={key.includes(c) ? "key-chip active" : "key-chip"} aria-pressed={key.includes(c)} onClick={() => setKey((k) => (k.includes(c) ? k.filter((x) => x !== c) : [...k, c]))}>{prettyField(c)}</button>)}
                  </div>
                  {needsKey && <p className="warn-line"><AlertTriangle size={13} /> Pick at least one column to compare.</p>}
                  <div className="spaced-block">
                    <label className="field-label" htmlFor="dup-choice">When a record is already in my list</label>
                    <select id="dup-choice" className="select" value={onDuplicate} onChange={(e) => setOnDuplicate(e.target.value as Duplicates)}>
                      <option value="fill">Keep mine, and fill in anything I left blank</option>
                      <option value="update">Update mine with the new values</option>
                      <option value="keep">Keep mine exactly, ignore the new one</option>
                    </select>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="dialog-foot">
          <span className="map-status">
            {mode === "replace" ? `${existing.length} replaced by ${incoming.length}`
              : result ? `${result.added} added${mode === "merge" ? ` · ${result.merged} merged into existing${result.duplicatesInFile ? ` · ${result.duplicatesInFile} repeated in the file` : ""}` : ""}${result.newColumns.length ? ` · ${result.newColumns.length} new column${result.newColumns.length === 1 ? "" : "s"}` : ""}` : ""}
          </span>
          <button className="button" onClick={onCancel}>Cancel</button>
          <button className="button button-primary" disabled={needsKey} onClick={() => (mode === "replace" ? onReplace() : onCombine(result!.rows))}>{mode === "replace" ? "Replace records" : mode === "add" ? "Add records" : "Merge records"}</button>
        </div>
      </div>
    </div>
  );
}
