import type { RecordRow, Sheet } from "../types";
import { LayoutStage, type InstanceInfo } from "./LayoutStage";
import { CalibrationSheet } from "./CalibrationSheet";

type Props = { bleed?: number; kind?: "sheets" | "calibration"; offset: { x: number; y: number }; sheet: Sheet; records: RecordRow[]; templateWidth: number; templateHeight: number; pageCount: number; recordIndex: number; instanceFor: (record: RecordRow, index: number, slot: number) => InstanceInfo };

/** Every sheet, one per printed page. Only mounted while printing. */
export function PrintSheets({ bleed, kind = "sheets", offset, sheet, records, templateWidth, templateHeight, pageCount, recordIndex, instanceFor }: Props) {
  return (
    <div className="print-root">
      <style>{`@page{size:${sheet.pageWidth}in ${sheet.pageHeight}in;margin:0}`}</style>
      {kind === "calibration" ? (
        <div className="print-page" style={{ width: `${sheet.pageWidth}in`, height: `${sheet.pageHeight}in` }}>
          <CalibrationSheet sheet={sheet} templateWidth={templateWidth} templateHeight={templateHeight} offset={offset} />
        </div>
      ) : Array.from({ length: pageCount }, (_, page) => (
        <div key={page} className="print-page" style={{ width: `${sheet.pageWidth}in`, height: `${sheet.pageHeight}in` }}>
          <LayoutStage
            offset={offset} sheet={sheet} records={records} templateWidth={templateWidth} templateHeight={templateHeight} instanceFor={instanceFor}
            pageNumber={page + 1} pageCount={pageCount} showGrid={false} preview bleed={bleed}
          />
        </div>
      ))}
    </div>
  );
}
