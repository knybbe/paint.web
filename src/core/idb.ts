const DB_NAME = "paint-web";
const DB_VERSION = 2;

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
      if (!db.objectStoreNames.contains("autosave")) db.createObjectStore("autosave");
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
}

export async function pushRecent(name: string): Promise<RecentFile[]> {
  const rec: RecentFile = { id: `${Date.now()}-${name}`, name, openedAt: Date.now() };
  const prev = ((await idbGet<RecentFile[]>("recent", "list")) ?? []).filter((r) => r.name !== name);
  const next = [rec, ...prev].slice(0, 12);
  await idbSet("recent", "list", next);
  return next;
}
