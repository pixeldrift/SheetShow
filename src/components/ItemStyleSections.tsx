import { useMemo, useState } from "react";
import { ChevronRight, Circle, Droplets, Sparkles, X } from "lucide-react";
import type { DesignItem, RecordRow, Shadow } from "../types";
import type { ImageLibrary } from "../hooks/useImageLibrary";
import { TRANSFORM_NAMES, defaultImageSource, needsReview, patternFields } from "../lib/images";
import { prettyField } from "../lib/data";
import { convertRadius } from "../lib/shape";
import { NumberField, Pair, Section } from "./Fields";

type Patch = (patch: Partial<DesignItem>, key?: string) => void;

export type ImageTools = {
  library: ImageLibrary;
  columns: string[];
  /** The record currently being previewed. */
  record: RecordRow;
  records: RecordRow[];
  onChoose: (itemId: string, target: "asset" | "fallback") => void;
  onReview: (itemId: string) => void;
  /** Web addresses this picture would load that aren't saved in the library yet. */
  webCount: (item: DesignItem) => number;
  onCacheWeb: (itemId: string) => void;
  onCheckWeb: (itemId: string) => void;
};

/** Where a picture comes from: one library image, or a rule that finds each record's own image. */
export function PictureSection({ item, patch, tools }: { item: DesignItem; patch: Patch; tools: ImageTools }) {
  const { library, columns, record } = tools;
  const source = item.imageSource;
  const asset = library.resolver.assetById(item.assetId);
  const match = source ? library.resolver.resolve(item, record) : null;
  const webCount = useMemo(() => (source ? tools.webCount(item) : 0), [source, item, tools.records, library.resolver]); // eslint-disable-line react-hooks/exhaustive-deps
  // "Needs attention" count across all included records (cached by the resolver, so this is cheap after the first pass).
  const attention = useMemo(() => (source ? tools.records.filter((r) => needsReview(library.resolver.resolve(item, r))).length : 0), [source, item, tools.records, library.resolver]); // eslint-disable-line react-hooks/exhaustive-deps

  const useData = () => patch({ imageSource: defaultImageSource(columns) });
  const insertField = (field: string) => source?.mode === "pattern" && patch({ imageSource: { mode: "pattern", pattern: source.pattern + `{${field}}` } });

  return (
    <Section title="PICTURE">
      <div className="segmented" role="tablist">
        <button role="tab" aria-selected={!source} className={!source ? "active" : ""} onClick={() => patch({ imageSource: undefined })}>One picture</button>
        <button role="tab" aria-selected={!!source} className={source ? "active" : ""} onClick={() => !source && useData()}>From data</button>
      </div>

      {!source && (
        <div className="picture-row">
          <div className="picture-thumb">{item.src || asset ? <img src={item.src ?? library.urlFor(asset!.id)} alt="" /> : null}</div>
          <div className="picture-meta"><strong>{asset?.name ?? (item.src ? item.assetName ?? "Embedded picture" : "No picture")}</strong>
            <button className="link-button" onClick={() => tools.onChoose(item.id, "asset")}>{asset || item.src ? "Replace…" : "Choose…"}</button></div>
        </div>
      )}

      {source && (
        <>
          <Pair label="Find the picture using">
            <select className="select" value={source.mode} onChange={(e) => patch({ imageSource: e.target.value === "column" ? { mode: "column", column: columns.find((c) => /^(image|photo|picture|pic|img|file|filename)/i.test(c)) ?? columns[0] ?? "" } : { mode: "pattern", pattern: `{${columns[0] ?? "name"}}` } })}>
              <option value="pattern">A filename pattern</option><option value="column">A column with the filename or URL</option>
            </select>
          </Pair>
          {source.mode === "column" ? (
            <div className="spaced-block"><Pair label="Column"><select className="select" value={source.column} onChange={(e) => patch({ imageSource: { mode: "column", column: e.target.value } })}>{columns.map((c) => <option key={c} value={c}>{prettyField(c)}</option>)}</select></Pair></div>
          ) : (
            <div className="spaced-block">
              <Pair label="Pattern">
                <input className="property-input mono" value={source.pattern} spellCheck={false} onChange={(e) => patch({ imageSource: { mode: "pattern", pattern: e.target.value } }, `pattern:${item.id}`)} placeholder="{band}.jpg" />
              </Pair>
              <div className="chip-row">
                {columns.slice(0, 12).map((c) => <button key={c} className="field-chip" onClick={() => insertField(c)} title={`Insert {${c}}`}>+ {prettyField(c)}</button>)}
              </div>
              <p className="hint">Put fields in braces. Add transforms with a bar: <code>{"{name|lower}"}</code>, <code>{"{species|slug}"}</code>. Separate fallbacks with <code>||</code>. A web address works too: <code>https://example.com/{"{band}"}.jpg</code>. Transforms: {TRANSFORM_NAMES.join(", ")}.</p>
              {patternFields(source.pattern).some((f) => !columns.includes(f)) && <p className="hint warn">Unknown field: {patternFields(source.pattern).filter((f) => !columns.includes(f)).join(", ")}</p>}
            </div>
          )}

          {match && (
            <div className={`match-preview ${match.kind === "none" ? "bad" : match.kind === "fuzzy" ? "warn" : "ok"}`}>
              <div className="picture-thumb small">{(match.url ?? library.urlFor(match.asset?.id)) ? <img src={match.url ?? library.urlFor(match.asset?.id)} alt="" /> : null}</div>
              <div><strong>{match.kind === "none" ? "No match for this record" : match.kind === "fuzzy" ? "Best guess" : match.kind === "web" ? "Web picture" : "Found"}</strong>
                <small>{match.candidate || "nothing to look up"}{match.asset ? ` → ${match.asset.path}` : ""}</small></div>
            </div>
          )}
          <button className="button wide" onClick={() => tools.onReview(item.id)}>Review matches{attention ? ` (${attention} need attention)` : ""}…</button>
          {webCount > 0 && (
            <div className="web-block">
              <p className="hint first"><strong>{webCount}</strong> picture{webCount === 1 ? "" : "s"} load{webCount === 1 ? "s" : ""} from the web. Printing checks that they all load first.</p>
              <div className="icon-row">
                <button className="wide-icon" onClick={() => tools.onCheckWeb(item.id)}>Check links</button>
                <button className="wide-icon" onClick={() => tools.onCacheWeb(item.id)} title="Download them into the library so the project works offline">Save to library</button>
              </div>
            </div>
          )}

          <div className="picture-row spaced-block">
            <div className="picture-thumb small">{item.fallbackAssetId ? <img src={library.urlFor(item.fallbackAssetId)} alt="" /> : null}</div>
            <div className="picture-meta"><strong>Placeholder</strong><span><button className="link-button" onClick={() => tools.onChoose(item.id, "fallback")}>{item.fallbackAssetId ? "Change…" : "Choose…"}</button>{item.fallbackAssetId && <button className="link-button" onClick={() => patch({ fallbackAssetId: undefined })}>Remove</button>}</span></div>
          </div>
        </>
      )}

      <div className="spaced-block"><Pair label="Scale to box">
        <select className="select" value={item.imageFit ?? "cover"} onChange={(e) => patch({ imageFit: e.target.value as DesignItem["imageFit"] })}>
          <option value="cover">Fill box (crop edges)</option><option value="contain">Fit inside box (no crop)</option>
        </select>
      </Pair></div>
    </Section>
  );
}

