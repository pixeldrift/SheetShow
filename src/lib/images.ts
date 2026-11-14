import type { Asset, DesignItem, RecordRow } from "../types";
import { nameSimilarity } from "./mapping";
import { ID } from "./records";

/* ── Patterns: "{band}.jpg || {species|slug}/{name|lower}.png" ──────────────────────── */

const TRANSFORMS: Record<string, (value: string, arg?: string) => string> = {
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
export const TRANSFORM_NAMES = Object.keys(TRANSFORMS);

const TOKEN = /\{([^{}|]+)((?:\|[^{}|]+)*)\}/g;

/** Fields a pattern refers to, in order of appearance. */
export const patternFields = (pattern: string) => [...pattern.matchAll(TOKEN)].map((m) => m[1].trim());

/**
 * Expands a pattern against a record. `||` separates fallbacks, tried in order. A candidate is dropped when
 * a field it needs is empty, so a record without a band number never produces a bogus ".jpg".
 */
export function expandPattern(pattern: string, record: RecordRow): string[] {
  return pattern.split("||").map((part) => part.trim()).filter(Boolean).flatMap((part) => {
    let complete = true;
    const out = part.replace(TOKEN, (_m, field: string, chain: string) => {
      let value = (record[field.trim()] ?? "").trim();
      if (!value) complete = false;
      for (const step of chain.split("|").filter(Boolean)) {
        const [name, arg] = step.trim().split(":");
        value = TRANSFORMS[name]?.(value, arg) ?? value;
      }
      return value;
    });
    return complete ? [out] : [];
  });
}

/** The filenames, paths or URLs a data-driven image asks for on this record. */
export function candidatesFor(item: DesignItem, record: RecordRow): string[] {
  const source = item.imageSource;
  if (!source) return [];
  if (source.mode === "column") { const v = (record[source.column] ?? "").trim(); return v ? [v] : []; }
  return expandPattern(source.pattern, record);
}

/* ── Matching ───────────────────────────────────────────────────────────────────────── */

export type MatchKind = "override" | "exact" | "normalized" | "fuzzy" | "web" | "none";
export type Match = { kind: MatchKind; asset?: Asset; url?: string; score: number; candidate: string; alternates: Match[] };

export const isWebUrl = (text: string) => /^(https?:)?\/\//i.test(text);
const EXT = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i;
export const stripExt = (text: string) => text.replace(EXT, "");
export const baseName = (path: string) => path.split("/").pop() ?? path;
export const normalizeKey = (text: string) => stripExt(text).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "");

export const FUZZY_MIN = 0.72;

export type Resolver = ReturnType<typeof createResolver>;

/** Indexes the library once; each lookup then tries exact → normalised → fuzzy, and results are cached per candidate. */
export function createResolver(assets: Asset[]) {
  const byName = new Map<string, Asset>();
  const byPath = new Map<string, Asset>();
  const byKey = new Map<string, Asset>();
  const pathKeys: { key: string; asset: Asset }[] = [];
  const bases: { key: string; asset: Asset }[] = [];
  for (const asset of assets) {
    byName.set(baseName(asset.path).toLowerCase(), asset);
    byPath.set(asset.path.toLowerCase(), asset);
    const key = normalizeKey(baseName(asset.path));
    if (!byKey.has(key)) byKey.set(key, asset);
    pathKeys.push({ key: normalizeKey(asset.path), asset });
    bases.push({ key: stripExt(baseName(asset.path)), asset });
  }
  const cache = new Map<string, Omit<Match, "alternates">>();

  const single = (candidate: string): Omit<Match, "alternates"> => {
    if (isWebUrl(candidate)) return { kind: "web", url: candidate, score: 1, candidate };
    const hit = cache.get(candidate);
    if (hit) return hit;
    const lower = candidate.toLowerCase();
    let found: Omit<Match, "alternates"> = { kind: "none", score: 0, candidate };
    const exact = byPath.get(lower) ?? byName.get(lower) ?? (lower.includes("/") ? assets.find((a) => a.path.toLowerCase().endsWith("/" + lower)) : undefined);
    if (exact) found = { kind: "exact", asset: exact, score: 1, candidate };
    else {
      const key = normalizeKey(candidate);
      const normalized = key ? (lower.includes("/") ? pathKeys.find((p) => p.key.endsWith(key))?.asset : undefined) ?? byKey.get(key) : undefined;
      if (normalized) found = { kind: "normalized", asset: normalized, score: 0.95, candidate };
      else if (key.length >= 2) {
        let best = 0, bestAsset: Asset | undefined;
        const base = stripExt(baseName(candidate));
        for (const entry of bases) {
          if (Math.abs(entry.key.length - base.length) > Math.max(base.length, entry.key.length) * 0.6) continue; // can't be similar
          const score = nameSimilarity(base, entry.key);
          if (score > best) { best = score; bestAsset = entry.asset; }
        }
        if (bestAsset && best >= FUZZY_MIN) found = { kind: "fuzzy", asset: bestAsset, score: best, candidate };
      }
    }
    cache.set(candidate, found);
    return found;
  };

  const byId = new Map(assets.map((a) => [a.id, a]));

  return {
    assetById: (id: string | undefined) => (id ? byId.get(id) : undefined),
    /** Resolves a data-driven image for one record. Manual choices win; later candidates become load-failure fallbacks. */
    resolve(item: DesignItem, record: RecordRow): Match {
      const chosen = record[ID] ? item.overrides?.[record[ID]] : undefined;
      const override = chosen ? byId.get(chosen) : undefined;
      const results = candidatesFor(item, record).map(single);
      const usable = results.filter((m) => m.kind !== "none");
      if (override) return { kind: "override", asset: override, score: 1, candidate: results[0]?.candidate ?? "", alternates: usable.map((m) => ({ ...m, alternates: [] })) };
      if (!usable.length) return { kind: "none", score: 0, candidate: results[0]?.candidate ?? candidatesFor(item, record)[0] ?? "", alternates: [] };
      return { ...usable[0], alternates: usable.slice(1).map((m) => ({ ...m, alternates: [] })) };
    },
  };
}

/** Does this match still need a person's eye? (Fuzzy guesses and misses.) */
export const needsReview = (m: Match) => m.kind === "fuzzy" || m.kind === "none";

/** A sensible starting rule: a column that looks like a filename, else a pattern on the most identifying field. */
export function defaultImageSource(columns: string[]): import("../types").ImageSource {
  const fileColumn = columns.find((c) => /^(image|photo|picture|pic|img|file|filename)/i.test(c));
  if (fileColumn) return { mode: "column", column: fileColumn };
  return { mode: "pattern", pattern: `{${columns.find((c) => /^(band|id|name)/i.test(c)) ?? columns[0] ?? "name"}}` };
}
