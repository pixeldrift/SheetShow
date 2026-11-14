import type { Condition, ConditionGroup, ConditionOp, ConditionalRule, DesignItem, RecordMeta, RecordRow } from "../types";

export const OP_LABELS: Record<ConditionOp, string> = {
  equals: "is", notEquals: "is not", contains: "contains", notContains: "doesn’t contain", startsWith: "starts with", endsWith: "ends with",
  oneOf: "is one of", empty: "is empty", notEmpty: "is not empty", gt: "is greater than", gte: "is at least", lt: "is less than", lte: "is at most",
};
export const OPS = Object.keys(OP_LABELS) as ConditionOp[];
export const needsValue = (op: ConditionOp) => op !== "empty" && op !== "notEmpty";

const toNumber = (text: string) => { const n = Number(text.replace(/[$€£,%\s]/g, "")); return text.trim() !== "" && Number.isFinite(n) ? n : NaN; };

/** Numbers compare as numbers, then dates as dates, otherwise as natural text. */
function compare(a: string, b: string): number {
  const x = toNumber(a), y = toNumber(b);
  if (!Number.isNaN(x) && !Number.isNaN(y)) return x - y;
  const dx = Date.parse(a), dy = Date.parse(b);
  if (!Number.isNaN(dx) && !Number.isNaN(dy)) return dx - dy;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function evalCondition(c: Condition, raw: string): boolean {
  const v = raw.trim(), t = c.value.trim();
  const lv = v.toLowerCase(), lt = t.toLowerCase();
  switch (c.op) {
    case "equals": return lv === lt;
    case "notEquals": return lv !== lt;
    case "contains": return lv.includes(lt);
    case "notContains": return !lv.includes(lt);
    case "startsWith": return lv.startsWith(lt);
    case "endsWith": return lv.endsWith(lt);
    case "oneOf": return t.split(",").some((part) => part.trim().toLowerCase() === lv);
    case "empty": return v === "";
    case "notEmpty": return v !== "";
    case "gt": return v !== "" && compare(v, t) > 0;
    case "gte": return v !== "" && compare(v, t) >= 0;
    case "lt": return v !== "" && compare(v, t) < 0;
    case "lte": return v !== "" && compare(v, t) <= 0;
  }
}

/** A field's value for a record. The automatic fields (record number, page number…) can be used in conditions too. */
export function valueOf(field: string, record: RecordRow, meta?: RecordMeta): string {
  switch (field) {
    case "__record_number": return String(meta?.recordNumber ?? "");
    case "__page_number": return String(meta?.pageNumber ?? "");
    case "__record_count": return String(meta?.recordCount ?? "");
    case "__page_count": return String(meta?.pageCount ?? "");
    default: return record[field] ?? "";
  }
}

export function evalGroup(group: ConditionGroup, record: RecordRow, meta?: RecordMeta): boolean {
  if (!group.conditions.length) return false; // an empty rule never fires, so a half-built rule can't hide things by accident
  const results = group.conditions.map((c) => evalCondition(c, valueOf(c.field, record, meta)));
  return group.match === "all" ? results.every(Boolean) : group.match === "any" ? results.some(Boolean) : !results.some(Boolean);
}

/** Which rules fire for a record, in order. First-match mode stops at the first; "otherwise" fires only if nothing before it did. */
export function firedRules(item: DesignItem, record: RecordRow, meta?: RecordMeta): ConditionalRule[] {
  const rules = item.rules ?? [];
  const fired: ConditionalRule[] = [];
  for (const rule of rules) {
    const matches = rule.when === null ? fired.length === 0 : evalGroup(rule.when, record, meta);
    if (!matches) continue;
    fired.push(rule);
    if ((item.rulesMode ?? "first") === "first") break;
  }
  return fired;
}

/**
 * The item as it should look for one record. `ghost` (the editor) keeps rule-hidden items, marked so they can be
 * drawn faded and stay selectable; otherwise they become invisible.
 */
export function resolveConditions(item: DesignItem, record: RecordRow, meta?: RecordMeta, ghost = false): DesignItem {
  if (!item.rules?.length) return item;
  const fired = firedRules(item, record, meta);
  if (!fired.length) return item;
  let out: DesignItem = { ...item };
  for (const rule of fired) {
    if (rule.effects.set) {
      out = { ...out, ...rule.effects.set };
      if (rule.effects.set.radius !== undefined) { out.radiusUnit = "pct"; delete out.radii; } // a rule's radius is always a percentage
    }
    if (rule.effects.visible !== undefined) out.visible = rule.effects.visible;
  }
  if (ghost && out.visible === false && item.visible !== false) { out.visible = true; out._ruleHidden = true; }
  return out;
}

export const applyConditions = (items: DesignItem[], record: RecordRow, meta?: RecordMeta, ghost = false) =>
  items.some((item) => item.rules?.length) ? items.map((item) => resolveConditions(item, record, meta, ghost)) : items;

/** How many of the given records fire each rule (so the editor can say "matches 12 of 80 records"). */
export function countFires(item: DesignItem, records: RecordRow[]): number[] {
  const counts = (item.rules ?? []).map(() => 0);
  records.slice(0, 5000).forEach((record, i) => {
    const meta: RecordMeta = { recordNumber: i + 1, pageNumber: 1, recordCount: records.length, pageCount: 1 };
    for (const rule of firedRules(item, record, meta)) counts[(item.rules ?? []).indexOf(rule)]++;
  });
  return counts;
}

/** Every field the rules look at (used to keep them connected when columns are renamed or re-mapped). */
export const ruleFields = (item: DesignItem): string[] => (item.rules ?? []).flatMap((r) => r.when?.conditions.map((c) => c.field) ?? []);
