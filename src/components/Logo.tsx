/** The SheetShow mark. One SVG, so the sparkle is part of the logo and never shifts relative to the sheet. Same artwork as public/icon.svg. */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="SheetShow">
      <rect width="64" height="64" rx="14" fill="#f4e8dc" />
      <path d="M18 8.5h19.5L49.5 20.5V51a4.5 4.5 0 0 1-4.5 4.5H18A4.5 4.5 0 0 1 13.5 51V13A4.5 4.5 0 0 1 18 8.5Z" fill="#fff" stroke="#d17c4b" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M37.5 8.5v7.5a4.5 4.5 0 0 0 4.5 4.5h7.5" fill="#f6dcc8" stroke="#d17c4b" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      <g fill="#f7dfcd" stroke="#d17c4b" strokeWidth="1.7" strokeLinejoin="round">
        {[25.5, 34.5, 43.5].flatMap((y) => [18.5, 32.5].map((x) => <rect key={`${x}-${y}`} x={x} y={y} width="11" height="7" rx="1.6" />))}
      </g>
      <path d="M51 3.5 53 9.4 58.9 11.4 53 13.4 51 19.3 49 13.4 43.1 11.4 49 9.4Z" fill="#d17c4b" />
    </svg>
  );
}
