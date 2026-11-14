import type { SVGProps } from "react";

/** Outline glue bottle — used for "Paste". */
export function GlueBottle({ size = 16, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true" {...props}>
      <path d="M12 1.6c-1.3.9-1.9 2.2-2 3.7l-.2 1.2h4.4l-.2-1.2c-.1-1.5-.7-2.8-2-3.7z" />
      <rect x="8.9" y="6.5" width="6.2" height="2.1" />
      <path d="M9 8.6h6l1.5.8c.9.5 1.4 1.2 1.4 2.3v9.4c0 .9-.7 1.5-1.5 1.5H7.6c-.8 0-1.5-.6-1.5-1.5v-9.4c0-1.1.5-1.8 1.4-2.3z" />
      <rect x="9" y="11.8" width="6" height="7.6" />
    </svg>
  );
}
