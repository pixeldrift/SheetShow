import type { ConditionalRule, DesignItem, Project, RecordRow, Sheet } from "../types";
import { fieldDisplayName } from "../lib/data";
import { starterRecords } from "../lib/data";

/** A starting point shown in the template gallery. Add your own by dropping a .json project into src/templates/. */
export type TemplatePreset = {
  id: string;
  name: string;
  description: string;
  /** What it's designed to print on, e.g. "Avery 8371 · 10 per sheet". */
  stock: string;
  project: Project;
};

const text = (id: string, x: number, y: number, w: number, h: number, value: string, o: Partial<DesignItem> = {}): DesignItem =>
  ({ id, type: "text", x, y, w, h, text: value, fontSize: 10, color: "#26352f", weight: 500, visible: true, ...o });
const field = (id: string, x: number, y: number, w: number, h: number, name: string, o: Partial<DesignItem> = {}): DesignItem =>
  text(id, x, y, w, h, fieldDisplayName(name), { field: name, ...o });
const box = (id: string, x: number, y: number, w: number, h: number, fill: string, o: Partial<DesignItem> = {}): DesignItem =>
  ({ id, type: "rect", x, y, w, h, fill, stroke: "none", visible: true, ...o });

const sheet = (o: Partial<Sheet>): Sheet => ({ pageWidth: 8.5, pageHeight: 11, columns: 1, rows: 1, gapX: 0, gapY: 0, marginX: 0.25, marginY: 0.25, repeatMode: "next", cropMarks: false, ...o });
const rows = (header: string[], lines: string[][]): RecordRow[] => lines.map((line) => Object.fromEntries(header.map((h, i) => [h, line[i] ?? ""])));

/* ── Business card ─────────────────────────────────────────────────────────── */
const card: TemplatePreset = {
  id: "business-card",
  name: "Business card",
  description: "A clean card with an accent bar. Names shrink to fit on one line.",
  stock: "Avery 8371 · 10 per sheet",
  project: {
    version: 1, name: "Business cards", fileName: "sample-people.csv",
    records: rows(["name", "title", "company", "phone", "email"], [
      ["Amelia Okonkwo", "Head of Design", "Northwind Studio", "(503) 555-0142", "amelia@northwind.example"],
      ["Tomás Villanueva-Hernández", "Senior Engineer", "Northwind Studio", "(503) 555-0177", "tomas@northwind.example"],
      ["Priya Raman", "Operations Lead", "Northwind Studio", "(503) 555-0108", "priya@northwind.example"],
      ["Jonas Eriksen", "Account Director", "Northwind Studio", "(503) 555-0163", "jonas@northwind.example"],
    ]),
    template: { width: 3.5, height: 2 },
    sheet: sheet({ columns: 2, rows: 5, gapX: 0.25, marginX: 0.5, marginY: 0.5 }),
    fonts: [],
    items: [
      box("bar", 0, 0, 0.18, 2, "#2f5f8a"),
      field("name", 0.45, 0.42, 2.8, 0.45, "name", { fontSize: 20, weight: 700, color: "#1f2d3a", autoFit: "width", minFontSize: 11 }),
      field("title", 0.45, 0.92, 2.8, 0.25, "title", { fontSize: 10, color: "#5b6b7a" }),
      field("company", 0.45, 1.16, 2.8, 0.22, "company", { fontSize: 9, weight: 700, color: "#2f5f8a" }),
      text("phone", 0.45, 1.5, 2.8, 0.18, "{phone}", { fontSize: 8, color: "#3b4a57" }),
      text("email", 0.45, 1.68, 2.8, 0.18, "{email}", { fontSize: 8, color: "#3b4a57" }),
    ],
  },
};

/* ── Address label ─────────────────────────────────────────────────────────── */
const address: TemplatePreset = {
  id: "address-label",
  name: "Address label",
  description: "Three lines, with the city, state and ZIP merged into one line.",
  stock: "Avery 5160 · 30 per sheet",
  project: {
    version: 1, name: "Address labels", fileName: "sample-addresses.csv",
    records: rows(["name", "street", "city", "state", "zip"], [
      ["Amelia Okonkwo", "1420 NW Everett St, Apt 5", "Portland", "OR", "97209"],
      ["Tomás Villanueva", "88 Harbor View Rd", "Astoria", "OR", "97103"],
      ["Priya Raman", "2301 Elm Street", "Eugene", "OR", "97401"],
      ["Jonas Eriksen", "17 Birchwood Lane", "Bend", "OR", "97702"],
    ]),
    template: { width: 2.625, height: 1 },
    sheet: sheet({ columns: 3, rows: 10, gapX: 0.125, marginX: 0.1875, marginY: 0.5 }),
    fonts: [],
    items: [
      field("name", 0.14, 0.12, 2.35, 0.26, "name", { fontSize: 11, weight: 700, autoFit: "width", minFontSize: 8 }),
      field("street", 0.14, 0.4, 2.35, 0.22, "street", { fontSize: 10, autoFit: "width", minFontSize: 7 }),
      text("city", 0.14, 0.64, 2.35, 0.22, "{city}, {state} {zip}", { fontSize: 10 }),
    ],
  },
};

