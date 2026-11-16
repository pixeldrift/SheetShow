import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { RecordRow, Sheet, Variant, VariantRule } from "../types";
import { prettyField, uid } from "../lib/data";
import { nthLabel, pickVariant } from "../lib/instances";
import { NumberField, Pair, Section } from "./Fields";

type Props = {
  variants: Variant[];
  activeId: string;
  rules: VariantRule[];
  fields: string[];
  records: RecordRow[];
  basis: NonNullable<Sheet["variantBasis"]>;
  onActivate: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onRules: (rules: VariantRule[]) => void;
  onBasis: (basis: NonNullable<Sheet["variantBasis"]>) => void;
};

/** Several templates combined into one output, like alternating row colors in a table. */
export function VariantsSection(p: Props) {
  const multiple = p.variants.length > 1;
  const preview = useMemo(() => p.records.slice(0, 12).map((record, i) => {
    const id = pickVariant(p.rules, p.variants, record, i, i, p.basis);
    return (p.variants.findIndex((v) => v.id === id) + 10).toString(36).toUpperCase();
  }).join(" "), [p.records, p.rules, p.variants, p.basis]);

  const setRule = (id: string, change: Partial<VariantRule>) => p.onRules(p.rules.map((r) => (r.id === id ? ({ ...r, ...change } as VariantRule) : r)));
  const addRule = () => p.onRules([...p.rules, { id: uid(), variantId: p.variants[1]?.id ?? p.variants[0].id, kind: "nth", every: 2, start: 2 }]);

  return (
    <Section title="ALTERNATING TEMPLATES">
      <p className="hint first">Make more than one template, then say which records use which — for example every other badge in a different color.</p>
      <div className="variant-list">
        {p.variants.map((v, i) => (
          <div key={v.id} className={v.id === p.activeId ? "variant-row active" : "variant-row"}>
            <button className="variant-letter" onClick={() => p.onActivate(v.id)} aria-label={`Edit ${v.name}`} title="Edit this template">{String.fromCharCode(65 + i)}</button>
            <input className="variant-name" value={v.name} onChange={(e) => p.onRename(v.id, e.target.value)} aria-label="Template name" />
            {multiple && <button className="mini-button" title="Delete this template" aria-label={`Delete ${v.name}`} onClick={() => p.onDelete(v.id)}><Trash2 size={13} /></button>}
          </div>
        ))}
      </div>
      <button className="button wide" onClick={p.onAdd}><Plus size={14} /> Add a template (copy of this one)</button>

      {multiple && (
        <>
          <div className="rules-head">WHICH RECORDS USE WHICH</div>
          <p className="hint first">Rules are checked top to bottom. Records that match none use the first template.</p>
          {p.rules.map((rule) => (
            <div className="rule-row" key={rule.id}>
              <div className="rule-line">
                <span>Use</span>
                <select className="select" value={rule.variantId} onChange={(e) => setRule(rule.id, { variantId: e.target.value })} aria-label="Template">{p.variants.map((v, i) => <option key={v.id} value={v.id}>{String.fromCharCode(65 + i)} · {v.name}</option>)}</select>
                <button className="mini-button" title="Remove rule" aria-label="Remove rule" onClick={() => p.onRules(p.rules.filter((r) => r.id !== rule.id))}><Trash2 size={13} /></button>
              </div>
              <div className="rule-line">
                <span>for</span>
                <select className="select" value={rule.kind === "field" ? "field" : rule.every === 2 && rule.start === 1 ? "odd" : rule.every === 2 && rule.start === 2 ? "even" : "nth"}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "odd") p.onRules(p.rules.map((r) => (r.id === rule.id ? { id: r.id, variantId: r.variantId, kind: "nth", every: 2, start: 1 } : r)));
                    else if (v === "even") p.onRules(p.rules.map((r) => (r.id === rule.id ? { id: r.id, variantId: r.variantId, kind: "nth", every: 2, start: 2 } : r)));
                    else if (v === "nth") p.onRules(p.rules.map((r) => (r.id === rule.id ? { id: r.id, variantId: r.variantId, kind: "nth", every: 3, start: 3 } : r)));
                    else p.onRules(p.rules.map((r) => (r.id === rule.id ? { id: r.id, variantId: r.variantId, kind: "field", field: p.fields[0] ?? "", equals: "" } : r)));
                  }} aria-label="Which records">
                  <option value="odd">odd records (1, 3, 5…)</option><option value="even">even records (2, 4, 6…)</option><option value="nth">every n-th record…</option><option value="field">records where a field equals…</option>
                </select>
              </div>
              {rule.kind === "nth" && !(rule.every === 2 && (rule.start === 1 || rule.start === 2)) && (
                <div className="two-col rule-line">
                  <Pair label="Every"><NumberField value={rule.every} min={1} max={99} step={1} places={0} onChange={(n) => setRule(rule.id, { every: Math.round(n) })} /></Pair>
                  <Pair label="Starting at"><NumberField value={rule.start} min={1} max={99} step={1} places={0} onChange={(n) => setRule(rule.id, { start: Math.round(n) })} /></Pair>
                </div>
              )}
              {rule.kind === "field" && (
                <div className="two-col rule-line">
                  <Pair label="Field"><select className="select" value={rule.field} onChange={(e) => setRule(rule.id, { field: e.target.value })}>{p.fields.map((f) => <option key={f} value={f}>{prettyField(f)}</option>)}</select></Pair>
                  <Pair label="Equals"><input className="property-input" value={rule.equals} onChange={(e) => setRule(rule.id, { equals: e.target.value })} placeholder="e.g. VIP" /></Pair>
                </div>
              )}
              {rule.kind === "nth" && <p className="hint first">= {nthLabel(rule.every, rule.start)}</p>}
            </div>
          ))}
          <button className="button wide" onClick={addRule}><Plus size={14} /> Add a rule</button>
          <Pair label="Count by">
            <select className="select" value={p.basis} onChange={(e) => p.onBasis(e.target.value as Props["basis"])}>
              <option value="record">Record order</option><option value="slot">Position on each sheet</option>
            </select>
          </Pair>
          <div className="variant-preview" title="Which template the first records use"><span>First records:</span><strong>{preview || "—"}</strong></div>
        </>
      )}
    </Section>
  );
}
