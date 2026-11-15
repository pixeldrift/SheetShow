import { useRef, useState } from "react";
import { BoxSelect, ChevronDown, FileSearch, Grid2X2, ImagePlus, Magnet, PencilLine, Plus, Ruler, ScanLine, Square, Type } from "lucide-react";
import { MAX_ZOOM, MIN_ZOOM } from "./Viewport";
import { ZoomField } from "./ZoomField";
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
  onAddText: () => void; onAddShape: () => void; onAddImage: () => void; onAddReference: () => void;
  /** Tool palettes docked into this toolbar. */
  docked?: React.ReactNode;
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
      {p.workspace === "template" && (
        <>
          <div className="tool-group add-inline">
            <button className="tool-button" title="Add text" aria-label="Add text" onClick={p.onAddText}><Type size={16} /></button>
            <button className="tool-button" title="Add rectangle: then turn it into a text box or photo placeholder in Properties" aria-label="Add rectangle" onClick={p.onAddShape}><Square size={16} /></button>
            <button className="tool-button" title="Add image or PDF" aria-label="Add image or PDF" onClick={p.onAddImage}><ImagePlus size={16} /></button>
            <button className="tool-button" title="Add a reference image: a faded, locked guide at the bottom that never prints" aria-label="Add reference image" onClick={p.onAddReference}><ScanLine size={16} /></button>
          </div>
          <div className="tool-group add-collapsed">
            <button ref={shapesRef} className="tool-button with-caret" title="Add something to the template" aria-label="Add" aria-haspopup="menu" aria-expanded={!!shapesAt} onClick={() => (shapesAt ? setShapesAt(null) : openShapes())}>
              <Plus size={16} /><ChevronDown size={10} className="caret" />
            </button>
          </div>
          <div className="toolbar-divider" />
        </>
      )}
      {p.workspace === "layout" && (
        <>
          <button className="button mode-button toggle" aria-pressed={p.instanceMode} onClick={p.onInstanceMode} title="Override mode: click or double-click anything on a sheet to change just that record — edit a name, drop in a different photo, tweak a colour">
            <PencilLine size={15} /> Override
          </button>
          <div className="toolbar-divider" />
        </>
      )}
      <div className="tool-group">
        {p.workspace === "template" && toggle(p.multi, "Multi-select (tap items to add, drag to box-select)", p.onMulti, <BoxSelect size={15} />)}
        {toggle(p.showGrid, "Show grid", p.onGrid, <Grid2X2 size={15} />)}
        {toggle(p.showRulers, "Show rulers", p.onRulers, <Ruler size={15} />)}
        <span className="split-tool">
          {toggle(p.snap, "Smart snapping: line up with other objects, the page and guides (hold Ctrl/⌘ to move freely)", p.onSnap, <Magnet size={15} />)}
          <button ref={snapRef} className="tool-button split-caret" title="Choose what snaps" aria-label="Snapping options" aria-haspopup="menu" aria-expanded={!!snapAt} onClick={() => { const r = snapRef.current?.getBoundingClientRect(); setSnapAt(snapAt || !r ? null : { x: r.left, y: r.bottom + 6 }); }}><ChevronDown size={11} /></button>
        </span>
        {toggle(p.preview, "Print preview", p.onPreview, <FileSearch size={16} />)}
      </div>
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
              ["objects", "Other objects", "Edges and centres line up"],
              ["spacing", "Equal spacing", "Matching gaps between objects"],
              ["page", "Page", "Edges and centre of the template"],
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
            <button role="menuitem" onClick={choose(p.onAddShape)}><Square size={15} /> <span>Rectangle<small>Turn it into a text box or photo placeholder in Properties</small></span></button>
            <button role="menuitem" onClick={choose(p.onAddImage)}><ImagePlus size={15} /> <span>Image or PDF<small>From your library or a file</small></span></button>
            <button role="menuitem" onClick={choose(p.onAddReference)}><ScanLine size={15} /> <span>Reference image<small>A faded, locked guide that never prints</small></span></button>
          </div>
        </>
      )}
    </div>
  );
}
