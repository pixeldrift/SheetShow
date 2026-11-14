/** Printer calibration is a property of the printer and paper, not of a design, so it lives on this device rather than in the project. */
export type PrinterProfile = { id: string; name: string; x: number; y: number };
export type PrinterState = { profiles: PrinterProfile[]; activeId: string | null; x: number; y: number };

const KEY = "sheetshow:printer:v1";
export const emptyPrinter: PrinterState = { profiles: [], activeId: null, x: 0, y: 0 };

export function loadPrinter(): PrinterState {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (parsed && Array.isArray(parsed.profiles) && Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) return parsed as PrinterState;
  } catch { /* fall through */ }
  return emptyPrinter;
}

export function savePrinter(state: PrinterState) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode: the offset just won't be remembered */ }
}

/** Thousandths of an inch is far finer than any printer can resolve. */
export const roundOffset = (n: number) => Math.round(n * 1000) / 1000;
export const formatOffset = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(3)}″`;
