import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, ClipboardPaste, Copy, Download, Sheet, Shrink, FilePlus2, Plus, Redo2, Search, Trash2, Undo2, Upload } from "lucide-react";
import type { RecordRow } from "../types";
import { prettyField } from "../lib/data";
import { ID, isIncluded } from "../lib/records";
import { parseGrid } from "../lib/importText";
import { SortArrow, useColumnHeaders, type SortState } from "./columnDrag";

const ROW_H = 38;
const MIN_COL = 64, MAX_COL = 600;
const WIDTHS_KEY = "sheetshow.columnWidths";
const loadWidths = (): Record<string, number> => { try { return JSON.parse(localStorage.getItem(WIDTHS_KEY) ?? "{}"); } catch { return {}; } };
const OVERSCAN = 8;

type Props = {
  rows: RecordRow[];
  columns: string[];
  fileName: string;
  canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void;
  onCell: (id: string, column: string, value: string) => void;
  onInclude: (ids: string[], included: boolean) => void;
  onOnly: (ids: string[]) => void;
  onAddRow: () => void;
  onDuplicate: (ids: string[]) => void;
  onDelete: (ids: string[]) => void;
  onAddColumn: () => void;
  onRenameColumn: (column: string) => void;
  onDeleteColumn: (column: string) => void;
  onSort: (column: string, direction: 1 | -1) => void;
  sort: SortState;
  onReorderColumn: (column: string, target: string, after: boolean) => void;
  onPaste: (id: string, column: string, grid: string[][]) => void;
  onImport: (file: File) => void;
  onExport: () => void;
  onPasteData: () => void;
  onGoogleSheet: () => void;
};

type Show = "all" | "included" | "excluded";

