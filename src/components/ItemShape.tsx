import type { DesignItem, RecordMeta, RecordRow } from "../types";
import { PX_PER_IN, valueFor } from "../lib/data";
import { fontStack } from "../lib/fonts";
import { fontSizePx, layoutLines, textHeight, withAutoFit } from "../lib/text";

type Props = {
  item: DesignItem;
  record: RecordRow;
  meta: RecordMeta;
  selected?: boolean;
  /** Set for the editable canvas; omitted for thumbnails and print output. */
  onPointerDown?: (event: React.PointerEvent<SVGGElement>) => void;
};

/** One design object as SVG, positioned in inches. Shared by the editor, page layout and print output. */
export function ItemShape({ item: source, record, meta, selected, onPointerDown }: Props) {
  const w = source.w * PX_PER_IN;
  const boxH = source.h * PX_PER_IN;
  const text = source.type === "text" ? valueFor(source, record, meta) : "";
  // Auto-fit adjusts the font size so the text fills (or shrinks into) the box.
  const item = withAutoFit(source, text, w, boxH);
  const fontSize = fontSizePx(item);
  const lineStep = fontSize * (item.lineHeight ?? 1.2);
  const lines = item.type === "text" ? layoutLines(text, item, w) : [];
  const fitted = !!item.autoFit && item.autoFit !== "off";
  // Without auto-fit, wrapped text can run past the box, so the outline and grab area grow to cover it.
  const h = item.type === "text" && !fitted ? Math.max(boxH, textHeight(lines.length, fontSize, item.lineHeight ?? 1.2)) : boxH;
  const anchor = item.align === "center" ? "middle" : item.align === "right" ? "end" : "start";
  const textX = item.align === "center" ? w / 2 : item.align === "right" ? w : 0;
  const rotate = item.rotation ? ` rotate(${item.rotation} ${w / 2} ${boxH / 2})` : "";
  return (
    <g
      data-item-id={item.id}
      transform={`translate(${item.x * PX_PER_IN} ${item.y * PX_PER_IN})${rotate}`}
      className={onPointerDown ? (item.locked ? "canvas-object locked" : "canvas-object") : undefined}
      onPointerDown={onPointerDown}
    >
      {item.type === "rect" && <rect width={w} height={boxH} fill={item.fill ?? "#e9eee9"} stroke={item.stroke ?? "none"} strokeWidth="1" />}
      {item.type === "image" && item.src && <image href={item.src} width={w} height={boxH} preserveAspectRatio={item.imageFit === "contain" ? "xMidYMid meet" : "xMidYMid slice"} />}
      {item.type === "text" && (
        <>
          {/* Invisible hit area so thin text is easy to grab with a finger. */}
          {onPointerDown && <rect width={w} height={h} fill="transparent" />}
          <text x={textX} y={fontSize * 1.15} fontFamily={fontStack(item.fontFamily)} fontStyle={item.italic ? "italic" : "normal"} fontSize={fontSize} fontWeight={item.weight ?? 500} fill={item.color ?? "#34443d"} textAnchor={anchor}>
            {lines.map((line, i) => <tspan key={i} x={textX} dy={i === 0 ? 0 : lineStep}>{line || "\u00a0"}</tspan>)}
          </text>
        </>
      )}
      {selected && <rect x="-4" y="-4" width={w + 8} height={h + 8} fill="none" stroke="#d77d4e" strokeWidth="1.4" strokeDasharray="4 3" pointerEvents="none" />}
    </g>
  );
}

/** A full template rendered at natural size, clipped to its bounds. */
export function TemplateThumbnail({ items, record, meta, width, height }: { items: DesignItem[]; record: RecordRow; meta: RecordMeta; width: number; height: number }) {
  return (
    <svg className="template-thumb" width={width * PX_PER_IN} height={height * PX_PER_IN} viewBox={`0 0 ${width * PX_PER_IN} ${height * PX_PER_IN}`}>
      {items.filter((item) => item.visible !== false).map((item) => <ItemShape key={item.id} item={item} record={record} meta={meta} />)}
    </svg>
  );
}
