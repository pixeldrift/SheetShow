import { useRef, useState } from "react";
import { SquareDashedMousePointer, ChevronDown, FileSearch, FileText, LayoutGrid, Rows3, Grid2X2, Image as ImageIcon, Magnet, PencilLine, Plus, Route, Ruler, Type } from "lucide-react";
import { MAX_ZOOM, MIN_ZOOM } from "./Viewport";
import { ZoomField } from "./ZoomField";
import { ReferenceImageIcon, ShapesIcon } from "./icons";
import type { SnapOptions } from "../lib/smartSnap";

type Props = {
  workspace: "template" | "layout";
  /** Override mode (page layout): change just one record's copy of the template. */
  instanceMode: boolean; onInstanceMode: () => void;
  showGrid: boolean; onGrid: () => void;
  showRulers: boolean; onRulers: () => void;
  snap: boolean; onSnap: () => void;
  snapOptions: SnapOptions; onSnapOptions: (options: SnapOptions) => void;
  preview: boolean; onPreview: () => void;
  zoom: number; onZoom: (zoom: number) => void; onZoomPreset: () => void;
  multi: boolean; onMulti: () => void;
  /** Page layout: arrows from card to card in record order, and a quick way to add a card. */
  showOrder?: boolean; onShowOrder?: () => void; onAddCard?: () => void;
  onAddText: () => void; onAddShape: () => void; onAddImage: () => void; onAddReference: () => void;
  /** Tool palettes docked into this toolbar. */
  docked?: React.ReactNode;
  /** Page layout: show one sheet, every sheet in a scrolling column, or a grid of sheets. */
  pageView?: "single" | "scroll" | "grid"; onPageView?: (view: "single" | "scroll" | "grid") => void; pageCount?: number;
};

