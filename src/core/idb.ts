const DB_NAME = "paint-web";
const DB_VERSION = 4;

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings");
      if (event.oldVersion < 2 && db.objectStoreNames.contains("recent")) {
        db.deleteObjectStore("recent");
      }
      if (!db.objectStoreNames.contains("recent")) db.createObjectStore("recent");
      if (!db.objectStoreNames.contains("recent-files")) db.createObjectStore("recent-files");
      if (!db.objectStoreNames.contains("autosave")) db.createObjectStore("autosave");
      if (!db.objectStoreNames.contains("workspace")) db.createObjectStore("workspace");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGet<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

export function putRequest(store: IDBObjectStore, value: unknown, key: IDBValidKey): IDBRequest {
  return store.keyPath ? store.put(value) : store.put(value, key);
}

export async function idbSet(store: string, key: IDBValidKey, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    putRequest(tx.objectStore(store), value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbDelete(store: string, key: IDBValidKey): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbGetAll<T>(store: string): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

export interface RecentFile {
  id: string;
  name: string;
  openedAt: number;
  type?: string;
  size?: number;
}

const RECENT_BLOB_MAX = 30 * 1024 * 1024;
const RECENT_LIMIT = 8;

export async function pushRecent(name: string): Promise<RecentFile[]> {
  const rec: RecentFile = { id: `${Date.now()}-${name}`, name, openedAt: Date.now() };
  const prev = ((await idbGet<RecentFile[]>("recent", "list")) ?? []).filter((r) => r.name !== name);
  const next = [rec, ...prev].slice(0, RECENT_LIMIT);
  await idbSet("recent", "list", next);
  return next;
}

export async function pushRecentFile(file: File): Promise<RecentFile[]> {
  const rec: RecentFile = {
    id: `${Date.now()}-${file.name}`,
    name: file.name,
    openedAt: Date.now(),
    type: file.type,
    size: file.size,
  };
  const prev = ((await idbGet<RecentFile[]>("recent", "list")) ?? []).filter((r) => r.name !== file.name);
  const dropped = [...prev].slice(RECENT_LIMIT - 1);
  const next = [rec, ...prev].slice(0, RECENT_LIMIT);
  await idbSet("recent", "list", next);
  for (const old of dropped) {
    try {
      await idbDelete("recent-files", old.id);
    } catch {
      /* ignore */
    }
  }
  if (file.size <= RECENT_BLOB_MAX) {
    try {
      await idbSet("recent-files", rec.id, await file.arrayBuffer());
    } catch {
      /* quota */
    }
  }
  return next;
}