/** The data source as an editable table, with a per-row "print this record" switch. */
export function DataTable(p: Props) {
  const { rows, columns } = p;
  // Click a header to sort by it, click again to reverse; drag a header to move the column.
  const { headerProps } = useColumnHeaders((column) => p.onSort(column, p.sort?.column === column && p.sort.dir === 1 ? -1 : 1), p.onReorderColumn);
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<Show>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(600);
  const scroller = useRef<HTMLDivElement>(null);
  // Column widths: each starts as wide as its longest content (within reason); drag a header's right edge to change it,
  // double-tap the edge to fit it again. Long values are cut off with … and show in full when you edit the cell.
  const [custom, setCustom] = useState<Record<string, number>>(loadWidths);
  const fit = useMemo(() => {
    const ctx = document.createElement("canvas").getContext("2d");
    const text = (font: string, value: string) => { if (!ctx) return value.length * 7.5; ctx.font = font; return ctx.measureText(value).width; };
    const out: Record<string, number> = {};
    for (const column of columns) {
      let longest = ["", "", ""];
      for (const row of rows.slice(0, 500)) {
        const v = row[column] ?? "";
        if (v.length > longest[2].length) longest = [...longest.slice(1), v].sort((a, b) => a.length - b.length);
      }
      const cell = Math.max(...longest.map((v) => text('13px "DM Sans", system-ui, sans-serif', v))) + 26;
      const head = text('700 10px "DM Sans", system-ui, sans-serif', prettyField(column).toUpperCase()) + prettyField(column).length * 0.6 + 46;
      out[column] = Math.round(Math.min(MAX_COL, Math.max(MIN_COL + 16, cell, head)));
    }
    return out;
  }, [p.fileName, columns.join("\u0001")]); // eslint-disable-line react-hooks/exhaustive-deps
  const widthOf = (column: string) => custom[column] ?? fit[column] ?? 140;
  const saveWidths = (next: Record<string, number>) => { setCustom(next); try { localStorage.setItem(WIDTHS_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ } };
  const fitColumns = () => saveWidths({});
  /** Squeeze every column so they all fit on screen at once, trimming the widest first. */
  const squeezeColumns = () => {
    const room = (scroller.current?.clientWidth ?? 800) - 44 - 46 - 4;
    const auto = columns.map((c) => fit[c] ?? 140);
    const total = auto.reduce((a, b) => a + b, 0);
    if (total <= room) { saveWidths({}); return; }
    const next: Record<string, number> = {};
    columns.forEach((c, i) => { next[c] = Math.max(MIN_COL, Math.floor(auto[i] * room / total)); });
    saveWidths(next);
  };
  const startResize = (column: string, event: React.PointerEvent) => {
    event.stopPropagation(); event.preventDefault();
    const startX = event.clientX, startW = widthOf(column);
    document.body.classList.add("scrubbing");
    const move = (e: PointerEvent) => setCustom((c) => ({ ...c, [column]: Math.round(Math.min(MAX_COL, Math.max(MIN_COL, startW + e.clientX - startX))) }));
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      document.body.classList.remove("scrubbing");
      setCustom((c) => { try { localStorage.setItem(WIDTHS_KEY, JSON.stringify(c)); } catch { /* storage unavailable */ } return c; });
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  };
  const refitOne = (column: string) => { const { [column]: _gone, ...rest } = custom; saveWidths(rest); };
  const tableWidth = 44 + 46 + columns.reduce((sum, c) => sum + widthOf(c), 0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeight(el.clientHeight));
    observer.observe(el);
    setHeight(el.clientHeight);
    return () => observer.disconnect();
  }, []);

  const rowNumber = useMemo(() => new Map(rows.map((r, i) => [r[ID], i + 1])), [rows]);
  const included = useMemo(() => rows.filter(isIncluded).length, [rows]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => (show === "all" || (show === "included") === isIncluded(row)) && (!q || columns.some((c) => (row[c] ?? "").toLowerCase().includes(q))));
  }, [rows, columns, query, show]);

  // Only the rows on screen are rendered, so very large files stay quick.
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const end = Math.min(visible.length, Math.ceil((scrollTop + height) / ROW_H) + OVERSCAN);
  const slice = visible.slice(start, end);
  const visibleIds = visible.map((r) => r[ID]);
  const allIncluded = visible.length > 0 && visible.every(isIncluded);
  const someIncluded = visible.some(isIncluded);
  const chosen = [...selected].filter((id) => rows.some((r) => r[ID] === id));

  const pickRow = (id: string, event: React.MouseEvent) => {
    const next = new Set(event.metaKey || event.ctrlKey ? selected : []);
    if (event.shiftKey && anchor) {
      const a = visibleIds.indexOf(anchor), b = visibleIds.indexOf(id);
      if (a >= 0 && b >= 0) for (const rid of visibleIds.slice(Math.min(a, b), Math.max(a, b) + 1)) next.add(rid);
    } else if (selected.has(id) && (event.metaKey || event.ctrlKey)) next.delete(id);
    else { next.add(id); setAnchor(id); }
    setSelected(next);
  };

  const focusCell = (rowId: string, column: string) =>
    scroller.current?.querySelector<HTMLInputElement>(`input[data-row="${rowId}"][data-col="${CSS.escape(column)}"]`)?.focus();

  const onKey = (event: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, column: string) => {
    if (event.key !== "Enter" && event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const next = visible[rowIndex + (event.key === "ArrowUp" || (event.key === "Enter" && event.shiftKey) ? -1 : 1)];
    if (next) focusCell(next[ID], column);
  };

  const onPaste = (event: React.ClipboardEvent<HTMLInputElement>, id: string, column: string) => {
    const text = event.clipboardData.getData("text");
    if (!/[\t\n]/.test(text.replace(/\n$/, ""))) return; // a single value pastes normally
    event.preventDefault();
    // Spreadsheets copy tab-separated cells, so a column is lines and a row is tabs. Quoted cells (with line breaks inside) are kept whole.
    const grid = parseGrid(text, "\t");
    if (grid.length) p.onPaste(id, column, grid);
  };

  return (
    <div className="data-view">
      <div className="data-toolbar">
        <div className="data-summary"><strong>{included}</strong> of {rows.length} records will print{included !== rows.length && <button className="link-button" onClick={() => p.onInclude(rows.map((r) => r[ID]), true)}>Include all</button>}</div>
        <div className="field-search data-search"><Search size={14} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search records…" aria-label="Search records" /></div>
        <select className="select data-filter" value={show} onChange={(e) => setShow(e.target.value as Show)} aria-label="Show records">
          <option value="all">All records</option><option value="included">Included only</option><option value="excluded">Excluded only</option>
        </select>
        <div className="tool-group">
          <button className="tool-button" title="Undo data edit" aria-label="Undo data edit" disabled={!p.canUndo} onClick={p.onUndo}><Undo2 size={16} /></button>
          <button className="tool-button" title="Redo data edit" aria-label="Redo data edit" disabled={!p.canRedo} onClick={p.onRedo}><Redo2 size={16} /></button>
        </div>
        <div className="tool-group">
          <button className="tool-button" title="Fit each column to its contents" aria-label="Fit columns to contents" onClick={fitColumns}><ArrowLeftRight size={16} /></button>
          <button className="tool-button" title="Squeeze the columns so they all fit on screen (long values are cut off)" aria-label="Fit all columns on screen" onClick={squeezeColumns}><Shrink size={16} /></button>
        </div>
        <div className="tool-group">
          <button className="button" onClick={p.onAddRow}><Plus size={15} /> Row</button>
          <button className="button" onClick={p.onAddColumn}><FilePlus2 size={15} /> Column</button>
          <button className="tool-button" title="Open another CSV…" aria-label="Open another CSV" onClick={() => fileRef.current?.click()}><Upload size={16} /></button>
          <button className="tool-button" title="Paste data copied from a spreadsheet…" aria-label="Paste data" onClick={p.onPasteData}><ClipboardPaste size={16} /></button>
          <button className="tool-button" title="Import from Google Sheets…" aria-label="Import from Google Sheets" onClick={p.onGoogleSheet}><Sheet size={16} /></button>
          <button className="tool-button" title="Export CSV" aria-label="Export CSV" onClick={p.onExport}><Download size={16} /></button>
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onImport(f); e.target.value = ""; }} />
        </div>
      </div>

      {chosen.length > 0 && (
        <div className="bulk-bar" role="toolbar" aria-label="Selected records">
          <strong>{chosen.length} selected</strong>
          <button className="button" onClick={() => p.onInclude(chosen, true)}>Include</button>
          <button className="button" onClick={() => p.onInclude(chosen, false)}>Exclude</button>
          <button className="button" title="Include only these and exclude everything else" onClick={() => p.onOnly(chosen)}>Only these</button>
          <button className="button" onClick={() => p.onDuplicate(chosen)}><Copy size={14} /> Duplicate</button>
          <button className="button danger" onClick={() => { if (chosen.length < 2 || window.confirm(`Delete ${chosen.length} records?`)) { p.onDelete(chosen); setSelected(new Set()); } }}><Trash2 size={14} /> Delete</button>
          <button className="link-button" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      <div className="table-scroll" ref={scroller} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)} data-scroll>
        <table className="data-table" style={{ width: tableWidth }}>
          <colgroup><col style={{ width: 44 }} /><col style={{ width: 46 }} />{columns.map((c) => <col key={c} style={{ width: widthOf(c) }} />)}</colgroup>
          <thead>
            <tr>
              <th className="col-include" title="Include in print"><input type="checkbox" aria-label="Include all shown records" checked={allIncluded} ref={(el) => { if (el) el.indeterminate = !allIncluded && someIncluded; }} onChange={() => p.onInclude(visibleIds, !allIncluded)} /></th>
              <th className="col-num">#</th>
              {columns.map((column) => (
                <th key={column} {...headerProps(column)} title="Click to sort · click again to reverse · drag to move the column">
                  <div className="th-inner"><span title={column}>{prettyField(column)}<SortArrow sort={p.sort} column={column} /></span><button className="mini-button" aria-label={`Column options for ${column}`} onClick={() => setMenu(menu === column ? null : column)}>⋯</button></div>
                  <span className="col-resize" role="separator" aria-orientation="vertical" aria-label={`Resize ${column}`} title="Drag to change the width · double-tap to fit" onPointerDown={(e) => startResize(column, e)} onDoubleClick={() => refitOne(column)} />
                  {menu === column && (
                    <>
                      <div className="menu-scrim" onClick={() => setMenu(null)} />
                      <div className="menu col-menu" role="menu">
                        <button role="menuitem" onClick={() => { setMenu(null); p.onRenameColumn(column); }}>Rename…</button>
                        <button role="menuitem" onClick={() => { setMenu(null); refitOne(column); }}>Fit width to contents</button>
                        <button role="menuitem" onClick={() => { setMenu(null); p.onSort(column, 1); }}>Sort A → Z</button>
                        <button role="menuitem" onClick={() => { setMenu(null); p.onSort(column, -1); }}>Sort Z → A</button>
                        <button role="menuitem" className="danger" onClick={() => { setMenu(null); p.onDeleteColumn(column); }}>Delete column</button>
                      </div>
                    </>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {start > 0 && <tr aria-hidden style={{ height: start * ROW_H }}><td colSpan={columns.length + 2} /></tr>}
            {slice.map((row, i) => {
              const id = row[ID], on = isIncluded(row);
              return (
                <tr key={id} className={`${on ? "" : "excluded"}${selected.has(id) ? " selected" : ""}`} style={{ height: ROW_H }}>
                  <td className="col-include"><input type="checkbox" aria-label="Include in print" checked={on} onChange={() => p.onInclude([id], !on)} /></td>
                  <td className="col-num" onClick={(e) => pickRow(id, e)} title="Click to select · Shift/Ctrl-click for more">{rowNumber.get(id)}</td>
                  {columns.map((column) => (
                    <td key={column}><input className="cell" data-row={id} data-col={column} value={row[column] ?? ""} onChange={(e) => p.onCell(id, column, e.target.value)} onKeyDown={(e) => onKey(e, start + i, column)} onPaste={(e) => onPaste(e, id, column)} aria-label={`${prettyField(column)}, row ${rowNumber.get(id)}`} /></td>
                  ))}
                </tr>
              );
            })}
            {end < visible.length && <tr aria-hidden style={{ height: (visible.length - end) * ROW_H }}><td colSpan={columns.length + 2} /></tr>}
          </tbody>
        </table>
        {visible.length === 0 && <p className="empty-note table-empty">{rows.length ? "No records match." : "No records yet."}</p>}
      </div>
    </div>
  );
}
