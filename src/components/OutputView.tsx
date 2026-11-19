import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Printer, Search } from "lucide-react";
import type { PageMeta, Plan, RecordRow, Sheet } from "../types";
import { PX_PER_IN } from "../lib/data";
import { recordLabel } from "../lib/audit";
import { describePlan, perSheetOf, type SheetRef } from "../lib/packet";
import { LayoutStage, type InstanceInfo } from "./LayoutStage";

type Props = {
  seq: SheetRef[]; sheets: Record<string, Sheet>; pages: PageMeta[]; plan: Plan;
  records: RecordRow[]; templateWidth: number; templateHeight: number; bleed: number;
  instanceFor: (record: RecordRow, index: number, slot: number, variantId?: string) => InstanceInfo;
  textIssues: number; onReviewText: () => void;
  onOpen: (sheetIndex: number) => void; onPrint: () => void;
};

/** A sheet's thumbnail, drawn only once it scrolls near the screen (a long run can be hundreds of sheets). */
function Thumb({ ref_, K, p, width }: { ref_: SheetRef; K: number; p: Props; width: number }) {
  const sheet = p.sheets[ref_.pageId];
  const box = useRef<HTMLButtonElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: "500px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const scale = width / (sheet.pageWidth * PX_PER_IN);
  const height = sheet.pageHeight * PX_PER_IN * scale;
  const per = perSheetOf(sheet, p.templateWidth, p.templateHeight);
  const first = ref_.base + 1, last = Math.min(ref_.limit, ref_.base + per);
  const name = p.pages.find((x) => x.id === ref_.pageId)?.name ?? "Page";
  return (
    <button ref={box} className="out-sheet" style={{ width }} onClick={() => p.onOpen(K)} aria-label={`Open sheet ${K + 1}, ${name}`}>
      <span className="out-thumb" style={{ width, height }}>
        {near && (
          <span style={{ display: "block", width: sheet.pageWidth * PX_PER_IN, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
            <LayoutStage sheet={sheet} templateWidth={p.templateWidth} templateHeight={p.templateHeight} records={p.records} instanceFor={p.instanceFor} pageId={ref_.pageId}
              base={ref_.base} limit={ref_.limit} pageNumber={K + 1} pageCount={p.seq.length} showGrid={false} preview bleed={p.bleed} />
          </span>
        )}
      </span>
      <span className="out-cap"><strong>Sheet {K + 1}</strong><small>{name} · {last < first ? "no records" : first === last ? `record ${first}` : `records ${first}–${last}`}</small></span>
    </button>
  );
}

const useWidth = () => {
  const [w, setW] = useState(() => (window.innerWidth < 640 ? Math.floor((window.innerWidth - 16 * 2 - 12) / 2) : 200));
  useEffect(() => {
    const on = () => setW(window.innerWidth < 640 ? Math.floor((window.innerWidth - 16 * 2 - 12) / 2) : 200);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
};

/** Everything that will come out of the printer, together: every sheet, grouped by packet, with a plain summary and a Print button. */
export function OutputView(p: Props) {
  const width = useWidth();
  const [page, setPage] = useState("");
  const [query, setQuery] = useState("");
  const name = (id: string) => p.pages.find((x) => x.id === id)?.name ?? "Page";
  const q = query.trim().toLowerCase();

  /** Sheets grouped by packet (or, when all records print together, by run of the same page template). */
  const groups = useMemo(() => {
    const out: { key: string; title: string; sub: string; items: number[] }[] = [];
    let lastPage = "", run = 0;
    p.seq.forEach((ref, K) => {
      if (ref.pageId !== lastPage) { run++; lastPage = ref.pageId; }
      if (page && ref.pageId !== page) return;
      if (q) {
        const per = perSheetOf(p.sheets[ref.pageId], p.templateWidth, p.templateHeight);
        let hit = false;
        for (let i = ref.base; i < Math.min(ref.limit, ref.base + per); i++) if (p.records[i] && recordLabel(p.records[i]).toLowerCase().includes(q)) hit = true;
        if (!hit) return;
      }
      const packet = p.plan.group > 0;
      const key = packet ? `g${ref.group}` : `p${run}`;
      let g = out[out.length - 1];
      if (!g || g.key !== key) {
        const start = packet ? ref.group * p.plan.group : 0;
        const end = packet ? Math.min(p.records.length, start + p.plan.group) : p.records.length;
        g = { key, title: packet ? (p.plan.group === 1 ? recordLabel(p.records[start] ?? {}) : `Records ${start + 1}–${end}`) : name(ref.pageId), sub: packet ? "" : `all ${p.records.length} records`, items: [] };
        out.push(g);
      }
      g.items.push(K);
    });
    return out;
  }, [p.seq, page, q, p.plan, p.pages]); // eslint-disable-line react-hooks/exhaustive-deps

  const summary = describePlan(p.plan, name, p.seq.length, p.records.length);
  const shown = groups.reduce((n, g) => n + g.items.length, 0);
  return (
    <div className="out-view">
      <div className="out-head">
        <div className="out-summary"><strong>{summary}</strong></div>
        {p.textIssues > 0 && <button className="out-warn" onClick={p.onReviewText}><AlertTriangle size={15} /> {p.textIssues} {p.textIssues === 1 ? "text doesn't" : "texts don't"} fit its box. Review</button>}
        <div className="out-filters">
          <div className="field-search"><Search size={14} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a person's sheets…" aria-label="Find sheets by record" /></div>
          {p.pages.length > 1 && (
            <select className="select" value={page} onChange={(e) => setPage(e.target.value)} aria-label="Show page template">
              <option value="">All page templates</option>
              {p.pages.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          )}
        </div>
      </div>
      <div className="out-scroll" data-scroll>
        {groups.map((g) => (
          <section key={g.key} className="out-group">
            <h3>{g.title}<small>{g.sub && `${g.sub} · `}{g.items.length} {g.items.length === 1 ? "sheet" : "sheets"}</small></h3>
            <div className="out-grid">{g.items.map((K) => <Thumb key={K} ref_={p.seq[K]} K={K} p={p} width={width} />)}</div>
          </section>
        ))}
        {shown === 0 && <p className="empty-note">No sheets match.</p>}
      </div>
      <div className="out-foot">
        <span>{p.seq.length} {p.seq.length === 1 ? "sheet" : "sheets"} will print</span>
        <button className="button button-primary" onClick={p.onPrint}><Printer size={15} /> Print</button>
      </div>
    </div>
  );
}
