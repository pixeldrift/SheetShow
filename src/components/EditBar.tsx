import { Copy, Group, Redo2, Scissors, Trash2, Undo2, Ungroup } from "lucide-react";
import { GlueBottle } from "./icons";
import { Palette, type PaletteState } from "./Palette";

type Props = {
  canGroup: boolean; canUngroup: boolean; onGroup: () => void; onUngroup: () => void;
  hasSelection: boolean; canPaste: boolean; canUndo: boolean; canRedo: boolean;
  palette: PaletteState; onPalette: (state: PaletteState) => void; canDock: boolean;
  onUndo: () => void; onRedo: () => void; onDelete: () => void; onCut: () => void; onCopy: () => void; onPaste: () => void;
};

/** Floating edit actions at the bottom of the canvas. */
export function EditBar(p: Props) {
  const btn = (label: string, disabled: boolean, onClick: () => void, icon: React.ReactNode) => (
    <button className="tool-button" title={label} aria-label={label} disabled={disabled} onClick={onClick}>{icon}</button>
  );
  return (
    <Palette label="Edit tools" className="edit-bar" state={p.palette} onState={p.onPalette} canDock={p.canDock}>
      {btn("Undo (Ctrl+Z)", !p.canUndo, p.onUndo, <Undo2 size={16} />)}
      {btn("Redo (Ctrl+Shift+Z)", !p.canRedo, p.onRedo, <Redo2 size={16} />)}
      <span className="edit-divider" />
      {(p.canGroup || p.canUngroup) && (p.canGroup ? btn("Group (Ctrl+G)", false, p.onGroup, <Group size={16} />) : btn("Ungroup (Ctrl+Shift+G)", false, p.onUngroup, <Ungroup size={16} />))}
      {btn("Delete", !p.hasSelection, p.onDelete, <Trash2 size={16} />)}
      {btn("Cut", !p.hasSelection, p.onCut, <Scissors size={16} />)}
      {btn("Copy", !p.hasSelection, p.onCopy, <Copy size={16} />)}
      {btn("Paste", !p.canPaste, p.onPaste, <GlueBottle size={18} />)}
    </Palette>
  );
}
