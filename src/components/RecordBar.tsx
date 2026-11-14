import { ChevronLeft, ChevronRight, Database } from "lucide-react";

type Props = { label: string; position: number; total: number; name: string; onStep: (delta: number) => void };

export function RecordBar({ label, position, total, name, onStep }: Props) {
  return (
    <div className="record-bar">
      <div className="record-info"><div className="record-icon"><Database size={15} /></div><div><strong>Data preview</strong><span>{name}</span></div></div>
      <div className="record-controls">
        <button className="tool-button" aria-label={`Previous ${label.toLowerCase()}`} onClick={() => onStep(-1)} disabled={position <= 1}><ChevronLeft size={17} /></button>
        <div className="record-select"><span>{label}</span><strong>{String(position).padStart(2, "0")}</strong><span>/ {total}</span></div>
        <button className="tool-button" aria-label={`Next ${label.toLowerCase()}`} onClick={() => onStep(1)} disabled={position >= total}><ChevronRight size={17} /></button>
      </div>
    </div>
  );
}
