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
    </div>
  );
}
