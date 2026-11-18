import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, FileSpreadsheet, LayoutGrid, LayoutTemplate, Link2, Printer, Sparkles, X } from "lucide-react";
import { Logo } from "./Logo";
import { updateGuide, useGuide } from "../lib/guide";

type Place = "data" | "template" | "layout";
type Step = { icon: React.ReactNode; kicker: string; title: string; body: React.ReactNode; go?: { label: string; place: Place } };

const STEPS: Step[] = [
  {
    icon: <Logo size={64} />, kicker: "Welcome", title: "Welcome to SheetShow",
    body: <>
      <p>Turn the rows of a spreadsheet into designs that change from one record to the next: business cards, a batch of thank-you letters, conference badges, return-address stickers, and more.</p>
      <p>It takes a few steps. This guide walks through them, and you can open it again any time from <strong>Help</strong>.</p>
    </>,
  },
  {
    icon: <FileSpreadsheet size={34} />, kicker: "Step 1", title: "Import your spreadsheet",
    body: <>
      <p>Open a CSV or TSV file from your favorite spreadsheet app, paste straight from a spreadsheet, or open a Google Sheet by its link.</p>
      <p>No list yet? Start blank and type your records right inside SheetShow.</p>
    </>,
    go: { label: "Open the Data tab", place: "data" },
  },
  {
    icon: <LayoutTemplate size={34} />, kicker: "Step 2", title: "Design a template",
    body: <>
      <p>Design one card, label, or badge with text, shapes, and pictures. Start from a standard Avery size, or make any size you like.</p>
      <p>A design can change with your data. For example, show a different color or ribbon for presenters than for attendees. You can keep several templates in one project and mix them on a page.</p>
    </>,
    go: { label: "Open the Template tab", place: "template" },
  },
  {
    icon: <Link2 size={34} />, kicker: "Step 3", title: "Link your data",
    body: <>
      <p>Drag a field from the Fields drawer onto the canvas, or onto a text box, to link it.</p>
      <p>Step through your records in the bar at the bottom to see every card come to life. You can fix a typo right there, without importing the spreadsheet again.</p>
    </>,
    go: { label: "Open the Template tab", place: "template" },
  },
  {
    icon: <LayoutGrid size={34} />, kicker: "Step 4", title: "Arrange the sheet",
    body: <>
      <p>If you chose an Avery template, the sheet is already laid out for you. Or build your own: drag cards anywhere, turn them, and number them to choose which record each one shows.</p>
      <p>A project can have several page templates, such as a front and a back, or a whole welcome packet with a letter, a thank-you note, and a badge for every person.</p>
    </>,
    go: { label: "Open the Page layout tab", place: "layout" },
  },
  {
    icon: <Printer size={34} />, kicker: "Step 5", title: "Preview and print",
    body: <>
      <p>Flip through the sheets, check that every name fits, and print. Add crop marks or bleed for cards you will cut, and use the calibration sheet to line a design up with pre-cut label stock.</p>
    </>,
    go: { label: "Open the Page layout tab", place: "layout" },
  },
  {
    icon: <Sparkles size={34} />, kicker: "Step 6", title: "Go further",
    body: <>
      <p><strong>Pictures from your data.</strong> Match a picture to every record by file name. It's great for employee badges, inventory tags, and product labels.</p>
      <p><strong>Smart text.</strong> Combine several fields in one line, and add conditions that show text only when a record has a certain value.</p>
      <p><strong>Rules.</strong> Change a color, hide a layer, or swap in a different template depending on what is in a record.</p>
    </>,
  },
];

/** The first-run tour: a short, skippable walk through the steps. Plays once, and can be replayed from Help. */
export function WelcomeDialog({ onClose, onGo }: { onClose: () => void; onGo: (place: Place) => void }) {
  const guide = useGuide();
  const [index, setIndex] = useState(0);
  const [again, setAgain] = useState(guide.welcomeOnStart);
  const step = STEPS[index], last = index === STEPS.length - 1;
  const finish = () => { updateGuide({ welcomeSeen: true, welcomeOnStart: again }); onClose(); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight") setIndex((i) => Math.min(STEPS.length - 1, i + 1));
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="dialog-scrim welcome-scrim">
      <div className="dialog welcome-dialog" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
        <button className="icon-button welcome-skip" aria-label="Close the guide" onClick={finish}><X size={17} /></button>
        <div className="welcome-body" data-scroll key={index}>
          <div className="welcome-art" aria-hidden>{step.icon}</div>
          <span className="welcome-kicker">{step.kicker}</span>
          <h2 id="welcome-title">{step.title}</h2>
          <div className="welcome-text">{step.body}</div>
          {step.go && <button className="welcome-go" onClick={() => { finish(); onGo(step.go!.place); }}>{step.go.label} <ArrowRight size={14} /></button>}
        </div>
        <div className="welcome-dots" role="tablist" aria-label="Guide steps">
          {STEPS.map((s, i) => <button key={i} role="tab" aria-selected={i === index} aria-label={`${s.kicker}: ${s.title}`} className={i === index ? "active" : ""} onClick={() => setIndex(i)} />)}
        </div>
        <div className="dialog-foot welcome-foot">
          <label className="check-row"><input type="checkbox" checked={again} onChange={(e) => setAgain(e.target.checked)} /> Show this guide when SheetShow opens</label>
          <span className="spacer" />
          {!last && <button className="button" onClick={finish}>Skip</button>}
          {index > 0 && <button className="button" onClick={() => setIndex(index - 1)}><ArrowLeft size={14} /> Back</button>}
          {last ? <button className="button button-primary" onClick={finish}>Start designing</button> : <button className="button button-primary" onClick={() => setIndex(index + 1)}>Next <ArrowRight size={14} /></button>}
        </div>
      </div>
    </div>
  );
}
