import type { RecordRow } from "../types";
import { gridToRecords, parseGrid } from "./importText";

/** The spreadsheet and tab a Google Sheets address points at. */
export function parseSheetAddress(input: string): { id: string; gid: string | null } | null {
  const text = input.trim();
  const m = text.match(/\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]{20,})/) ?? text.match(/^([a-zA-Z0-9_-]{30,})$/);
  if (!m) return null;
  const gid = text.match(/[#&?]gid=(\d+)/)?.[1] ?? null;
  return { id: m[1], gid };
}

export class SheetAccessError extends Error {
  constructor(message: string, readonly needsSignIn: boolean) { super(message); }
}

/** A sheet shared as “anyone with the link can view”, read as CSV with no sign-in. */
export async function fetchPublicSheet(id: string, gid: string | null): Promise<RecordRow[]> {
  const tab = gid ?? "0";
  const urls = [
    `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${tab}`,
    `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${tab}`,
  ];
  let sawPage = false;
  for (const url of urls) {
    try {
      const response = await fetch(url, { credentials: "omit" });
      const type = response.headers.get("content-type") ?? "";
      if (response.ok && !type.includes("text/html")) {
        const records = gridToRecords(parseGrid(await response.text(), ","), true);
        if (records.length) return records;
        throw new SheetAccessError("That sheet has no rows.", false);
      }
      sawPage = true; // Google answered with a sign-in or error page: the sheet isn't open to the link
    } catch (error) {
      if (error instanceof SheetAccessError) throw error;
      /* blocked or unreachable: try the next address */
    }
  }
  throw new SheetAccessError(sawPage
    ? "Google asked for a sign-in, so this sheet isn't shared with “anyone with the link”."
    : "The sheet couldn't be reached. It may not be shared with “anyone with the link”, or the connection was blocked.", true);
}

/* ── Signed in with Google: read-only access to the person's own sheets ─────────────────── */

export const googleClientId: string | undefined = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || undefined;
const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

type Gis = { accounts: { oauth2: { initTokenClient: (config: { client_id: string; scope: string; callback: (r: { access_token?: string; error?: string; error_description?: string }) => void; error_callback?: (e: { type?: string }) => void }) => { requestAccessToken: (o?: { prompt?: string }) => void } } } };
let gisLoading: Promise<Gis> | null = null;
let token: { value: string; expires: number } | null = null;

function loadGis(): Promise<Gis> {
  const w = window as unknown as { google?: Gis };
  if (w.google?.accounts?.oauth2) return Promise.resolve(w.google);
  gisLoading ??= new Promise<Gis>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => (w.google?.accounts?.oauth2 ? resolve(w.google) : reject(new Error("Google sign-in did not load.")));
    script.onerror = () => { gisLoading = null; reject(new Error("Google sign-in could not be loaded. Check your connection.")); };
    document.head.appendChild(script);
  });
  return gisLoading;
}

/** Asks Google for read-only access to the person's spreadsheets. The token lives in memory only, never saved. */
export async function signInToGoogle(): Promise<void> {
  if (!googleClientId) throw new Error("Google sign-in isn't set up for this copy of SheetShow.");
  if (token && token.expires > Date.now() + 30_000) return;
  const gis = await loadGis();
  await new Promise<void>((resolve, reject) => {
    const client = gis.accounts.oauth2.initTokenClient({
      client_id: googleClientId, scope: SCOPE,
      callback: (r) => {
        if (r.access_token) { token = { value: r.access_token, expires: Date.now() + 3_300_000 }; resolve(); }
        else reject(new Error(r.error_description || "Google sign-in was cancelled."));
      },
      error_callback: (e) => reject(new Error(e.type === "popup_closed" ? "The Google sign-in window was closed." : "Google sign-in was blocked. Allow pop-ups for this page and try again.")),
    });
    client.requestAccessToken({ prompt: "" });
  });
}

const api = async (path: string): Promise<unknown> => {
  if (!token) throw new Error("Sign in with Google first.");
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${path}`, { headers: { Authorization: `Bearer ${token.value}` } });
  if (response.status === 401) { token = null; throw new Error("Your Google sign-in expired. Sign in again."); }
  if (response.status === 403 || response.status === 404) throw new Error("That sheet isn't available to the Google account you signed in with. Check that it's shared with you.");
  if (!response.ok) throw new Error(`Google Sheets answered with an error (${response.status}).`);
  return response.json();
};

export type SheetTab = { gid: string; title: string };
export type SheetInfo = { title: string; tabs: SheetTab[] };

export async function sheetInfo(id: string): Promise<SheetInfo> {
  const data = await api(`${id}?fields=properties.title,sheets.properties(sheetId,title)`) as { properties: { title: string }; sheets: { properties: { sheetId: number; title: string } }[] };
  return { title: data.properties.title, tabs: data.sheets.map((s) => ({ gid: String(s.properties.sheetId), title: s.properties.title })) };
}

/** One tab of a sheet, as the values the person sees (formulas already worked out). */
export async function fetchSignedInTab(id: string, tabTitle: string): Promise<RecordRow[]> {
  const data = await api(`${id}/values/${encodeURIComponent(tabTitle)}?valueRenderOption=FORMATTED_VALUE`) as { values?: string[][] };
  const records = gridToRecords((data.values ?? []).map((row) => row.map((c) => String(c ?? "").trim())), true);
  if (!records.length) throw new Error("That tab has no rows.");
  return records;
}
