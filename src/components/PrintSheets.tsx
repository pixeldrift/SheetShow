import type { RecordRow, Sheet } from "../types";
import { LayoutStage, type InstanceInfo } from "./LayoutStage";
import { CalibrationSheet } from "./CalibrationSheet";
import type { SheetRef } from "../lib/packet";

type Props = {
  bleed?: number; kind?: "sheets" | "calibration"; offset: { x: number; y: number };
  /** Every page design, and the sheets to print in order (each says which design and which records). */
  sheets: Record<string, Sheet>; sequence: SheetRef[]; firstPageId: string;
  records: RecordRow[]; templateWidth: number; templateHeight: number;
  instanceFor: (record: RecordRow, index: number, slot: number, variantId?: string) => InstanceInfo;
};

/** Every sheet, one per printed page. Only mounted while printing. */
export function PrintSheets({ bleed, kind = "sheets", offset, sheets, sequence, firstPageId, records, templateWidth, templateHeight, instanceFor }: Props) {
  const first = sheets[firstPageId];
  const designs = Object.entries(sheets);
  // Each page design may be a different paper size: a named @page per design, picked by each printed page.
  const pageRules = designs.map(([id, s]) => `@page p-${id}{size:${s.pageWidth}in ${s.pageHeight}in;margin:0}`).join("");
  return (
    <div className="print-root">
      <style>{pageRules}</style>
      {kind === "calibration" ? (
        <div className="print-page" style={{ width: `${first.pageWidth}in`, height: `${first.pageHeight}in`, page: `p-${firstPageId}` } as React.CSSProperties}>
          <CalibrationSheet sheet={first} templateWidth={templateWidth} templateHeight={templateHeight} offset={offset} />
        </div>
      ) : sequence.map((ref, K) => {
        const s = sheets[ref.pageId];
        return (
          <div key={K} className="print-page" style={{ width: `${s.pageWidth}in`, height: `${s.pageHeight}in`, page: `p-${ref.pageId}` } as React.CSSProperties}>
            <LayoutStage
              offset={offset} sheet={s} records={records} templateWidth={templateWidth} templateHeight={templateHeight} instanceFor={instanceFor}
              pageId={ref.pageId} base={ref.base} limit={ref.limit} pageNumber={K + 1} pageCount={sequence.length} showGrid={false} preview bleed={bleed}
            />
          </div>
        );
      })}
    </div>
  );
}
