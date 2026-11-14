import { useCallback, useRef, useState } from "react";

type History<T> = { past: T[]; present: T; future: T[] };
type SetOptions = { /** Edits sharing a key within a short window collapse into one undo step. */ coalesce?: string };

const COALESCE_MS = 900;

/** State with undo/redo. Rapid edits with the same coalesce key (typing, dragging) form a single step. */
export function useHistory<T>(initial: T) {
  const [history, setHistory] = useState<History<T>>({ past: [], present: initial, future: [] });
  const last = useRef<{ key: string; at: number } | null>(null);

  const set = useCallback((update: (previous: T) => T, options: SetOptions = {}) => {
    const now = Date.now();
    const merge = !!options.coalesce && last.current?.key === options.coalesce && now - last.current.at < COALESCE_MS;
    last.current = options.coalesce ? { key: options.coalesce, at: now } : null;
    setHistory((h) => {
      const next = update(h.present);
      if (next === h.present) return h;
      return { past: merge ? h.past : [...h.past, h.present].slice(-100), present: next, future: [] };
    });
  }, []);

  /** Ends the current coalescing group (e.g. on pointer-up). */
  const breakGroup = useCallback(() => { last.current = null; }, []);
  const undo = useCallback(() => {
    last.current = null;
    setHistory((h) => h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h);
  }, []);
  const redo = useCallback(() => {
    last.current = null;
    setHistory((h) => h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h);
  }, []);

  /** Replaces the document and clears undo history (new / open). */
  const reset = useCallback((value: T) => { last.current = null; setHistory({ past: [], present: value, future: [] }); }, []);

  return { value: history.present, set, undo, redo, breakGroup, reset, canUndo: history.past.length > 0, canRedo: history.future.length > 0 };
}
