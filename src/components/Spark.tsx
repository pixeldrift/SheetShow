import { useEffect, useRef, useState } from "react";
import { guideSettings, updateGuide, useGuide } from "../lib/guide";

/**
 * A small pulsing ✦ on a feature you haven't tried. Tap it for a short tip. It goes away when you tap "Got it" or
 * use the thing it sits on. Put it inside the button or heading it describes. Switch sparks off in Help.
 */
export function Spark({ id, title, text }: { id: string; title: string; text: string }) {
  const guide = useGuide();
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState<{ x: number; y: number } | null>(null);
  const seen = !!guide.sparksSeen[id];
  const hide = () => { updateGuide({ sparksSeen: { ...guideSettings().sparksSeen, [id]: true } }); setOpen(null); };

  // Using the feature counts as having found it.
  useEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent || seen) return;
    parent.classList.add("has-spark");
    const used = (e: Event) => { if (!ref.current?.contains(e.target as Node)) hide(); };
    parent.addEventListener("click", used);
    return () => { parent.removeEventListener("click", used); parent.classList.remove("has-spark"); };
  }, [seen]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!(e.target as Element).closest(".spark-tip")) setOpen(null); };
    window.addEventListener("pointerdown", away, true);
    return () => window.removeEventListener("pointerdown", away, true);
  }, [open]);

  if (!guide.sparks || seen) return null;
  return (
    <>
      <span ref={ref} className="spark" role="img" aria-label={`Tip: ${title}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation(); e.preventDefault();
          const r = e.currentTarget.getBoundingClientRect();
          setOpen(open ? null : { x: Math.min(Math.max(r.left + r.width / 2, 130), window.innerWidth - 130), y: r.bottom + 8 });
        }}>✦</span>
      {open && (
        <span className="spark-tip" role="status" style={{ left: open.x, top: open.y }} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <strong>{title}</strong>
          <span>{text}</span>
          <span className="spark-actions">
            <button type="button" onClick={() => { updateGuide({ sparks: false }); setOpen(null); }}>Hide all tips</button>
            <button type="button" className="spark-ok" onClick={hide}>Got it</button>
          </span>
        </span>
      )}
    </>
  );
}
