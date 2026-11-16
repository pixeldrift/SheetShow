import { useEffect, useState } from "react";

export type TokenMode = "chips" | "text";
const KEY = "sheetshow.tokenMode";
const EVENT = "sheetshow:tokenMode";

const read = (): TokenMode => { try { return localStorage.getItem(KEY) === "chips" ? "chips" : "text"; } catch { return "text"; } };

/** How {{tokens}} look in the Properties text box: colour-coded plain text (the default), or chips (the token under the caret turns into text). The on-canvas editor always uses plain text. */
export function useTokenMode(): [TokenMode, () => void] {
  const [mode, setMode] = useState<TokenMode>(read);
  useEffect(() => {
    const sync = () => setMode(read());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  const toggle = () => {
    const next: TokenMode = read() === "chips" ? "text" : "chips";
    try { localStorage.setItem(KEY, next); } catch { /* storage unavailable */ }
    window.dispatchEvent(new Event(EVENT));
    setMode(next);
  };
  return [mode, toggle];
}
