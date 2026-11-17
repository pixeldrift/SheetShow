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
  if (sheet.placements) return undefined; // a hand-arranged page is no longer the stock sheet
  return averyPresets.find((p) =>
    near(p.width, width) && near(p.height, height) && p.columns === sheet.columns && p.rows === sheet.rows &&
    near(p.gapX, sheet.gapX) && near(p.gapY, sheet.gapY) && near(p.marginX, sheet.marginX) && near(p.marginY, sheet.marginY) &&
    near(8.5, sheet.pageWidth) && near(11, sheet.pageHeight));
}

/**
 * Label stock, shown in both the Template and Page layout settings. Picking a sheet sets the template size AND the
 * page layout together; both can still be changed by hand afterwards, which turns the status to "Custom".
 */
/** A to-scale sketch: the single label on the left, a sheet of them on the right. Everything is in inches. */
function Preview({ label, page, title }: { label: { w: number; h: number }; page: { w: number; h: number; cols: number; rows: number; gapX: number; gapY: number; mx: number; my: number }; title: string }) {
  const fit = (w: number, h: number, boxW: number, boxH: number) => Math.min(boxW / w, boxH / h);
  const ls = fit(label.w, label.h, 120, 84), ps = fit(page.w, page.h, 120, 84);
  return (
    <div className="stock-preview" aria-label={title}>
      <figure>
        <svg width={label.w * ls + 2} height={label.h * ls + 2} viewBox={`-1 -1 ${label.w * ls + 2} ${label.h * ls + 2}`} role="img" aria-label="One label">
          <rect width={label.w * ls} height={label.h * ls} rx="3" fill="#fffaf6" stroke="#d17c4b" strokeWidth="1.5" />
        </svg>
        <figcaption><strong>Individual template</strong><span>{label.w} × {label.h}″</span></figcaption>
      </figure>
      <figure>
        <svg width={page.w * ps + 2} height={page.h * ps + 2} viewBox={`-1 -1 ${page.w * ps + 2} ${page.h * ps + 2}`} role="img" aria-label="One sheet">
          <rect width={page.w * ps} height={page.h * ps} fill="#fff" stroke="#c9cec5" />
          {Array.from({ length: page.rows * page.cols }, (_, i) => (
            <rect key={i} x={(page.mx + (i % page.cols) * (label.w + page.gapX)) * ps} y={(page.my + Math.floor(i / page.cols) * (label.h + page.gapY)) * ps}
              width={label.w * ps} height={label.h * ps} rx="1" fill="#fceee3" stroke="#d17c4b" strokeWidth="0.6" />
          ))}
        </svg>
        <figcaption><strong>Page layout</strong><span>{page.cols * page.rows} per sheet</span></figcaption>
      </figure>
    </div>
  );
}

export function StockPicker({ templateWidth, templateHeight, sheet, onPreset }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<LabelPreset | null>(null);
  const q = query.trim().toLowerCase();
  const current = matchedStock(templateWidth, templateHeight, sheet);
  const described = describeSize(templateWidth, templateHeight, sheet);
  const matches = averyPresets
    .map((preset) => ({ preset, error: Math.abs(preset.width - templateWidth) + Math.abs(preset.height - templateHeight) }))
    .filter(({ preset }) => !q || `${preset.code} ${preset.name} ${preset.width}x${preset.height}`.toLowerCase().includes(q))
    .sort((a, b) => a.error - b.error);
  const close = () => { setOpen(false); setQuery(""); setPicked(null); };
  const choose = () => { if (picked) onPreset(picked); close(); };
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open]);
  const shown = picked
    ? { label: { w: picked.width, h: picked.height }, page: { w: 8.5, h: 11, cols: picked.columns, rows: picked.rows, gapX: picked.gapX, gapY: picked.gapY, mx: picked.marginX, my: picked.marginY } }
    : { label: { w: templateWidth, h: templateHeight }, page: { w: sheet.pageWidth, h: sheet.pageHeight, cols: sheet.columns, rows: sheet.rows, gapX: sheet.gapX, gapY: sheet.gapY, mx: sheet.marginX, my: sheet.marginY } };

  return (
    <Section title="AVERY TEMPLATES" unit={`${averyPresets.length} FORMATS`}>
      <div className={described.kind !== "custom" ? "stock-status matched" : "stock-status"}>
        {described.kind !== "custom" ? <BadgeCheck size={14} /> : <Link2 size={14} />}
        <div>
          <strong>{described.title}</strong>
          <small>{described.kind === "stock" ? `${described.detail}. Template and page layout match.` : described.detail}</small>
        </div>
      </div>
      <button type="button" className="button stock-browse" onClick={() => setOpen(true)}><List size={14} /> Avery templates…</button>
      {open && (
        <div className="dialog-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="dialog stock-dialog" role="dialog" aria-modal="true" aria-labelledby="stock-title">
            <div className="dialog-head">
              <div><h2 id="stock-title">Avery templates</h2></div>
              <button className="icon-button" aria-label="Close" onClick={close}><X size={17} /></button>
            </div>
            <Preview {...shown} title={picked ? `Avery ${picked.code}` : "Current"} />
            <div className="dialog-body" data-scroll>
              <div className="field-search"><Search size={14} /><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by number, name, or size" aria-label="Search label formats" /></div>
              {matches.length
                ? matches.map(({ preset }) => (
                  <button key={preset.code} className={picked?.code === preset.code ? "preset-option selected" : !picked && current?.code === preset.code ? "preset-option current-stock" : "preset-option"}
                    aria-pressed={picked?.code === preset.code} onClick={() => setPicked(preset)} onDoubleClick={() => { onPreset(preset); close(); }}>
                    <span className="preset-main"><span className="preset-row"><strong>Avery {preset.code}</strong><em>{preset.width} × {preset.height}″</em></span><span className="preset-row"><small>{preset.name.replace(/\s*·\s*\d+ per sheet$/, "")}</small><small>{preset.columns * preset.rows} per sheet</small></span></span>
                  </button>
                ))
                : <p className="empty-note">No matches. Try a different size or search by Avery number.</p>}
            </div>
            <div className="dialog-foot">
              <button className="button" onClick={close}>Cancel</button>
              <button className="button button-primary" disabled={!picked} onClick={choose}>Choose this template</button>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}
