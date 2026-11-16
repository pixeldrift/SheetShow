import { useState } from "react";
import { ChevronDown, ChevronsUpDown, Database, Eye, EyeOff, FileImage, Filter, Group, Hash, Lock, Square, Type, Unlock } from "lucide-react";
import type { DesignItem } from "../types";
import { fieldDisplayName } from "../lib/data";
import { isLinked } from "./ItemShape";

export const kindIcon = (item: DesignItem, size = 14) =>
  item.type === "text" ? (item.field?.startsWith("__") ? <Hash size={size} /> : <Type size={size} />) : item.type === "image" ? <FileImage size={size} /> : <Square size={size} />;
export const layerLabel = (item: DesignItem) => (item.field ? fieldDisplayName(item.field) : item.text || item.assetName || (item.type === "rect" ? "Shape" : "Item"));

type Props = {
  items: DesignItem[];
  selectedItems: DesignItem[];
  onSelect: (ids: string[]) => void;
  onUpdate: (id: string, patch: Partial<DesignItem>) => void;
  onUpdateMany: (ids: string[], patch: Partial<DesignItem>) => void;
  /** Drag-and-drop: put `id` above/below `targetId`. */
  onReorder: (id: string, targetId: string, above: boolean, asGroup: boolean) => void;
  /** Hand-editing one record's copy: groups aren't offered. */
  flat: boolean;
  /** Multi-select mode (the toolbar toggle): tapping a layer adds it to, or takes it out of, the selection. */
  multi?: boolean;
};

/** Every object in the design, front to back: select, show/hide, lock, and drag to restack. A global view, not a property of one object. */
export function LayersPanel({ items, selectedItems, onSelect, onUpdate, onUpdateMany, onReorder, flat: flatLayers, multi }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // Drag a layer by its grip: the row under the pointer shows a line where it will land.
  const [drag, setDrag] = useState<{ id: string; over: string; above: boolean } | null>(null);
  const dropClass = (rowId: string) => (drag && drag.over === rowId && drag.id !== rowId ? (drag.above ? " drop-above" : " drop-below") : "");
  const startDrag = (id: string, asGroup: boolean) => (event: React.PointerEvent) => {
    event.preventDefault(); event.stopPropagation();
    const target = (e: PointerEvent) => {
      const row = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-layer-id]");
      if (!row) return null;
      const rect = row.getBoundingClientRect();
      return { over: row.dataset.layerId!, above: e.clientY < rect.top + rect.height / 2 };
    };
    document.body.classList.add("scrubbing");
    let last: { over: string; above: boolean } | null = null;
    const move = (e: PointerEvent) => { last = target(e); setDrag(last ? { id, ...last } : null); };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      document.body.classList.remove("scrubbing");
      setDrag(null);
      // The list is drawn top (front) to bottom (back), so "above" in the list means later in the stacking order.
      if (last && last.over !== id) onReorder(id, last.over, last.above, asGroup);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  };

  return (
    <div className="layer-list">
      {(() => {
        const pick = (ids: string[], e: React.MouseEvent) => { if (multi || e.shiftKey || e.metaKey || e.ctrlKey) { const have = selectedItems.map((x) => x.id); onSelect(ids.every((id) => have.includes(id)) ? have.filter((id) => !ids.includes(id)) : [...new Set([...have, ...ids])]); } else { onSelect(ids); } };
        const itemRow = (item: DesignItem, indented: boolean) => (
          <div key={item.id} data-layer-id={item.id} className={`${selectedItems.some((x) => x.id === item.id) ? "layer-row selected" : "layer-row"}${indented ? " nested" : ""}${dropClass(item.id)}`} onClick={(e) => pick([item.id], e)}>
            <span className="layer-kind">{kindIcon(item, 13)}</span>
            <span className="layer-label">{layerLabel(item)}{isLinked(item) ? <Database size={11} className="layer-linked" aria-label="Linked to your data" /> : null}{item.reference ? <em className="ref-tag">reference</em> : null}{item.rules?.length ? <Filter size={11} className="layer-rules" aria-label="Has conditional rules" /> : null}</span>
            <button className="mini-button" title={item.visible === false ? "Show" : "Hide"} onClick={(e) => { e.stopPropagation(); onUpdate(item.id, { visible: item.visible === false }); }}>{item.visible === false ? <EyeOff size={13} /> : <Eye size={13} />}</button>
            <button className="mini-button" title={item.locked ? "Unlock" : "Lock"} onClick={(e) => { e.stopPropagation(); onUpdate(item.id, { locked: !item.locked }); }}>{item.locked ? <Lock size={13} /> : <Unlock size={13} />}</button>
            <span className="layer-grip" title="Drag to change the stacking order" aria-label="Drag to reorder" role="button" onClick={(e) => e.stopPropagation()} onPointerDown={startDrag(item.id, false)}><ChevronsUpDown size={14} /></span>
          </div>
        );
        const rows: React.ReactNode[] = [];
        const seen = new Set<string>();
        for (const item of [...items].reverse()) {
          if (!item.groupId || flatLayers) { rows.push(itemRow(item, false)); continue; }
          if (seen.has(item.groupId)) continue;
          seen.add(item.groupId);
          const members = [...items].reverse().filter((m) => m.groupId === item.groupId);
          const ids = members.map((m) => m.id);
          const open = !collapsed.has(item.groupId);
          const allHidden = members.every((m) => m.visible === false), allLocked = members.every((m) => m.locked);
          rows.push(
            <div key={`g-${item.groupId}`} data-layer-id={ids[0]} className={`${ids.every((id) => selectedItems.some((x) => x.id === id)) ? "layer-row group selected" : "layer-row group"}${dropClass(ids[0])}`} onClick={(e) => pick(ids, e)}>
              <button className="mini-button chev" aria-label={open ? "Collapse group" : "Expand group"} onClick={(e) => { e.stopPropagation(); setCollapsed((c) => { const n = new Set(c); if (n.has(item.groupId!)) n.delete(item.groupId!); else n.add(item.groupId!); return n; }); }}><ChevronDown size={13} style={{ transform: open ? undefined : "rotate(-90deg)" }} /></button>
              <span className="layer-kind"><Group size={13} /></span>
              <span className="layer-label">{item.groupName ?? "Group"} <em>{members.length}</em></span>
              <button className="mini-button" title={allHidden ? "Show group" : "Hide group"} onClick={(e) => { e.stopPropagation(); onUpdateMany(ids, { visible: allHidden }); }}>{allHidden ? <EyeOff size={13} /> : <Eye size={13} />}</button>
              <button className="mini-button" title={allLocked ? "Unlock group" : "Lock group"} onClick={(e) => { e.stopPropagation(); onUpdateMany(ids, { locked: !allLocked }); }}>{allLocked ? <Lock size={13} /> : <Unlock size={13} />}</button>
              <span className="layer-grip" title="Drag to change the stacking order" aria-label="Drag group to reorder" role="button" onClick={(e) => e.stopPropagation()} onPointerDown={startDrag(ids[0], true)}><ChevronsUpDown size={14} /></span>
            </div>,
          );
          if (open) members.forEach((m) => rows.push(itemRow(m, true)));
        }
        return rows;
      })()}
      {!items.length && <p className="empty-note">Nothing on this template yet.</p>}
    </div>
  );
}
