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

type IconProps = { size?: number } & SVGProps<SVGSVGElement>;
const base = (size: number): SVGProps<SVGSVGElement> => ({ viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round", "aria-hidden": true });

/** A square and a circle side by side: the shape tools (today a rectangle, with room for more). */
export function ShapesIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={1.8} {...props}>
      <rect x="1.8" y="6.5" width="9.6" height="10" rx="1.7" />
      <circle cx="17.9" cy="11.5" r="5.1" />
    </svg>
  );
}

/** The picture icon with its artwork drawn as dots: a picture that is only a guide and never prints. */
export function ReferenceImageIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" strokeDasharray="0.1 2.5" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" strokeDasharray="0.1 2.6" />
    </svg>
  );
}
