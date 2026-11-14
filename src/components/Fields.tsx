import { ReactNode, useEffect, useRef, useState } from "react";

/** Number input that lets you type freely (e.g. "1.") and only commits valid numbers. */
export function NumberField({ value, onChange, min, max, step = 0.01, unit, places = 3 }: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; unit?: string; places?: number }) {
  const format = (n: number) => String(Number(n.toFixed(places)));
  const [draft, setDraft] = useState(format(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(format(value)); }, [value]);
  return (
    <div className="number-input">
      <input
        type="number" inputMode="decimal" step={step} min={min} max={max} value={draft}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; setDraft(format(value)); }}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = parseFloat(e.target.value);
          if (!Number.isFinite(n)) return;
          onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n)));
        }}
      />
      {unit && <small>{unit}</small>}
    </div>
  );
}

export function Section({ title, unit, children }: { title: string; unit?: string; children: ReactNode }) {
  return <section className="property-section"><h3>{title}{unit && <span className="unit-label">{unit}</span>}</h3>{children}</section>;
}

export function Pair({ label, children }: { label: string; children: ReactNode }) {
  return <div className="pair"><span>{label}</span>{children}</div>;
}
