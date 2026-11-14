import { useMemo } from "react";
import { Circle, Droplets, Sparkles, X } from "lucide-react";
import type { DesignItem, RecordRow, Shadow } from "../types";
import type { ImageLibrary } from "../hooks/useImageLibrary";
import { TRANSFORM_NAMES, defaultImageSource, needsReview, patternFields } from "../lib/images";
import { prettyField } from "../lib/data";
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
};

/** Where a picture comes from: one library image, or a rule that finds each record's own image. */
export function PictureSection({ item, patch, tools }: { item: DesignItem; patch: Patch; tools: ImageTools }) {
  const { library, columns, record } = tools;
  const source = item.imageSource;
  const asset = library.resolver.assetById(item.assetId);
  const match = source ? library.resolver.resolve(item, record) : null;
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

/** Fill, corner radius and frame — shared by shapes and pictures. */
export function ShapeStyleSection({ item, patch }: { item: DesignItem; patch: Patch }) {
  const hasStroke = !!item.stroke && item.stroke !== "none";
  const radius = item.radius ?? 0;
  const makeCircle = () => { const side = Math.min(item.w, item.h); patch({ radius: 50, w: side, h: side }); };
  return (
    <Section title={item.type === "image" ? "CORNERS & FRAME" : "APPEARANCE"}>
      {item.type === "rect" && <div className="color-row first"><span>Fill color</span><input type="color" value={item.fill ?? "#e9eee9"} onChange={(e) => patch({ fill: e.target.value })} /></div>}
      <div className="slider-row">
        <span>Corner radius</span>
        <input type="range" min="0" max="50" step="1" value={radius} aria-label="Corner radius" onChange={(e) => patch({ radius: Number(e.target.value) })} />
        <output>{radius}%</output>
      </div>
      <div className="icon-row spaced-block">
        <button className="wide-icon" onClick={makeCircle} title="Make it round: sets the shape square and the corners fully round"><Circle size={15} /> Circle</button>
        <button className="wide-icon" onClick={() => patch({ radius: 0 })}>Square corners</button>
      </div>
      <div className="color-row">
        <span>Frame color</span>
        <span className="inline-controls">
          {hasStroke && <button className="mini-button" title="Remove frame" aria-label="Remove frame" onClick={() => patch({ stroke: "none" })}><X size={13} /></button>}
          <input type="color" value={hasStroke ? item.stroke! : "#ffffff"} onChange={(e) => patch({ stroke: e.target.value, strokeWidth: item.strokeWidth ?? 1.5 })} />
        </span>
      </div>
      {hasStroke && <div className="spaced-block"><Pair label="Frame thickness"><NumberField value={item.strokeWidth ?? (item.type === "rect" ? 0.75 : 1)} min={0.25} max={40} step={0.25} places={2} unit="pt" onChange={(n) => patch({ strokeWidth: n })} /></Pair></div>}
    </Section>
  );
}

const SHADOW: Shadow = { x: 0, y: 2, blur: 5, color: "#000000", opacity: 0.35 };
const GLOW: Shadow = { x: 0, y: 0, blur: 10, color: "#ffb347", opacity: 0.95 };

/** Opacity plus a drop shadow / glow (a glow is just a shadow with no offset). */
export function EffectsSection({ item, patch }: { item: DesignItem; patch: Patch }) {
  const shadow = item.shadow;
  const set = (change: Partial<Shadow>) => patch({ shadow: { ...(shadow ?? SHADOW), ...change } });
  return (
    <Section title="EFFECTS">
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
