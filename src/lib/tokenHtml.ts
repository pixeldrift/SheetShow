import { SPECIAL_NAMES } from "./merge";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** One {{ … }} tag found in a text. */
export type Tag = { start: number; end: number; raw: string; inner: string; kind: "ins" | "open" | "else" | "close" };

export function findTags(text: string): Tag[] {
  const out: Tag[] = [];
  for (const m of text.matchAll(/\{\{([^{}]*)\}\}/g)) {
    const inner = m[1].trim();
    out.push({ start: m.index!, end: m.index! + m[0].length, raw: m[0], inner, kind: inner.startsWith("?") ? "open" : inner.startsWith("/") ? "close" : inner.toLowerCase() === "else" ? "else" : "ins" });
  }
  return out;
}

const norm = (k: string) => k.toLowerCase().replace(/[\s_]+/g, "_");
export const isKnownField = (name: string, fields: string[]) => fields.some((f) => norm(f) === norm(name)) || SPECIAL_NAMES.includes(name.trim().toLowerCase());

const COND = /([“”"][^“”"]*[“”"])|(~)|\?([^\s"“”,=!<>?]+(?:\s+(?!(?:and|or)\b|!?(?:contains|starts|ends)\b)[^\s"“”,=!<>?]+)*)|(!=|>=|<=|[=<>]|!?\b(?:contains|starts|ends)\b)|(\band\b|\bor\b)|([\s\S])/g;

/** Color-coded HTML for the inside of a tag (the part between the braces). `raw` keeps surrounding spaces so offsets stay true. */
export function highlightInner(rawInner: string): string {
  const t = rawInner;
  const lead = t.match(/^\s*/)![0];
  const body = t.slice(lead.length);
  const spaced = (html: string) => esc(lead) + html;
  if (body.startsWith("/")) { const n = body.slice(1); return spaced('<span class="kw">/</span>' + (n.trim() ? `<span class="fn">${esc(n)}</span>` : esc(n))); }
  if (body.trim().toLowerCase() === "else") return spaced(`<span class="kw">${esc(body)}</span>`);
  if (body.startsWith("?")) {
    let out = "", m: RegExpExecArray | null;
    COND.lastIndex = 0;
    while ((m = COND.exec(body))) {
      if (m[1]) out += `<span class="q">${esc(m[1])}</span>`;
      else if (m[2]) out += '<span class="q">~</span>';
      else if (m[3]) out += `<span class="mk">?</span><span class="fn">${esc(m[3])}</span>`;
      else if (m[4]) out += `<span class="op">${esc(m[4])}</span>`;
      else if (m[5]) out += `<span class="kw">${m[5]}</span>`;
      else out += esc(m[6]);
    }
    return spaced(out);
  }
  const bar = body.indexOf("|");
  return spaced(bar < 0 ? `<span class="fn">${esc(body)}</span>` : `<span class="fn">${esc(body.slice(0, bar))}</span><span class="br">${esc(body.slice(bar))}</span>`);
}

/** The field a tag refers to, for the unknown-field check on insert tags. */
export const tagField = (tag: Tag) => tag.inner.replace(/^\?/, "").split("|")[0].trim();

/**
 * The editor's HTML for a text. `caret` is the collapsed caret position (or null when not focused): the tag it sits inside is
 * shown as raw text; every other tag is a chip (in chips mode) or color-coded raw text (in text mode).
 */
export function buildEditorHtml(text: string, mode: "chips" | "text", caret: number | null, fields: string[]): { html: string; activeStart: number } {
  const tags = findTags(text);
  let html = "", last = 0, activeStart = -1;
  const plain = (s: string) => esc(s);
  for (const tag of tags) {
    html += plain(text.slice(last, tag.start));
    last = tag.end;
    const active = caret !== null && caret > tag.start && caret < tag.end;
    if (active) activeStart = tag.start;
    const rawInner = tag.raw.slice(2, -2);
    const bad = tag.kind === "ins" && !isKnownField(tagField(tag), fields);
    if (mode === "chips" && !active) {
      let label: string;
      if (tag.kind === "ins") { const [name, ...chain] = tag.inner.split("|"); label = `<span class="fn">${esc(name.trim())}</span>${chain.length ? `<small>|${esc(chain.join("|"))}</small>` : ""}`; }
      else if (tag.kind === "close") label = `<span class="kw">end</span>${tag.inner.slice(1).trim() ? ` <span class="fn">${esc(tag.inner.slice(1).trim())}</span>` : ""}`;
      else label = highlightInner(rawInner.trim());
      html += `<span class="te-chip ${tag.kind}${bad ? " bad" : ""}" contenteditable="false" data-raw="${esc(tag.raw).replace(/"/g, "&quot;")}" data-start="${tag.start}">${label}</span>`;
    } else {
      html += `<span class="te-raw ${tag.kind}${active ? " active" : ""}${bad ? " bad" : ""}"><span class="br">{{</span>${highlightInner(rawInner)}<span class="br">}}</span></span>`;
    }
  }
  html += plain(text.slice(last));
  // A newline at the very end draws no line of its own; this invisible mark gives the caret somewhere to sit.
  if (text.endsWith("\n")) html += '<span class="te-pad">\u200b</span>';
  return { html, activeStart };
}
