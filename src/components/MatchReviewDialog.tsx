import { useEffect, useMemo, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import type { Asset, DesignItem, RecordRow } from "../types";
import type { ImageLibrary } from "../hooks/useImageLibrary";
import { ID } from "../lib/records";
import { needsReview, type Match } from "../lib/images";
import { ImageLibraryDialog } from "./ImageLibraryDialog";

type Props = {
  item: DesignItem;
  records: RecordRow[];
  library: ImageLibrary;
  onOverrides: (changes: Record<string, string | null>) => void;
  onClose: () => void;
};

const ROW_H = 54;
type Filter = "attention" | "all" | "missing";
const STATUS: Record<string, string> = { override: "Chosen", exact: "Exact", normalized: "Matched", fuzzy: "Guess — check", web: "Web", none: "No match" };

const labelFor = (record: RecordRow) => record.name || Object.entries(record).find(([k, v]) => !k.startsWith("__") && v)?.[1] || "(empty)";

/** Every record next to the picture it resolved to, so guesses can be confirmed and misses fixed by hand. */
export function MatchReviewDialog({ item, records, library, onOverrides, onClose }: Props) {
  const [filter, setFilter] = useState<Filter>("attention");
  const [picking, setPicking] = useState<string | null>(null);
  const [showUnused, setShowUnused] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(360);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeight(el.clientHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !picking) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, picking]);

  const rows = useMemo(() => records.map((record) => ({ record, match: library.resolver.resolve(item, record) })), [records, item, library.resolver]);
  const counts = useMemo(() => {
    const c = { good: 0, fuzzy: 0, none: 0 };
    for (const { match } of rows) { if (match.kind === "fuzzy") c.fuzzy++; else if (match.kind === "none") c.none++; else c.good++; }
    return c;
  }, [rows]);
  const used = useMemo(() => new Set(rows.flatMap(({ match }) => (match.asset ? [match.asset.id] : []))), [rows]);
  const unused = library.assets.filter((a) => !used.has(a.id));

  const visible = rows.filter(({ match }) => filter === "all" || (filter === "missing" ? match.kind === "none" : needsReview(match)));
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - 4);
  const end = Math.min(visible.length, Math.ceil((scrollTop + height) / ROW_H) + 4);

  const urlOf = (match: Match) => match.url ?? library.urlFor(match.asset?.id);
  const acceptAllGuesses = () => onOverrides(Object.fromEntries(rows.filter(({ match }) => match.kind === "fuzzy" && match.asset).map(({ record, match }) => [record[ID], match.asset!.id])));

  return (
    <div className="dialog-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget && !picking) onClose(); }}>
      <div className="dialog review-dialog" role="dialog" aria-modal="true" aria-labelledby="review-title">
        <div className="dialog-head">
          <div><h2 id="review-title">Match pictures to records</h2>
            <p>{item.imageSource?.mode === "pattern" ? <>Looking for <code>{item.imageSource.pattern}</code></> : item.imageSource?.mode === "column" ? <>Looking for the filename in <strong>{item.imageSource.column}</strong></> : null}</p></div>
          <button className="icon-button" aria-label="Close" onClick={onClose}><X size={17} /></button>
        </div>

        <div className="review-summary">
          <span className="chip ok">{counts.good} matched</span>
          <span className={counts.fuzzy ? "chip warn" : "chip"}>{counts.fuzzy} to check</span>
          <span className={counts.none ? "chip bad" : "chip"}>{counts.none} missing</span>
          <select className="select review-filter" value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="Show">
            <option value="attention">Needs attention</option><option value="missing">Missing only</option><option value="all">All records</option>
          </select>
          {counts.fuzzy > 0 && <button className="button" onClick={acceptAllGuesses}><Check size={14} /> Accept all guesses</button>}
        </div>

        <div className="review-list" ref={scroller} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)} data-scroll>
          <div style={{ height: visible.length * ROW_H, position: "relative" }}>
            {visible.slice(start, end).map(({ record, match }, i) => {
              const id = record[ID];
              const url = urlOf(match);
              return (
                <div className="review-row" key={id} style={{ position: "absolute", top: (start + i) * ROW_H, height: ROW_H, left: 0, right: 0 }}>
                  <div className="review-thumb">{url ? <img src={url} alt="" /> : <span>—</span>}</div>
                  <div className="review-text"><strong>{labelFor(record)}</strong><small title={match.candidate}>{match.candidate || "(nothing to look up for this record)"}{match.asset ? ` → ${match.asset.path}` : ""}</small></div>
                  <span className={`chip ${match.kind === "none" ? "bad" : match.kind === "fuzzy" ? "warn" : "ok"}`}>{STATUS[match.kind]}</span>
                  {match.kind === "fuzzy" && match.asset && <button className="button" onClick={() => onOverrides({ [id]: match.asset!.id })}>Accept</button>}
                  <button className="button" onClick={() => setPicking(id)}>{match.kind === "none" ? "Choose…" : "Change…"}</button>
                  {item.overrides?.[id] && <button className="mini-button" title="Go back to automatic matching" aria-label="Clear manual choice" onClick={() => onOverrides({ [id]: null })}><X size={13} /></button>}
                </div>
              );
            })}
          </div>
          {!visible.length && <p className="empty-note review-empty">{filter === "attention" ? "Every record has a confident match." : "Nothing to show."}</p>}
        </div>

        <div className="dialog-foot">
          <button className="link-button" onClick={() => setShowUnused((v) => !v)}>{unused.length} unused picture{unused.length === 1 ? "" : "s"} in the library</button>
          <span className="spacer" />
          <button className="button button-primary" onClick={onClose}>Done</button>
        </div>
        {showUnused && unused.length > 0 && <div className="unused-list">{unused.slice(0, 60).map((a) => a.path).join(" · ")}{unused.length > 60 ? ` … and ${unused.length - 60} more` : ""}</div>}
      </div>

      {picking && (
        <ImageLibraryDialog library={library} title="Choose a picture" onClose={() => setPicking(null)}
          onPick={(asset: Asset) => { onOverrides({ [picking]: asset.id }); setPicking(null); }} />
      )}
    </div>
  );
}
