import { BoxSelect, FileSearch, PencilLine, Grid2X2, ImagePlus, Magnet, Ruler, Shapes, Type, ZoomIn, ZoomOut } from "lucide-react";
import { MAX_ZOOM, MIN_ZOOM } from "./Viewport";

type Props = {
  workspace: "template" | "layout";
  instanceMode: boolean; onInstanceMode: () => void;
  showGrid: boolean; onGrid: () => void;
  showRulers: boolean; onRulers: () => void;
  snap: boolean; onSnap: () => void;
  preview: boolean; onPreview: () => void;
  zoom: number; onZoom: (zoom: number) => void; onZoomPreset: () => void;
  multi: boolean; onMulti: () => void;
  onAddText: () => void; onAddShape: () => void; onAddImage: () => void;
};

export function Toolbar(p: Props) {
  const toggle = (on: boolean, label: string, onClick: () => void, icon: React.ReactNode) => (
    <button className={on ? "tool-button active" : "tool-button"} title={label} aria-label={label} aria-pressed={on} onClick={onClick}>{icon}</button>
  );
  return (
    <div className="canvas-toolbar">
      {p.workspace === "template" && (
        <>
          <div className="tool-group">
            <button className="tool-button" title="Add text" aria-label="Add text" onClick={p.onAddText}><Type size={16} /></button>
            <button className="tool-button" title="Add shape" aria-label="Add shape" onClick={p.onAddShape}><Shapes size={16} /></button>
            <button className="tool-button" title="Add image or PDF" aria-label="Add image or PDF" onClick={p.onAddImage}><ImagePlus size={16} /></button>
          </div>
          <div className="toolbar-divider" />
        </>
      )}
      {p.workspace === "layout" && (
        <>
          <button className={p.instanceMode ? "button mode-button active" : "button mode-button"} aria-pressed={p.instanceMode} onClick={p.onInstanceMode} title="Click or double-click anything on a sheet to change just that record: edit a name, drop in a different photo, tweak a colour">
            <PencilLine size={15} /> Edit individual records
          </button>
          <div className="toolbar-divider" />
        </>
      )}
      <div className="tool-group">
        {p.workspace === "template" && toggle(p.multi, "Multi-select (tap items to add, drag to box-select)", p.onMulti, <BoxSelect size={15} />)}
        {toggle(p.showGrid, "Show grid", p.onGrid, <Grid2X2 size={15} />)}
        {toggle(p.showRulers, "Show rulers", p.onRulers, <Ruler size={15} />)}
        {toggle(p.snap, "Snap to grid and guides", p.onSnap, <Magnet size={15} />)}
        {toggle(p.preview, "Print preview", p.onPreview, <FileSearch size={16} />)}
      </div>
      <div className="toolbar-spacer" />
      <div className="zoom-control">
        <button className="tool-button" title="Zoom out" aria-label="Zoom out" onClick={() => p.onZoom(p.zoom / 1.25)}><ZoomOut size={15} /></button>
        <input aria-label="Zoom level" className="zoom-slider" type="range" min={Math.log(MIN_ZOOM)} max={Math.log(MAX_ZOOM)} step="0.01" value={Math.log(p.zoom)} onChange={(e) => p.onZoom(Math.exp(Number(e.target.value)))} />
        <button className="zoom-percent" onClick={p.onZoomPreset} title="Toggle fit-to-screen / 100% and re-centre">{Math.round(p.zoom * 100)}%</button>
        <button className="tool-button" title="Zoom in" aria-label="Zoom in" onClick={() => p.onZoom(p.zoom * 1.25)}><ZoomIn size={15} /></button>
      </div>
    </div>
  );
}
