import { useSyncExternalStore } from "react";

/** What the built-in guidance does. Kept in this browser; every piece can be switched off, and the welcome guide can be replayed, from Help. */
export type GuideSettings = {
  /** The welcome guide has played at least once. */
  welcomeSeen: boolean;
  /** Play the welcome guide every time SheetShow opens (off by default; it plays once on the very first visit). */
  welcomeOnStart: boolean;
  /** On a touch screen, show a small label bubble when a button is tapped. */
  tapTips: boolean;
};

const KEY = "sheetshow.guide";
const DEFAULTS: GuideSettings = { welcomeSeen: false, welcomeOnStart: false, tapTips: true };

const read = (): GuideSettings => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return DEFAULTS; }
};
let current = read();
const listeners = new Set<() => void>();

export const guideSettings = () => current;
export function updateGuide(change: Partial<GuideSettings>) {
  current = { ...current, ...change };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* storage unavailable */ }
  listeners.forEach((fn) => fn());
}
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const useGuide = () => useSyncExternalStore(subscribe, () => current, () => DEFAULTS);

/** Whether the welcome guide should open by itself right now. */
export const shouldWelcome = (hasSavedProject: boolean) => {
  if (hasSavedProject && !current.welcomeSeen) { updateGuide({ welcomeSeen: true }); return false; } // someone who was already using SheetShow doesn't need the greeting
  return !current.welcomeSeen || current.welcomeOnStart;
};
