import { useEffect, useState } from "react";
import { LogIn, Sheet, X } from "lucide-react";
import type { RecordRow } from "../types";
import { SheetAccessError, fetchPublicSheet, fetchSignedInTab, googleClientId, parseSheetAddress, sheetInfo, signInToGoogle, type SheetInfo } from "../lib/googleSheets";

type Props = {
  onUse: (records: RecordRow[], name: string) => void;
  onPasteInstead: () => void;
  onCancel: () => void;
};

/** Brings in a Google Sheet by its address: directly when it is shared with the link, or after signing in with Google for one that is private. */
export function SheetsDialog({ onUse, onPasteInstead, onCancel }: Props) {
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<{ text: string; signIn: boolean } | null>(null);
  const [info, setInfo] = useState<{ id: string; sheet: SheetInfo; gid: string | null } | null>(null);
  const [tab, setTab] = useState("");
  const parsed = parseSheetAddress(address);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onCancel]);

  const wrap = async (label: string, work: () => Promise<void>) => {
    setBusy(label); setProblem(null);
    try { await work(); }
    catch (error) { setProblem({ text: error instanceof Error ? error.message : "Something went wrong.", signIn: error instanceof SheetAccessError && error.needsSignIn }); }
    finally { setBusy(null); }
  };

  const getShared = () => parsed && wrap("Reading the sheet…", async () => {
    const records = await fetchPublicSheet(parsed.id, parsed.gid);
    onUse(records, `Google Sheet ${parsed.id.slice(0, 6)}…`);
  });

  const signIn = () => parsed && wrap("Waiting for Google…", async () => {
    await signInToGoogle();
    const sheet = await sheetInfo(parsed.id);
    const wanted = sheet.tabs.find((t) => t.gid === parsed.gid) ?? sheet.tabs[0];
    setInfo({ id: parsed.id, sheet, gid: parsed.gid });
    setTab(wanted.title);
    if (sheet.tabs.length === 1) { onUse(await fetchSignedInTab(parsed.id, wanted.title), sheet.title); }
  });

  const importTab = () => info && wrap("Reading the tab…", async () => {
    onUse(await fetchSignedInTab(info.id, tab), info.sheet.tabs.length > 1 ? `${info.sheet.title} · ${tab}` : info.sheet.title);
  });

  return (
    <div className="dialog-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="dialog sheets-dialog" role="dialog" aria-modal="true" aria-labelledby="sheets-title">
        <div className="dialog-head">
          <div><h2 id="sheets-title">Import from Google Sheets</h2><p>Paste the address of the sheet. If it is shared with “anyone with the link” it comes in directly; otherwise sign in with Google, which gives SheetShow read-only access to sheets you can open.</p></div>
          <button className="icon-button" aria-label="Cancel" onClick={onCancel}><X size={17} /></button>
        </div>
        <div className="dialog-body" data-scroll>
          {!info ? (
            <>
              <label className="pair"><span>Sheet address</span>
                <input className="property-input" value={address} onChange={(e) => { setAddress(e.target.value); setProblem(null); }} placeholder="https://docs.google.com/spreadsheets/d/…" autoFocus spellCheck={false} />
              </label>
              {address.trim() && !parsed && <p className="hint warn">That doesn’t look like a Google Sheets address. It should contain /spreadsheets/d/ and a long id.</p>}
              {parsed?.gid && <p className="hint">Reads the tab with gid {parsed.gid}. Without one, the first tab is used.</p>}
            </>
          ) : (
            <label className="pair"><span>Which tab of “{info.sheet.title}”?</span>
              <select className="select" value={tab} onChange={(e) => setTab(e.target.value)}>{info.sheet.tabs.map((t) => <option key={t.gid} value={t.title}>{t.title}</option>)}</select>
            </label>
          )}
          {busy && <p className="hint">{busy}</p>}
          {problem && (
            <div className="banner warn-banner">
              <span>{problem.text}</span>
              {problem.signIn && (
                <p className="hint">
                  {googleClientId ? "You can sign in with Google to read it as yourself, " : "This copy of SheetShow isn’t set up for Google sign-in, so private sheets can’t be read directly. "}
                  or copy the cells in Google Sheets (Ctrl/⌘+A, then Ctrl/⌘+C) and <button className="link-button" onClick={onPasteInstead}>paste them instead</button>.
                </p>
              )}
            </div>
          )}
        </div>
        <div className="dialog-foot">
          <span className="spacer" />
          <button className="button" onClick={onCancel}>Cancel</button>
          {!info && googleClientId && <button className="button" disabled={!parsed || !!busy} onClick={signIn}><LogIn size={14} /> Sign in with Google</button>}
          {!info ? <button className="button primary" disabled={!parsed || !!busy} onClick={getShared}><Sheet size={14} /> Get the sheet</button>
            : <button className="button primary" disabled={!!busy} onClick={importTab}><Sheet size={14} /> Import this tab</button>}
        </div>
      </div>
    </div>
  );
}
