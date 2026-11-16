import { useId, type SVGProps } from "react";

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

/** A square, a triangle and a circle overlapping, with a gap where one passes over another: the shape tools. */
export function ShapesIcon({ size = 16, ...props }: IconProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const circle = { cx: 8.6, cy: 15.2, r: 5.3 };
  const tri = "M16.6 7.6 22 18.6H11.6Z";
  return (
    <svg {...base(size)} strokeWidth={1.7} {...props}>
      <defs>
        {/* each shape is cut away where a shape in front of it crosses it */}
        <mask id={`${id}a`} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="white" />
          <circle {...circle} r={circle.r} fill="black" stroke="black" strokeWidth="3.4" />
          <path d={tri} fill="black" stroke="black" strokeWidth="3.4" />
        </mask>
        <mask id={`${id}b`} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="white" />
          <circle {...circle} fill="black" stroke="black" strokeWidth="3.4" />
        </mask>
      </defs>
      <rect x="2.8" y="2.6" width="10" height="10" rx="1.6" mask={`url(#${id}a)`} />
      <path d={tri} mask={`url(#${id}b)`} />
      <circle {...circle} />
    </svg>
  );
}

/** Two stacked sheets: the front one is the picture, the one behind it is dotted and carries a registration mark. Reference images sit under the design and never print. */
export function ReferenceImageIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={1.7} {...props}>
      <path d="M12 2.8 21 7.4 12 12 3 7.4Z" />
      <path d="M3 11.6 12 16.2 21 11.6" strokeDasharray="0.1 2.5" />
      <circle cx="12" cy="20.1" r="1.5" />
      <path d="M12 17.6v1M12 21.6v1M9.7 20.1h1M13.3 20.1h1" strokeWidth="1.3" />
    </svg>
  );
}
