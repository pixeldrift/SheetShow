import { useEffect, useMemo, useRef } from "react";
import { X } from "lucide-react";
import helpText from "../help/help.md?raw";
import { headingsOf, renderMarkdown } from "../lib/markdown";
import { Logo } from "./Logo";

/** The user guide: how to use SheetShow, plus who made it. Written in src/help/help.md. */
export function HelpDialog({ onClose }: { onClose: () => void }) {
  const body = useRef<HTMLDivElement>(null);
  const content = useMemo(() => renderMarkdown(helpText), []);
  const toc = useMemo(() => headingsOf(helpText).filter((h) => h.level === 2), []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const jump = (id: string) => body.current?.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="dialog-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <div className="dialog-head">
          <div className="help-brand"><Logo size={34} /><div><h2 id="help-title">SheetShow Help</h2><p>Where data takes the stage</p></div></div>
          <button className="icon-button" aria-label="Close help" onClick={onClose}><X size={17} /></button>
        </div>
        <div className="help-layout">
          <nav className="help-toc" aria-label="Help topics">
            {toc.map((h) => <button key={h.id} onClick={() => jump(h.id)}>{h.text}</button>)}
          </nav>
          <div className="help-body" ref={body} data-scroll>{content}</div>
        </div>
      </div>
    </div>
  );
}
