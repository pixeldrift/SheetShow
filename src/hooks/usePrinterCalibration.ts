import { useCallback, useEffect, useState } from "react";
import { loadPrinter, roundOffset, savePrinter, type PrinterState } from "../lib/printer";
import { uid } from "../lib/data";

export type PrinterCalibration = ReturnType<typeof usePrinterCalibration>;

/** The page offset (inches) plus saved printer profiles. Every change is remembered on this device. */
export function usePrinterCalibration() {
  const [state, setState] = useState<PrinterState>(() => loadPrinter());
  useEffect(() => { savePrinter(state); }, [state]);

  const active = state.profiles.find((p) => p.id === state.activeId) ?? null;
  const dirty = !!active && (active.x !== state.x || active.y !== state.y);

  const setOffset = useCallback((x: number, y: number) => setState((s) => ({ ...s, x: roundOffset(x), y: roundOffset(y) })), []);
  const nudge = useCallback((dx: number, dy: number) => setState((s) => ({ ...s, x: roundOffset(s.x + dx), y: roundOffset(s.y + dy) })), []);
  const reset = useCallback(() => setState((s) => ({ ...s, x: 0, y: 0 })), []);

  /** Saves the current offset as a new named profile and selects it. */
  const saveAs = useCallback((name: string) => setState((s) => {
    const id = uid();
    return { ...s, profiles: [...s.profiles, { id, name: name.trim() || "My printer", x: s.x, y: s.y }], activeId: id };
  }), []);
  /** Updates the selected profile with the current offset. */
  const updateActive = useCallback(() => setState((s) => ({ ...s, profiles: s.profiles.map((p) => (p.id === s.activeId ? { ...p, x: s.x, y: s.y } : p)) })), []);
  const select = useCallback((id: string | null) => setState((s) => {
    const profile = s.profiles.find((p) => p.id === id);
    return profile ? { ...s, activeId: id, x: profile.x, y: profile.y } : { ...s, activeId: null };
  }), []);
  const remove = useCallback((id: string) => setState((s) => ({ ...s, profiles: s.profiles.filter((p) => p.id !== id), activeId: s.activeId === id ? null : s.activeId })), []);

  return { x: state.x, y: state.y, profiles: state.profiles, active, dirty, setOffset, nudge, reset, saveAs, updateActive, select, remove };
}
