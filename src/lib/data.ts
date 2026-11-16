import type { DesignItem, LabelPreset, RecordMeta, RecordRow } from "../types";
import { mergeText, specialValues } from "./merge";

export const PX_PER_IN = 96;
export const uid = () => Math.random().toString(36).slice(2, 9);
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const round = (n: number, places = 3) => Number(n.toFixed(places));

export const starterRecords: RecordRow[] = [
  { first: "Maya", last: "Chen", title: "Operations Lead", company: "Harbor Coffee Co.", email: "maya.chen@harborcoffee.example" },
  { first: "Daniel", last: "Okafor", title: "Head Roaster", company: "Harbor Coffee Co.", email: "daniel.okafor@harborcoffee.example" },
  { first: "Priya", last: "Raman", title: "", company: "Northwind Studio", email: "priya.raman@northwind.example" },
  { first: "Tomás", last: "Herrera", title: "Creative Director", company: "Northwind Studio", email: "tomas.herrera@northwind.example" },
  { first: "Hannah", last: "Lindqvist", title: "Volunteer Coordinator", company: "Riverbend Library", email: "hannah.lindqvist@riverbend.example" },
  { first: "Samuel", last: "Adeyemi", title: "Branch Manager", company: "Riverbend Library", email: "samuel.adeyemi@riverbend.example" },
  { first: "Grace", last: "Whitfield", title: "", company: "Riverbend Library", email: "grace.whitfield@riverbend.example" },
  { first: "Kenji", last: "Watanabe", title: "Event Planner", company: "Cedar & Pine Events", email: "kenji.watanabe@cedarpine.example" },
  { first: "Amara", last: "Nwosu", title: "Owner", company: "Cedar & Pine Events", email: "amara.nwosu@cedarpine.example" },
  { first: "Lucas", last: "Moreau", title: "Sound Engineer", company: "Cedar & Pine Events", email: "lucas.moreau@cedarpine.example" },
  { first: "Fatima", last: "Al-Sayed", title: "Program Director", company: "Bright Futures Club", email: "fatima.alsayed@brightfutures.example" },
  { first: "Owen", last: "Fitzgerald", title: "Treasurer", company: "Bright Futures Club", email: "owen.fitzgerald@brightfutures.example" },
  { first: "Sofia", last: "Marchetti", title: "", company: "Bright Futures Club", email: "sofia.marchetti@brightfutures.example" },
  { first: "Noah", last: "Kowalski", title: "Lead Carpenter", company: "Kowalski & Daughters", email: "noah.kowalski@kowalski.example" },
  { first: "Elena", last: "Petrova", title: "Office Manager", company: "Kowalski & Daughters", email: "elena.petrova@kowalski.example" },
  { first: "James", last: "Oyelaran", title: "Photographer", company: "Studio Oyelaran", email: "james.oyelaran@oyelaran.example" },
  { first: "Mei", last: "Tanaka", title: "Designer", company: "Studio Oyelaran", email: "mei.tanaka@oyelaran.example" },
  { first: "Ravi", last: "Subramanian", title: "Chief Baker", company: "Golden Crumb Bakery", email: "ravi.subramanian@goldencrumb.example" },
  { first: "Chloe", last: "Bennett", title: "", company: "Golden Crumb Bakery", email: "chloe.bennett@goldencrumb.example" },
  { first: "Isaac", last: "Mendoza", title: "Delivery Driver", company: "Golden Crumb Bakery", email: "isaac.mendoza@goldencrumb.example" },
];

/** The sample design: a business card for each person, with a name made of two fields. */
export const starterItems: DesignItem[] = [
  { id: "shape-1", type: "rect", x: 0.18, y: 0.18, w: 3.14, h: 1.64, fill: "#fbfaf7", stroke: "#e7e2d8", visible: true },
  { id: "shape-2", type: "rect", x: 0.18, y: 0.18, w: 0.09, h: 1.64, fill: "#e28b55", stroke: "none", visible: true },
  { id: "text-1", type: "text", x: 0.42, y: 0.5, w: 2.75, h: 0.28, text: "Company", field: "company", fontSize: 8, color: "#b16b3f", weight: 700, caps: true, letterSpacing: 60, visible: true },
  { id: "text-2", type: "text", x: 0.42, y: 0.86, w: 2.75, h: 0.4, text: "{{first}} {{last}}", fontSize: 22, color: "#26352f", weight: 700, visible: true },
  { id: "text-3", type: "text", x: 0.42, y: 1.23, w: 2.75, h: 0.22, text: "Title", field: "title", fontSize: 10, color: "#66736d", visible: true },
  { id: "text-4", type: "text", x: 0.42, y: 1.55, w: 0.6, h: 0.18, text: "EMAIL ", fontSize: 7, color: "#9a9d91", weight: 700, visible: true },
  { id: "text-5", type: "text", x: 0.9, y: 1.55, w: 2.3, h: 0.18, text: "Email", field: "email", fontSize: 8, color: "#47564f", visible: true },
];