/* ── Conference badge (two templates by rule, plus a meal symbol shown by a condition) ── */
/** Show an object only for guests whose meal choice is vegetarian or vegan. */
const veggieOnly = (id: string): ConditionalRule[] => [
  { id: `${id}-show`, when: { match: "any", conditions: [{ id: `${id}-c`, field: "meal", op: "oneOf", value: "Vegetarian, Vegan" }] }, effects: { visible: true } },
  { id: `${id}-else`, when: null, effects: { visible: false } },
];
const badgeItems = (color: string): DesignItem[] => [
  box("band", 0, 0, 4, 0.72, color),
  text("event", 0.3, 0.2, 3.4, 0.35, "DESIGN SUMMIT 2026", { fontSize: 15, weight: 700, color: "#ffffff" }),
  box("photo-bg", 0.3, 0.98, 1.15, 1.15, "#e7ecef", { radius: 50 }),
  { id: "photo", type: "image", x: 0.3, y: 0.98, w: 1.15, h: 1.15, radius: 50, stroke: color, strokeWidth: 2.5, imageSource: { mode: "pattern", pattern: "{name}" }, visible: true },
  field("name", 1.65, 1.0, 2.15, 0.78, "name", { fontSize: 24, weight: 700, color: "#1f2d3a", autoFit: "shrink", minFontSize: 12 }),
  field("org", 1.65, 1.86, 1.6, 0.3, "org", { fontSize: 12, color: "#51606d", autoFit: "width", minFontSize: 8 }),
  box("veg", 3.35, 1.84, 0.4, 0.4, "#3f8f5a", { radius: 50, rules: veggieOnly("veg") }),
  text("veg-v", 3.35, 1.9, 0.4, 0.3, "V", { fontSize: 14, weight: 700, color: "#ffffff", align: "center", rules: veggieOnly("veg-v") }),
  box("foot", 0, 2.5, 4, 0.5, color),
  field("ticket", 0, 2.6, 4, 0.3, "ticket", { fontSize: 14, weight: 700, color: "#ffffff", align: "center" }),
];
const badge: TemplatePreset = {
  id: "conference-badge",
  name: "Conference badge",
  description: "Speakers get an orange badge by rule, and vegetarian or vegan guests get a green V by a condition. Add photos in the image library to fill the circle.",
  stock: "4 × 3 in badges · 6 per sheet",
  project: {
    version: 1, name: "Conference badges", fileName: "sample-attendees.csv",
    records: rows(["name", "org", "ticket", "meal"], [
      ["Dr. Amelia Okonkwo", "Northwind Studio", "SPEAKER", "Standard"],
      ["Tomás Villanueva-Hernández", "Fabrikam Robotics", "ATTENDEE", "Vegetarian"],
      ["Priya Raman", "Contoso Health", "ATTENDEE", "Vegan"],
      ["Jonas Eriksen", "Tailspin Aviation", "SPEAKER", "Vegetarian"],
      ["Wanjiru Kamau", "Adventure Works", "ATTENDEE", "Standard"],
      ["Sofia Marchetti-Delacroix", "Litware Foods International", "ATTENDEE", "Gluten-free"],
    ]),
    template: { width: 4, height: 3 },
    sheet: sheet({ columns: 2, rows: 3, marginX: 0.25, marginY: 1 }),
    fonts: [],
    items: badgeItems("#2f5f8a"),
    variants: [
      { id: "a", name: "Attendee", items: badgeItems("#2f5f8a") },
      { id: "b", name: "Speaker", items: badgeItems("#d2692f") },
    ],
    rules: [{ id: "speakers", variantId: "b", kind: "field", field: "ticket", equals: "SPEAKER" }],
  },
};

