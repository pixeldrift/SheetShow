import { useEffect, useId, useState } from "react";
import type { DesignItem, RecordMeta, RecordRow } from "../types";
import { useImages } from "./ImageContext";
import { cornerRadii, isUniform, paddingsOf, roundedRectPath, type Radii } from "../lib/shape";
import { fieldDisplayName } from "../lib/data";
import { PX_PER_IN, valueFor } from "../lib/data";
import { fontStack } from "../lib/fonts";
import { layoutText, spacingPx, type TextLayout } from "../lib/text";
import { ImageFxFilter, hasImageFx } from "./ImageFxFilter";

type Props = {
  item: DesignItem;
  record: RecordRow;
  meta: RecordMeta;
  /** Editor only: how to draw the selection outline. "primary" = the single selected item, "member" = one of several. */
  outline?: "primary" | "member";
  /** Editor zoom, so outlines keep a constant on-screen thickness. */
  zoom?: number;
  /** Page layout's edit mode: the item can be clicked (via its slot) even though it has no pointer handler. */
  interactive?: boolean;
  /** Editor only: show linked text as {field} instead of the record's value, to see at a glance what is variable. */
  raw?: boolean;
  /** Editor only: mark selected text that is linked to the data with a small database icon. */
  badge?: boolean;
  /** This item has hand edits on this record's copy. */
  overridden?: boolean;
  /** Set for the editable canvas; omitted for thumbnails and print output. */
  onPointerDown?: (event: React.PointerEvent<SVGGElement>) => void;
};

/**
 * Lays an item out. `frame` is the box shown to the user (outline, handles, rotation centre): the item's own box,
 * grown to cover wrapped text that runs past it, unless auto-fit is keeping the text inside.
 */
/** What a linked text shows in "field names" view: {name}. Static text (including your own {merge} fields) stays as typed. */
const rawText = (item: DesignItem) => (item.field ? `{{${item.field.startsWith("__") ? fieldDisplayName(item.field) : item.field}}}` : item.text ?? "");

