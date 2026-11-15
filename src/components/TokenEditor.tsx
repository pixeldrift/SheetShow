import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from "react";
import { buildEditorHtml, findTags } from "../lib/tokenHtml";
import type { TokenMode } from "../lib/tokenMode";

export type TokenEditorHandle = { focus: (where?: "select" | "end") => void; blur: () => void; element: HTMLDivElement | null };

type Props = {
  value: string;
  onChange: (value: string) => void;
  mode: TokenMode;
  /** Field names, to flag unknown ones. */
  fields: string[];
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
  placeholder?: string;
  onBlur?: () => void;
  /** Called first; call preventDefault to stop the editor handling the key itself. */
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
};

/** The plain text an editor DOM (or a fragment of it) stands for: chips count as their raw {{…}} text. */
function serialize(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node as Text).data;
  if (node instanceof HTMLElement) {
    if (node.classList.contains("te-chip")) return node.dataset.raw ?? "";
    if (node.classList.contains("te-pad")) return "";
    if (node.tagName === "BR") return "\n";
  }
  let out = "";
  node.childNodes.forEach((child) => { out += serialize(child); });
  return out;
}

/** The text of a range, measured from the start of the editor. */
const offsetOf = (root: HTMLElement, node: Node, offset: number) => {
  const r = document.createRange();
  r.setStart(root, 0);
  r.setEnd(node, offset);
  return serialize(r.cloneContents()).length;
};

/** The DOM position for a plain-text offset. */
function locate(root: HTMLElement, offset: number): { node: Node; offset: number } {
  let seen = 0;
  const kids = Array.from(root.childNodes);
  for (let i = 0; i < kids.length; i++) {
    const kid = kids[i];
    const len = serialize(kid).length;
    if (kid.nodeType === Node.TEXT_NODE) { if (offset <= seen + len) return { node: kid, offset: offset - seen }; }
    else if (kid instanceof HTMLElement && kid.classList.contains("te-chip")) {
      if (offset <= seen) return { node: root, offset: i };
      if (offset <= seen + len) return { node: root, offset: i + 1 };
    } else if (offset <= seen + len) {
      // inside a raw tag: walk its text nodes
      const walker = document.createTreeWalker(kid, NodeFilter.SHOW_TEXT);
      let inner = seen, t: Node | null;
      while ((t = walker.nextNode())) { const l = (t as Text).data.length; if (offset <= inner + l) return { node: t, offset: offset - inner }; inner += l; }
    }
    seen += len;
  }
  return { node: root, offset: root.childNodes.length };
}

/**
 * A text editor that understands {{tokens}}. In chips mode every token is a chip except the one the caret is in, which turns
 * into plain text so it can be edited; in text mode all tokens stay text, colour-coded. Either way the value is plain text.
 */
