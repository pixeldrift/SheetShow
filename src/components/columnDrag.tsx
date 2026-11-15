import { useState } from "react";

/**
 * Headers you can click (to sort) or drag (to reorder the columns). Shared by the Data tab and the records drawer.
 * A press that never moves is a click; a press that moves picks the column up, and the header under the pointer shows where it will land.
 */
export function useColumnHeaders(onClick: (column: string) => void, onReorder: (column: string, target: string, after: boolean) => void) {
  const [drag, setDrag] = useState<{ column: string; over: string | null; after: boolean } | null>(null);

  const press = (column: string) => (event: React.PointerEvent) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button, input")) return;
    const startX = event.clientX, startY = event.clientY;
    let moved = false;
    let last: { over: string | null; after: boolean } = { over: null, after: false };
    const find = (e: PointerEvent) => {
      const th = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-col-header]");
      if (!th) return { over: null, after: false };
      const rect = th.getBoundingClientRect();
      return { over: th.dataset.colHeader!, after: e.clientX > rect.left + rect.width / 2 };
    };
    const move = (e: PointerEvent) => {
      if (!moved && Math.hypot(e.clientX - startX, e.clientY - startY) < 6) return;
      if (!moved) document.body.classList.add("scrubbing");
      moved = true;
      last = find(e);
      setDrag({ column, ...last });
    };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      document.body.classList.remove("scrubbing");
      setDrag(null);
      if (!moved) onClick(column);
      else if (last.over && last.over !== column) onReorder(column, last.over, last.after);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  };

  /** Props for a header cell. */
  const headerProps = (column: string) => ({
    "data-col-header": column,
    onPointerDown: press(column),
    className: `sortable${drag?.column === column ? " col-dragging" : ""}${drag && drag.over === column && drag.column !== column ? (drag.after ? " drop-after" : " drop-before") : ""}`,
  });
  return { headerProps };
}

export type SortState = { column: string; dir: 1 | -1 } | null;
export const SortArrow = ({ sort, column }: { sort: SortState; column: string }) =>
  sort && sort.column === column ? <span className="sort-arrow" aria-label={sort.dir === 1 ? "sorted ascending" : "sorted descending"}>{sort.dir === 1 ? "▲" : "▼"}</span> : null;
