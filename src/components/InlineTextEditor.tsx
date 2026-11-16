import { useEffect, useRef, type RefObject } from "react";
import { TokenEditor, type TokenEditorHandle } from "./TokenEditor";
import type { DesignItem } from "../types";
import { PX_PER_IN } from "../lib/data";
import { fontStack } from "../lib/fonts";
import { paddingsOf } from "../lib/shape";
import { spacingPx } from "../lib/text";

type Props = {
  item: DesignItem;
  svgRef: RefObject<SVGSVGElement>;
  zoom: number;
  draft: string;
  onChange: (draft: string) => void;
  /** Leaving the box (tapping elsewhere) saves. */
  onCommit: () => void;
  /** Escape throws the edit away. */
  onCancel: () => void;
  /** Field names, so unknown ones are flagged. */
  fields: string[];
};

/**
 * Edits a text object right on the canvas, over the object itself. Linked text is shown as its {{field}} tokens
 * while editing (the preview is paused), so field names and your own wording can be mixed.
 */
export function InlineTextEditor({ item, svgRef, zoom, draft, onChange, onCommit, onCancel, fields }: Props) {
  const ref = useRef<TokenEditorHandle>(null);
  const cancelled = useRef(false);
  const mountedAt = useRef(Date.now());
  useEffect(() => { const t = window.setTimeout(() => ref.current?.focus("select"), 0); return () => window.clearTimeout(t); }, []);
  // Pressing anywhere outside the box saves (the canvas swallows pointer presses, so blur alone would never fire).
  useEffect(() => {
    const away = (e: PointerEvent) => { const target = e.target as Node; if (ref.current?.element?.contains(target) || (target as HTMLElement).closest?.(".token-mode-toggle")) return; if (Date.now() - mountedAt.current > 450 && !cancelled.current) { cancelled.current = true; onCommit(); } };
    window.addEventListener("pointerdown", away, true);
    return () => window.removeEventListener("pointerdown", away, true);
  });
  

  const svg = svgRef.current;
  if (!svg) return null;
  const rect = svg.getBoundingClientRect();
  const scale = PX_PER_IN * zoom;
  const [pt, pr, pb, pl] = paddingsOf(item).map((v) => v * scale);
  const left = rect.left + item.x * scale, top = rect.top + item.y * scale;
  return (
    <>
      <TokenEditor
        ref={ref}
        className="inline-editor"
        ariaLabel="Edit text"
        value={draft}
        onChange={onChange}
        mode="text" /* on the canvas tokens stay plain, color-coded text; chips are left for the Properties box */
        fields={fields}
        onBlur={() => {
          if (cancelled.current) return;
          // A touch double-tap is followed by a synthesized mouse press that would blur us straight away: hold on to focus for a moment.
          if (Date.now() - mountedAt.current < 450) { ref.current?.focus(); return; }
          cancelled.current = true;
          onCommit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.preventDefault(); cancelled.current = true; onCancel(); }
          else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); ref.current?.blur(); }
        }}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: "fixed", left, top, width: Math.max(item.w * scale, 170), minHeight: item.h * scale,
          padding: `${pt}px ${pr}px ${pb}px ${pl}px`,
          fontFamily: fontStack(item.fontFamily), fontSize: ((item.fontSize ?? 12) * 96 / 72) * zoom, fontWeight: item.weight ?? 500, fontStyle: item.italic ? "italic" : "normal",
          textDecoration: item.underline ? "underline" : undefined, letterSpacing: item.letterSpacing ? `${spacingPx(item) * zoom}px` : undefined, fontKerning: item.kerning === false ? "none" : undefined, lineHeight: item.lineHeight ?? 1.2, color: item.color ?? "#34443d", textAlign: item.align ?? "left",
          transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined, transformOrigin: "center",
          whiteSpace: item.wrap === false ? "pre" : "pre-wrap",
        }}
      />
    </>
  );
}