/* ── Cage card ─────────────────────────────────────────────────────────────── */
const row = (id: string, y: number, label: string, name: string, extra: Partial<DesignItem> = {}): DesignItem[] => [
  text(`${id}-l`, 0.3, y + 0.06, 0.8, 0.2, label, { fontSize: 7, weight: 700, color: "#7d9a8a" }),
  field(id, 1.1, y, 2.6, 0.28, name, { fontSize: 12, color: "#1d3b2c", ...extra }),
];
const cage: TemplatePreset = {
  id: "cage-card",
  name: "Cage card",
  description: "Everything a keeper needs at a glance, using the bird sample data.",
  stock: "Avery 5164 · 6 per sheet",
  project: {
    version: 1, name: "Cage cards", fileName: "bird-records.csv",
    records: starterRecords.map((r) => ({ ...r })),
    template: { width: 4, height: 3.333 },
    sheet: sheet({ columns: 2, rows: 3, gapX: 0.1875, gapY: 0.167, marginX: 0.15625, marginY: 0.5 }),
    fonts: [],
    items: [
      box("frame", 0.05, 0.05, 3.9, 3.233, "#fffdf8", { stroke: "#2f6b4f", strokeWidth: 2, radius: 3 }),
      box("head", 0.05, 0.05, 3.9, 0.62, "#2f6b4f", { radius: 3 }),
      text("title", 0.3, 0.2, 2.2, 0.3, "CAGE CARD", { fontSize: 12, weight: 700, color: "#ffffff" }),
      field("num", 2.9, 0.2, 0.8, 0.3, "__record_number", { fontSize: 12, weight: 700, color: "#ffffff", align: "right" }),
      field("name", 0.3, 0.8, 3.4, 0.7, "name", { fontSize: 34, weight: 700, color: "#1d3b2c", autoFit: "width", minFontSize: 16 }),
      field("species", 0.3, 1.46, 3.4, 0.3, "species", { fontSize: 15, italic: true, color: "#4d6b5b", autoFit: "width", minFontSize: 9 }),
      ...row("band", 1.92, "BAND", "band"),
      ...row("location", 2.22, "LOCATION", "location", { autoFit: "width", minFontSize: 8 }),
      ...row("hatched", 2.52, "HATCHED", "hatch_date"),
      text("diet-l", 0.3, 2.88, 0.8, 0.2, "DIET", { fontSize: 7, weight: 700, color: "#7d9a8a" }),
      field("diet", 1.1, 2.82, 2.6, 0.36, "diet", { fontSize: 10, color: "#1d3b2c", overflow: "truncate" }),
    ],
  },
};

/* ── Price tags (two templates: regular / sale) ────────────────────────────── */
const priceItems = (sale: boolean): DesignItem[] => [
  field("name", 0.12, 0.1, 1.55, 0.44, "name", { fontSize: 11, weight: 700, autoFit: "shrink", minFontSize: 7, color: "#1d2b36" }),
  text("sku", 0.12, 0.66, 1.5, 0.18, "SKU {sku}", { fontSize: 7, color: "#8a96a0" }),
  text("price", 1.2, 0.24, 1.32, 0.6, "${price}", { fontSize: 30, weight: 700, align: "right", color: sale ? "#c0392b" : "#1d2b36", autoFit: "width", minFontSize: 14 }),
  ...(sale ? [box("sale", 2.025, 0, 0.6, 0.2, "#c0392b"), text("sale-t", 2.025, 0.03, 0.6, 0.15, "SALE", { fontSize: 8, weight: 700, color: "#ffffff", align: "center" })] : []),
];
const price: TemplatePreset = {
  id: "price-tags",
  name: "Price tags",
  description: "Items marked sale=yes get a red price and a SALE flag automatically.",
  stock: "Avery 5160 · 30 per sheet",
  project: {
    version: 1, name: "Price tags", fileName: "sample-products.csv",
    records: rows(["name", "sku", "price", "sale"], [
      ["Wildflower honey, 12 oz", "HN-1201", "8.50", "no"],
      ["Strawberry jam", "JM-0408", "6.25", "yes"],
      ["Sourdough loaf", "BK-0113", "7.00", "no"],
      ["Cold-pressed apple cider, half gallon", "CD-0622", "9.75", "yes"],
      ["Beeswax candle", "CN-3310", "12.00", "no"],
      ["Smoked sea salt", "SS-0090", "5.50", "no"],
    ]),
    template: { width: 2.625, height: 1 },
    sheet: sheet({ columns: 3, rows: 10, gapX: 0.125, marginX: 0.1875, marginY: 0.5 }),
    fonts: [],
    items: priceItems(false),
    variants: [
      { id: "a", name: "Regular", items: priceItems(false) },
      { id: "b", name: "Sale", items: priceItems(true) },
    ],
    rules: [{ id: "sale", variantId: "b", kind: "field", field: "sale", equals: "yes" }],
  },
};

export const BUILT_IN_PRESETS: TemplatePreset[] = [card, address, badge, cage, price];
