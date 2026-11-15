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
export const TOKEN = /\{\{\s*([^{}|#^/?:][^{}|]*?)\s*((?:\|[^{}|]+)*)\}\}/g;
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
export const SPECIAL_NAMES = ["record number", "page number", "record count", "page count"];

/* ── Conditions ──────────────────────────────────────────────────────────────────────────
 *
 *   {{name}}                          insert the value (nothing if it is empty)
 *   {{?title}}, {{title}}{{/}}        show the text only if title has a value
 *   {{?type = "VIP"}}★{{/}}           = != contains starts ends  (put ! in front of a word operator to negate it)
 *   {{?type = "A", "B"}}              a comma list means any of these ("none of these" with !=)
 *   {{?city = ?home_city}}            ?name is always a field; quoted text is always literal
 *   {{?type = "VIP" and ?band starts "GC"}}   and / or (not mixed in one tag)
 *   {{else}}                          the other branch
 *   {{/}} or {{/title}}               close: the name is optional, and checked when given
 *
 * A bare {{?name}} with no {{/}} anywhere in the text just inserts, the same as {{name}}.
 * Once the text uses blocks, every ? tag opens one.
 */

type Tok = { t: "str"; v: string } | { t: "sym"; v: string } | { t: "comma" } | { t: "tilde" } | { t: "field"; v: string } | { t: "word"; v: string };
const LEX = /\s+|[“”"]([^“”"]*)[“”"]|(!=|>=|<=|[=<>])|(,)|(~)|\?([^\s"“”,=!<>]+)|(!?[^\s"“”,=!<>?]+)/y;

function lex(source: string): Tok[] | null {
  const out: Tok[] = [];
  LEX.lastIndex = 0;
  while (LEX.lastIndex < source.length) {
    const start = LEX.lastIndex;
    const m = LEX.exec(source);
    if (!m || LEX.lastIndex === start) return null;
    if (m[1] !== undefined) out.push({ t: "str", v: m[1] });
    else if (m[2]) out.push({ t: "sym", v: m[2] });
    else if (m[3]) out.push({ t: "comma" });
    else if (m[4]) out.push({ t: "tilde" });
    else if (m[5]) out.push({ t: "field", v: m[5] });
    else if (m[6]) out.push({ t: "word", v: m[6] });
  }
  return out;
}

/** `loose` (written ~"text" or ~?field) compares ignoring case, spaces, punctuation and accents. */
type Operand = ({ kind: "lit"; v: string } | { kind: "field"; v: string }) & { loose?: boolean };
type Clause = { field: string; op?: string; values: Operand[] };
type Cond = { clauses: Clause[]; join: "and" | "or" };

const WORD_OPS = new Set(["contains", "starts", "ends", "!contains", "!starts", "!ends"]);
const isOp = (t: Tok) => (t.t === "sym" && t.v !== "!") || (t.t === "word" && WORD_OPS.has(t.v.toLowerCase()));

/** Reads "?field [op value, value] [and|or ?field …]" (the text after the opening ?, with the ? put back). */
function parseCondition(source: string): Cond | { error: string } {
  const toks = lex(source);
  if (!toks || !toks.length) return { error: "Could not read this condition." };
  const clauses: Clause[] = [];
  let join: "and" | "or" | null = null;
  let i = 0;
  while (i < toks.length) {
    const first = toks[i];
    if (first.t !== "field") return { error: "Each condition starts with ?fieldName." };
    i++;
    const nameParts = [first.v];
    while (i < toks.length && toks[i].t === "word" && !isOp(toks[i]) && !["and", "or"].includes((toks[i] as { v: string }).v.toLowerCase())) nameParts.push((toks[i++] as { v: string }).v);
    const clause: Clause = { field: nameParts.join(" "), values: [] };
    if (i < toks.length && isOp(toks[i])) {
      clause.op = ((toks[i++] as { v: string }).v).toLowerCase();
      for (;;) {
        let loose = false;
        if (toks[i]?.t === "tilde") { loose = true; i++; }
        const v = toks[i];
        if (!v) return { error: `Missing a value after ${clause.op}.` };
        if (loose && v.t !== "str" && v.t !== "field") return { error: "Put quotes after ~, like ~\"this value\"." };
        if (v.t === "str") clause.values.push({ kind: "lit", v: v.v, loose });
        else if (v.t === "field") clause.values.push({ kind: "field", v: v.v, loose });
        else if (v.t === "word" && /^-?\d+(\.\d+)?$/.test(v.v)) clause.values.push({ kind: "lit", v: v.v });
        else return { error: `Put text in quotes, like "${(v as { v?: string }).v ?? ""}".` };
        i++;
        if (toks[i]?.t === "comma") { i++; continue; }
        break;
      }
    }
    clauses.push(clause);
    if (i < toks.length) {
      const j = toks[i];
      const word = j.t === "word" ? j.v.toLowerCase() : "";
      if (word !== "and" && word !== "or") return { error: "Use and / or between conditions." };
      if (join && join !== word) return { error: "Don't mix and with or in one tag; nest two blocks instead." };
      join = word;
      i++;
      if (i >= toks.length) return { error: `Nothing after ${word}.` };
    }
  }
  return { clauses, join: join ?? "and" };
}

type Lookup = (name: string) => string | undefined;
const norm = (s: string) => s.trim().toLowerCase();
/** Spelling-insensitive: "This Value", "this_value", "thisValue" and "thïs-value" all become "thisvalue". */
const looseNorm = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const num = (s: string) => (s.trim() !== "" && Number.isFinite(Number(s)) ? Number(s) : null);

function holds(cond: Cond, lookup: Lookup): boolean | null {
  const results: boolean[] = [];
  for (const c of cond.clauses) {
    const raw = lookup(c.field);
    if (raw === undefined) return null; // unknown field
    const value = raw;
    if (!c.op) { results.push(value.trim() !== ""); continue; }
    const operands: { text: string; loose: boolean }[] = [];
    for (const o of c.values) { const r = o.kind === "lit" ? o.v : lookup(o.v); if (r === undefined) return null; operands.push({ text: r, loose: !!o.loose }); }
    const negate = c.op.startsWith("!");
    const op = c.op.replace(/^!/, "");
    const test = ({ text: b0, loose }: { text: string; loose: boolean }) => {
      const a = loose ? looseNorm(value) : norm(value);
      const b = loose ? looseNorm(b0) : norm(b0);
      switch (op) {
        case "=": { const x = num(a), y = num(b); return x !== null && y !== null ? x === y : a === b; }
        case "contains": return b !== "" ? a.includes(b) : a === "";
        case "starts": return a.startsWith(b);
        case "ends": return a.endsWith(b);
        case ">": case "<": case ">=": case "<=": {
          const x = num(a), y = num(b);
          const cmp = x !== null && y !== null ? x - y : a.localeCompare(b, undefined, { numeric: true });
          return op === ">" ? cmp > 0 : op === "<" ? cmp < 0 : op === ">=" ? cmp >= 0 : cmp <= 0;
        }
        default: return false;
      }
    };
    const any = operands.some(test);
    results.push(negate ? !any : any);
  }
  return cond.join === "or" ? results.some(Boolean) : results.every(Boolean);
}

type Node =
  | { kind: "text"; v: string }
  | { kind: "insert"; field: string; chain: string; raw: string }
  | { kind: "block"; cond: Cond | { error: string }; name: string; raw: string; yes: Node[]; no: Node[]; closed: boolean };

const TAG = /\{\{([^{}]*)\}\}/g;

/** Parses the text into nodes plus the problems found along the way. */
function parse(text: string): { nodes: Node[]; problems: string[] } {
  const parts: { tag?: string; text: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(TAG)) {
    if (m.index! > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ tag: m[1], text: m[0] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  const hasClosers = parts.some((p) => p.tag !== undefined && p.tag.trim().startsWith("/"));
  const problems: string[] = [];
  const root: Node[] = [];
  const stack: { block: Extract<Node, { kind: "block" }>; inElse: boolean }[] = [];
  const target = () => { const top = stack[stack.length - 1]; return top ? (top.inElse ? top.block.no : top.block.yes) : root; };
  for (const p of parts) {
    if (p.tag === undefined) { target().push({ kind: "text", v: p.text }); continue; }
    const body = p.tag.trim();
    if (body.startsWith("?")) {
      const bare = body.slice(1).trim();
      const simple = /^[^\s"“”=!<>,?|]+(?:\s+[^\s"“”=!<>,?|]+)*(?:\|.*)?$/.test(bare) && !WORD_OPS.has(bare.toLowerCase());
      if (!hasClosers && simple) {
        const [field, ...chain] = bare.split("|");
        target().push({ kind: "insert", field: field.trim(), chain: chain.length ? "|" + chain.join("|") : "", raw: p.text });
        continue;
      }
      const cond = parseCondition(body);
      const block: Extract<Node, { kind: "block" }> = { kind: "block", cond, name: "error" in cond ? "" : cond.clauses[0].field, raw: p.text, yes: [], no: [], closed: false };
      if ("error" in cond) problems.push(`${p.text}: ${cond.error}`);
      target().push(block);
      stack.push({ block, inElse: false });
    } else if (body.toLowerCase() === "else") {
      const top = stack[stack.length - 1];
      if (!top || top.inElse) { problems.push("{{else}} has no matching {{?…}} before it."); target().push({ kind: "text", v: p.text }); }
      else top.inElse = true;
    } else if (body.startsWith("/")) {
      const named = body.slice(1).trim();
      const top = stack.pop();
      if (!top) { problems.push(`${p.text} closes nothing.`); target().push({ kind: "text", v: p.text }); continue; }
      if (named && norm(named) !== norm(top.block.name)) problems.push(`${p.text} closes the block for ${top.block.name || "another condition"}.`);
      top.block.closed = true;
    } else {
      const [field, ...chain] = body.split("|");
      target().push({ kind: "insert", field: field.trim(), chain: chain.length ? "|" + chain.join("|") : "", raw: p.text });
    }
  }
  for (const { block } of stack) problems.push(`${block.raw} has no closing {{/}}.`);
  return { nodes: root, problems };
}

/**
 * Fills {{field}} tokens in static text from a record: "{{city}}, {{state}} {{zip}}" → "Portland, OR 97201".
 * Conditions ({{?title}}…{{/}}) keep punctuation from dangling when a value is missing. Runs of spaces are tidied and each
 * line trimmed, so "{{first}} {{middle}} {{last}}" never leaves a double space. Anything that is not a real field or a
 * well-formed condition stays as typed, so ordinary text survives.
 */
export function mergeText(text: string, record: RecordRow, specials: Specials = {}): string {
  if (!text.includes("{{")) return text;
  const lookup = makeLookup(record, specials);
  const { nodes } = parse(text);
  const render = (list: Node[]): string => list.map((n) => {
    if (n.kind === "text") return n.v;
    if (n.kind === "insert") { const v = lookup(n.field); return v === undefined ? n.raw : applyChain(v, n.chain); }
    if ("error" in n.cond) return n.raw + render(n.yes) + (n.no.length ? "{{else}}" + render(n.no) : "") + (n.closed ? "{{/}}" : "");
    if (!n.closed) return n.raw + render(n.yes) + (n.no.length ? "{{else}}" + render(n.no) : "");
    const ok = holds(n.cond, lookup);
    if (ok === null) return n.raw + render(n.yes) + (n.no.length ? "{{else}}" + render(n.no) : "") + "{{/}}"; // unknown field: show it as typed
    return render(ok ? n.yes : n.no);
  }).join("");
  return render(nodes).split("\n").map((line) => line.replace(/[ \t]{2,}/g, " ").trim()).join("\n");
}

function makeLookup(record: RecordRow, specials: Specials): Lookup {
  return (name) => {
    const key = name.trim();
    if (key in record) return (record[key] ?? "").trim();
    const spaced = key.replace(/\s+/g, "_");
    if (spaced in record) return (record[spaced] ?? "").trim();
    // Field names are matched without regard to case, as the Fields list shows them capitalised.
    const n = (k: string) => k.toLowerCase().replace(/[\s_]+/g, "_");
    const found = Object.keys(record).find((k) => n(k) === n(key));
    if (found !== undefined) return (record[found] ?? "").trim();
    return specials[key.toLowerCase()];
  };
}

/** Problems worth telling the person about while they write text: unclosed blocks, unknown fields, unreadable conditions. */
export function mergeIssues(text: string, fields: string[]): string[] {
  if (!text.includes("{{")) return [];
  const known = (name: string) => { const n = (k: string) => k.toLowerCase().replace(/[\s_]+/g, "_"); return fields.some((f) => n(f) === n(name)) || SPECIAL_NAMES.includes(name.trim().toLowerCase()); };
  const { nodes, problems } = parse(text);
  const out = [...problems];
  const walk = (list: Node[]) => list.forEach((n) => {
    if (n.kind === "insert") { if (!known(n.field)) out.push(`${n.raw}: there is no field called “${n.field}”.`); }
    else if (n.kind === "block") {
      if (!("error" in n.cond)) for (const c of n.cond.clauses) { if (!known(c.field)) out.push(`${n.raw}: there is no field called “${c.field}”.`); for (const v of c.values) if (v.kind === "field" && !known(v.v)) out.push(`${n.raw}: there is no field called “${v.v}”.`); }
      walk(n.yes); walk(n.no);
    }
  });
  walk(nodes);
  return [...new Set(out)];
}

/* ── Older projects used single braces, {name}. Upgrade them once, when a project is loaded. ── */

const LEGACY = /(?<!\{)\{([^{}|]+)((?:\|[^{}|]+)*)\}(?!\})/g;
/** Turns {field} into {{field}} when the field is a real column (or a special name), leaving every other brace alone. */
export function upgradeTokens(text: string, columns: Set<string>): string {
  if (!text.includes("{")) return text;
  // The short-lived {{#x}}…{{/x}} and {{^x}} sections become {{?x}}…{{/x}} and {{?x = ""}}.
  text = text.replace(/\{\{#\s*([^{}|]+?)\s*\}\}/g, "{{?$1}}").replace(/\{\{\^\s*([^{}|]+?)\s*\}\}/g, '{{?$1 = ""}}');
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
  const esc = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(/\{\{([^{}]*)\}\}/g, (whole, body: string) => {
    const t = body.trim();
    if (t.startsWith("/")) { const name = t.slice(1).trim(); const to = mapping[name]; return to && to !== name ? `{{/${to}}}` : whole; }
    if (t.startsWith("?")) {
      // Every ?field inside a condition: the name runs up to whatever follows it (an operator, and/or, a comma, a pipe or the end).
      let out = body;
      for (const [from, to] of Object.entries(mapping)) {
        if (!to || to === from) continue;
        out = out.replace(new RegExp(`\\?${esc(from)}(?=\\s|,|\\||=|!|<|>|$)`, "gi"), `?${to}`);
      }
      return out === body ? whole : `{{${out}}}`;
    }
    const m = t.match(/^([^|]+?)\s*((?:\|.*)?)$/);
    const to = m ? mapping[m[1].trim()] : undefined;
    return m && to && to !== m[1].trim() ? `{{${to}${m[2]}}}` : whole;
  });
}
