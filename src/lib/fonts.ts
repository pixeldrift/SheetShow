/** A curated set of popular Google Fonts. Any other Google family can still be used by typing its name. */
export const GOOGLE_FONTS = [
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Raleway", "Nunito", "Work Sans", "DM Sans",
  "Manrope", "Source Sans 3", "Fira Sans", "IBM Plex Sans", "Rubik", "Karla", "Quicksand", "Barlow", "Space Grotesk",
  "Oswald", "Bebas Neue", "Anton", "Archivo Black",
  "Playfair Display", "Merriweather", "Lora", "Libre Baskerville", "Cormorant Garamond", "EB Garamond", "Crimson Text",
  "PT Serif", "Source Serif 4", "Roboto Slab", "Zilla Slab", "DM Serif Display", "Abril Fatface",
  "Pacifico", "Lobster", "Dancing Script", "Caveat", "Satisfy", "Great Vibes", "Permanent Marker", "Shadows Into Light",
  "Indie Flower", "Amatic SC", "Comfortaa", "Fredoka", "Baloo 2",
  "JetBrains Mono", "Roboto Mono", "Inconsolata", "Courier Prime", "Special Elite",
];

export const DEFAULT_STACK = "Inter, Arial, sans-serif";
export const fontStack = (family?: string) => (family ? `"${family}", ${DEFAULT_STACK}` : DEFAULT_STACK);

const pending = new Map<string, Promise<boolean>>();

function addStylesheet(href: string): Promise<boolean> {
  return new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = () => resolve(true);
    link.onerror = () => { link.remove(); resolve(false); };
    document.head.appendChild(link);
  });
}

/**
 * Loads a family from Google Fonts. Resolves true when the face is usable.
 * Only the family name is sent to Google. Falls back to a plain request for families that lack some weights.
 */
export function loadGoogleFont(family: string): Promise<boolean> {
  const cached = pending.get(family);
  if (cached) return cached;
  const name = encodeURIComponent(family).replace(/%20/g, "+");
  const job = (async () => {
    const ok = (await addStylesheet(`https://fonts.googleapis.com/css2?family=${name}:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700&display=swap`))
      || (await addStylesheet(`https://fonts.googleapis.com/css2?family=${name}&display=swap`));
    if (!ok) return false;
    try { await document.fonts.load(`400 16px "${family}"`); } catch { /* keep going */ }
    return document.fonts.check(`16px "${family}"`);
  })();
  job.then((ok) => { if (!ok) pending.delete(family); });
  pending.set(family, job);
  return job;
}

type LocalFontData = { family: string };
type FontWindow = Window & { queryLocalFonts?: () => Promise<LocalFontData[]> };

/** Local Font Access API: Chromium desktop only, and it asks the user for permission. */
export const localFontsSupported = () => typeof (window as FontWindow).queryLocalFonts === "function";

export async function queryLocalFontFamilies(): Promise<string[]> {
  const query = (window as FontWindow).queryLocalFonts;
  if (!query) return [];
  const faces = await query.call(window);
  return [...new Set(faces.map((face) => face.family))].sort((a, b) => a.localeCompare(b));
}
