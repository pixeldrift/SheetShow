import type { Sheet } from "../types";
import { PX_PER_IN } from "../lib/data";
import { formatOffset } from "../lib/printer";
import { placementsOf } from "../lib/placements";

/**
 * A test page for printer calibration: crosshairs exactly 1 inch from every edge and an outline of every label.
 * The offset is applied, so after adjusting you can print again and check the result.
 */
export function CalibrationSheet({ sheet, templateWidth, templateHeight, offset }: { sheet: Sheet; templateWidth: number; templateHeight: number; offset: { x: number; y: number } }) {
  const W = sheet.pageWidth, H = sheet.pageHeight;
  const cross = (cx: number, cy: number, label: string, key: string, anchor: "start" | "end" = "start") => (
    <g key={key}>
      <line x1={cx - 0.25} y1={cy} x2={cx + 0.25} y2={cy} /><line x1={cx} y1={cy - 0.25} x2={cx} y2={cy + 0.25} />
      <circle cx={cx} cy={cy} r={0.06} fill="none" />
      <text x={anchor === "start" ? cx + 0.12 : cx - 0.12} y={cy - 0.1} textAnchor={anchor} fontSize={0.11} fontFamily="DM Sans, Arial, sans-serif">{label}</text>
    </g>
  );
  const slots = placementsOf(sheet, templateWidth, templateHeight);
  return (
    <svg className="calib" width={W * PX_PER_IN} height={H * PX_PER_IN} viewBox={`0 0 ${W} ${H}`}>
      <g transform={`translate(${offset.x} ${offset.y})`} fill="none" stroke="#000" strokeWidth={0.006}>
        {slots.map((s, i) => <rect key={i} x={s.x} y={s.y} width={templateWidth} height={templateHeight} strokeWidth={0.004} strokeDasharray="0.04 0.03" />)}
        {cross(1, 1, "1.00″ from left and top", "tl")}
        {cross(W - 1, 1, "1.00″ from right and top", "tr", "end")}
        {cross(1, H - 1, "1.00″ from left and bottom", "bl")}
        {cross(W - 1, H - 1, "1.00″ from right and bottom", "br", "end")}
        <text x={W / 2} y={H / 2 - 0.1} textAnchor="middle" fontSize={0.2} fontWeight={700} fontFamily="DM Sans, Arial, sans-serif" fill="#000" stroke="none">SheetShow calibration sheet</text>
        <text x={W / 2} y={H / 2 + 0.12} textAnchor="middle" fontSize={0.11} fontFamily="DM Sans, Arial, sans-serif" fill="#000" stroke="none">Page offset: right {formatOffset(offset.x)} · down {formatOffset(offset.y)}</text>
        <text x={W / 2} y={H / 2 + 0.34} textAnchor="middle" fontSize={0.11} fontFamily="DM Sans, Arial, sans-serif" fill="#000" stroke="none">{W} × {H} in · {slots.length} labels · measure the crosshairs from the paper’s edges</text>
      </g>
    </svg>
  );
}
