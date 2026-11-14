import type { DesignItem, RecordMeta, RecordRow, Sheet } from "../types";
import { PX_PER_IN } from "../lib/data";
import { TemplateThumbnail } from "./ItemShape";

type Props = {
  sheet: Sheet;
  templateWidth: number;
  templateHeight: number;
  items: DesignItem[];
  records: RecordRow[];
  /** Index into `records` for each slot on this sheet. */
  slotRecord: (slot: number) => number;
  pageNumber: number;
  pageCount: number;
  showGrid: boolean;
  preview: boolean;
};

/** Slots are placed at their true physical positions (margin + column × (size + gap)) in inches. */
export function LayoutStage({ sheet, templateWidth, templateHeight, items, records, slotRecord, pageNumber, pageCount, showGrid, preview }: Props) {
  const slots = sheet.columns * sheet.rows;
  const marks = sheet.cropMarks && preview ? cropMarks(sheet, templateWidth, templateHeight) : [];
  return (
    <div className="layout-page" style={{ width: sheet.pageWidth * PX_PER_IN, height: sheet.pageHeight * PX_PER_IN }}>
      {Array.from({ length: slots }, (_, slot) => {
        const col = slot % sheet.columns;
        const row = Math.floor(slot / sheet.columns);
        const index = slotRecord(slot);
        const record = records[index];
        return (
          <div
            key={slot}
            className={showGrid && !preview ? "layout-slot outlined" : "layout-slot"}
            style={{
              left: (sheet.marginX + col * (templateWidth + sheet.gapX)) * PX_PER_IN,
              top: (sheet.marginY + row * (templateHeight + sheet.gapY)) * PX_PER_IN,
              width: templateWidth * PX_PER_IN,
              height: templateHeight * PX_PER_IN,
            }}
          >
            {record
              ? <TemplateThumbnail items={items} record={record} width={templateWidth} height={templateHeight} meta={{ recordNumber: index + 1, pageNumber, recordCount: records.length, pageCount }} />
              : <span className="empty-slot">Empty</span>}
            {!preview && <span className="slot-number">#{index + 1}</span>}
          </div>
        );
      })}
      {marks.length > 0 && (
        <svg className="crop-marks" width={sheet.pageWidth * PX_PER_IN} height={sheet.pageHeight * PX_PER_IN} viewBox={`0 0 ${sheet.pageWidth} ${sheet.pageHeight}`}>
          {marks.map((m, i) => <line key={i} x1={m[0]} y1={m[1]} x2={m[2]} y2={m[3]} />)}
        </svg>
      )}
    </div>
  );
}

/**
 * Crop marks sit in the page margins, in line with every slot edge, so they never touch the artwork
 * (labels often have no gap between them). Coordinates are in inches.
 */
function cropMarks(sheet: Sheet, w: number, h: number): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  const offset = 0.04;
  const xs = Array.from({ length: sheet.columns }, (_, c) => { const left = sheet.marginX + c * (w + sheet.gapX); return [left, left + w]; }).flat();
  const ys = Array.from({ length: sheet.rows }, (_, r) => { const top = sheet.marginY + r * (h + sheet.gapY); return [top, top + h]; }).flat();
  const gridLeft = sheet.marginX, gridTop = sheet.marginY;
  const gridRight = gridLeft + sheet.columns * w + (sheet.columns - 1) * sheet.gapX;
  const gridBottom = gridTop + sheet.rows * h + (sheet.rows - 1) * sheet.gapY;
  const room = (space: number) => Math.min(0.15, Math.max(0, space - offset - 0.02));
  const top = room(gridTop), left = room(gridLeft), bottom = room(sheet.pageHeight - gridBottom), right = room(sheet.pageWidth - gridRight);
  for (const x of xs) {
    if (top > 0) out.push([x, gridTop - offset - top, x, gridTop - offset]);
    if (bottom > 0) out.push([x, gridBottom + offset, x, gridBottom + offset + bottom]);
  }
  for (const y of ys) {
    if (left > 0) out.push([gridLeft - offset - left, y, gridLeft - offset, y]);
    if (right > 0) out.push([gridRight + offset, y, gridRight + offset + right, y]);
  }
  return out;
}