export function Toolbar(p: Props) {
  const [shapesAt, setShapesAt] = useState<{ x: number; y: number } | null>(null);
  const shapesRef = useRef<HTMLButtonElement>(null);
  const snapRef = useRef<HTMLButtonElement>(null);
  const [snapAt, setSnapAt] = useState<{ x: number; y: number } | null>(null);
  // Only the two persistent states (on / off) are drawn; hover and press feedback never linger after a tap.
  const toggle = (on: boolean, label: string, onClick: () => void, icon: React.ReactNode) => (
    <button className="tool-button toggle" title={label} aria-label={label} aria-pressed={on} onClick={onClick}>{icon}</button>
  );
  const openShapes = () => { const r = shapesRef.current?.getBoundingClientRect(); if (r) setShapesAt({ x: r.left, y: r.bottom + 6 }); };
  const choose = (action: () => void) => () => { setShapesAt(null); action(); };

  return (
    <div className="canvas-toolbar">
      {p.workspace === "layout" && p.onAddCard && (
        <>
          <div className="tool-group">
            <button className="tool-button" title="Add a card to the sheet: another copy of the template" aria-label="Add a card" onClick={p.onAddCard}><Plus size={16} /></button>
          </div>
          <div className="toolbar-divider" />
        </>
      )}
      {p.workspace === "template" && (
        <>
          <div className="tool-group add-inline">
            <button className="tool-button" title="Add text" aria-label="Add text" onClick={p.onAddText}><Type size={16} /></button>
            <button className="tool-button" title="Add a shape (a rectangle for now). Convert it to a text box or photo box in Properties" aria-label="Add rectangle" onClick={p.onAddShape}><ShapesIcon size={19} /></button>
            <button className="tool-button" title="Add image or PDF" aria-label="Add image or PDF" onClick={p.onAddImage}><ImageIcon size={16} /></button>
            <button className="tool-button" title="Add a reference image: a faded, locked guide at the bottom that never prints" aria-label="Add reference image" onClick={p.onAddReference}><ReferenceImageIcon size={16} /></button>
          </div>
          <div className="tool-group add-collapsed">
            <button ref={shapesRef} className="tool-button with-caret" title="Add something to the template" aria-label="Add" aria-haspopup="menu" aria-expanded={!!shapesAt} onClick={() => (shapesAt ? setShapesAt(null) : openShapes())}>
              <Plus size={16} /><ChevronDown size={10} className="caret" />
            </button>
          </div>
          <div className="toolbar-divider" />
        </>
      )}
      <div className="tool-group">
        {toggle(p.instanceMode, p.workspace === "layout" ? "Override mode: click or double-click anything on a sheet to change just that record — edit a name, drop in a different photo, tweak a color" : "Override mode: edits you make to the previewed record are kept for that record only; every other record keeps the template", p.onInstanceMode, <PencilLine size={15} />)}
        {p.workspace === "template" && toggle(p.multi, "Select several: tap objects to add or remove them, or drag on empty canvas to draw a selection box", p.onMulti, <SquareDashedMousePointer size={16} />)}
        {toggle(p.showGrid, "Show grid", p.onGrid, <Grid2X2 size={15} />)}
        {toggle(p.showRulers, "Show rulers", p.onRulers, <Ruler size={15} />)}
        <span className="split-tool">
          {toggle(p.snap, "Smart snapping: line up with other objects, the page and guides (hold Ctrl/⌘ to move freely)", p.onSnap, <Magnet size={15} />)}
          <button ref={snapRef} className="tool-button split-caret" title="Choose what snaps" aria-label="Snapping options" aria-haspopup="menu" aria-expanded={!!snapAt} onClick={() => { const r = snapRef.current?.getBoundingClientRect(); setSnapAt(snapAt || !r ? null : { x: r.left, y: r.bottom + 6 }); }}><ChevronDown size={11} /></button>
        </span>
        {p.workspace === "layout" && p.onShowOrder && toggle(!!p.showOrder, "Show the order: thin arrows from card to card in the order their records come (dotted between copies of the same record)", p.onShowOrder, <Route size={16} />)}
        {toggle(p.preview, "Print preview", p.onPreview, <FileSearch size={16} />)}
      </div>
      {p.workspace === "layout" && p.onPageView && (
        <div className="seg-mini view-modes" role="group" aria-label="How sheets are shown">
          <button className={p.pageView === "single" ? "active" : ""} aria-pressed={p.pageView === "single"} title="One sheet at a time" aria-label="One sheet at a time" onClick={() => p.onPageView!("single")}><FileText size={14} /></button>
          <button className={p.pageView === "scroll" ? "active" : ""} aria-pressed={p.pageView === "scroll"} title="All sheets, scrolling down the page" aria-label="All sheets in a column" onClick={() => p.onPageView!("scroll")}><Rows3 size={14} /></button>
          <button className={p.pageView === "grid" ? "active" : ""} aria-pressed={p.pageView === "grid"} title="All sheets in a grid" aria-label="All sheets in a grid" onClick={() => p.onPageView!("grid")}><LayoutGrid size={14} /></button>
        </div>
      )}
      {p.docked}
      <div className="toolbar-spacer" />
      <div className="zoom-control">
        <input aria-label="Zoom level" className="zoom-slider" type="range" min={Math.log(MIN_ZOOM)} max={Math.log(MAX_ZOOM)} step="0.01" value={Math.log(p.zoom)} onChange={(e) => p.onZoom(Math.exp(Number(e.target.value)))} />
        <ZoomField zoom={p.zoom} onZoom={p.onZoom} onPreset={p.onZoomPreset} />
      </div>

      {snapAt && (
        <>
          <div className="menu-scrim" onClick={() => setSnapAt(null)} />
          <div className="menu snap-menu" role="menu" style={{ position: "fixed", left: Math.min(snapAt.x, window.innerWidth - 250), top: snapAt.y }}>
            <label className="snap-master"><input type="checkbox" checked={p.snap} onChange={p.onSnap} /> <span>Snapping<small>Master switch (the magnet)</small></span></label>
            {([
              ["objects", "Other objects", "Edges and centers line up"],
              ["spacing", "Equal spacing", "Matching gaps between objects"],
              ["page", "Page", "Edges and center of the template"],
              ["margins", "Margins", "The template's dashed safe area"],
              ["guides", "Guides", "Lines dragged from the rulers"],
              ["grid", "Grid", "Only while the grid is showing"],
            ] as const).map(([key, label, hint]) => (
              <label key={key} role="menuitemcheckbox" aria-checked={p.snapOptions[key]} className={p.snap ? undefined : "dim"}>
                <input type="checkbox" checked={p.snapOptions[key]} onChange={(e) => p.onSnapOptions({ ...p.snapOptions, [key]: e.target.checked })} /> <span>{label}<small>{hint}</small></span>
              </label>
            ))}
          </div>
        </>
      )}
      {shapesAt && (
        <>
          <div className="menu-scrim" onClick={() => setShapesAt(null)} />
          <div className="menu shapes-menu" role="menu" style={{ position: "fixed", left: Math.min(shapesAt.x, window.innerWidth - 220), top: shapesAt.y }}>
            <button role="menuitem" onClick={choose(p.onAddText)}><Type size={15} /> <span>Text<small>Typed or linked to a field</small></span></button>
            <button role="menuitem" onClick={choose(p.onAddShape)}><ShapesIcon size={15} /> <span>Shape<small>Turn it into a text box or photo placeholder in Properties</small></span></button>
            <button role="menuitem" onClick={choose(p.onAddImage)}><ImageIcon size={15} /> <span>Image or PDF<small>From your library or a file</small></span></button>
            <button role="menuitem" onClick={choose(p.onAddReference)}><ReferenceImageIcon size={15} /> <span>Reference image<small>A faded, locked guide that never prints</small></span></button>
          </div>
        </>
      )}
    </div>
  );
}
