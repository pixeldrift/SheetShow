import { useMemo, useState } from "react";
import { ChevronRight, Circle, X } from "lucide-react";
import type { DesignItem, ImageFx, RecordRow, Shadow } from "../types";
import { hasImageFx } from "./ImageFxFilter";
import type { ImageLibrary } from "../hooks/useImageLibrary";
import { TRANSFORM_NAMES, defaultImageSource, needsReview, patternFields } from "../lib/images";
import { prettyField } from "../lib/data";
import { convertRadius, paddingsOf } from "../lib/shape";
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
  const insertField = (field: string) => source?.mode === "pattern" && patch({ imageSource: { mode: "pattern", pattern: source.pattern + `{{${field}}}` } });

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
            <select className="select" value={source.mode} onChange={(e) => patch({ imageSource: e.target.value === "column" ? { mode: "column", column: columns.find((c) => /^(image|photo|picture|pic|img|file|filename)/i.test(c)) ?? columns[0] ?? "" } : { mode: "pattern", pattern: `{{${columns[0] ?? "name"}}}` } })}>
              <option value="pattern">A filename pattern</option><option value="column">A column with the filename or URL</option>
            </select>
          </Pair>
          {source.mode === "column" ? (
            <div className="spaced-block"><Pair label="Column"><select className="select" value={source.column} onChange={(e) => patch({ imageSource: { mode: "column", column: e.target.value } })}>{columns.map((c) => <option key={c} value={c}>{prettyField(c)}</option>)}</select></Pair></div>
          ) : (
            <div className="spaced-block">
              <Pair label="Pattern">
                <input className="property-input mono" value={source.pattern} spellCheck={false} onChange={(e) => patch({ imageSource: { mode: "pattern", pattern: e.target.value } }, `pattern:${item.id}`)} placeholder="{{band}}.jpg" />
              </Pair>
              <div className="chip-row">
                {columns.slice(0, 12).map((c) => <button key={c} className="field-chip" onClick={() => insertField(c)} title={`Insert {{${c}}}`}>+ {prettyField(c)}</button>)}
              </div>
              <p className="hint">Put fields in double braces. Add transforms with a bar: <code>{"{{name|lower}}"}</code>, <code>{"{{species|slug}}"}</code>. Separate fallbacks with <code>||</code>. A web address works too: <code>https://example.com/{"{{band}}"}.jpg</code>. Transforms: {TRANSFORM_NAMES.join(", ")}.</p>
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

/** A small on/off switch; `on` is the persistent state, nothing lingers after a tap. */
export function Switch({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={() => onChange(!on)}><span /></button>;
}

/** A colour swatch that can optionally be cleared (shown as a slashed swatch when empty). */
function ColorChip({ value, fallback, label, onChange, onClear }: { value?: string; fallback: string; label: string; onChange: (c: string) => void; onClear?: () => void }) {
  return (
    <span className={`color-chip${value ? "" : " empty"}`}>
      <input type="color" aria-label={label} value={value ?? fallback} onChange={(e) => onChange(e.target.value)} />
      {value && onClear && <button type="button" className="chip-clear" title={`Remove ${label.toLowerCase()}`} aria-label={`Remove ${label.toLowerCase()}`} onClick={onClear}><X size={9} /></button>}
    </span>
  );
}

const CORNER_NAMES = ["Top left", "Top right", "Bottom left", "Bottom right"];

/** Background, border, padding and rounding: shared by shapes, pictures and text boxes. */
export function ShapeStyleSection({ item, patch }: { item: DesignItem; patch: Patch }) {
  const [corners, setCorners] = useState(!!item.radii);
  const [pads, setPads] = useState(!!item.paddings);
  const hasStroke = !!item.stroke && item.stroke !== "none";
  const unit = item.radiusUnit ?? "pct";
  const sidePx = Math.min(item.w, item.h) * 96;
  const max = unit === "pct" ? 50 : Math.max(1, Math.floor(sidePx / 2));
  const radii = item.radii ?? ([item.radius ?? 0, item.radius ?? 0, item.radius ?? 0, item.radius ?? 0] as const);
  const mixed = !!item.radii && !item.radii.every((r) => r === item.radii![0]);
  const paddings = paddingsOf(item);
  const mixedPad = !!item.paddings && !item.paddings.every((v) => v === item.paddings![0]);
  const hasBackground = item.type === "rect" || item.type === "text";
  const label = item.type === "image" ? "BORDER & CORNERS" : item.type === "text" ? "BOX" : "APPEARANCE";
  const radiusStep = unit === "pct" ? 1 : 0.5;
  const setUnit = (next: "pct" | "px") => {
    if (next === unit) return;
    patch({
      radiusUnit: next,
      radius: convertRadius(item.radius ?? 0, unit, next, sidePx),
      ...(item.radii ? { radii: item.radii.map((r) => convertRadius(r, unit, next, sidePx)) as [number, number, number, number] } : {}),
    });
  };
  // The four corners are listed top-left, top-right, bottom-left, bottom-right (reading order); radii are stored clockwise.
  const CORNER_INDEX = [0, 1, 3, 2];
  const setCorner = (index: number, value: number) => { const next = [...radii] as [number, number, number, number]; next[index] = value; patch({ radii: next }); };
  const setPad = (index: number, value: number) => { const next = [...paddings] as [number, number, number, number]; next[index] = value; patch({ paddings: next }); };
  const makeCircle = () => { const side = Math.min(item.w, item.h); patch({ radius: 50, radiusUnit: "pct", radii: undefined, w: side, h: side }); };
  const borderSize = hasStroke ? item.strokeWidth ?? (item.type === "rect" ? 0.75 : 1) : 0;

  return (
    <Section title={label}>
      {/* Background, border colour and border size share one line. */}
      <div className={`style-row${hasBackground ? "" : " two"}`}>
        {hasBackground && (
          <Pair label="Background">
            <ColorChip value={item.fill} fallback={item.type === "text" ? "#ffffff" : "#e9eee9"} label="Background" onChange={(c) => patch({ fill: c })} onClear={item.type === "text" ? () => patch({ fill: undefined }) : undefined} />
          </Pair>
        )}
        <Pair label="Border">
          <ColorChip value={hasStroke ? item.stroke : undefined} fallback="#cbd5cc" label="Border" onChange={(c) => patch({ stroke: c, strokeWidth: item.strokeWidth ?? 1.5 })} onClear={() => patch({ stroke: "none" })} />
        </Pair>
        <Pair label="Border size">
          <NumberField value={borderSize} min={0} max={40} step={0.25} places={2} unit="pt" onChange={(n) => (n <= 0 ? patch({ stroke: "none" }) : patch({ strokeWidth: n, stroke: hasStroke ? item.stroke : "#cbd5cc" }))} />
        </Pair>
      </div>

      {/* Padding (text boxes) and rounding: one number each, drag it to scrub or tap to type; the twirl reveals one box per side or corner. */}
      {/* Each twirl-down opens its boxes right under its own field. With either open, the two fields stack so that is unambiguous. */}
      <div className={`pad-round-row${item.type === "text" ? "" : " one"}${pads || corners ? " stacked" : ""}`}>
        {item.type === "text" && (
          <div className="pad-round-cell">
          <Pair label="Padding (in)">
            <div className="field-with-twirl">
              <NumberField value={mixedPad ? 0 : paddings[0]} min={0} max={2} step={0.01} places={2} onChange={(n) => patch({ padding: n, paddings: undefined })} />
              <button type="button" className="twirl-button" aria-expanded={pads} aria-label="Padding for each side" title="Padding for each side" onClick={() => setPads((o) => !o)}><ChevronRight size={13} style={{ transform: pads ? "rotate(90deg)" : undefined }} /></button>
            </div>
          </Pair>
            {pads && item.type === "text" && (
              <div className="corner-grid">
                {["Top", "Right", "Bottom", "Left"].map((name, index) => (
                  <Pair key={name} label={name}><NumberField value={paddings[index]} min={0} max={2} step={0.01} places={2} unit="in" onChange={(n) => setPad(index, n)} /></Pair>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="pad-round-cell">
        <Pair label="Rounding">
          <div className="field-with-twirl">
            <NumberField value={mixed ? 0 : radii[0]} min={0} max={max} step={radiusStep} places={1} onChange={(n) => patch({ radius: n, radii: undefined })} />
            <span className="seg-mini" role="group" aria-label="Rounding unit">
              <button className={unit === "pct" ? "active" : ""} aria-pressed={unit === "pct"} onClick={() => setUnit("pct")}>%</button>
              <button className={unit === "px" ? "active" : ""} aria-pressed={unit === "px"} onClick={() => setUnit("px")}>px</button>
            </span>
            <button type="button" className="twirl-button" aria-expanded={corners} aria-label="Rounding for each corner" title="Rounding for each corner" onClick={() => setCorners((o) => !o)}><ChevronRight size={13} style={{ transform: corners ? "rotate(90deg)" : undefined }} /></button>
          </div>
        </Pair>
          {corners && (
            <div className="corner-grid">
              {CORNER_NAMES.map((name, i) => (
                <Pair key={name} label={name}><NumberField value={radii[CORNER_INDEX[i]]} min={0} max={max} step={radiusStep} places={1} unit={unit === "pct" ? "%" : "px"} onChange={(n) => setCorner(CORNER_INDEX[i], n)} /></Pair>
              ))}
            </div>
          )}
        </div>
      </div>
      {item.type !== "text" && (
        <div className="icon-row spaced-block">
          <button className="wide-icon" onClick={makeCircle} title="Make it round: sets the shape square and the corners fully round"><Circle size={15} /> Circle</button>
          <button className="wide-icon" onClick={() => patch({ radius: 0, radii: undefined })}>Square corners</button>
        </div>
      )}
    </Section>
  );
}

const SHADOW: Shadow = { x: 0, y: 2, blur: 5, color: "#000000", opacity: 0.35 };

/** One effect: a twirl-down with its details, and a switch to turn it on. */
function Effect({ title, on, onToggle, children }: { title: string; on: boolean; onToggle: (on: boolean) => void; children: React.ReactNode }) {
  const [open, setOpen] = useState(on);
  return (
    <div className="effect-block">
      <div className="switch-row">
        <button type="button" className="twirl effect-twirl" aria-expanded={open} onClick={() => setOpen((o) => !o)}><ChevronRight size={12} style={{ transform: open ? "rotate(90deg)" : undefined }} /> {title}</button>
        <Switch label={title} on={on} onChange={(next) => { onToggle(next); if (next) setOpen(true); }} />
      </div>
      {open && <div className={on ? undefined : "effect-off"}>{children}</div>}
    </div>
  );
}

/** Opacity first, then outline (text) and shadow with their details, and finally the reference switch. */
export function EffectsSection({ item, patch }: { item: DesignItem; patch: Patch }) {
  const shadow = item.shadow;
  const stroke = item.textStroke;
  const sh = shadow ?? SHADOW;
  const set = (change: Partial<Shadow>) => patch({ shadow: { ...sh, ...change } });
  const ol = stroke ?? { color: "#ffffff", width: 2 };
  const setOutline = (change: Partial<{ color: string; width: number }>) => patch({ textStroke: { ...ol, ...change } });
  return (
    <Section title="EFFECTS">
      <div className="opacity-block">
        <Pair label="Opacity">
          <NumberField value={Math.round((item.opacity ?? 1) * 100)} min={0} max={100} step={1} places={0} unit="%" onChange={(n) => patch({ opacity: n / 100 })} />
        </Pair>
        <input type="range" min="0" max="100" step="1" value={Math.round((item.opacity ?? 1) * 100)} aria-label="Opacity" onChange={(ev) => patch({ opacity: Number(ev.target.value) / 100 })} />
      </div>
      {item.type === "text" && (
        <Effect title="Outline" on={!!stroke} onToggle={(on) => patch({ textStroke: on ? ol : undefined })}>
          <div className="two-col spaced">
            <Pair label="Color"><ColorChip value={ol.color} fallback="#ffffff" label="Outline color" onChange={(c) => setOutline({ color: c })} /></Pair>
            <Pair label="Thickness"><NumberField value={ol.width} min={0.25} max={20} step={0.25} places={2} unit="pt" onChange={(n) => setOutline({ width: n })} /></Pair>
          </div>
        </Effect>
      )}
      <Effect title="Shadow" on={!!shadow} onToggle={(on) => patch({ shadow: on ? sh : undefined })}>
        <div className="two-col spaced">
          <Pair label="Offset X"><NumberField value={sh.x} min={-60} max={60} step={0.5} places={1} unit="pt" onChange={(n) => set({ x: n })} /></Pair>
          <Pair label="Offset Y"><NumberField value={sh.y} min={-60} max={60} step={0.5} places={1} unit="pt" onChange={(n) => set({ y: n })} /></Pair>
          <Pair label="Softness"><NumberField value={sh.blur} min={0} max={80} step={0.5} places={1} unit="pt" onChange={(n) => set({ blur: n })} /></Pair>
          <Pair label="Opacity"><NumberField value={Math.round(sh.opacity * 100)} min={0} max={100} step={5} places={0} unit="%" onChange={(n) => set({ opacity: n / 100 })} /></Pair>
        </div>
        <div className="color-row"><span>Color</span><input type="color" aria-label="Shadow color" value={sh.color} onChange={(e) => set({ color: e.target.value })} /></div>
      </Effect>
      <div className="effect-block">
        <div className="switch-row" title="A guide for you while designing (a scan, a mock-up). It is never printed and can be semi-transparent."><span>Reference only (won’t print)</span>
          <Switch label="Reference only" on={!!item.reference} onChange={(on) => patch(on ? { reference: true, opacity: (item.opacity ?? 1) === 1 ? 0.5 : item.opacity } : { reference: undefined, opacity: item.opacity === 0.5 ? undefined : item.opacity })} /></div>
      </div>
    </Section>
  );
}

/** Colour effects for a picture: tint it, make it black and white, recolour an icon, or cut black or white out. */
export function ImageColorSection({ item, patch }: { item: DesignItem; patch: Patch }) {
  const fx: ImageFx = item.imageFx ?? {};
  // Defaults are not stored: an effect that does nothing is simply absent, so a picture with no effects is untouched.
  const set = (change: Partial<ImageFx>) => {
    const next: ImageFx = { ...fx, ...change };
    if (!next.hue) delete next.hue;
    if (next.saturation === 100 || next.saturation === undefined) delete next.saturation;
    if (next.brightness === 100 || next.brightness === undefined) delete next.brightness;
    if (next.contrast === 100 || next.contrast === undefined) delete next.contrast;
    if (!next.grayscale) delete next.grayscale;
    if (!next.overlay) delete next.overlay;
    if (!next.cutout) delete next.cutout;
    patch({ imageFx: Object.keys(next).length ? next : undefined });
  };
  const changed = hasImageFx(item.imageFx);
  const overlay = fx.overlay;
  return (
    <Section title="COLOR">
      <div className="switch-row first"><span>Black and white</span><Switch label="Black and white" on={!!fx.grayscale} onChange={(on) => set({ grayscale: on })} /></div>
      <div className="two-col spaced">
        <Pair label="Hue"><NumberField value={fx.hue ?? 0} min={-180} max={180} step={1} places={0} unit="°" onChange={(n) => set({ hue: n })} /></Pair>
        <Pair label="Saturation"><NumberField value={fx.saturation ?? 100} min={0} max={300} step={1} places={0} unit="%" onChange={(n) => set({ saturation: n })} /></Pair>
        <Pair label="Brightness"><NumberField value={fx.brightness ?? 100} min={0} max={300} step={1} places={0} unit="%" onChange={(n) => set({ brightness: n })} /></Pair>
        <Pair label="Contrast"><NumberField value={fx.contrast ?? 100} min={0} max={300} step={1} places={0} unit="%" onChange={(n) => set({ contrast: n })} /></Pair>
      </div>

      <div className="effect-block">
        <Pair label="Colour overlay">
          <select className="select" value={overlay?.mode ?? "none"} aria-label="Colour overlay"
            onChange={(e) => (e.target.value === "none" ? set({ overlay: undefined }) : set({ overlay: { mode: e.target.value as "multiply" | "film" | "solid", color: overlay?.color ?? "#d17c4b", amount: overlay?.amount ?? (e.target.value === "solid" ? 100 : 60) } }))}>
            <option value="none">None</option>
            <option value="multiply">Tint (like a coloured filter)</option>
            <option value="film">Film (a see-through layer of colour)</option>
            <option value="solid">Recolour (keeps the shape, one colour)</option>
          </select>
        </Pair>
        {overlay && (
          <div className="two-col spaced">
            <Pair label="Colour"><ColorChip value={overlay.color} fallback="#d17c4b" label="Overlay colour" onChange={(c) => set({ overlay: { ...overlay, color: c } })} /></Pair>
            <Pair label="Amount"><NumberField value={overlay.amount} min={0} max={100} step={1} places={0} unit="%" onChange={(n) => set({ overlay: { ...overlay, amount: n } })} /></Pair>
          </div>
        )}
        {overlay?.mode === "solid" && <p className="hint">Turns every visible pixel this colour. Good for changing an icon from black to any colour.</p>}
      </div>

      <div className="effect-block">
        <Pair label="Make transparent">
          <select className="select" value={fx.cutout?.remove ?? "none"} aria-label="Make transparent"
            onChange={(e) => (e.target.value === "none" ? set({ cutout: undefined }) : set({ cutout: { remove: e.target.value as "black" | "white", amount: fx.cutout?.amount ?? 40 } }))}>
            <option value="none">Nothing</option>
            <option value="white">White (and near white)</option>
            <option value="black">Black (and near black)</option>
          </select>
        </Pair>
        {fx.cutout && <div className="two-col spaced"><Pair label="Strength"><NumberField value={fx.cutout.amount} min={0} max={100} step={1} places={0} unit="%" onChange={(n) => set({ cutout: { ...fx.cutout!, amount: n } })} /></Pair></div>}
      </div>
      {changed && <button className="link-button reset-fx" onClick={() => patch({ imageFx: undefined })}>Reset colour effects</button>}
    </Section>
  );
}
