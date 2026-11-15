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

export class SheetAccessError extends Error {}

/** A sheet shared as “anyone with the link can view”, read as CSV with no sign-in. Anything private is brought in by copying and pasting. */
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
        throw new SheetAccessError("That sheet has no rows.");
      }
      sawPage = true; // Google answered with a sign-in or error page: the sheet isn't open to the link
    } catch (error) {
      if (error instanceof SheetAccessError) throw error;
      /* blocked or unreachable: try the next address */
    }
  }
  throw new SheetAccessError(sawPage
    ? "Google asked for a sign-in, so this sheet isn't shared with “anyone with the link”."
    : "The sheet couldn't be reached. It may not be shared with “anyone with the link”, or the connection was blocked.");
}
