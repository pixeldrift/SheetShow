import type { DesignItem, LabelPreset, RecordMeta, RecordRow } from "../types";
import { mergeText } from "./merge";

export const PX_PER_IN = 96;
export const uid = () => Math.random().toString(36).slice(2, 9);
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const round = (n: number, places = 3) => Number(n.toFixed(places));

export const starterRecords: RecordRow[] = [
  { name: "Pip", species: "Green-cheeked conure", band: "GC-1048", location: "Garden Room · Cage 03", diet: "Pellets, greens, fruit", hatch_date: "2022-04-18" },
  { name: "Juniper", species: "Blue-and-gold macaw", band: "BG-0217", location: "Aviary · Flight 01", diet: "Pellets, nuts, vegetables", hatch_date: "2018-09-02" },
  { name: "Mochi", species: "Cockatiel", band: "CK-3309", location: "Garden Room · Cage 08", diet: "Pellets, seed, greens", hatch_date: "2021-11-26" },
  { name: "Fig", species: "African grey", band: "AG-0084", location: "Sunroom · Perch 02", diet: "Pellets, vegetables", hatch_date: "2016-02-11" },
  { name: "Basil", species: "Indian ringneck", band: "IR-1742", location: "Garden Room · Cage 05", diet: "Pellets, fruit, greens", hatch_date: "2020-07-07" },
  { name: "Clover", species: "Lovebird", band: "LB-4421", location: "Nursery · Cage 02", diet: "Small pellets, seed, greens", hatch_date: "2023-03-14" },
];

export const starterItems: DesignItem[] = [
  { id: "shape-1", type: "rect", x: 0.18, y: 0.18, w: 3.14, h: 1.64, fill: "#fbfaf7", stroke: "#e7e2d8", visible: true },
  { id: "shape-2", type: "rect", x: 0.18, y: 0.18, w: 0.09, h: 1.64, fill: "#e28b55", stroke: "none", visible: true },
  { id: "text-1", type: "text", x: 0.42, y: 0.55, w: 2.75, h: 0.28, text: "BIRD PROFILE", fontSize: 8, color: "#b16b3f", weight: 700, visible: true },
  { id: "text-2", type: "text", x: 0.42, y: 0.91, w: 2.75, h: 0.38, text: "Bird name", field: "name", fontSize: 22, color: "#26352f", weight: 700, visible: true },
  { id: "text-3", type: "text", x: 0.42, y: 1.23, w: 2.75, h: 0.22, text: "Species", field: "species", fontSize: 10, color: "#66736d", visible: true },
  { id: "text-4", type: "text", x: 0.42, y: 1.55, w: 1.3, h: 0.18, text: "BAND · ", fontSize: 7, color: "#9a9d91", weight: 700, visible: true },
  { id: "text-5", type: "text", x: 1.0, y: 1.55, w: 2.0, h: 0.18, text: "Band number", field: "band", fontSize: 8, color: "#47564f", visible: true },
];

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

export function valueFor(item: DesignItem, record: RecordRow, meta: RecordMeta): string {
  if (!item.field) return mergeText(item.text ?? "", record);
  switch (item.field) {
    case "__record_number": return String(meta.recordNumber);
    case "__page_number": return String(meta.pageNumber);
    case "__record_count": return String(meta.recordCount);
    case "__page_count": return String(meta.pageCount);
    default: return record[item.field] ?? "—";
  }
}
