import { PX_PER_IN } from "../lib/data";

type Props = { axis: "x" | "y"; lengthIn: number; zoom: number; onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void; onDoubleClick: () => void };

/** Ruler along one edge of the page. Tick density adapts to zoom. */
export function Ruler({ axis, lengthIn, zoom, onPointerDown, onDoubleClick }: Props) {
  const ppi = PX_PER_IN * zoom;
  const minor = ppi >= 220 ? 0.125 : ppi >= 70 ? 0.25 : ppi >= 36 ? 0.5 : 1;
  const major = ppi >= 36 ? 1 : ppi >= 18 ? 2 : 5;
  const ticks: { at: number; isMajor: boolean }[] = [];
  for (let i = 0; i * minor <= lengthIn + 1e-6; i++) {
    const at = i * minor;
    ticks.push({ at, isMajor: Math.abs(at / major - Math.round(at / major)) < 1e-6 });
  }
  const size = lengthIn * ppi;
  const horizontal = axis === "x";
  return (
    <div
      className={`ruler ruler-${horizontal ? "top" : "left"}`}
      data-no-pan
      style={horizontal ? { width: size } : { height: size }}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      title={horizontal ? "Drag down to add a guide · double-click for template/page setup" : "Drag right to add a guide · double-click for template/page setup"}
    >
      {ticks.map(({ at, isMajor }) => (
        <i key={at} className={isMajor ? "tick major" : "tick"} style={horizontal ? { left: at * ppi } : { top: at * ppi }}>
          {isMajor && at > 0 ? <b>{at}</b> : null}
        </i>
      ))}
    </div>
  );
}
