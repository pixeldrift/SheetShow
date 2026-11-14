import { unzip, zip } from "fflate";
import { getDocument } from "pdfjs-dist";
import type { Asset } from "../types";
import { uid } from "./data";
import { baseName } from "./images";

/** A file on its way into the library, with the folder path it came from (if any). */
export type Incoming = { blob: Blob; name: string; path: string };
export type Skipped = { name: string; reason: string };

const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", avif: "image/avif", bmp: "image/bmp" };
const ext = (name: string) => name.toLowerCase().split(".").pop() ?? "";
const isZip = (name: string, type: string) => ext(name) === "zip" || type === "application/zip" || type === "application/x-zip-compressed";
const isPdf = (name: string, type: string) => ext(name) === "pdf" || type === "application/pdf";
const MAX_DIM = 2400; // enough for 300 dpi on anything up to 8 inches

const unzipAsync = (data: Uint8Array) =>
  new Promise<Record<string, Uint8Array>>((resolve, reject) =>
    unzip(data, { filter: (f) => !f.name.endsWith("/") && !f.name.includes("__MACOSX/") && !baseName(f.name).startsWith(".") }, (error, files) => (error ? reject(error) : resolve(files))));

/** Opens zips (a zip may contain folders) and flattens everything into individual files. */
export async function expandIncoming(inputs: Incoming[], skipped: Skipped[]): Promise<Incoming[]> {
  const out: Incoming[] = [];
  for (const input of inputs) {
    if (isZip(input.name, input.blob.type)) {
      try {
        const files = await unzipAsync(new Uint8Array(await input.blob.arrayBuffer()));
        for (const [path, bytes] of Object.entries(files)) {
          const name = baseName(path);
          out.push({ blob: new Blob([bytes], { type: MIME[ext(name)] ?? "" }), name, path });
        }
      } catch { skipped.push({ name: input.name, reason: "couldn’t open this zip" }); }
    } else out.push(input);
  }
  return stripCommonRoot(out);
}

/** A folder (or a zip of one) names its own container: drop that single shared top-level folder so re-imports line up. */
function stripCommonRoot(files: Incoming[]): Incoming[] {
  const roots = new Set(files.map((f) => f.path.split("/")[0]));
  if (!files.length || roots.size !== 1 || !files.every((f) => f.path.includes("/"))) return files;
  return files.map((f) => ({ ...f, path: f.path.split("/").slice(1).join("/") }));
}

const loadDimensions = (blob: Blob) => new Promise<{ width: number; height: number }>((resolve, reject) => {
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.onload = () => { URL.revokeObjectURL(url); resolve({ width: image.naturalWidth || 300, height: image.naturalHeight || 300 }); };
  image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("decode")); };
  image.src = url;
});

async function pdfFirstPage(blob: Blob): Promise<Blob> {
  const pdf = await getDocument({ data: await blob.arrayBuffer() }).promise;
  const page = await pdf.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(3, Math.max(2, 1800 / Math.max(base.width, base.height))) });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
  await pdf.destroy();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("pdf"))), "image/png"));
}

/** Decodes an image, downsizing very large photos so the library (and printing) stay fast. */
export async function prepareImage(input: Incoming): Promise<{ asset: Asset; blob: Blob } | Skipped> {
  let blob = input.blob;
  let name = input.name, path = input.path;
  try {
    if (isPdf(name, blob.type)) { blob = await pdfFirstPage(blob); name = name.replace(/\.pdf$/i, "") + ".png"; path = path.replace(/\.pdf$/i, "") + ".png"; }
    const type = MIME[ext(name)] ?? blob.type;
    if (!type.startsWith("image/")) return { name: input.name, reason: "not an image" };
    if (blob.type !== type) blob = new Blob([blob], { type });
    let { width, height } = await loadDimensions(blob);
    if (type !== "image/svg+xml" && type !== "image/gif" && Math.max(width, height) > MAX_DIM) {
      const scale = MAX_DIM / Math.max(width, height);
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const outType = type === "image/jpeg" ? "image/jpeg" : "image/png";
      blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("resize"))), outType, 0.9));
      width = canvas.width; height = canvas.height;
    }
    return { asset: { id: uid() + uid(), name, path, width, height, bytes: blob.size }, blob };
  } catch {
    return { name: input.name, reason: "couldn’t be read as an image (HEIC and some formats aren’t supported by this browser)" };
  }
}

/** Builds a zip of the given files (images are already compressed, so they're stored, not deflated). */
export function zipFiles(files: Record<string, Uint8Array>): Promise<Blob> {
  const entries = Object.fromEntries(Object.entries(files).map(([path, bytes]) => [path, [bytes, { level: 0 as const }] as [Uint8Array, { level: 0 }]]));
  return new Promise((resolve, reject) => zip(entries, (error, data) => (error ? reject(error) : resolve(new Blob([data], { type: "application/zip" })))));
}
export { unzipAsync };

/* ── Gathering files from drops and pickers ───────────────────────────────────────── */

/** Walks dropped folders (Chromium/Safari/Firefox entry API). */
async function walk(entry: FileSystemEntry, prefix: string, out: Incoming[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
    out.push({ blob: file, name: file.name, path: prefix + file.name });
  } else if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
      if (!batch.length) break;
      for (const child of batch) await walk(child, prefix + entry.name + "/", out);
    }
  }
}

export async function incomingFromDrop(data: DataTransfer): Promise<Incoming[]> {
  const out: Incoming[] = [];
  const entries = [...data.items].map((item) => item.webkitGetAsEntry?.()).filter((e): e is FileSystemEntry => !!e);
  if (entries.length) for (const entry of entries) await walk(entry, "", out);
  else for (const file of data.files) out.push({ blob: file, name: file.name, path: file.name });
  return out;
}

export const incomingFromFiles = (files: FileList | File[]): Incoming[] =>
  [...files].map((file) => ({ blob: file, name: file.name, path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name }));
