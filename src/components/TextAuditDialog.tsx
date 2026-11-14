import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { Issue } from "../lib/audit";

type Props = {
  issues: Issue[];
  /** Start filtered to one text object. */
  itemId?: string | null;
  onFix: (issue: Issue) => void;
  onClose: () => void;
};

const LABEL = { spill: "Runs past its box", truncated: "Cut off with “…”" } as const;

/** Every text that doesn't fit, across all the records that will print. */
export function TextAuditDialog({ issues, itemId, onFix, onClose }: Props) {
  const [filter, setFilter] = useState<string>(itemId ?? "all");
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const items = useMemo(() => [...new Map(issues.map((i) => [i.itemId, i.itemLabel])).entries()], [issues]);
  const shown = issues.filter((i) => filter === "all" || i.itemId === filter);

  return (
    <div className="dialog-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog review-dialog" role="dialog" aria-modal="true" aria-labelledby="audit-title">
        <div className="dialog-head">
          <div><h2 id="audit-title">Text that doesn’t fit</h2>
            <p>{issues.length ? `${issues.length} place${issues.length === 1 ? "" : "s"} where text is too long for its box. Fix one by editing just that record on the page, or change the text’s fit settings to handle them all.` : "Everything fits."}</p></div>
          <button className="icon-button" aria-label="Close" onClick={onClose}><X size={17} /></button>
        </div>
        {issues.length > 0 && (
          <div className="review-summary">
            <select className="select review-filter" style={{ marginLeft: 0 }} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Show text">
              <option value="all">All text ({issues.length})</option>
              {items.map(([id, label]) => <option key={id} value={id}>{label} ({issues.filter((i) => i.itemId === id).length})</option>)}
            </select>
          </div>
        )}
        <div className="review-list" data-scroll>
          {shown.slice(0, 400).map((issue) => (
            <div className="review-row audit-row" key={issue.recordId + issue.itemId}>
              <AlertTriangle size={16} className={issue.kind === "truncated" ? "audit-icon cut" : "audit-icon"} />
              <div className="review-text"><strong>{issue.recordLabel}</strong><small>{issue.itemLabel} · {LABEL[issue.kind]}{issue.atMin ? " even at the smallest allowed size" : ""} · record {issue.recordIndex + 1}</small></div>
              <button className="button" onClick={() => onFix(issue)}>Fix on page…</button>
            </div>
          ))}
          {shown.length > 400 && <p className="empty-note review-empty">Showing the first 400 of {shown.length}.</p>}
          {!shown.length && <p className="empty-note review-empty">Nothing to show.</p>}
        </div>
        <div className="dialog-foot"><span className="spacer" /><button className="button button-primary" onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
}
