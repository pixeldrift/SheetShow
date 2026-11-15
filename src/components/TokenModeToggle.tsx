import { Code2, Tags } from "lucide-react";
import type { TokenMode } from "../lib/tokenMode";

/** Switches how {{tokens}} look while editing: chips, or colour-coded plain text. Sits on the corner of a text box. */
export function TokenModeToggle({ mode, onToggle, className, style }: { mode: TokenMode; onToggle: () => void; className?: string; style?: React.CSSProperties }) {
  const label = mode === "chips" ? "Tokens show as chips. Switch to colour-coded plain text." : "Tokens show as colour-coded text. Switch to chips.";
  return (
    <button type="button" style={style} className={`token-mode-toggle ${className ?? ""}`} title={label} aria-label={label} aria-pressed={mode === "text"}
      onPointerDown={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()} onClick={onToggle}>
      {mode === "chips" ? <Tags size={13} /> : <Code2 size={13} />}
    </button>
  );
}