/** Text that gets its words from the data: a linked field, or your own wording with {{fields}} in it. */
export const isLinked = (item: DesignItem) => item.type === "text" && (!!item.field || /\{\{/.test(item.text ?? ""));

function layoutItem(source: DesignItem, record: RecordRow, meta: RecordMeta, raw = false) {
  const w = source.w * PX_PER_IN;
  const boxH = source.h * PX_PER_IN;
  if (source.type !== "text") return { item: source, w, boxH, h: boxH, fontSize: 0, lines: [] as string[], issue: null as TextLayout["issue"] };
  // The {{field names}} view is longer than most values (a two-digit page number is {{Page number}}): show it on one line,
  // clipped to the box, so a narrow box stays narrow and tidy.
  const effective: DesignItem = raw && isLinked(source) ? { ...source, wrap: false, autoFit: "off", overflow: "clip" } : source;
  const layout = layoutText(effective, raw ? rawText(source) : valueFor(source, record, meta), w, boxH);
  // Without auto-fit or truncation, wrapped text can run past the box, so the frame grows to cover it.
  const expands = (effective.autoFit ?? "off") === "off" && (effective.overflow ?? "spill") === "spill";
  const h = expands ? Math.max(boxH, layout.needH) : boxH;
  return { item: layout.item, w, boxH, h, fontSize: layout.fontPx, lines: layout.lines, issue: layout.issue };
}

/** The frame (px) the editor should draw handles and outlines on. */
export const itemFrame = (item: DesignItem, record: RecordRow, meta: RecordMeta, raw = false) => {
  const { w, h } = layoutItem(item, record, meta, raw);
  return { w, h };
};

const ACCENT = "#d77d4e";
export const OVERRIDE = "#7c5cdb"; // violet marks anything that has been hand-edited on one record
const PT = 96 / 72; // CSS px per point

/** Tries each URL in turn (a web source can fail, leaving a library fallback). */
function ImageLayer({ urls, w, h, fit, editor, label }: { urls: string[]; w: number; h: number; fit: "cover" | "contain"; editor: boolean; label: string }) {
  const [index, setIndex] = useState(0);
  const key = urls.join("\n");
  useEffect(() => setIndex(0), [key]);
  const url = urls[index];
  if (url) return <image href={url} width={w} height={h} preserveAspectRatio={fit === "contain" ? "xMidYMid meet" : "xMidYMid slice"} onError={() => setIndex((n) => n + 1)} />;
  if (!editor) return null; // missing pictures print blank; the editor shows a tile so you can see and fix them
  return (
    <g>
      <rect width={w} height={h} fill="#f1f1ec" />
      <path d={`M0 0L${w} ${h}M${w} 0L0 ${h}`} stroke="#dfe1d9" strokeWidth="1" />
      <text x={w / 2} y={h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(11, h / 3)} fontFamily="DM Sans, sans-serif" fill="#8f968d">{label}</text>
    </g>
  );
}

/** One design object as SVG, positioned in inches. Shared by the editor, page layout and print output. */
export function ItemShape({ item: source, record, meta, outline, zoom = 1, interactive, overridden, raw, badge, onPointerDown }: Props) {
  const images = useImages();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { item, w, boxH, h, fontSize, lines } = layoutItem(source, record, meta, raw);
  const lineStep = fontSize * (item.lineHeight ?? 1.2);
  const anchor = item.align === "center" ? "middle" : item.align === "right" ? "end" : "start";
  const [padT, padR, , padL] = item.type === "text" ? paddingsOf(item).map((v) => v * PX_PER_IN) : [0, 0, 0, 0];
  const textX = item.align === "center" ? padL + (w - padL - padR) / 2 : item.align === "right" ? w - padR : padL;
  const rotate = item.rotation ? ` rotate(${item.rotation} ${w / 2} ${h / 2})` : "";
  const editor = !!onPointerDown || !!interactive;

  // Frame: drawn inside the box so it never pushes past the item's edges. Rectangles keep their legacy 1px outline.
  const hasStroke = !!item.stroke && item.stroke !== "none";
  const strokePx = hasStroke ? (item.strokeWidth !== undefined ? item.strokeWidth * PT : item.type === "rect" ? 1 : PT) : 0;
  // Text boxes can have a background and frame too; they follow the text's own frame height.
  const shapeH = item.type === "text" ? h : boxH;
  const radii = cornerRadii(item, w, shapeH);
  const uniform = isUniform(radii);
  /** The item's outline inset by `inset` px, with corners rounded to match. */
  const outlineShape = (inset: number, extra: Record<string, unknown>) => {
    const inner = radii.map((r) => Math.max(0, r - inset)) as Radii;
    return uniform
      ? <rect x={inset} y={inset} width={Math.max(0, w - 2 * inset)} height={Math.max(0, shapeH - 2 * inset)} rx={inner[0]} {...extra} />
      : <path d={roundedRectPath(inset, inset, Math.max(0, w - 2 * inset), Math.max(0, shapeH - 2 * inset), inner)} {...extra} />;
  };

  let urls: string[] = [];
  let missingLabel = "Picture";
  if (item.type === "image") {
    if (item.imageSource && raw) {
      missingLabel = item.imageSource.mode === "column" ? `{{${item.imageSource.column}}}` : item.imageSource.pattern;
    } else if (item.imageSource) {
      const match = images.resolver.resolve(item, record);
      urls = [match, ...match.alternates].filter((m) => m.kind !== "none").map((m) => m.url ?? images.urlFor(m.asset?.id)).filter((u): u is string => !!u);
      if (!urls.length) { const fallback = images.urlFor(item.fallbackAssetId); if (fallback) urls = [fallback]; }
      missingLabel = match.candidate ? `No match: ${match.candidate.slice(0, 28)}` : "Data-driven picture";
    } else if (item.assetId) urls = [images.urlFor(item.assetId)].filter((u): u is string => !!u);
    else if (item.src) urls = [item.src];
  }

  const shadow = item.shadow;
  return (
    <g
      data-item-id={item.id}
      transform={`translate(${item.x * PX_PER_IN} ${item.y * PX_PER_IN})${rotate}`}
      className={editor ? (item.locked ? "canvas-object locked" : "canvas-object") : undefined}
      onPointerDown={onPointerDown}
    >
      {(shadow || item.type === "image" || (item.type === "text" && item.overflow === "clip")) && (
        <defs>
          {shadow && <filter id={`${uid}s`} x="-60%" y="-60%" width="220%" height="220%" colorInterpolationFilters="sRGB"><feDropShadow dx={shadow.x * PT} dy={shadow.y * PT} stdDeviation={Math.max(0, shadow.blur * PT) / 2} floodColor={shadow.color} floodOpacity={shadow.opacity} /></filter>}
          {item.type === "image" && <clipPath id={`${uid}c`}>{outlineShape(0, {})}</clipPath>}
          {item.type === "image" && hasImageFx(item.imageFx) && <ImageFxFilter id={`${uid}fx`} fx={item.imageFx!} />}
          {item.type === "text" && item.overflow === "clip" && <clipPath id={`${uid}t`}><rect width={w} height={boxH} /></clipPath>}
        </defs>
      )}
      <g opacity={(item.opacity ?? 1) * (source._ruleHidden ? 0.22 : 1)} filter={shadow ? `url(#${uid}s)` : undefined}>
        {item.type === "rect" && outlineShape(strokePx / 2, { fill: item.fill ?? "#e9eee9", stroke: hasStroke ? item.stroke : "none", strokeWidth: strokePx })}
        {item.type === "image" && (
          <>
            <g clipPath={`url(#${uid}c)`}><g filter={hasImageFx(item.imageFx) ? `url(#${uid}fx)` : undefined}><ImageLayer urls={urls} w={w} h={boxH} fit={item.imageFit ?? "cover"} editor={editor} label={missingLabel} /></g></g>
            {strokePx > 0 && outlineShape(strokePx / 2, { fill: "none", stroke: item.stroke, strokeWidth: strokePx, pointerEvents: "none" })}
          </>
        )}
        {item.type === "text" && (
          <>
            {(item.fill || hasStroke) && outlineShape(strokePx / 2, { fill: item.fill ?? "none", stroke: hasStroke ? item.stroke : "none", strokeWidth: strokePx })}
            {/* Invisible hit area so thin text is easy to grab with a finger. */}
            {editor && <rect width={w} height={h} fill="transparent" />}
            <g clipPath={item.overflow === "clip" ? `url(#${uid}t)` : undefined}><text x={textX} y={padT + fontSize * 1.15} fontFamily={fontStack(item.fontFamily)} fontStyle={item.italic ? "italic" : "normal"} letterSpacing={item.letterSpacing ? spacingPx(item) : undefined} style={item.kerning === false ? { fontKerning: "none" } : undefined} textDecoration={item.underline ? "underline" : undefined} fontSize={fontSize} fontWeight={item.weight ?? 500} fill={item.color ?? "#34443d"} textAnchor={anchor}
              {...(item.textStroke ? { stroke: item.textStroke.color, strokeWidth: item.textStroke.width * 2 * PT, paintOrder: "stroke", strokeLinejoin: "round" as const } : {})}>
              {lines.map((line, i) => <tspan key={i} x={textX} dy={i === 0 ? 0 : lineStep}>{line || "\u00a0"}</tspan>)}
            </text></g>
          </>
        )}
      </g>
      {badge && outline && isLinked(source) && (() => {
        const s = 14 / zoom;
        return (
          <g transform={`translate(${-s * 0.5} ${-s * 0.5}) scale(${s / 24})`} pointerEvents="none">
            <title>Linked to your data</title>
            <rect width="24" height="24" rx="6" fill="#eef3ec" stroke="#8fa896" strokeWidth="1.6" />
            <g transform="translate(4.5 4.5) scale(.625)" fill="none" stroke="#4f6b58" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5" /><path d="M3 12a9 3 0 0 0 18 0" /></g>
          </g>
        );
      })()}
      {/* Outline sits exactly on the frame edge, so the resize handles (centred on the same edge) attach to it. */}
      {editor && !outline && <rect className="hover-outline" width={w} height={h} fill="none" stroke={ACCENT} strokeWidth={1 / zoom} pointerEvents="none" />}
      {source._ruleHidden && editor && <rect width={w} height={h} fill="none" stroke="#8f968d" strokeWidth={1 / zoom} strokeDasharray={`${3 / zoom} ${3 / zoom}`} pointerEvents="none" />}
      {overridden && !outline && <rect width={w} height={h} fill="none" stroke={OVERRIDE} strokeWidth={1.5 / zoom} strokeDasharray={`${4 / zoom} ${3 / zoom}`} pointerEvents="none" />}
      {outline && <rect width={w} height={h} fill="none" stroke={outline === "primary" && overridden ? OVERRIDE : ACCENT} strokeWidth={(outline === "primary" ? 1.5 : 1) / zoom} strokeOpacity={outline === "primary" ? 1 : 0.7} pointerEvents="none" />}
    </g>
  );
}

/** A full template rendered at natural size, clipped to its bounds. In page edit mode its items can be picked. */
export function TemplateThumbnail({ items, record, meta, width, height, interactive, selectedItemId, overriddenIds, zoom }: {
  items: DesignItem[]; record: RecordRow; meta: RecordMeta; width: number; height: number;
  interactive?: boolean; selectedItemId?: string | null; overriddenIds?: Set<string>; zoom?: number;
}) {
  return (
    <svg className="template-thumb" width={width * PX_PER_IN} height={height * PX_PER_IN} viewBox={`0 0 ${width * PX_PER_IN} ${height * PX_PER_IN}`}>
      {items.filter((item) => item.visible !== false && !item.reference).map((item) => (
        <ItemShape key={item.id} item={item} record={record} meta={meta} interactive={interactive} zoom={zoom}
          outline={interactive && selectedItemId === item.id ? "primary" : undefined} overridden={overriddenIds?.has(item.id)} />
      ))}
    </svg>
  );
}
