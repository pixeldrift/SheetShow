import { useEffect, useState } from "react";
import { Sheet, X } from "lucide-react";
import type { RecordRow } from "../types";
import { fetchPublicSheet, parseSheetAddress } from "../lib/googleSheets";

type Props = {
  onUse: (records: RecordRow[], name: string) => void;
  onPasteInstead: () => void;
  onCancel: () => void;
};

/** Brings in a Google Sheet by its address when it is shared with “anyone with the link”. Anything private is copied and pasted instead. */
export function SheetsDialog({ onUse, onPasteInstead, onCancel }: Props) {
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const parsed = parseSheetAddress(address);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onCancel]);

  const get = async () => {
    if (!parsed) return;
    setBusy(true); setProblem(null);
    try { onUse(await fetchPublicSheet(parsed.id, parsed.gid), `Google Sheet ${parsed.id.slice(0, 6)}…`); }
    catch (error) { setProblem(error instanceof Error ? error.message : "The sheet could not be read."); }
    finally { setBusy(false); }
  };

  return (
    <div className="dialog-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="dialog sheets-dialog" role="dialog" aria-modal="true" aria-labelledby="sheets-title">
        <div className="dialog-head">
          <div><h2 id="sheets-title">Import from Google Sheets</h2><p>Paste the address of a sheet that is shared with “anyone with the link”. For a private sheet, copy its cells in Google Sheets and paste them instead.</p></div>
          <button className="icon-button" aria-label="Cancel" onClick={onCancel}><X size={17} /></button>
        </div>
        <div className="dialog-body" data-scroll>
          <label className="pair"><span>Sheet address</span>
            <input className="property-input" value={address} onChange={(e) => { setAddress(e.target.value); setProblem(null); }} onKeyDown={(e) => { if (e.key === "Enter") get(); }} placeholder="https://docs.google.com/spreadsheets/d/…" autoFocus spellCheck={false} />
          </label>
          {address.trim() && !parsed && <p className="hint warn">That doesn’t look like a Google Sheets address. It should contain /spreadsheets/d/ and a long id.</p>}
          {parsed?.gid && <p className="hint">Reads the tab with gid {parsed.gid}. Without one, the first tab is used.</p>}
          {busy && <p className="hint">Reading the sheet…</p>}
          {problem && (
            <div className="banner warn-banner">
              <span>{problem}</span>
              <p className="hint">You can still copy the cells in Google Sheets (Ctrl/⌘+A, then Ctrl/⌘+C) and <button className="link-button" onClick={onPasteInstead}>paste them instead</button>.</p>
            </div>
          )}
        </div>
        <div className="dialog-foot">
          <span className="spacer" />
          <button className="button" onClick={onCancel}>Cancel</button>
          <button className="button primary" disabled={!parsed || busy} onClick={get}><Sheet size={14} /> Get the sheet</button>
        </div>
      </div>
    </div>
  );
}
