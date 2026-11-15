import { useRef, type ReactNode } from "react";
import { GripVertical, Pin } from "lucide-react";

export type PaletteState = { docked: boolean; x?: number; y?: number };

type Props = {
  label: string;
  /** The class that gives the floating version its look and default spot. */
  className: string;
  state: PaletteState;
  onState: (state: PaletteState) => void;
  /** Docking onto the top toolbar needs room, so it is offered on wide screens only. */
  canDock: boolean;
  children: ReactNode;
};

/**
 * A group of tools you can move. Floating, it sits on the canvas and can be dragged anywhere by its handle; docked, it
 * lives in the top toolbar and the divider before it is the handle: drag it down onto the canvas to float it, or drag a
 * floating palette up into the toolbar (or press the pin) to dock it again.
 */
export function Palette({ label, className, state, onState, canDock, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const docked = state.docked && canDock;

  const startDrag = (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const el = ref.current, frame = document.querySelector<HTMLElement>(".canvas-frame");
    if (!el || !frame) return;
    const box = el.getBoundingClientRect();
    const grab = docked ? { x: 24, y: 16 } : { x: event.clientX - box.left, y: event.clientY - box.top };
    const startX = event.clientX, startY = event.clientY;
    let moved = false;
    document.body.classList.add("scrubbing");
    const place = (e: PointerEvent) => {
      const f = frame.getBoundingClientRect();
      const x = Math.min(f.width - 60, Math.max(-box.width + 60, e.clientX - f.left - grab.x));
      const y = Math.min(f.height - 30, Math.max(0, e.clientY - f.top - grab.y));
      return { x: Math.round(x), y: Math.round(y) };
    };
    const move = (e: PointerEvent) => {
      if (!moved && Math.hypot(e.clientX - startX, e.clientY - startY) < 5) return;
      moved = true;
      onState({ docked: false, ...place(e) });
    };
    const up = (e: PointerEvent) => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      document.body.classList.remove("scrubbing");
      const bar = document.querySelector<HTMLElement>(".canvas-toolbar");
      if (moved && canDock && bar && e.clientY < bar.getBoundingClientRect().bottom + 28) onState({ docked: true });
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  };

  if (docked) {
    return (
      <div ref={ref} className="palette docked" role="toolbar" aria-label={label}>
        <span className="palette-grip docked" onPointerDown={startDrag} title={`Drag ${label.toLowerCase()} onto the canvas to float it`} aria-hidden />
        {children}
      </div>
    );
  }
  const placed = state.x !== undefined && state.y !== undefined;
  return (
    <div ref={ref} className={`${className} palette floating`} role="toolbar" aria-label={label} data-no-pan style={placed ? { left: state.x, top: state.y, bottom: "auto", transform: "none" } : undefined}>
      <span className="palette-grip" onPointerDown={startDrag} title={`Drag to move ${label.toLowerCase()}${canDock ? "; drop it on the toolbar to dock it" : ""}`}><GripVertical size={14} /></span>
      {children}
      {canDock && <button className="tool-button palette-pin" title="Dock to the toolbar" aria-label={`Dock ${label} to the toolbar`} onClick={() => onState({ docked: true })}><Pin size={13} /></button>}
    </div>
  );
}