/** Background, corner radius and frame: shared by shapes, pictures and text boxes. */
export function ShapeStyleSection({ item, patch }: { item: DesignItem; patch: Patch }) {
  const [corners, setCorners] = useState(!!item.radii);
  const hasStroke = !!item.stroke && item.stroke !== "none";
  const unit = item.radiusUnit ?? "pct";
  const sidePx = Math.min(item.w, item.h) * 96;
  const max = unit === "pct" ? 50 : Math.max(1, Math.floor(sidePx / 2));
  const radii = item.radii ?? ([item.radius ?? 0, item.radius ?? 0, item.radius ?? 0, item.radius ?? 0] as const);
  const mixed = !!item.radii && !item.radii.every((r) => r === item.radii![0]);
  const label = item.type === "image" ? "CORNERS & FRAME" : item.type === "text" ? "BOX & FRAME" : "APPEARANCE";
  const setUnit = (next: "pct" | "px") => {
    if (next === unit) return;
    patch({
      radiusUnit: next,
      radius: convertRadius(item.radius ?? 0, unit, next, sidePx),
      ...(item.radii ? { radii: item.radii.map((r) => convertRadius(r, unit, next, sidePx)) as [number, number, number, number] } : {}),
    });
  };
  const setCorner = (index: number, value: number) => { const next = [...radii] as [number, number, number, number]; next[index] = value; patch({ radii: next }); };
  const makeCircle = () => { const side = Math.min(item.w, item.h); patch({ radius: 50, radiusUnit: "pct", radii: undefined, w: side, h: side }); };
  const cornerNames = ["Top left", "Top right", "Bottom right", "Bottom left"];

  return (
    <Section title={label}>
      {(item.type === "rect" || item.type === "text") && (
        <div className="color-row first">
          <span>{item.type === "text" ? "Background" : "Fill color"}</span>
          <span className="inline-controls">
            {item.type === "text" && item.fill && <button className="mini-button" title="Remove background" aria-label="Remove background" onClick={() => patch({ fill: undefined })}><X size={13} /></button>}
            <input type="color" aria-label="Fill color" value={item.fill ?? (item.type === "text" ? "#ffffff" : "#e9eee9")} onChange={(e) => patch({ fill: e.target.value })} />
          </span>
        </div>
      )}

      {item.type === "text" && <div className="spaced-block"><Pair label="Padding"><NumberField value={item.padding ?? 0} min={0} max={2} step={0.01} places={2} unit="in" onChange={(n) => patch({ padding: n })} /></Pair></div>}

      <div className="radius-head">
        <span>Corner radius</span>
        <div className="seg-mini" role="group" aria-label="Radius unit">
          <button className={unit === "pct" ? "active" : ""} aria-pressed={unit === "pct"} onClick={() => setUnit("pct")}>%</button>
          <button className={unit === "px" ? "active" : ""} aria-pressed={unit === "px"} onClick={() => setUnit("px")}>px</button>
        </div>
      </div>
      <div className="radius-row">
        <input type="range" min="0" max={max} step={unit === "pct" ? 1 : 0.5} value={mixed ? 0 : Math.min(max, radii[0])} aria-label="Corner radius" onChange={(e) => patch({ radius: Number(e.target.value), radii: undefined })} />
        <NumberField value={mixed ? 0 : radii[0]} min={0} max={max} step={unit === "pct" ? 1 : 0.5} places={1} unit={unit === "pct" ? "%" : "px"} onChange={(n) => patch({ radius: n, radii: undefined })} />
      </div>
      {mixed && <p className="hint first">Corners differ. Move the slider to make them all the same.</p>}
      <button className="twirl" aria-expanded={corners} onClick={() => setCorners((o) => !o)}><ChevronRight size={12} style={{ transform: corners ? "rotate(90deg)" : undefined }} /> Individual corners</button>
      {corners && (
        <div className="corner-grid">
          {[0, 1, 3, 2].map((index) => (
            <Pair key={index} label={cornerNames[index]}><NumberField value={radii[index]} min={0} max={max} step={unit === "pct" ? 1 : 0.5} places={1} unit={unit === "pct" ? "%" : "px"} onChange={(n) => setCorner(index, n)} /></Pair>
          ))}
        </div>
      )}
      {item.type !== "text" && (
        <div className="icon-row spaced-block">
          <button className="wide-icon" onClick={makeCircle} title="Make it round: sets the shape square and the corners fully round"><Circle size={15} /> Circle</button>
          <button className="wide-icon" onClick={() => patch({ radius: 0, radii: undefined })}>Square corners</button>
        </div>
      )}

      {/* Frame colour and thickness share one line. */}
      <div className="frame-row">
        <span>Frame</span>
        <input type="color" aria-label="Frame color" value={hasStroke ? item.stroke! : "#ffffff"} onChange={(e) => patch({ stroke: e.target.value, strokeWidth: item.strokeWidth ?? 1.5 })} />
        {hasStroke ? (
          <>
            <NumberField value={item.strokeWidth ?? (item.type === "rect" ? 0.75 : 1)} min={0.25} max={40} step={0.25} places={2} unit="pt" onChange={(n) => patch({ strokeWidth: n })} />
            <button className="mini-button" title="Remove frame" aria-label="Remove frame" onClick={() => patch({ stroke: "none" })}><X size={13} /></button>
          </>
        ) : <span className="frame-none">none</span>}
      </div>
    </Section>
  );
}

