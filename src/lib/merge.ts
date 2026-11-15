import type { DesignItem, RecordRow } from "../types";

/** Transforms usable in `{{field|transform}}`: shared by picture patterns and merge fields in text. */
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

/** A field token is double-braced, {{name}}, because a single pair of braces can appear in ordinary text but a doubled pair almost never does. */
export const TOKEN = /\{\{\s*([^{}|#^/][^{}|]*?)\s*((?:\|[^{}|]+)*)\}\}/g;
export const fieldToken = (field: string) => `{{${field}}}`;

export function applyChain(value: string, chain: string): string {
  let out = value;
  for (const step of chain.split("|").filter(Boolean)) {
    const [name, arg] = step.trim().split(":");
    out = TRANSFORMS[name]?.(out, arg) ?? out;
  }
  return out;
}

/** Values for the special fields, by the names shown in the editor: {{Record number}}. */
export type Specials = Record<string, string>;
export const specialValues = (meta: { recordNumber: number; pageNumber: number; recordCount: number; pageCount: number }): Specials => ({
  "record number": String(meta.recordNumber), "page number": String(meta.pageNumber), "record count": String(meta.recordCount), "page count": String(meta.pageCount),
});

const SECTION = /\{\{([#^])\s*([^{}|]+?)\s*\}\}([\s\S]*?)\{\{\/\s*\2\s*\}\}/;

/**
 * Fills {{field}} tokens in static text from a record: "{{city}}, {{state}} {{zip}}" → "Portland, OR 97201".
 *
 * Optional pieces keep punctuation and spaces from dangling when a value is missing:
 *   {{#title}}, {{title}}{{/title}}   shown only when the record has a title
 *   {{^title}}Untitled{{/title}}      shown only when it does not
 * and runs of spaces are tidied (and each line trimmed), so "{{first}} {{middle}} {{last}}" never leaves a double space.
 * Anything that is not a real field stays as typed.
 */
export function mergeText(text: string, record: RecordRow, specials: Specials = {}): string {
  if (!text.includes("{{")) return text;
  const lookup = (name: string): string | undefined => {
    const key = name.trim();
    if (key in record) return (record[key] ?? "").trim();
    const spaced = key.replace(/\s+/g, "_");
    if (spaced in record) return (record[spaced] ?? "").trim();
    // Field names are matched without regard to case, as the Fields list shows them capitalised.
    const norm = (k: string) => k.toLowerCase().replace(/[\s_]+/g, "_");
    const found = Object.keys(record).find((k) => norm(k) === norm(key));
    if (found !== undefined) return (record[found] ?? "").trim();
    return specials[key.toLowerCase()];
  };
  let out = text;
  for (let pass = 0; pass < 6 && SECTION.test(out); pass++) {
    out = out.replace(new RegExp(SECTION.source, "g"), (whole, kind: string, field: string, body: string) => {
      const value = lookup(field);
      if (value === undefined) return whole;
      return (kind === "#") === (value !== "") ? body : "";
    });
  }
  out = out.replace(TOKEN, (whole, field: string, chain: string) => {
    const value = lookup(field);
    return value === undefined ? whole : applyChain(value, chain);
  });
  return out.split("\n").map((line) => line.replace(/[ \t]{2,}/g, " ").trim()).join("\n");
}

/* ── Older projects used single braces, {name}. Upgrade them once, when a project is loaded. ── */

const LEGACY = /(?<!\{)\{([^{}|]+)((?:\|[^{}|]+)*)\}(?!\})/g;
/** Turns {field} into {{field}} when the field is a real column (or a special name), leaving every other brace alone. */
export function upgradeTokens(text: string, columns: Set<string>): string {
  if (!text.includes("{")) return text;
  return text.replace(LEGACY, (whole, field: string, chain: string) => (columns.has(field.trim()) || ["record number", "page number", "record count", "page count"].includes(field.trim().toLowerCase()) ? `{{${field.trim()}${chain}}}` : whole));
}

/** Upgrades every static text and picture pattern in a project to double-brace tokens. Safe to run on an already-upgraded project. */
export function upgradeProject<T extends { records: RecordRow[]; items: DesignItem[]; variants?: { items: DesignItem[] }[] }>(project: T): T {
  const columns = new Set(Object.keys(project.records[0] ?? {}).filter((k) => !k.startsWith("__")));
  const fix = (item: DesignItem): DesignItem => {
    let next = item;
    if (!item.field && item.text) { const t = upgradeTokens(item.text, columns); if (t !== item.text) next = { ...next, text: t }; }
    if (item.imageSource?.mode === "pattern") { const p = upgradeTokens(item.imageSource.pattern, columns); if (p !== item.imageSource.pattern) next = { ...next, imageSource: { mode: "pattern", pattern: p } }; }
    return next;
  };
  return { ...project, items: project.items.map(fix), ...(project.variants ? { variants: project.variants.map((v) => ({ ...v, items: v.items.map(fix) })) } : {}) };
}

/** Renames the fields used by tokens and sections in a text or pattern: {{old}} → {{new}} (null mappings are left alone). */
export function renameTokens(text: string, mapping: Record<string, string | null>): string {
  if (!text.includes("{{")) return text;
  return text.replace(/\{\{([#^/]?)\s*([^{}|]+?)\s*((?:\|[^{}|]+)*)\}\}/g, (whole, mark: string, field: string, chain: string) => {
    const to = mapping[field.trim()];
    return to && to !== field.trim() ? `{{${mark}${to}${chain}}}` : whole;
  });
}
