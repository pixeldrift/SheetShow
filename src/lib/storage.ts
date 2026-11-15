import { strFromU8, strToU8, unzip } from "fflate";
import type { Asset, Project } from "../types";
import { zipFiles } from "./importImages";
import { upgradeProject } from "./merge";

const KEY = "sheetshow:project:v1";

const isProject = (value: unknown): value is Project => {
  const p = value as Project;
  return !!p && p.version === 1 && Array.isArray(p.items) && Array.isArray(p.records) && !!p.template && !!p.sheet;
};

export function loadProject(): Project | null {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return isProject(parsed) ? upgradeProject({ ...parsed, fonts: parsed.fonts ?? [], sheet: { ...parsed.sheet, cropMarks: parsed.sheet.cropMarks ?? false } }) : null;
  } catch { return null; }
}

/** Returns false when the browser refused (private mode, or quota exceeded by large images). */
export function saveProject(project: Project): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(project)); return true; } catch { return false; }
}

export function downloadProject(project: Project) {
  const blob = new Blob([JSON.stringify(project)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${project.name.replace(/[^\w\- ]+/g, "").trim() || "sheetshow"}.sheetshow.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export async function readProjectFile(file: File): Promise<Project> {
  const parsed = JSON.parse(await file.text());
  if (!isProject(parsed)) throw new Error("That file isn’t a SheetShow project.");
  return { ...parsed, fonts: parsed.fonts ?? [], sheet: { ...parsed.sheet, cropMarks: parsed.sheet.cropMarks ?? false } };
}


/** A project plus its pictures, as one zip: project.json + images/<id>.<ext>. */
export async function bundleProject(project: Project, assets: Asset[], blobOf: (id: string) => Blob | undefined): Promise<Blob> {
  const files: Record<string, Uint8Array> = { "project.json": strToU8(JSON.stringify({ ...project, assets })) };
  for (const asset of assets) {
    const blob = blobOf(asset.id);
    if (blob) files[`images/${asset.id}.${asset.path.split(".").pop() ?? "bin"}`] = new Uint8Array(await blob.arrayBuffer());
  }
  return zipFiles(files);
}

export function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}

export const projectFileName = (name: string, bundle: boolean) => `${name.replace(/[^\w\- ]+/g, "").trim() || "sheetshow"}.sheetshow.${bundle ? "zip" : "json"}`;

const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", avif: "image/avif", bmp: "image/bmp" };

/** Opens either a plain .json project or a .zip bundle (returning its pictures too). */
export async function readProjectAny(file: File): Promise<{ project: Project; images?: { asset: Asset; blob: Blob }[] }> {
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  if (head[0] !== 0x50 || head[1] !== 0x4b) return { project: await readProjectFile(file) };
  const files = await new Promise<Record<string, Uint8Array>>(async (resolve, reject) =>
    unzip(new Uint8Array(await file.arrayBuffer()), (error, data) => (error ? reject(error) : resolve(data))));
  const json = files["project.json"];
  if (!json) throw new Error("That zip isn’t a SheetShow project (no project.json inside).");
  const parsed = JSON.parse(strFromU8(json)) as Project & { assets?: Asset[] };
  if (!isProject(parsed)) throw new Error("That file isn’t a SheetShow project.");
  const images = (parsed.assets ?? []).flatMap((asset) => {
    const bytes = files[`images/${asset.id}.${asset.path.split(".").pop() ?? "bin"}`];
    return bytes ? [{ asset, blob: new Blob([bytes], { type: MIME[asset.path.toLowerCase().split(".").pop() ?? ""] ?? "" }) }] : [];
  });
  const { assets: _assets, ...project } = parsed;
  return { project: { ...project, fonts: project.fonts ?? [], sheet: { ...project.sheet, cropMarks: project.sheet.cropMarks ?? false } }, images };
}
