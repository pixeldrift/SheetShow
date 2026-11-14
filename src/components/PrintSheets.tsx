import type { DesignItem, RecordRow, Sheet } from "../types";
import { LayoutStage } from "./LayoutStage";

type Props = { sheet: Sheet; items: DesignItem[]; records: RecordRow[]; templateWidth: number; templateHeight: number; pageCount: number; recordIndex: number };

/** Every sheet, one per printed page. Only mounted while printing. */
export function PrintSheets({ sheet, items, records, templateWidth, templateHeight, pageCount, recordIndex }: Props) {
  const slots = sheet.columns * sheet.rows;
  return (
    <div className="print-root">
      <style>{`@page{size:${sheet.pageWidth}in ${sheet.pageHeight}in;margin:0}`}</style>
      {Array.from({ length: pageCount }, (_, page) => (
        <div key={page} className="print-page" style={{ width: `${sheet.pageWidth}in`, height: `${sheet.pageHeight}in` }}>
          <LayoutStage
            sheet={sheet} items={items} records={records} templateWidth={templateWidth} templateHeight={templateHeight}
            slotRecord={(slot) => (sheet.repeatMode === "same" ? recordIndex : page * slots + slot)}
            pageNumber={page + 1} pageCount={pageCount} showGrid={false} preview
          />
        </div>
      ))}
    </div>
  );
}
