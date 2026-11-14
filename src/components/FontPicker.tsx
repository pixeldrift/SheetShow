import { useState } from "react";
import { Check, ChevronsUpDown, Loader, Search } from "lucide-react";
import type { FontLibrary } from "../hooks/useFontLibrary";
import { GOOGLE_FONTS } from "../lib/fonts";

type Props = { value?: string; library: FontLibrary; onPick: (family: string | undefined) => void };

/** Font chooser: document fonts, installed fonts (where the browser allows), Google Fonts, or any typed name. */
export function FontPicker({ value, library, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim();
  const lower = q.toLowerCase();
  const match = (name: string) => !q || name.toLowerCase().includes(lower);

  const documentFonts = library.fonts.filter((f) => match(f.family));
  const local = library.local.filter((f) => match(f) && !library.fonts.some((d) => d.family === f)).slice(0, 80);
  const google = GOOGLE_FONTS.filter((f) => match(f) && !library.fonts.some((d) => d.family === f));
  const exact = [...GOOGLE_FONTS, ...library.local, ...library.fonts.map((f) => f.family)].some((f) => f.toLowerCase() === lower);
  const [failed, setFailed] = useState<string | null>(null);

  const choose = async (family: string, source: "google" | "local" | "custom") => {
    setFailed(null);
    onPick(family); // apply right away; the web font swaps in when it arrives
    setOpen(false);
    setQuery("");
    const ok = await library.use(family, source);
    if (!ok && source === "google") setFailed(`Couldn’t download “${family}”. Check your connection.`);
  };

  const row = (family: string, source: "google" | "local" | "custom", hint?: string) => (
    <button key={`${source}:${family}`} className={family === value ? "font-row selected" : "font-row"} onClick={() => choose(family, source)}>
      <span>{family}</span>
      {library.busy === family ? <Loader size={13} className="spin" /> : family === value ? <Check size={13} /> : hint ? <em>{hint}</em> : null}
    </button>
  );

  return (
    <div className="font-picker">
      <button className="select font-trigger" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span style={{ fontFamily: value ? `"${value}", sans-serif` : undefined }}>{value ?? "Default"}</span>
        <ChevronsUpDown size={14} />
      </button>
      {failed && <p className="hint warn">{failed}</p>}
      {open && (
        <div className="font-menu">
          <div className="field-search"><Search size={14} /><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search or type any font name" aria-label="Search fonts" /></div>
          <div className="font-list" data-scroll>
            {!q && <button className={!value ? "font-row selected" : "font-row"} onClick={() => { onPick(undefined); setOpen(false); }}><span>Default</span>{!value && <Check size={13} />}</button>}
            {documentFonts.length > 0 && <div className="font-group">IN THIS DOCUMENT</div>}
            {documentFonts.map((f) => row(f.family, f.source))}
            {local.length > 0 && <div className="font-group">INSTALLED ON THIS DEVICE</div>}
            {local.map((f) => row(f, "local"))}
            {google.length > 0 && <div className="font-group">GOOGLE FONTS</div>}
            {google.map((f) => row(f, "google"))}
            {q && !exact && row(q, "custom", "Use this name")}
          </div>
          {library.localSupported
            ? library.local.length === 0 && <button className="font-access" onClick={library.requestLocal}>Access fonts installed on this device…</button>
            : <p className="hint">This browser can’t list installed fonts. Type an installed font’s exact name above to use it.</p>}
          {library.localError && <p className="hint warn">{library.localError}</p>}
        </div>
      )}
    </div>
  );
}