export const TokenEditor = forwardRef<TokenEditorHandle, Props>(function TokenEditor({ value, onChange, mode, fields, className, style, ariaLabel, placeholder, onBlur, onKeyDown, onPointerDown }, handle) {
  const root = useRef<HTMLDivElement>(null);
  const shown = useRef({ value: "", mode: "" as string, active: -2 });
  const latest = useRef({ value, mode, fields, onChange });
  latest.current = { value, mode, fields, onChange };
  const composing = useRef(false);
  const history = useRef<{ v: string; c: [number, number] }[]>([{ v: value, c: [value.length, value.length] }]);
  const historyAt = useRef(0);
  const lastPush = useRef(0);

  const caretNow = (): [number, number] | null => {
    const el = root.current, sel = window.getSelection();
    if (!el || !sel || !sel.rangeCount || !el.contains(sel.anchorNode) || !el.contains(sel.focusNode)) return null;
    const a = offsetOf(el, sel.anchorNode!, sel.anchorOffset), b = offsetOf(el, sel.focusNode!, sel.focusOffset);
    return [Math.min(a, b), Math.max(a, b)];
  };
  const setCaret = (start: number, end = start) => {
    const el = root.current, sel = window.getSelection();
    if (!el || !sel) return;
    const a = locate(el, start), b = start === end ? a : locate(el, end);
    const r = document.createRange();
    r.setStart(a.node, a.offset);
    r.setEnd(b.node, b.offset);
    sel.removeAllRanges();
    sel.addRange(r);
  };

  /** Draw `text`. `caret` is where to put the caret afterwards (null leaves the selection alone, e.g. when not focused). */
  const draw = (text: string, caret: [number, number] | null) => {
    const el = root.current;
    if (!el) return;
    const focused = document.activeElement === el;
    const collapsed = caret && caret[0] === caret[1] ? caret[0] : null;
    const { html, activeStart } = buildEditorHtml(text, latest.current.mode, focused ? collapsed ?? (caret ? null : null) : null, latest.current.fields);
    el.innerHTML = html;
    shown.current = { value: text, mode: latest.current.mode, active: activeStart };
    if (focused && caret) setCaret(caret[0], caret[1]);
  };

  const commit = (text: string, caret: [number, number], coalesce = false) => {
    draw(text, caret);
    const now = Date.now();
    if (coalesce && now - lastPush.current < 600 && historyAt.current === history.current.length - 1) history.current[historyAt.current] = { v: text, c: caret };
    else { history.current = [...history.current.slice(0, historyAt.current + 1), { v: text, c: caret }]; historyAt.current = history.current.length - 1; }
    lastPush.current = now;
    if (text !== latest.current.value) latest.current.onChange(text);
  };

  // Outside changes (undo elsewhere, a mode switch, a new field list) redraw.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    if (shown.current.value !== value || shown.current.mode !== mode) draw(value, caretNow());
    else if (document.activeElement !== el) draw(value, null);
  }, [value, mode, fields.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Moving the caret into or out of a token swaps it between chip and text.
  useEffect(() => {
    const onSelection = () => {
      const el = root.current;
      if (!el || document.activeElement !== el || composing.current || latest.current.mode !== "chips") return;
      const c = caretNow();
      if (!c) return;
      const text = shown.current.value;
      const caret = c[0] === c[1] ? c[0] : null;
      const active = caret === null ? -1 : (findTags(text).find((t) => caret > t.start && caret < t.end)?.start ?? -1);
      if (active !== shown.current.active) draw(text, c);
    };
    document.addEventListener("selectionchange", onSelection);
    return () => document.removeEventListener("selectionchange", onSelection);
  }, []);

  useImperativeHandle(handle, () => ({
    focus: (where) => {
      const el = root.current;
      if (!el) return;
      el.focus();
      const n = latest.current.value.length;
      draw(latest.current.value, where === "select" ? [0, n] : [n, n]);
    },
    blur: () => root.current?.blur(),
    get element() { return root.current; },
  }));

  const insertText = (text: string) => {
    const c = caretNow();
    if (!c) return;
    const v = shown.current.value;
    const next = v.slice(0, c[0]) + text + v.slice(c[1]);
    const at = c[0] + text.length;
    commit(next, [at, at]);
  };

  const keyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    if (mod && (key === "z" || key === "y")) {
      e.preventDefault();
      const redo = key === "y" || e.shiftKey;
      const to = historyAt.current + (redo ? 1 : -1);
      if (to < 0 || to >= history.current.length) return;
      historyAt.current = to;
      const snap = history.current[to];
      draw(snap.v, snap.c);
      if (snap.v !== latest.current.value) latest.current.onChange(snap.v);
      return;
    }
    if (mod) return;
    if (e.key === "Enter") { e.preventDefault(); insertText("\n"); return; }
    const c = caretNow();
    if (!c || c[0] !== c[1] || latest.current.mode !== "chips") return;
    const text = shown.current.value;
    const tags = findTags(text);
    if (e.key === "ArrowLeft" && !e.shiftKey) { const t = tags.find((x) => x.end === c[0]); if (t) { e.preventDefault(); draw(text, [t.end - 2, t.end - 2]); } }
    else if (e.key === "ArrowRight" && !e.shiftKey) { const t = tags.find((x) => x.start === c[0]); if (t) { e.preventDefault(); draw(text, [t.start + 2, t.start + 2]); } }
    else if (e.key === "Backspace") { const t = tags.find((x) => x.end === c[0]); if (t) { e.preventDefault(); commit(text.slice(0, t.start) + text.slice(t.end), [t.start, t.start]); } }
    else if (e.key === "Delete") { const t = tags.find((x) => x.start === c[0]); if (t) { e.preventDefault(); commit(text.slice(0, t.start) + text.slice(t.end), [t.start, t.start]); } }
  };

  const input = () => {
    const el = root.current;
    if (!el || composing.current) return;
    const text = serialize(el).replace(/​/g, "");
    commit(text, caretNow() ?? [text.length, text.length], true);
  };

  return (
    <div
      ref={root}
      className={`token-editor ${className ?? ""}`}
      style={style}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={ariaLabel}
      data-placeholder={placeholder}
      spellCheck={false}
      onInput={input}
      onKeyDown={keyDown}
      onPointerDown={onPointerDown}
      onFocus={() => draw(shown.current.value, caretNow())}
      onBlur={() => { draw(shown.current.value, null); onBlur?.(); }}
      onCompositionStart={() => { composing.current = true; }}
      onCompositionEnd={() => { composing.current = false; input(); }}
      onMouseDown={(e) => {
        // Pressing a chip opens it for editing, with the caret at the end of its text.
        const chip = (e.target as HTMLElement).closest<HTMLElement>(".te-chip");
        if (!chip || !root.current?.contains(chip)) return;
        e.preventDefault();
        const start = Number(chip.dataset.start);
        const tag = findTags(shown.current.value).find((t) => t.start === start);
        root.current.focus();
        if (tag) draw(shown.current.value, [tag.end - 2, tag.end - 2]);
      }}
      onPaste={(e) => { e.preventDefault(); insertText(e.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n")); }}
      onCopy={(e) => { const sel = window.getSelection(); if (sel && sel.rangeCount) { e.preventDefault(); e.clipboardData.setData("text/plain", serialize(sel.getRangeAt(0).cloneContents())); } }}
      onCut={(e) => { const sel = window.getSelection(); if (sel && sel.rangeCount) { e.preventDefault(); e.clipboardData.setData("text/plain", serialize(sel.getRangeAt(0).cloneContents())); insertText(""); } }}
      onDrop={(e) => e.preventDefault()}
    />
  );
});
