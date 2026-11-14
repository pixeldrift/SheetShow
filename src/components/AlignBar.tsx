import {
  AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalDistributeCenter,
  AlignStartHorizontal, AlignStartVertical, AlignVerticalDistributeCenter,
} from "lucide-react";
import type { AlignMode } from "../lib/align";

type Props = {
  /** How many separate things are selected (a group counts as one). One aligns to the template; several align to each other. */
  units: number;
  onAlign: (mode: AlignMode) => void;
  onDistribute: (axis: "x" | "y") => void;
};

/** Alignment is an action, so it lives on the canvas beside cut, copy and paste rather than in the properties. */
export function AlignBar({ units, onAlign, onDistribute }: Props) {
  const to = units > 1 ? "selection" : "template";
  const btn = (label: string, onClick: () => void, icon: React.ReactNode, disabled = false) => (
    <button className="tool-button" title={label} aria-label={label} disabled={disabled} onClick={onClick}>{icon}</button>
  );
  return (
    <div className="align-bar" data-no-pan role="toolbar" aria-label="Align">
      <span className="align-to" title={`Aligning to the ${to}`}>{units > 1 ? "Align" : "Align to page"}</span>
      {btn(`Align left (to the ${to})`, () => onAlign("left"), <AlignStartVertical size={16} />)}
      {btn(`Align centre horizontally (to the ${to})`, () => onAlign("center"), <AlignCenterVertical size={16} />)}
      {btn(`Align right (to the ${to})`, () => onAlign("right"), <AlignEndVertical size={16} />)}
      <span className="edit-divider" />
      {btn(`Align top (to the ${to})`, () => onAlign("top"), <AlignStartHorizontal size={16} />)}
      {btn(`Align centre vertically (to the ${to})`, () => onAlign("middle"), <AlignCenterHorizontal size={16} />)}
      {btn(`Align bottom (to the ${to})`, () => onAlign("bottom"), <AlignEndHorizontal size={16} />)}
      <span className="edit-divider" />
      {btn("Distribute horizontally (needs three or more)", () => onDistribute("x"), <AlignHorizontalDistributeCenter size={16} />, units < 3)}
      {btn("Distribute vertically (needs three or more)", () => onDistribute("y"), <AlignVerticalDistributeCenter size={16} />, units < 3)}
    </div>
  );
}
