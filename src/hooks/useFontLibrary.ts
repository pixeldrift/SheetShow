import { useCallback, useEffect, useState } from "react";
import type { FontEntry } from "../types";
import { loadGoogleFont, localFontsSupported, queryLocalFontFamilies } from "../lib/fonts";

export type FontLibrary = ReturnType<typeof useFontLibrary>;

/** Fonts used by the document, plus the device's installed fonts once the user grants access. */
export function useFontLibrary(initial: FontEntry[]) {
  const [fonts, setFonts] = useState<FontEntry[]>(initial);
  const [local, setLocal] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // Re-measure text whenever a web font finishes loading.
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    document.fonts.addEventListener("loadingdone", bump);
    return () => document.fonts.removeEventListener("loadingdone", bump);
  }, []);

  /** Make a family available and remember it in the document. Returns false if a web font could not be fetched. */
  const use = useCallback(async (family: string, source: FontEntry["source"]) => {
    setFonts((list) => (list.some((f) => f.family === family) ? list : [...list, { family, source }]));
    if (source === "local") return true;
    setBusy(family);
    const ok = await loadGoogleFont(family);
    setBusy(null);
    return ok;
  }, []);

  /** Re-loads web fonts after opening a project. */
  const restore = useCallback((list: FontEntry[]) => {
    setFonts(list);
    list.filter((f) => f.source !== "local").forEach((f) => loadGoogleFont(f.family));
  }, []);

  const requestLocal = useCallback(async () => {
    try { setLocal(await queryLocalFontFamilies()); setLocalError(null); }
    catch { setLocalError("Permission to read installed fonts was declined."); }
  }, []);

  useEffect(() => { initial.filter((f) => f.source !== "local").forEach((f) => loadGoogleFont(f.family)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { fonts, local, busy, localError, localSupported: localFontsSupported(), use, restore, requestLocal };
}
