/** The SheetShow mark. One SVG, so the sparkle is part of the logo and never shifts relative to the sheet. Same artwork as public/icon.svg. */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="SheetShow">
  <defs><filter id="ss-shadow" x="-20%" y="-20%" width="150%" height="150%"><feDropShadow dx="0.8" dy="1.6" stdDeviation="1.5" floodColor="#8a4a26" floodOpacity=".35"/></filter></defs>
  <rect width="64" height="64" rx="14" fill="#f4e8dc"/>
  
  <g transform="rotate(-5 32 32)" stroke="#d17c4b" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
    <path filter="url(#ss-shadow)" d="M18 8.5h19.5L49.5 20.5V51a4.5 4.5 0 0 1-4.5 4.5H18A4.5 4.5 0 0 1 13.5 51V13A4.5 4.5 0 0 1 18 8.5Z" fill="#fff"/>
    <path d="M37.5 8.5v7.5a4.5 4.5 0 0 0 4.5 4.5h7.5" fill="#f6dcc8"/>
    <g fill="#f7dfcd"><rect x="19" y="26" width="10" height="6" rx="1.6"/><rect x="33" y="26" width="10" height="6" rx="1.6"/><rect x="19" y="35" width="10" height="6" rx="1.6"/><rect x="33" y="35" width="10" height="6" rx="1.6"/><rect x="19" y="44" width="10" height="6" rx="1.6"/><rect x="33" y="44" width="10" height="6" rx="1.6"/></g>
  </g>
  
  <path d="M51 3.5 53 9.4 58.9 11.4 53 13.4 51 19.3 49 13.4 43.1 11.4 49 9.4Z" fill="#d17c4b"/>

    </svg>
  );
}
