import { useEffect, useRef, useState } from "react";
import { ChevronDown, GripVertical } from "lucide-react";
import type { RecordRow } from "../types";
import { prettyField } from "../lib/data";

type Props = {
  open: boolean;
  records: RecordRow[];
  fields: string[];
  current: number;
  excluded: number;
  onPick: (index: number) => void;
  onClose: () => void;
  /** Start dragging a cell's field onto the template (creates a linked text there). */
  onCellPointerDown: (field: string, event: React.PointerEvent) => void;
  /** A drag just ended, so the click that follows it shouldn't also pick the row. */
  justDragged: () => boolean;
  dragging: boolean;
};

const ROW = 34;

/** A slide-up list of the records being previewed: scroll, tap a row to preview it, drag a cell onto the template. */
export function RecordsDrawer({ open, records, fields, current, excluded, onPick, onClose, onCellPointerDown, justDragged, dragging }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);
  const [height, setHeight] = useState(240);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeight(el.clientHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, [open]);
  // Bring the current record into view when the drawer opens.
  useEffect(() => { if (open && scroller.current) scroller.current.scrollTop = Math.max(0, current * ROW - 3 * ROW); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = Math.max(0, Math.floor(top / ROW) - 4);
  const end = Math.min(records.length, Math.ceil((top + height) / ROW) + 4);

  return (
    <div className={`records-drawer${open ? " open" : ""}${dragging ? " dragging" : ""}`} aria-hidden={!open} role="region" aria-label="Records">
      <div className="drawer-head">
        <strong>Records</strong>
        <span>{records.length} printing{excluded ? ` · ${excluded} excluded` : ""} — tap one to preview. Drag a cell onto the template to add it as linked text.</span>
        <button className="icon-button" aria-label="Close records" onClick={onClose}><ChevronDown size={17} /></button>
      </div>
      <div className="drawer-scroll" ref={scroller} onScroll={(e) => setTop(e.currentTarget.scrollTop)} data-scroll>
        <table className="drawer-table">
          <thead><tr><th className="num">#</th>{fields.map((f) => <th key={f}>{prettyField(f)}</th>)}</tr></thead>
          <tbody>
            {start > 0 && <tr aria-hidden style={{ height: start * ROW }}><td colSpan={fields.length + 1} /></tr>}
            {records.slice(start, end).map((record, i) => {
              const index = start + i;
              return (
                <tr key={index} className={index === current ? "current" : ""} style={{ height: ROW }} onClick={() => { if (!justDragged()) onPick(index); }}>
                  <td className="num">{index + 1}</td>
                  {fields.map((f) => (
                    <td key={f} className="cell-drag" onPointerDown={(e) => onCellPointerDown(f, e)} title={`Drag onto the template to add ${prettyField(f)}`}>
                      <span>{record[f] ?? ""}</span>{index === current && f === fields[0] && <GripVertical size={11} className="grip" />}
                    </td>
                  ))}
                </tr>
              );
            })}
            {end < records.length && <tr aria-hidden style={{ height: (records.length - end) * ROW }}><td colSpan={fields.length + 1} /></tr>}
          </tbody>
        </table>
        {!records.length && <p className="empty-note" style={{ padding: 24, textAlign: "center" }}>No records are set to print. Turn some on in the Data tab.</p>}
      </div>
    </div>
  );
}
