import { useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Printer, RotateCcw, Save, Trash2 } from "lucide-react";
import type { PrinterCalibration } from "../hooks/usePrinterCalibration";
import { NumberField, Pair, Section } from "./Fields";

const STEPS = [0.005, 0.01, 0.025, 0.05];
const mm = (inches: number) => `${(inches * 25.4).toFixed(2)} mm`;

/** Nudge everything on the printed page to correct a printer that prints slightly off. */
export function PrinterCalibrationSection({ printer, onTestSheet }: { printer: PrinterCalibration; onTestSheet: () => void }) {
  const [step, setStep] = useState(0.01);
  const moved = printer.x !== 0 || printer.y !== 0;
  const askSave = () => {
    const name = window.prompt("Name this printer setting", printer.active?.name ?? "Office printer");
    if (name !== null) printer.saveAs(name);
  };

  return (
    <Section title="PRINTER CALIBRATION" defaultOpen={false}>
      <p className="hint first">If your printer lands everything a little off the paper or label, move the whole page here. It shows on the sheet, in preview and in print, and is remembered on this device.</p>

      <div className="nudge-pad" role="group" aria-label="Move the printed page">
        <span />
        <button className="nudge" aria-label="Move up" title="Move everything up" onClick={() => printer.nudge(0, -step)}><ArrowUp size={16} /></button>
        <span />
        <button className="nudge" aria-label="Move left" title="Move everything left" onClick={() => printer.nudge(-step, 0)}><ArrowLeft size={16} /></button>
        <button className="nudge center" aria-label="Reset to zero" title="Back to zero" disabled={!moved} onClick={printer.reset}><RotateCcw size={14} /></button>
        <button className="nudge" aria-label="Move right" title="Move everything right" onClick={() => printer.nudge(step, 0)}><ArrowRight size={16} /></button>
        <span />
        <button className="nudge" aria-label="Move down" title="Move everything down" onClick={() => printer.nudge(0, step)}><ArrowDown size={16} /></button>
        <span />
      </div>

      <div className="step-row" role="group" aria-label="Nudge size">
        <span>Each nudge</span>
        {STEPS.map((s) => <button key={s} className={s === step ? "step-chip active" : "step-chip"} onClick={() => setStep(s)} title={mm(s)}>{s}″</button>)}
      </div>

      <div className="two-col spaced">
        <Pair label="Right (+) / left (−)"><NumberField value={printer.x} min={-1} max={1} step={0.005} places={3} unit="in" onChange={(n) => printer.setOffset(n, printer.y)} /></Pair>
        <Pair label="Down (+) / up (−)"><NumberField value={printer.y} min={-1} max={1} step={0.005} places={3} unit="in" onChange={(n) => printer.setOffset(printer.x, n)} /></Pair>
      </div>
      <p className="hint">{moved ? `Moved ${mm(Math.abs(printer.x))} ${printer.x >= 0 ? "right" : "left"} and ${mm(Math.abs(printer.y))} ${printer.y >= 0 ? "down" : "up"}.` : "Not moved."} 1/100″ is about a quarter of a millimetre.</p>

      <div className="spaced-block">
        <Pair label="Saved settings">
          <select className="select" value={printer.active?.id ?? ""} onChange={(e) => printer.select(e.target.value || null)}>
            <option value="">{printer.profiles.length ? "Not using a saved setting" : "None saved yet"}</option>
            {printer.profiles.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.x >= 0 ? "+" : ""}{p.x.toFixed(3)}, {p.y >= 0 ? "+" : ""}{p.y.toFixed(3)})</option>)}
          </select>
        </Pair>
        <div className="icon-row spaced-block">
          {printer.active && printer.dirty && <button className="wide-icon active" onClick={printer.updateActive} title={`Overwrite “${printer.active.name}” with these numbers`}><Save size={14} /> Update “{printer.active.name}”</button>}
          <button className="wide-icon" onClick={askSave}><Save size={14} /> Save as…</button>
          {printer.active && <button className="wide-icon" aria-label={`Delete ${printer.active.name}`} onClick={() => { if (window.confirm(`Delete the saved setting “${printer.active!.name}”?`)) printer.remove(printer.active!.id); }}><Trash2 size={14} /></button>}
        </div>
      </div>

      <button className="button wide" onClick={onTestSheet} title="Prints crosshairs exactly 1 inch from each page edge, plus an outline of every label"><Printer size={14} /> Print a calibration sheet</button>
      <p className="hint">Print it, then measure: the crosshairs should be exactly 1″ from each edge, and the outlines should sit on your labels (hold the sheet to a window over a label sheet). Nudge by the difference and print again.</p>
    </Section>
  );
}
