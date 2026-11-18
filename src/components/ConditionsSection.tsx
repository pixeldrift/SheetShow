import { useMemo } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import type { Condition, ConditionGroup, ConditionalRule, DesignItem, RecordRow, RuleStyle } from "../types";
import { OPS, OP_LABELS, countFires, firedRules, needsValue } from "../lib/conditions";
import { prettyField, specialFields, uid } from "../lib/data";
import { NumberField, Section } from "./Fields";

type Patch = (patch: Partial<DesignItem>, key?: string) => void;
type Props = { item: DesignItem; patch: Patch; fields: string[]; records: RecordRow[]; record: RecordRow };

/** Which look-changes each kind of object can have, and how they're edited. */
const STYLE_ROWS: { key: keyof RuleStyle; label: string; types: DesignItem["type"][]; control: "color" | "percent" | "number" | "text" | "bold" | "italic" | "radius"; initial: (item: DesignItem) => unknown }[] = [
  { key: "color", label: "Text color", types: ["text"], control: "color", initial: () => "#c0392b" },
  { key: "weight", label: "Bold", types: ["text"], control: "bold", initial: () => 700 },
  { key: "italic", label: "Italic", types: ["text"], control: "italic", initial: () => true },
  { key: "fontSize", label: "Font size", types: ["text"], control: "number", initial: (i) => (i.fontSize ?? 12) * 1.25 },
  { key: "text", label: "Replace text", types: ["text"], control: "text", initial: () => "" },
  { key: "fill", label: "Fill color", types: ["rect"], control: "color", initial: () => "#d2692f" },
  { key: "stroke", label: "Frame color", types: ["rect", "image"], control: "color", initial: () => "#d2692f" },
  { key: "radius", label: "Corner radius", types: ["rect", "image"], control: "radius", initial: () => 50 },
  { key: "opacity", label: "Opacity", types: ["text", "rect", "image"], control: "percent", initial: () => 0.5 },
];

const newCondition = (field: string): Condition => ({ id: uid(), field, op: "equals", value: "" });
const newGroup = (field: string): ConditionGroup => ({ match: "all", conditions: [newCondition(field)] });

