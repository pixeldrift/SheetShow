import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardPaste, X } from "lucide-react";
import type { RecordRow } from "../types";
import { gridToRecords, parseGrid, type Delimiter } from "../lib/importText";

type Props = {
  /** The records found, ready for the replace / add / merge choice. */
  onUse: (records: RecordRow[], name: string) => void;
  onCancel: () => void;
};

/** A box to paste cells into: copy a block in Google Sheets, Excel or Numbers and paste it here. */
export function PasteDialog({ onUse, onCancel }: Props) {
  const [text, setText] = useState("");
  // A single column is most likely a plain list with no heading, so the first row is data unless you say otherwise.
  const [headerChoice, setHeaderChoice] = useState<boolean | null>(null);
  const [listName, setListName] = useState("");
  const [delimiter, setDelimiter] = useState<Delimiter>("auto");
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { box.current?.focus(); }, []);
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onCancel]);

  const grid = useMemo(() => parseGrid(text, delimiter), [text, delimiter]);
  const width = Math.max(0, ...grid.map((r) => r.length));
  const header = headerChoice ?? width > 1;
  const isList = width === 1 && !header;
  const records = useMemo(() => {
    const made = gridToRecords(grid, header);
    // A plain list gets the name you give it, in place of "Column 1".
    return isList && listName.trim() ? made.map((r) => ({ [listName.trim()]: r["Column 1"] })) : made;
  }, [grid, header, isList, listName]);
  const columns = Object.keys(records[0] ?? {});

  return (
    <div className="dialog-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="dialog paste-dialog" role="dialog" aria-modal="true" aria-labelledby="paste-title">
        <div className="dialog-head">
          <div><h2 id="paste-title">Paste your data</h2><p>Copy a block of cells in Google Sheets, Excel or Numbers (include the heading row) and paste it below. Comma-separated text works too.</p></div>
          <button className="icon-button" aria-label="Cancel" onClick={onCancel}><X size={17} /></button>
        </div>
        <div className="dialog-body" data-scroll>
          <textarea ref={box} className="paste-box" value={text} onChange={(e) => setText(e.target.value)} placeholder={"Name\tSpecies\tBand\nPip\tGreen-cheeked conure\tGC-1048"} spellCheck={false} aria-label="Pasted data" />
          <div className="paste-options">
            <label className="check-row"><input type="checkbox" checked={header} onChange={(e) => setHeaderChoice(e.target.checked)} /> The first row has the column names</label>
            <label className="paste-delim">Separated by
              <select className="select" value={delimiter} onChange={(e) => setDelimiter(e.target.value as Delimiter)}>
                <option value="auto">Detect</option><option value={"\t"}>Tabs</option><option value=",">Commas</option><option value=";">Semicolons</option><option value="|">Bars (|)</option>
              </select>
            </label>
          </div>
          {isList && text.trim() && (
            <label className="pair paste-name"><span>This looks like a plain list. What should the column be called?</span>
              <input className="property-input" value={listName} onChange={(e) => setListName(e.target.value)} placeholder="For example: Name" aria-label="Column name" />
            </label>
          )}
          {text.trim() ? (
            records.length ? (
              <>
                <p className="hint paste-count"><strong>{records.length}</strong> record{records.length === 1 ? "" : "s"} · <strong>{columns.length}</strong> column{columns.length === 1 ? "" : "s"}{width !== columns.length ? "" : ""}</p>
                <div className="paste-preview" data-scroll>
                  <table><thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                    <tbody>{records.slice(0, 5).map((r, i) => <tr key={i}>{columns.map((c) => <td key={c}>{r[c]}</td>)}</tr>)}</tbody></table>
                </div>
                {records.length > 5 && <p className="hint">Showing the first 5 of {records.length}.</p>}
              </>
            ) : <p className="hint warn">No data rows found yet. {header ? "With the first row as column names, you need at least one more row." : ""}</p>
          ) : null}
        </div>
        <div className="dialog-foot">
          <span className="spacer" />
          <button className="button" onClick={onCancel}>Cancel</button>
          <button className="button primary" disabled={!records.length || (isList && !listName.trim())} onClick={() => onUse(records, "Pasted data")}><ClipboardPaste size={14} /> Use this data</button>
        </div>
      </div>
    </div>
  );
}
