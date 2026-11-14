import type { RecordRow } from "../types";

/** Transforms usable in `{field|transform}`: shared by picture patterns and merge fields in text. */
export const TRANSFORMS: Record<string, (value: string, arg?: string) => string> = {
  lower: (v) => v.toLowerCase(),
  upper: (v) => v.toUpperCase(),
  trim: (v) => v.trim(),
  slug: (v) => v.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
  snake: (v) => v.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
  nospace: (v) => v.replace(/\s+/g, ""),
  first: (v) => v.trim().split(/\s+/)[0] ?? "",
  last: (v) => v.trim().split(/\s+/).pop() ?? "",
  urlencode: (v) => encodeURIComponent(v),
  pad: (v, arg) => v.padStart(Number(arg) || 0, "0"),
};

export const TOKEN = /\{([^{}|]+)((?:\|[^{}|]+)*)\}/g;

export function applyChain(value: string, chain: string): string {
  let out = value;
  for (const step of chain.split("|").filter(Boolean)) {
    const [name, arg] = step.trim().split(":");
    out = TRANSFORMS[name]?.(out, arg) ?? out;
  }
  return out;
}

/**
 * Fills `{field}` placeholders in static text from a record: "{city}, {state} {zip}" → "Portland, OR 97201".
 * Text that isn't a real field stays as typed, so ordinary braces survive.
 */
export function mergeText(text: string, record: RecordRow): string {
  if (!text.includes("{")) return text;
  return text.replace(TOKEN, (whole, field: string, chain: string) => {
    const key = field.trim();
    return key in record ? applyChain((record[key] ?? "").trim(), chain) : whole;
  });
}
