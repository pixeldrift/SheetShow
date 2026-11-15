import { useEffect, useRef, useState } from "react";
import { ChevronDown, GripVertical } from "lucide-react";
import type { RecordRow } from "../types";
import { prettyField } from "../lib/data";
import { SortArrow, useColumnHeaders, type SortState } from "./columnDrag";

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
  /** Page view: which sheet each record prints on, so picking a record turns to its sheet and the current sheet's records are marked. */
  pageOf?: (index: number) => number;
  sort: SortState;
  onSort: (column: string, dir: 1 | -1) => void;
  onReorderColumn: (column: string, target: string, after: boolean) => void;
  currentPage?: number;
};

const ROW = 34;

/** A slide-up list of the records being previewed: scroll, tap a row to preview it, drag a cell onto the template. */
export function RecordsDrawer({ open, records, fields, current, excluded, onPick, onClose, onCellPointerDown, justDragged, dragging, pageOf, currentPage, sort, onSort, onReorderColumn }: Props) {
  const { headerProps } = useColumnHeaders((column) => onSort(column, sort?.column === column && sort.dir === 1 ? -1 : 1), onReorderColumn);
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
          <thead><tr><th className="num">#</th>{fields.map((f) => <th key={f} {...headerProps(f)} title="Click to sort · click again to reverse · drag to move the column">{prettyField(f)}<SortArrow sort={sort} column={f} /></th>)}</tr></thead>
          <tbody>
            {start > 0 && <tr aria-hidden style={{ height: start * ROW }}><td colSpan={fields.length + 1} /></tr>}
            {records.slice(start, end).map((record, i) => {
              const index = start + i;
              return (
                <tr key={index} className={`${index === current ? "current" : ""}${pageOf && pageOf(index) === currentPage ? " on-page" : ""}`} style={{ height: ROW }} onClick={() => { if (!justDragged()) onPick(index); }}>
                  <td className="num">{index + 1}{pageOf && <small className="sheet-no" title="The sheet this record prints on">s{pageOf(index) + 1}</small>}</td>
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
