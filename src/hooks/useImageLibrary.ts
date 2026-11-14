import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Asset } from "../types";
import { createResolver } from "../lib/images";
import { expandIncoming, prepareImage, zipFiles, type Incoming, type Skipped } from "../lib/importImages";
import { storeAll, storeClear, storeDelete, storePut } from "../lib/imageStore";

export type ImportReport = { added: number; replaced: number; skipped: Skipped[] };

/** The shared image library: metadata in React state, pixels in IndexedDB, object URLs created on demand. */
export function useImageLibrary() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const blobs = useRef(new Map<string, Blob>());
  const urls = useRef(new Map<string, string>());

  useEffect(() => {
    storeAll().then((rows) => {
      for (const row of rows) blobs.current.set(row.id, row.blob);
      setAssets(rows.map(({ blob: _blob, addedAt: _added, ...asset }) => asset).sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true })));
    }).catch(() => { /* private mode: the library just starts empty */ }).finally(() => setReady(true));
  }, []);

  const urlFor = useCallback((id: string | undefined) => {
    if (!id) return undefined;
    let url = urls.current.get(id);
    if (!url) { const blob = blobs.current.get(id); if (!blob) return undefined; url = URL.createObjectURL(blob); urls.current.set(id, url); }
    return url;
  }, []);

  const forget = (id: string) => { const url = urls.current.get(id); if (url) URL.revokeObjectURL(url); urls.current.delete(id); blobs.current.delete(id); };

  /** Adds images, zips (opened for you) and PDFs. Files with the same path replace the existing image. */
  const addFiles = useCallback(async (incoming: Incoming[]): Promise<ImportReport & { assets: Asset[] }> => {
    const skipped: Skipped[] = [];
    const files = await expandIncoming(incoming, skipped);
    setProgress({ done: 0, total: files.length });
    const byPath = new Map(assets.map((a) => [a.path.toLowerCase(), a]));
    const added: Asset[] = [];
    let replaced = 0;
    for (let i = 0; i < files.length; i++) {
      const prepared = await prepareImage(files[i]);
      if ("reason" in prepared) skipped.push(prepared);
      else {
        const existing = byPath.get(prepared.asset.path.toLowerCase());
        const asset = existing ? { ...prepared.asset, id: existing.id } : prepared.asset;
        if (existing) { replaced++; forget(existing.id); }
        blobs.current.set(asset.id, prepared.blob);
        try { await storePut(asset, prepared.blob); } catch { /* keep it in memory for this session */ }
        byPath.set(asset.path.toLowerCase(), asset);
        added.push(asset);
      }
      setProgress({ done: i + 1, total: files.length });
    }
    setAssets([...byPath.values()].sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true })));
    setProgress(null);
    return { added: added.length - replaced, replaced, skipped, assets: added };
  }, [assets]);

  const remove = useCallback(async (id: string) => {
    forget(id);
    setAssets((list) => list.filter((a) => a.id !== id));
    try { await storeDelete(id); } catch { /* ignore */ }
  }, []);

  const clear = useCallback(async () => {
    for (const id of [...blobs.current.keys()]) forget(id);
    setAssets([]);
    try { await storeClear(); } catch { /* ignore */ }
  }, []);

  /** Original files by path, ready for a zip. */
  const exportZip = useCallback(async () => {
    const files: Record<string, Uint8Array> = {};
    for (const asset of assets) { const blob = blobs.current.get(asset.id); if (blob) files[asset.path] = new Uint8Array(await blob.arrayBuffer()); }
    return zipFiles(files);
  }, [assets]);

  /** Restores a whole library (opening a project bundle), keeping the ids that items refer to. */
  const replaceAll = useCallback(async (entries: { asset: Asset; blob: Blob }[]) => {
    await clear();
    for (const { asset, blob } of entries) { blobs.current.set(asset.id, blob); try { await storePut(asset, blob); } catch { /* ignore */ } }
    setAssets(entries.map((e) => e.asset).sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true })));
  }, [clear]);

  const blobOf = useCallback((id: string) => blobs.current.get(id), []);
  const resolver = useMemo(() => createResolver(assets), [assets]);

  return { assets, ready, progress, urlFor, blobOf, addFiles, remove, clear, exportZip, replaceAll, resolver };
}

export type ImageLibrary = ReturnType<typeof useImageLibrary>;
