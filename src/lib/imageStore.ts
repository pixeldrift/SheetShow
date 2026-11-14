import type { Asset } from "../types";

/** The image library's pixels, kept in IndexedDB (localStorage is far too small for photos). */
type Row = Asset & { blob: Blob; addedAt: number };

let dbPromise: Promise<IDBDatabase> | null = null;
const open = () => (dbPromise ??= new Promise((resolve, reject) => {
  const request = indexedDB.open("sheetshow", 1);
  request.onupgradeneeded = () => request.result.createObjectStore("images", { keyPath: "id" });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
}));

const run = async <T,>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await open();
  return new Promise((resolve, reject) => {
    const request = work(db.transaction("images", mode).objectStore("images"));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const storeAll = () => run<Row[]>("readonly", (s) => s.getAll());
export const storePut = (asset: Asset, blob: Blob) => run("readwrite", (s) => s.put({ ...asset, blob, addedAt: Date.now() }));
export const storeDelete = (id: string) => run("readwrite", (s) => s.delete(id));
export const storeClear = () => run("readwrite", (s) => s.clear());