const SHADOW: Shadow = { x: 0, y: 2, blur: 5, color: "#000000", opacity: 0.35 };
const GLOW: Shadow = { x: 0, y: 0, blur: 10, color: "#ffb347", opacity: 0.95 };

/** Opacity plus a drop shadow / glow (a glow is just a shadow with no offset). */
export function EffectsSection({ item, patch }: { item: DesignItem; patch: Patch }) {
  const shadow = item.shadow;
  const stroke = item.textStroke;
  const set = (change: Partial<Shadow>) => patch({ shadow: { ...(shadow ?? SHADOW), ...change } });
  return (
    <Section title="EFFECTS">
      {item.type === "text" && (
        <div className="outline-block">
          <div className="color-row first"><span>Text outline</span>
            <span className="inline-controls">
              {stroke && <button className="mini-button" title="Remove outline" aria-label="Remove outline" onClick={() => patch({ textStroke: undefined })}><X size={13} /></button>}
              <input type="color" aria-label="Outline color" value={stroke?.color ?? "#ffffff"} onChange={(e) => patch({ textStroke: { color: e.target.value, width: stroke?.width ?? 1.5 } })} />
            </span>
          </div>
          {stroke && <div className="spaced-block"><Pair label="Outline thickness"><NumberField value={stroke.width} min={0.25} max={20} step={0.25} places={2} unit="pt" onChange={(n) => patch({ textStroke: { color: stroke.color, width: n } })} /></Pair></div>}
          <div className="icon-row spaced-block">
            <button className="wide-icon" title="White outline: readable on dark pictures" onClick={() => patch({ textStroke: { color: "#ffffff", width: 2 } })}><span className="swatch" style={{ background: "#fff" }} /> White</button>
            <button className="wide-icon" title="Black outline: readable on light pictures" onClick={() => patch({ textStroke: { color: "#000000", width: 2 } })}><span className="swatch" style={{ background: "#000" }} /> Black</button>
          </div>
        </div>
      )}
      <div className="slider-row">
        <span>Opacity</span>
        <input type="range" min="0" max="100" step="1" value={Math.round((item.opacity ?? 1) * 100)} aria-label="Opacity" onChange={(e) => patch({ opacity: Number(e.target.value) / 100 })} />
        <output>{Math.round((item.opacity ?? 1) * 100)}%</output>
      </div>
      <div className="icon-row spaced-block">
        <button className={shadow && shadow.x === 0 && shadow.y === 0 ? "wide-icon" : "wide-icon active"} aria-pressed={!!shadow && !(shadow.x === 0 && shadow.y === 0)} onClick={() => patch({ shadow: SHADOW })}><Droplets size={15} /> Shadow</button>
        <button className={shadow && shadow.x === 0 && shadow.y === 0 ? "wide-icon active" : "wide-icon"} aria-pressed={!!shadow && shadow.x === 0 && shadow.y === 0} onClick={() => patch({ shadow: GLOW })}><Sparkles size={15} /> Glow</button>
        {shadow && <button className="wide-icon" onClick={() => patch({ shadow: undefined })}>None</button>}
      </div>
      {shadow && (
        <>
          <div className="two-col spaced">
            <Pair label="Offset X"><NumberField value={shadow.x} min={-60} max={60} step={0.5} places={1} unit="pt" onChange={(n) => set({ x: n })} /></Pair>
            <Pair label="Offset Y"><NumberField value={shadow.y} min={-60} max={60} step={0.5} places={1} unit="pt" onChange={(n) => set({ y: n })} /></Pair>
            <Pair label="Blur"><NumberField value={shadow.blur} min={0} max={80} step={0.5} places={1} unit="pt" onChange={(n) => set({ blur: n })} /></Pair>
            <Pair label="Strength"><NumberField value={Math.round(shadow.opacity * 100)} min={0} max={100} step={5} places={0} unit="%" onChange={(n) => set({ opacity: n / 100 })} /></Pair>
          </div>
          <div className="color-row"><span>{shadow.x === 0 && shadow.y === 0 ? "Glow color" : "Shadow color"}</span><input type="color" value={shadow.color} onChange={(e) => set({ color: e.target.value })} /></div>
        </>
      )}
    </Section>
  );
}
