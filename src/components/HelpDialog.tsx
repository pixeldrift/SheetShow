import { useEffect, useMemo, useRef } from "react";
import { X } from "lucide-react";
import helpText from "../help/help.md?raw";
import { headingsOf, renderMarkdown } from "../lib/markdown";
import { Logo } from "./Logo";
import { updateGuide, useGuide } from "../lib/guide";
import { TOUR_NAMES, type TourId } from "../lib/tours";

/** The user guide: how to use SheetShow, plus who made it. Written in src/help/help.md. */
export function HelpDialog({ onClose, onReplayWelcome, onStartTour }: { onClose: () => void; onReplayWelcome: () => void; onStartTour: (id: TourId) => void }) {
  const guide = useGuide();
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
          <div className="help-brand"><Logo size={34} /><div><h2 id="help-title">SheetShow Help</h2></div></div>
          <button className="icon-button" aria-label="Close help" onClick={onClose}><X size={17} /></button>
        </div>
        <div className="help-layout">
          <nav className="help-toc" aria-label="Help topics">
            {toc.map((h) => <button key={h.id} onClick={() => jump(h.id)}>{h.text}</button>)}
          </nav>
          <div className="help-body" ref={body} data-scroll>
            <section className="guide-settings" aria-label="Guides and tips">
              <h3>Guides and tips</h3>
              <button className="button" onClick={onReplayWelcome}>Replay the welcome guide</button>
              <label className="check-row"><input type="checkbox" checked={guide.welcomeOnStart} onChange={(e) => updateGuide({ welcomeOnStart: e.target.checked })} /> Show the welcome guide whenever SheetShow opens</label>
              <label className="check-row"><input type="checkbox" checked={guide.tours} onChange={(e) => updateGuide({ tours: e.target.checked })} /> Offer a short tour the first time I open each tab</label>
              <div className="guide-tours"><span>Show the tour for:</span>{(Object.keys(TOUR_NAMES) as TourId[]).map((id) => <button key={id} className="button" onClick={() => onStartTour(id)}>{TOUR_NAMES[id]}</button>)}</div>
              <label className="check-row"><input type="checkbox" checked={guide.sparks} onChange={(e) => updateGuide({ sparks: e.target.checked })} /> Show ✦ sparks on features I haven't tried</label>
              <button className="button" onClick={() => updateGuide({ sparksSeen: {}, sparks: true })}>Bring the sparks back</button>
              <label className="check-row"><input type="checkbox" checked={guide.tapTips} onChange={(e) => updateGuide({ tapTips: e.target.checked })} /> On a touch screen, show a label when I tap a button</label>
            </section>
            {content}
          </div>
        </div>
      </div>
    </div>
  );
}
