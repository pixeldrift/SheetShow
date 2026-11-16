import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Check, Search, X } from "lucide-react";
import type { LabelPreset, Sheet } from "../types";
import { averyPresets } from "../lib/data";
import { PAPER_SIZES, customSheet, paperLabel, paperMatch, sizeText, stockSheet, wholePage, type Paper } from "../lib/papers";
import { NumberField, Pair } from "./Fields";

type Choice = { kind: "paper"; paper: Paper } | { kind: "stock"; preset: LabelPreset } | { kind: "custom" };

type Props = {
  /** The page layout to build on (cropmarks and so on are carried over). */
  baseSheet: Sheet;
  onCreate: (template: { width: number; height: number }, sheet: Sheet) => void;
  onCancel: () => void;
};

/** Asks how big the new design is: a paper size, a label or card stock, or your own numbers. Typing a number turns the choice into Custom (or the paper it happens to match). */
export function NewProjectDialog({ baseSheet, onCreate, onCancel }: Props) {
  const [width, setWidth] = useState(3.5);
  const [height, setHeight] = useState(2);
  const [choice, setChoice] = useState<Choice>({ kind: "stock", preset: averyPresets.find((p) => p.code === "8371") ?? averyPresets[0] });
  const [query, setQuery] = useState("");
  useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); }; window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc); }, [onCancel]);
  useEffect(() => { if (choice.kind === "stock") { setWidth(choice.preset.width); setHeight(choice.preset.height); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pickPaper = (paper: Paper) => { setChoice({ kind: "paper", paper }); setWidth(paper.width); setHeight(paper.height); };
  const pickStock = (preset: LabelPreset) => { setChoice({ kind: "stock", preset }); setWidth(preset.width); setHeight(preset.height); };
  const typed = (w: number, h: number) => {
    setWidth(w); setHeight(h);
    const paper = paperMatch(w, h);
    setChoice(paper ? { kind: "paper", paper: { ...paper, width: w, height: h } } : { kind: "custom" });
  };
  const swap = () => typed(height, width);

  const heading = useMemo(() => {
    if (choice.kind === "stock") return { title: `Avery ${choice.preset.code}`, detail: `${choice.preset.name} · ${sizeText(choice.preset.width, choice.preset.height)}` };
    if (choice.kind === "paper") { const p = paperMatch(width, height); return { title: p ? paperLabel({ ...p, width, height }) : "Custom", detail: "One design fills each page." }; }
    return { title: "Custom", detail: `${sizeText(width, height)}` };
  }, [choice, width, height]);

  const create = () => {
    if (choice.kind === "stock") onCreate({ width: choice.preset.width, height: choice.preset.height }, stockSheet(choice.preset, baseSheet));
    else if (choice.kind === "paper") onCreate({ width, height }, wholePage(width, height, baseSheet));
    else onCreate({ width, height }, customSheet(width, height, baseSheet));
  };

  const q = query.trim().toLowerCase();
  const stocks = averyPresets.filter((p) => !q || `${p.code} ${p.name} ${p.width}x${p.height}`.toLowerCase().includes(q));

  return (
    <div className="dialog-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="dialog new-dialog" role="dialog" aria-modal="true" aria-labelledby="new-title">
        <div className="dialog-head">
          <div><h2 id="new-title">New project</h2><p>Start with a blank design. Pick a size, or type your own.</p></div>
          <button className="icon-button" aria-label="Cancel" onClick={onCancel}><X size={17} /></button>
        </div>
        <div className="dialog-body" data-scroll>
          <div className={`size-summary ${choice.kind}`} aria-live="polite"><strong>{heading.title}</strong><small>{heading.detail}</small></div>
          <div className="two-col new-size">
            <Pair label="Width (in)"><NumberField value={width} min={0.1} step={0.05} places={3} onChange={(n) => typed(n, height)} /></Pair>
            <Pair label="Height (in)"><NumberField value={height} min={0.1} step={0.05} places={3} onChange={(n) => typed(width, n)} /></Pair>
          </div>
          <button className="link-button swap-size" onClick={swap}><ArrowLeftRight size={13} /> Turn it sideways</button>

          <h3 className="new-group">PAPER AND CARDS</h3>
          <div className="paper-grid">
            {PAPER_SIZES.map((p) => {
              const on = choice.kind === "paper" && paperMatch(width, height)?.id === p.id;
              return <button key={p.id} className={on ? "paper-chip selected" : "paper-chip"} onClick={() => pickPaper(p)}><strong>{p.name}</strong><small>{sizeText(p.width, p.height)}</small>{on && <Check size={12} />}</button>;
            })}
          </div>

          <h3 className="new-group">LABEL AND CARD STOCK <span>AVERY</span></h3>
          <div className="field-search"><Search size={14} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by number, name, or size" aria-label="Search label formats" /></div>
          <div className="stock-list">
            {stocks.map((p) => (
              <button key={p.code} className={choice.kind === "stock" && choice.preset.code === p.code ? "preset-option selected" : "preset-option"} onClick={() => pickStock(p)}>
                <span><strong>Avery {p.code}</strong><small>{p.name}</small></span><em>{p.width} × {p.height}″</em>
              </button>
            ))}
            {!stocks.length && <p className="empty-note">No formats match.</p>}
          </div>
        </div>
        <div className="dialog-foot">
          <span className="spacer" />
          <button className="button" onClick={onCancel}>Cancel</button>
          <button className="button primary" onClick={create}>Create project</button>
        </div>
      </div>
    </div>
  );
}
