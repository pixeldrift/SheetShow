import type { DesignItem, InstanceOverride, ItemPatch, RecordRow, Variant, VariantRule } from "../types";

/** Which template a record uses. Rules are checked in order; nothing matching means the first template. */
export function pickVariant(rules: VariantRule[], variants: Variant[], record: RecordRow, index: number, slot: number, basis: "record" | "slot"): string {
  const position = (basis === "slot" ? slot : index) + 1; // 1-based, like CSS :nth-child
  for (const rule of rules) {
    if (!variants.some((v) => v.id === rule.variantId)) continue;
    if (rule.kind === "nth") {
      const every = Math.max(1, Math.round(rule.every));
      if (position >= rule.start && (position - rule.start) % every === 0) return rule.variantId;
    } else if ((record[rule.field] ?? "").trim().toLowerCase() === rule.equals.trim().toLowerCase()) return rule.variantId;
  }
  return variants[0]?.id ?? "a";
}

export const nthLabel = (every: number, start: number) =>
  every === 2 && start === 1 ? "odd records" : every === 2 && start === 2 ? "even records" : every === 1 ? "every record" : `every ${ordinal(every)} record starting at ${start}`;
const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][(n % 100 >= 11 && n % 100 <= 13) || n % 10 > 3 ? 0 : n % 10]}`;

export const hasEdits = (override?: InstanceOverride) => !!override && Object.keys(override.items).length > 0;

/** The template's items with one record's hand edits applied (unless they're switched off). */
export function applyOverride(items: DesignItem[], override?: InstanceOverride): DesignItem[] {
  if (!override || override.off || !hasEdits(override)) return items;
  return items.map((item) => {
    const patch = override.items[item.id];
    return patch ? applyPatch(item, patch) : item;
  });
}

export function applyPatch(item: DesignItem, patch: ItemPatch): DesignItem {
  const next: Record<string, unknown> = { ...item };
  for (const [key, value] of Object.entries(patch)) { if (value === null) delete next[key]; else next[key] = value; }
  return next as unknown as DesignItem;
}

/** Turns an inspector patch (where `undefined` clears a property) into one that survives JSON. */
export const toItemPatch = (patch: Partial<DesignItem>): ItemPatch =>
  Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === undefined ? null : v])) as ItemPatch;