/** True when the records are only the built-in sample (or the older bird sample), or nothing has been typed yet: there is nothing of the person's own to protect. */
export function isPlaceholderData(rows: RecordRow[]): boolean {
  if (!rows.length) return true;
  const cells = (r: RecordRow) => Object.entries(r).filter(([k]) => !k.startsWith("__")).map(([, v]) => String(v ?? ""));
  if (rows.every((r) => cells(r).every((v) => !v.trim()))) return true;
  const key = (list: RecordRow[]) => list.map((r) => cells(r).join("|")).join("\n");
  if (key(rows) === key(starterRecords)) return true;
  return rows[0]?.name === "Pip" && rows[0]?.band === "GC-1048"; // the old bird sample
}
/** True while the design is still the built-in sample card. */
export const isPlaceholderDesign = (items: DesignItem[]) => items.length === 0 || JSON.stringify(items) === JSON.stringify(starterItems);

const preset = (code: string, name: string, width: number, height: number, columns: number, rows: number, gapX: number, gapY: number, marginX: number, marginY: number): LabelPreset =>
  ({ code, name, width, height, columns, rows, gapX, gapY, marginX, marginY });

export const averyPresets: LabelPreset[] = [
  preset("5160", "Address labels · 30 per sheet", 2.625, 1, 3, 10, 0.125, 0, 0.1875, 0.5),
  preset("5161", "Address labels · 20 per sheet", 4, 1, 2, 10, 0.1875, 0, 0.15625, 0.5),
  preset("5162", "Address labels · 14 per sheet", 4, 1.333, 2, 7, 0.1875, 0.167, 0.15625, 0.5),
  preset("5163", "Shipping labels · 10 per sheet", 4, 2, 2, 5, 0.1875, 0, 0.15625, 0.5),
  preset("5164", "Shipping labels · 6 per sheet", 4, 3.333, 2, 3, 0.1875, 0.167, 0.15625, 0.5),
  preset("5167", "Return address · 80 per sheet", 1.75, 0.5, 4, 20, 0.125, 0, 0.25, 0.5),
  preset("5260", "Easy Peel address · 30 per sheet", 2.625, 1, 3, 10, 0.125, 0, 0.1875, 0.5),
  preset("8160", "Inkjet address · 30 per sheet", 2.625, 1, 3, 10, 0.125, 0, 0.1875, 0.5),
  preset("8161", "Inkjet address · 20 per sheet", 4, 1, 2, 10, 0.1875, 0, 0.15625, 0.5),
  preset("8162", "Inkjet address · 14 per sheet", 4, 1.333, 2, 7, 0.1875, 0.167, 0.15625, 0.5),
  preset("8163", "Inkjet shipping · 10 per sheet", 4, 2, 2, 5, 0.1875, 0, 0.15625, 0.5),
  preset("8164", "Inkjet shipping · 6 per sheet", 4, 3.333, 2, 3, 0.1875, 0.167, 0.15625, 0.5),
  preset("5195", "File folder labels · 60 per sheet", 0.667, 3.438, 3, 20, 0.125, 0, 0.25, 0.25),
  preset("5390", "Name badges · 8 per sheet", 3.375, 2.333, 2, 4, 0.25, 0.25, 0.625, 0.5),
  preset("5392", "Name badges · 8 per sheet", 3.5, 2.25, 2, 4, 0.25, 0.25, 0.5, 0.75),
  preset("8371", "Business cards · 10 per sheet", 3.5, 2, 2, 5, 0.25, 0, 0.5, 0.5),
  preset("8871", "Business cards · 10 per sheet", 3.5, 2, 2, 5, 0.25, 0, 0.5, 0.5),
  preset("22806", "Shipping labels · 10 per sheet", 4, 2, 2, 5, 0.1875, 0, 0.15625, 0.5),
];

/** Automatic fields that are computed rather than read from the data source. */
export const specialFields = [
  { key: "__record_number", label: "Record number" },
  { key: "__page_number", label: "Page number" },
  { key: "__record_count", label: "Record count" },
  { key: "__page_count", label: "Page count" },
] as const;

export const prettyField = (field: string) => field.replaceAll("_", " ");
export const fieldDisplayName = (field: string) =>
  specialFields.find((entry) => entry.key === field)?.label ?? prettyField(field);

function rawValueFor(item: DesignItem, record: RecordRow, meta: RecordMeta): string {
  if (!item.field) return mergeText(item.text ?? "", record, specialValues(meta));
  switch (item.field) {
    case "__record_number": return String(meta.recordNumber);
    case "__page_number": return String(meta.pageNumber);
    case "__record_count": return String(meta.recordCount);
    case "__page_count": return String(meta.pageCount);
    default: return record[item.field] ?? "—";
  }
}

/** What a text object shows for a record: its field or merge text, in capitals when All caps is on. */
export function valueFor(item: DesignItem, record: RecordRow, meta: RecordMeta): string {
  const value = rawValueFor(item, record, meta);
  return item.caps ? value.toUpperCase() : value;
}
