import type { ReactNode } from "react";

/** Inline: **bold**, *italic*, `code`, [text](url). */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /(<kbd>[^<]+<\/kbd>|\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g;
  let last = 0, n = 0;
  for (const match of text.matchAll(pattern)) {
    const at = match.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const token = match[0];
    const key = `${keyBase}-${n++}`;
    if (token.startsWith("<kbd>")) out.push(<kbd key={key}>{token.slice(5, -6)}</kbd>);
    else if (token.startsWith("**")) out.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith("`")) out.push(<code key={key}>{token.slice(1, -1)}</code>);
    else if (token.startsWith("[")) { const [, label, href] = /\[([^\]]+)\]\(([^)]+)\)/.exec(token)!; out.push(<a key={key} href={href} target="_blank" rel="noreferrer">{label}</a>); }
    else out.push(<em key={key}>{token.slice(1, -1)}</em>);
    last = at + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** A small Markdown renderer for the help text: headings, paragraphs, bullet and numbered lists, quotes, rules. */
export function renderMarkdown(source: string): ReactNode[] {
  const lines = source.replace(/\r/g, "").split("\n");
  const out: ReactNode[] = [];
  let i = 0, key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length, text = heading[2];
      const Tag = (`h${level + 1}`) as "h2" | "h3" | "h4";
      out.push(<Tag key={key++} id={slugify(text)}>{inline(text, `h${key}`)}</Tag>);
      i++; continue;
    }
    if (/^---+$/.test(line.trim())) { out.push(<hr key={key++} />); i++; continue; }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ""));
      out.push(<blockquote key={key++}>{inline(quote.join(" "), `q${key}`)}</blockquote>);
      continue;
    }
    const bullet = /^\s*[-*]\s+/, numbered = /^\s*\d+\.\s+/;
    if (bullet.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line);
      const items: ReactNode[] = [];
      while (i < lines.length && (ordered ? numbered : bullet).test(lines[i])) {
        let text = lines[i++].replace(ordered ? numbered : bullet, "");
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !bullet.test(lines[i])) text += " " + lines[i++].trim(); // wrapped continuation
        items.push(<li key={items.length}>{inline(text, `l${key}-${items.length}`)}</li>);
      }
      out.push(ordered ? <ol key={key++}>{items}</ol> : <ul key={key++}>{items}</ul>);
      continue;
    }
    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|>|\s*[-*]\s|\s*\d+\.\s|---)/.test(lines[i])) paragraph.push(lines[i++]);
    out.push(<p key={key++}>{inline(paragraph.join(" "), `p${key}`)}</p>);
  }
  return out;
}

/** The headings (levels 1–2) of a document, for a table of contents. */
export function headingsOf(source: string): { level: number; text: string; id: string }[] {
  return source.split("\n").flatMap((line) => { const m = /^(#{1,2})\s+(.*)$/.exec(line); return m ? [{ level: m[1].length, text: m[2], id: slugify(m[2]) }] : []; });
}
