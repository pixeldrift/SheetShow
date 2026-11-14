import { ReactNode, useEffect, useRef, useState } from "react";

/**
 * Number input that lets you type freely (e.g. "1.") and only commits valid numbers.
 * While you're typing it shows your draft; otherwise it always shows the real value. A change from elsewhere
 * (undo, a ±90° button) is adopted even if this field still has focus, as Safari doesn't blur it on button clicks.
 */
export function NumberField({ value, onChange, min, max, step = 0.01, unit, places = 3 }: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; unit?: string; places?: number }) {
  const format = (n: number) => String(Number(n.toFixed(places)));
  const [draft, setDraft] = useState<string | null>(null); // null = not editing
  const lastCommitted = useRef<number | null>(null);
  useEffect(() => {
    if (value !== lastCommitted.current) { lastCommitted.current = null; setDraft((d) => (d === null ? null : format(value))); }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="number-input">
      <input
        type="number" inputMode="decimal" step={step} min={min} max={max} value={draft ?? format(value)}
        onFocus={() => setDraft(format(value))}
        onBlur={() => setDraft(null)}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = parseFloat(e.target.value);
          if (!Number.isFinite(n)) return;
          const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
          lastCommitted.current = clamped;
          onChange(clamped);
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
