import type { ImageFx } from "../types";

/** True when the effects change anything. */
export const hasImageFx = (fx?: ImageFx) =>
  !!fx && (!!fx.hue || (fx.saturation !== undefined && fx.saturation !== 100) || (fx.brightness !== undefined && fx.brightness !== 100) || (fx.contrast !== undefined && fx.contrast !== 100) || !!fx.grayscale || !!fx.overlay || !!fx.cutout);

/**
 * The SVG filter for a picture's color effects. It runs in order: cutout, black and white, saturation, hue, brightness and contrast,
 * then the color overlay, so a cutout is made from the picture's own tones before they are recolored.
 */
export function ImageFxFilter({ id, fx }: { id: string; fx: ImageFx }) {
  const steps: React.ReactNode[] = [];
  let last = "SourceGraphic", n = 0;
  const next = () => `s${n++}`;
  const add = (node: (input: string, result: string) => React.ReactNode) => { const result = next(); steps.push(node(last, result)); last = result; };

  if (fx.cutout) {
    const t = (Math.max(0, Math.min(100, fx.cutout.amount)) / 100) * 0.7, g = 1 / 0.12;
    const row = fx.cutout.remove === "black"
      ? `${g * 0.2126} ${g * 0.7152} ${g * 0.0722} 0 ${-g * t}`
      : `${-g * 0.2126} ${-g * 0.7152} ${-g * 0.0722} 0 ${g * (1 - t)}`;
    const cut = next();
    steps.push(<feColorMatrix key={cut} in={last} type="matrix" values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  ${row}`} result={cut} />);
    add((_in, result) => <feComposite key={result} in={cut} in2={last} operator="in" result={result} />); // keep the picture's own transparency too
  }
  if (fx.grayscale) add((i, r) => <feColorMatrix key={r} in={i} type="saturate" values="0" result={r} />);
  if (fx.saturation !== undefined && fx.saturation !== 100) add((i, r) => <feColorMatrix key={r} in={i} type="saturate" values={String(Math.max(0, fx.saturation! / 100))} result={r} />);
  if (fx.hue) add((i, r) => <feColorMatrix key={r} in={i} type="hueRotate" values={String(fx.hue)} result={r} />);
  const b = (fx.brightness ?? 100) / 100, c = (fx.contrast ?? 100) / 100;
  if (b !== 1 || c !== 1) {
    const slope = b * c, intercept = 0.5 - 0.5 * c;
    add((i, r) => (
      <feComponentTransfer key={r} in={i} result={r}>
        <feFuncR type="linear" slope={slope} intercept={intercept} /><feFuncG type="linear" slope={slope} intercept={intercept} /><feFuncB type="linear" slope={slope} intercept={intercept} />
      </feComponentTransfer>
    ));
  }
  if (fx.overlay) {
    const { mode, color } = fx.overlay, amount = Math.max(0, Math.min(100, fx.overlay.amount)) / 100;
    const base = last, flood = next(), shaped = next();
    steps.push(<feFlood key={flood} floodColor={color} floodOpacity={1} result={flood} />);
    steps.push(<feComposite key={shaped} in={flood} in2={base} operator="in" result={shaped} />); // color only where the picture is
    let strong = shaped;
    if (mode === "multiply") { strong = next(); steps.push(<feBlend key={strong} in={shaped} in2={base} mode="multiply" result={strong} />); }
    // the effect at full strength, mixed back with the untouched picture by the amount
    add((_i, r) => <feComposite key={r} in={strong} in2={base} operator="arithmetic" k1="0" k2={amount} k3={1 - amount} k4="0" result={r} />);
  }
  return <filter id={id} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">{steps}</filter>;
}