/** Conditional formatting: show or hide this object, or change how it looks, depending on a record's values. */
export function ConditionsSection({ item, patch, fields, records, record }: Props) {
  const rules = item.rules ?? [];
  const counts = useMemo(() => countFires(item, records), [item.rules, item.rulesMode, records]); // eslint-disable-line react-hooks/exhaustive-deps
  const fired = useMemo(() => new Set(firedRules(item, record).map((r) => r.id)), [item.rules, item.rulesMode, record]); // eslint-disable-line react-hooks/exhaustive-deps
  const first = fields[0] ?? "";
  const setRules = (next: ConditionalRule[]) => patch({ rules: next.length ? next : undefined }, `rules:${item.id}`);
  const update = (id: string, change: (rule: ConditionalRule) => ConditionalRule) => setRules(rules.map((r) => (r.id === id ? change(r) : r)));
  const move = (index: number, by: -1 | 1) => { const next = [...rules]; const j = index + by; if (j < 0 || j >= next.length) return; [next[index], next[j]] = [next[j], next[index]]; setRules(next); };

  const startShowOnly = () => setRules([{ id: uid(), when: newGroup(first), effects: { visible: true } }, { id: uid(), when: null, effects: { visible: false } }]);
  const startHide = () => setRules([{ id: uid(), when: newGroup(first), effects: { visible: false } }]);
  const startStyle = () => { const row = STYLE_ROWS.find((r) => r.types.includes(item.type) && r.control === "color") ?? STYLE_ROWS.find((r) => r.types.includes(item.type))!; setRules([{ id: uid(), when: newGroup(first), effects: { set: { [row.key]: row.initial(item) } as RuleStyle } }]); };

  const distinct = (field: string) => [...new Set(records.slice(0, 2000).map((r) => (r[field] ?? "").trim()).filter(Boolean))].slice(0, 40);

  return (
    <Section title="CONDITIONS" defaultOpen={rules.length > 0} unit={rules.length ? `${rules.length} RULE${rules.length === 1 ? "" : "S"}` : undefined}>
      {!rules.length ? (
        <>
          <p className="hint first">Show, hide or restyle this object depending on the data — for example a ribbon only for VIPs, or a different color for each ticket type.</p>
          <div className="quick-rules">
            <button className="button wide first" onClick={startShowOnly}>Show only when…</button>
            <button className="button wide" onClick={startHide}>Hide when…</button>
            <button className="button wide" onClick={startStyle}>Change its look when…</button>
          </div>
        </>
      ) : (
        <>
          {rules.map((rule, index) => (
            <div key={rule.id} className={fired.has(rule.id) ? "rule-card firing" : "rule-card"}>
              <div className="rule-card-head">
                <strong>{rule.when ? (index === 0 ? "If" : "Else if") : "Otherwise"}</strong>
                {fired.has(rule.id) && <span className="chip ok" title="This rule applies to the record being previewed">applies here</span>}
                <span className="rule-count" title="How many of the printed records this rule applies to">{counts[index]} of {records.length}</span>
                <button className="mini-button" aria-label="Move rule up" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={12} /></button>
                <button className="mini-button" aria-label="Move rule down" disabled={index === rules.length - 1} onClick={() => move(index, 1)}><ArrowDown size={12} /></button>
                <button className="mini-button" aria-label="Delete rule" onClick={() => setRules(rules.filter((r) => r.id !== rule.id))}><Trash2 size={13} /></button>
              </div>

              {rule.when && (
                <div className="cond-group">
                  <div className="cond-match">
                    <span>when</span>
                    <select className="select" value={rule.when.match} aria-label="How conditions combine" onChange={(e) => update(rule.id, (r) => ({ ...r, when: { ...r.when!, match: e.target.value as ConditionGroup["match"] } }))}>
                      <option value="all">all</option><option value="any">any</option><option value="none">none</option>
                    </select>
                    <span>of these {rule.when.match === "none" ? "are true (NOT)" : "are true"}</span>
                  </div>
                  {rule.when.conditions.map((c) => (
                    <div className="cond-row" key={c.id}>
                      <select className="select" value={c.field} aria-label="Field" onChange={(e) => update(rule.id, (r) => ({ ...r, when: { ...r.when!, conditions: r.when!.conditions.map((x) => (x.id === c.id ? { ...x, field: e.target.value } : x)) } }))}>
                        {fields.map((f) => <option key={f} value={f}>{prettyField(f)}</option>)}
                        {!fields.includes(c.field) && c.field && !c.field.startsWith("__") && <option value={c.field}>{c.field} (missing)</option>}
                        <optgroup label="Automatic">{specialFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</optgroup>
                      </select>
                      <select className="select" value={c.op} aria-label="Condition" onChange={(e) => update(rule.id, (r) => ({ ...r, when: { ...r.when!, conditions: r.when!.conditions.map((x) => (x.id === c.id ? { ...x, op: e.target.value as Condition["op"] } : x)) } }))}>
                        {OPS.map((op) => <option key={op} value={op}>{OP_LABELS[op]}</option>)}
                      </select>
                      {needsValue(c.op) && (
                        <>
                          <input className="property-input" list={`vals-${c.id}`} value={c.value} placeholder="value" aria-label="Value" onChange={(e) => update(rule.id, (r) => ({ ...r, when: { ...r.when!, conditions: r.when!.conditions.map((x) => (x.id === c.id ? { ...x, value: e.target.value } : x)) } }))} />
                          <datalist id={`vals-${c.id}`}>{distinct(c.field).map((v) => <option key={v} value={v} />)}</datalist>
                        </>
                      )}
                      <button className="mini-button" aria-label="Remove condition" disabled={rule.when!.conditions.length < 2} onClick={() => update(rule.id, (r) => ({ ...r, when: { ...r.when!, conditions: r.when!.conditions.filter((x) => x.id !== c.id) } }))}><X size={13} /></button>
                    </div>
                  ))}
                  <button className="link-button" onClick={() => update(rule.id, (r) => ({ ...r, when: { ...r.when!, conditions: [...r.when!.conditions, newCondition(first)] } }))}><Plus size={11} /> Add a condition</button>
                </div>
              )}

              <div className="effects">
                <div className="effect-row">
                  <span>then</span>
                  <select className="select" value={rule.effects.visible === undefined ? "" : rule.effects.visible ? "show" : "hide"} aria-label="Visibility"
                    onChange={(e) => update(rule.id, (r) => ({ ...r, effects: { ...r.effects, visible: e.target.value === "" ? undefined : e.target.value === "show" } }))}>
                    <option value="">keep it as it is</option><option value="show">show it</option><option value="hide">hide it</option>
                  </select>
                </div>
                {STYLE_ROWS.filter((row) => row.types.includes(item.type)).map((row) => {
                  const value = rule.effects.set?.[row.key];
                  const on = value !== undefined;
                  const setStyle = (v: unknown) => update(rule.id, (r) => { const set = { ...(r.effects.set ?? {}) } as Record<string, unknown>; if (v === undefined) delete set[row.key]; else set[row.key] = v; return { ...r, effects: { ...r.effects, set: Object.keys(set).length ? (set as RuleStyle) : undefined } }; });
                  return (
                    <div className="effect-row" key={row.key}>
                      <label className="check-row tight"><input type="checkbox" checked={on} onChange={(e) => setStyle(e.target.checked ? row.initial(item) : undefined)} /> {row.label}</label>
                      {on && row.control === "color" && <input type="color" aria-label={row.label} value={String(value)} onChange={(e) => setStyle(e.target.value)} />}
                      {on && row.control === "percent" && <input type="range" min="0" max="100" aria-label={row.label} value={Math.round(Number(value) * 100)} onChange={(e) => setStyle(Number(e.target.value) / 100)} />}
                      {on && row.control === "radius" && <input type="range" min="0" max="50" aria-label={row.label} value={Number(value)} onChange={(e) => setStyle(Number(e.target.value))} />}
                      {on && row.control === "number" && <NumberField value={Number(value)} min={4} max={300} step={1} places={1} unit="pt" onChange={(n) => setStyle(n)} />}
                      {on && row.control === "text" && <input className="property-input" value={String(value)} placeholder="Shown instead" aria-label="Replacement text" onChange={(e) => setStyle(e.target.value)} />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="rule-actions">
            <button className="button" onClick={() => setRules([...rules.filter((r) => r.when), { id: uid(), when: newGroup(first), effects: { visible: true } }, ...rules.filter((r) => !r.when)])}><Plus size={13} /> Add a rule</button>
            {!rules.some((r) => !r.when) && <button className="button" onClick={() => setRules([...rules, { id: uid(), when: null, effects: { visible: false } }])}>Add “otherwise”</button>}
          </div>
          <div className="spaced-block">
            <select className="select" value={item.rulesMode ?? "first"} aria-label="When several rules match" onChange={(e) => patch({ rulesMode: e.target.value as DesignItem["rulesMode"] })}>
              <option value="first">When several match, apply only the first</option>
              <option value="all">When several match, apply all (later ones win)</option>
            </select>
          </div>
          <p className="hint">An override on a single record always beats a rule. In the template editor, an object that a rule hides for the previewed record is shown faded so you can still select it.</p>
        </>
      )}
    </Section>
  );
}
