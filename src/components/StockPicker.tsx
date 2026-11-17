import { useEffect, useState } from "react";
import { BadgeCheck, Link2, List, Search, X } from "lucide-react";
import type { LabelPreset, Sheet } from "../types";
import { averyPresets } from "../lib/data";
import { Section } from "./Fields";
import { describeSize } from "../lib/papers";

type Props = {
  templateWidth: number;
  templateHeight: number;
  sheet: Sheet;
  /** Applies a label sheet to BOTH the individual template and the page layout. */
  onPreset: (preset: LabelPreset) => void;
};

const near = (a: number, b: number) => Math.abs(a - b) < 0.006;

/** The label stock the template and page currently describe, if they match a known sheet. */
export function matchedStock(width: number, height: number, sheet: Sheet): LabelPreset | undefined {
  return averyPresets.find((p) =>
    near(p.width, width) && near(p.height, height) && p.columns === sheet.columns && p.rows === sheet.rows &&
    near(p.gapX, sheet.gapX) && near(p.gapY, sheet.gapY) && near(p.marginX, sheet.marginX) && near(p.marginY, sheet.marginY) &&
    near(8.5, sheet.pageWidth) && near(11, sheet.pageHeight));
}

/**
 * Label stock, shown in both the Template and Page layout settings. Picking a sheet sets the template size AND the
 * page layout together; both can still be changed by hand afterwards, which turns the status to "Custom".
 */
export function StockPicker({ templateWidth, templateHeight, sheet, onPreset }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const current = matchedStock(templateWidth, templateHeight, sheet);
  const described = describeSize(templateWidth, templateHeight, sheet);
  const matches = averyPresets
    .map((preset) => ({ preset, error: Math.abs(preset.width - templateWidth) + Math.abs(preset.height - templateHeight) }))
    .filter(({ preset }) => !q || `${preset.code} ${preset.name} ${preset.width}x${preset.height}`.toLowerCase().includes(q))
    .sort((a, b) => a.error - b.error);
  const close = () => { setOpen(false); setQuery(""); };
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open]);

  return (
    <Section title="LABEL STOCK" unit={`${averyPresets.length} AVERY FORMATS`}>
      <div className={described.kind !== "custom" ? "stock-status matched" : "stock-status"}>
        {described.kind !== "custom" ? <BadgeCheck size={14} /> : <Link2 size={14} />}
        <div>
          <strong>{described.title}</strong>
          <small>{described.kind === "stock" ? `${described.detail}. Template and page layout match.` : described.kind === "paper" ? described.detail : described.detail}</small>
        </div>
      </div>
      <button type="button" className="button stock-browse" onClick={() => setOpen(true)}><List size={14} /> Choose an Avery sheet…</button>
      {open && (
        <div className="dialog-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="dialog stock-dialog" role="dialog" aria-modal="true" aria-labelledby="stock-title">
            <div className="dialog-head">
              <div><h2 id="stock-title">Choose an Avery sheet</h2><p>Picking one sets the individual template <strong>and</strong> the page layout. You can change either afterwards.</p></div>
              <button className="icon-button" aria-label="Close" onClick={close}><X size={17} /></button>
            </div>
            <div className="dialog-body" data-scroll>
              <div className="field-search"><Search size={14} /><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by number, name, or size" aria-label="Search label formats" /></div>
              {matches.length
                ? matches.map(({ preset }) => (
                  <button key={preset.code} className={current?.code === preset.code ? "preset-option selected" : "preset-option"} onClick={() => { onPreset(preset); close(); }}>
                    <span><strong>Avery {preset.code} · {preset.width} × {preset.height}″</strong><small>{preset.name.replace(/\s*·\s*\d+ per sheet$/, "")}</small></span><em>{preset.columns * preset.rows} per sheet</em>
                  </button>
                ))
                : <p className="empty-note">No matches. Try a different size or search by Avery number.</p>}
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}
