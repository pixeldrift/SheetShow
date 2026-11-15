import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine } from "lucide-react";
import type { ArrangeMode } from "../lib/groups";
import { Palette, type PaletteState } from "./Palette";

type Props = { onArrange: (mode: ArrangeMode) => void; palette: PaletteState; onPalette: (state: PaletteState) => void; canDock: boolean };

/** Stacking order: front and back, or one step at a time. Shortcuts: Ctrl/⌘ + ] and [ (add Shift for all the way). */
export function ArrangeBar({ onArrange, palette, onPalette, canDock }: Props) {
  const btn = (label: string, mode: ArrangeMode, icon: React.ReactNode) => (
    <button className="tool-button" title={label} aria-label={label} onClick={() => onArrange(mode)}>{icon}</button>
  );
  return (
    <Palette label="Arrange tools" className="arrange-bar" state={palette} onState={onPalette} canDock={canDock}>
      {btn("Send to back (Ctrl/⌘+Shift+[)", "back", <ArrowDownToLine size={16} />)}
      {btn("Move backward (Ctrl/⌘+[)", "down", <ArrowDown size={16} />)}
      {btn("Move forward (Ctrl/⌘+])", "up", <ArrowUp size={16} />)}
      {btn("Bring to front (Ctrl/⌘+Shift+])", "front", <ArrowUpToLine size={16} />)}
    </Palette>
  );
}
