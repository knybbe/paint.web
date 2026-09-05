'use strict';

// src/deviceId.ts
var DEFAULT_KEY = "localsync-device-id";
function randomId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
function getOrCreateDeviceId(key = DEFAULT_KEY) {
  if (typeof localStorage === "undefined") {
    return randomId();
  }
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = randomId();
    localStorage.setItem(key, id);
    return id;
  } catch {
    return randomId();
  }
}

// src/folder.ts
var LOCALSYNC_DIR = "localsync";
async function* iterateEntries(dir) {
  const withEntries = dir;
  if (typeof withEntries.entries === "function") {
    for await (const entry of withEntries.entries()) {
      yield entry;
    }
    return;
  }
  const withValues = dir;
  if (typeof withValues.values === "function") {
    for await (const handle of withValues.values()) {
      yield [handle.name, handle];
    }
  }
}
function isFolderSyncSupported() {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function" && typeof indexedDB !== "undefined";
}
async function ensurePermission(handle, mode = "readwrite") {
  const withPerm = handle;
  if (typeof withPerm.queryPermission === "function") {
    let perm = await withPerm.queryPermission({ mode });
    if (perm === "granted") return true;
    if (typeof withPerm.requestPermission === "function") {
      perm = await withPerm.requestPermission({ mode });
      return perm === "granted";
    }
    return false;
  }
  return true;
}
async function pickDirectory(id = "localsync") {
  const picker = window.showDirectoryPicker;
  return picker({ id, mode: "readwrite" });
}
async function getDir(parent, name, create) {
  return parent.getDirectoryHandle(name, { create });
}
async function getAppDir(root, appId, create) {
  const ls = await getDir(root, LOCALSYNC_DIR, create);
  return getDir(ls, appId, create);
}
async function writeJsonFile(dir, name, data) {
  const fh = await dir.getFileHandle(name, { create: true });
  const writable = await fh.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}
function safeFileName(id) {
  return id.replace(/[/\\?%*:|"<>]/g, "_");
}
async function readCollectionDocs(appDir, collection) {
  try {
    const collections = await getDir(appDir, "collections", false);
    const colDir = await getDir(collections, collection, false);
    const docs = [];
    for await (const [name, handle] of iterateEntries(colDir)) {
      if (handle.kind !== "file" || !name.endsWith(".json")) continue;
      try {
        const file = await handle.getFile();
        const text = await file.text();
        if (!text.trim()) continue;
        const doc = JSON.parse(text);
        if (doc && typeof doc.id === "string") docs.push(doc);
      } catch {
      }
    }
    return docs;
  } catch {
    return [];
  }
}
async function listCollectionNames(appDir) {
  try {
    const collections = await getDir(appDir, "collections", false);
    const names = [];
    for await (const [name, handle] of iterateEntries(collections)) {
      if (handle.kind === "directory") names.push(name);
    }
    return names;
  } catch {
    return [];
  }
}
async function writeDocToFolder(appDir, doc) {
  const collections = await getDir(appDir, "collections", true);
  const colDir = await getDir(collections, doc.collection, true);
  await writeJsonFile(colDir, `${safeFileName(doc.id)}.json`, doc);
}
async function writeMeta(appDir, appId) {
  const meta = {
    version: 1,
    appId,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await writeJsonFile(appDir, "meta.json", meta);
}

// src/idb.ts
var HANDLE_STORE = "handles";
var DOCS_STORE = "documents";
var META_STORE = "meta";
var HANDLE_KEY = "syncDirectory";
function docKey(collection, id) {
  return `${collection}/${id}`;
}
function openLocalSyncDb(dbName) {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }
    const req = indexedDB.open(dbName, 1);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(HANDLE_STORE)) {
        db.createObjectStore(HANDLE_STORE);
      }
      if (!db.objectStoreNames.contains(DOCS_STORE)) {
        const store = db.createObjectStore(DOCS_STORE, { keyPath: "key" });
        store.createIndex("collection", "collection", { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      resolve(wrapDb(dbName, db));
    };
  });
}
function wrapDb(dbName, db) {
  function txDone(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
    });
  }
  return {
    dbName,
    close: () => db.close(),
    async getHandle() {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(HANDLE_STORE, "readonly");
        const req = tx.objectStore(HANDLE_STORE).get(HANDLE_KEY);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    },
    async setHandle(handle) {
      const tx = db.transaction(HANDLE_STORE, "readwrite");
      const store = tx.objectStore(HANDLE_STORE);
      if (handle) store.put(handle, HANDLE_KEY);
      else store.delete(HANDLE_KEY);
      await txDone(tx);
    },
    async getDoc(collection, id) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(DOCS_STORE, "readonly");
        const req = tx.objectStore(DOCS_STORE).get(docKey(collection, id));
        req.onsuccess = () => {
          const row = req.result;
          resolve(row?.doc ?? null);
        };
        req.onerror = () => reject(req.error);
      });
    },
    async putDoc(doc) {
      const tx = db.transaction(DOCS_STORE, "readwrite");
      tx.objectStore(DOCS_STORE).put({
        key: docKey(doc.collection, doc.id),
        collection: doc.collection,
        id: doc.id,
        doc
      });
      await txDone(tx);
    },
    async deleteDocKey(collection, id) {
      const tx = db.transaction(DOCS_STORE, "readwrite");
      tx.objectStore(DOCS_STORE).delete(docKey(collection, id));
      await txDone(tx);
    },
    async listDocs(collection) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(DOCS_STORE, "readonly");
        const index = tx.objectStore(DOCS_STORE).index("collection");
        const req = index.getAll(collection);
        req.onsuccess = () => {
          const rows = req.result ?? [];
          resolve(rows.map((r) => r.doc).filter(Boolean));
        };
        req.onerror = () => reject(req.error);
      });
    },
    async listAllDocs() {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(DOCS_STORE, "readonly");
        const req = tx.objectStore(DOCS_STORE).getAll();
        req.onsuccess = () => {
          const rows = req.result ?? [];
          resolve(rows.map((r) => r.doc).filter(Boolean));
        };
        req.onerror = () => reject(req.error);
      });
    },
    async getMeta(key) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(META_STORE, "readonly");
        const req = tx.objectStore(META_STORE).get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    },
    async setMeta(key, value) {
      const tx = db.transaction(META_STORE, "readwrite");
      tx.objectStore(META_STORE).put(value, key);
      await txDone(tx);
    }
  };
}

// src/merge.ts
function compareUpdatedAt(a, b) {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
  if (Number.isNaN(ta)) return -1;
  if (Number.isNaN(tb)) return 1;
  return ta - tb;
}
function effectiveTime(doc) {
  if (doc.deletedAt) {
    return compareUpdatedAt(doc.deletedAt, doc.updatedAt) >= 0 ? doc.deletedAt : doc.updatedAt;
  }
  return doc.updatedAt;
}
function isDeleted(doc) {
  return Boolean(doc.deletedAt);
}
function compareDocsLww(a, b) {
  const byTime = compareUpdatedAt(effectiveTime(a), effectiveTime(b));
  if (byTime !== 0) return byTime;
  if (a.deviceId === b.deviceId) return a.rev - b.rev;
  return a.deviceId < b.deviceId ? -1 : a.deviceId > b.deviceId ? 1 : 0;
}
function sameVersion(a, b) {
  return a.updatedAt === b.updatedAt && a.deviceId === b.deviceId && a.rev === b.rev && (a.deletedAt ?? null) === (b.deletedAt ?? null);
}
function bothDiverged(local, remote) {
  const localFromRemote = Boolean(local.baseUpdatedAt) && local.baseUpdatedAt === remote.updatedAt;
  const remoteFromLocal = Boolean(remote.baseUpdatedAt) && remote.baseUpdatedAt === local.updatedAt;
  if (localFromRemote || remoteFromLocal) return false;
  if (local.updatedAt === remote.updatedAt && local.deviceId === remote.deviceId) {
    return false;
  }
  return true;
}
function resolveTombstonePair(preferred, other) {
  const prefTime = effectiveTime(preferred);
  const otherTime = effectiveTime(other);
  if (isDeleted(preferred) && isDeleted(other)) {
    return compareUpdatedAt(prefTime, otherTime) >= 0 ? preferred : other;
  }
  if (isDeleted(preferred)) {
    if (compareUpdatedAt(prefTime, other.updatedAt) >= 0) return preferred;
    return { ...other, deletedAt: null };
  }
  if (isDeleted(other)) {
    if (compareUpdatedAt(preferred.updatedAt, otherTime) >= 0) {
      return { ...preferred, deletedAt: null };
    }
    return other;
  }
  return preferred;
}
function lwwWinner(local, remote) {
  return compareDocsLww(local, remote) >= 0 ? resolveTombstonePair(local, remote) : resolveTombstonePair(remote, local);
}
function mergeOne(local, remote, policy) {
  if (!local && !remote) {
    throw new Error("mergeOne requires at least one document");
  }
  if (!local) return { kind: "keep", doc: remote };
  if (!remote) return { kind: "keep", doc: local };
  if (sameVersion(local, remote)) return { kind: "keep", doc: local };
  if (local.baseUpdatedAt && local.baseUpdatedAt === remote.updatedAt) {
    return { kind: "keep", doc: resolveTombstonePair(local, remote) };
  }
  if (remote.baseUpdatedAt && remote.baseUpdatedAt === local.updatedAt) {
    return { kind: "keep", doc: resolveTombstonePair(remote, local) };
  }
  const diverged = bothDiverged(local, remote);
  if (isDeleted(local) !== isDeleted(remote)) {
    if (policy === "detect" && diverged) {
      return { kind: "conflict", local, remote };
    }
    return { kind: "keep", doc: lwwWinner(local, remote) };
  }
  if (policy === "detect" && diverged) {
    return { kind: "conflict", local, remote };
  }
  return { kind: "keep", doc: lwwWinner(local, remote) };
}
function mergeDocuments(localDocs, remoteDocs, policy) {
  const byId = /* @__PURE__ */ new Map();
  for (const doc of localDocs) {
    if (!doc?.id) continue;
    const slot = byId.get(doc.id) ?? {};
    slot.local = doc;
    byId.set(doc.id, slot);
  }
  for (const doc of remoteDocs) {
    if (!doc?.id) continue;
    const slot = byId.get(doc.id) ?? {};
    slot.remote = doc;
    byId.set(doc.id, slot);
  }
  const docs = [];
  const conflicts = [];
  for (const [id, { local, remote }] of byId) {
    const outcome = mergeOne(local, remote, policy);
    if (outcome.kind === "keep") {
      docs.push(outcome.doc);
    } else {
      conflicts.push({
        collection: outcome.local.collection || outcome.remote.collection,
        id,
        local: outcome.local,
        remote: outcome.remote
      });
      docs.push(outcome.local);
    }
  }
  docs.sort((a, b) => compareUpdatedAt(b.updatedAt, a.updatedAt));
  return { docs, conflicts };
}
function pickNewer(a, b) {
  return lwwWinner(a, b);
}

// src/createLocalSync.ts
function createLocalSync(options) {
  const appId = options.appId;
  if (!appId || /[/\\]/.test(appId)) {
    throw new Error("createLocalSync: appId is required and must not contain slashes");
  }
  const conflictPolicy = options.conflictPolicy ?? "lww";
  const dbName = options.dbName ?? `localsync-${appId}`;
  const deviceIdKey = options.deviceIdKey ?? `localsync-device-id`;
  const deviceId = getOrCreateDeviceId(deviceIdKey);
  const supported = isFolderSyncSupported();
  let db = null;
  let cachedHandle = null;
  let conflictHandler = null;
  const conflicts = /* @__PURE__ */ new Map();
  const listeners = /* @__PURE__ */ new Set();
  let state = {
    status: supported ? "unmapped" : "unsupported",
    folderName: null,
    lastSyncedAt: null,
    lastError: null,
    supported,
    pendingConflicts: 0
  };
  function conflictKey(collection, id) {
    return `${collection}/${id}`;
  }
  function getState() {
    return {
      ...state,
      pendingConflicts: conflicts.size,
      supported: isFolderSyncSupported()
    };
  }
  function setState(partial) {
    state = {
      ...state,
      ...partial,
      supported: isFolderSyncSupported(),
      pendingConflicts: conflicts.size
    };
    const snapshot = getState();
    for (const l of listeners) {
      try {
        l(snapshot);
      } catch {
      }
    }
  }
  function subscribe(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }
  async function ensureDb() {
    if (db) return db;
    if (typeof indexedDB === "undefined") {
      throw new Error("IndexedDB is not available");
    }
    db = await openLocalSyncDb(dbName);
    return db;
  }
  async function init() {
    if (!isFolderSyncSupported()) {
      setState({
        status: "unsupported",
        folderName: null,
        lastError: null
      });
      try {
        await ensureDb();
      } catch {
      }
      return getState();
    }
    const store = await ensureDb();
    const handle = await store.getHandle();
    if (!handle) {
      cachedHandle = null;
      setState({ status: "unmapped", folderName: null, lastError: null });
      return getState();
    }
    cachedHandle = handle;
    const ok = await ensurePermission(handle, "readwrite");
    if (!ok) {
      setState({
        status: "permission_needed",
        folderName: handle.name,
        lastError: "Permission needed to access the sync folder."
      });
      return getState();
    }
    setState({
      status: "mapped",
      folderName: handle.name,
      lastError: null
    });
    return getState();
  }
  async function mapFolder() {
    if (!isFolderSyncSupported()) {
      setState({
        status: "unsupported",
        lastError: "Folder sync is not supported in this browser (use Chrome/Edge/Desktop Safari). Local IndexedDB still works."
      });
      return getState();
    }
    try {
      const handle = await pickDirectory(`localsync-${appId}`);
      const store = await ensureDb();
      await store.setHandle(handle);
      cachedHandle = handle;
      setState({
        status: "mapped",
        folderName: handle.name,
        lastError: null
      });
    } catch (e) {
      const aborted = e instanceof DOMException && (e.name === "AbortError" || e.name === "NotAllowedError");
      if (!aborted) {
        setState({
          lastError: e instanceof Error ? e.message : String(e)
        });
      }
    }
    return getState();
  }
  async function unmapFolder() {
    cachedHandle = null;
    try {
      const store = await ensureDb();
      await store.setHandle(null);
    } catch {
    }
    setState({
      status: isFolderSyncSupported() ? "unmapped" : "unsupported",
      folderName: null,
      lastSyncedAt: null,
      lastError: null
    });
    return getState();
  }
  async function requestPermission() {
    const store = await ensureDb();
    const handle = cachedHandle ?? await store.getHandle();
    if (!handle) return false;
    cachedHandle = handle;
    const ok = await ensurePermission(handle, "readwrite");
    if (ok) {
      setState({
        status: "mapped",
        folderName: handle.name,
        lastError: null
      });
    } else {
      setState({
        status: "permission_needed",
        folderName: handle.name,
        lastError: "Permission needed to access the sync folder."
      });
    }
    return ok;
  }
  async function put(collection, id, payload) {
    const store = await ensureDb();
    const existing = await store.getDoc(collection, id);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const doc = {
      version: 1,
      id,
      collection,
      updatedAt: now,
      createdAt: existing?.createdAt ?? now,
      deletedAt: null,
      deviceId,
      rev: (existing?.deviceId === deviceId ? existing.rev : 0) + 1,
      baseUpdatedAt: existing?.updatedAt,
      payload
    };
    await store.putDoc(doc);
    conflicts.delete(conflictKey(collection, id));
    setState({});
    void writeThrough(doc);
    return doc;
  }
  async function writeThrough(doc) {
    if (state.status !== "mapped" || !cachedHandle) return;
    try {
      const ok = await ensurePermission(cachedHandle, "readwrite");
      if (!ok) return;
      const appDir = await getAppDir(cachedHandle, appId, true);
      await writeDocToFolder(appDir, doc);
      await writeMeta(appDir, appId);
    } catch {
    }
  }
  async function get(collection, id) {
    const store = await ensureDb();
    const doc = await store.getDoc(collection, id);
    if (!doc || doc.deletedAt) return null;
    return doc;
  }
  async function list(collection) {
    const store = await ensureDb();
    const docs = await store.listDocs(collection);
    return docs.filter((d) => !d.deletedAt).sort((a, b) => a.updatedAt < b.updatedAt ? 1 : -1);
  }
  async function deleteDoc(collection, id) {
    const store = await ensureDb();
    const existing = await store.getDoc(collection, id);
    if (!existing) return null;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const doc = {
      ...existing,
      updatedAt: now,
      deletedAt: now,
      deviceId,
      rev: (existing.deviceId === deviceId ? existing.rev : 0) + 1,
      baseUpdatedAt: existing.updatedAt,
      payload: existing.payload
    };
    await store.putDoc(doc);
    conflicts.delete(conflictKey(collection, id));
    setState({});
    void writeThrough(doc);
    return doc;
  }
  function rememberConflicts(list2) {
    for (const c of list2) {
      conflicts.set(conflictKey(c.collection, c.id), c);
    }
    setState({ pendingConflicts: conflicts.size });
  }
  async function applyHandler(conflict) {
    if (!conflictHandler) return null;
    const result = await conflictHandler(conflict);
    if (result === "local") return conflict.local;
    if (result === "remote") return conflict.remote;
    return result;
  }
  async function sync() {
    const store = await ensureDb();
    if (!isFolderSyncSupported()) {
      setState({ status: "unsupported" });
      return getState();
    }
    let handle = cachedHandle;
    if (!handle) {
      handle = await store.getHandle();
      cachedHandle = handle;
    }
    if (!handle) {
      setState({ status: "unmapped", folderName: null });
      return getState();
    }
    const permitted = await ensurePermission(handle, "readwrite");
    if (!permitted) {
      setState({
        status: "permission_needed",
        folderName: handle.name,
        lastError: "Permission needed to access the sync folder."
      });
      return getState();
    }
    setState({ status: "syncing", folderName: handle.name, lastError: null });
    try {
      const appDir = await getAppDir(handle, appId, true);
      const localAll = await store.listAllDocs();
      const localByCollection = groupByCollection(localAll);
      const remoteCollections = /* @__PURE__ */ new Set([
        ...Object.keys(localByCollection),
        ...await listCollectionNames(appDir)
      ]);
      const newConflicts = [];
      for (const collection of remoteCollections) {
        const localDocs = localByCollection[collection] ?? [];
        const remoteDocs = await readCollectionDocs(appDir, collection);
        const { docs, conflicts: colConflicts } = mergeDocuments(
          localDocs,
          remoteDocs,
          conflictPolicy
        );
        const finalById = /* @__PURE__ */ new Map();
        for (const doc of docs) {
          finalById.set(doc.id, doc);
        }
        for (const c of colConflicts) {
          const handled = await applyHandler(c);
          if (handled) {
            finalById.set(c.id, handled);
          } else {
            newConflicts.push(c);
            finalById.set(c.id, c.local);
          }
        }
        for (const doc of finalById.values()) {
          await store.putDoc(doc);
          await writeDocToFolder(appDir, doc);
        }
      }
      conflicts.clear();
      rememberConflicts(newConflicts);
      await writeMeta(appDir, appId);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      setState({
        status: "mapped",
        folderName: handle.name,
        lastSyncedAt: now,
        lastError: null
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setState({
        status: "error",
        folderName: handle.name,
        lastError: message
      });
    }
    return getState();
  }
  function listConflicts() {
    return Array.from(conflicts.values());
  }
  function onConflict(handler) {
    conflictHandler = handler;
  }
  async function resolveConflict(collection, id, choice) {
    const store = await ensureDb();
    const key = conflictKey(collection, id);
    const info = conflicts.get(key);
    const local = info?.local ?? await store.getDoc(collection, id);
    if (!local && !info?.remote) {
      throw new Error(`No conflict or document for ${collection}/${id}`);
    }
    let winner;
    if (choice === "local") {
      if (!local) throw new Error("No local document");
      winner = local;
    } else if (choice === "remote") {
      if (!info?.remote) throw new Error("No remote document in conflict");
      winner = info.remote;
    } else if (choice && typeof choice === "object" && "id" in choice && "updatedAt" in choice && "payload" in choice) {
      winner = choice;
    } else {
      const base = local ?? info.remote;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      winner = {
        ...base,
        updatedAt: now,
        deletedAt: null,
        deviceId,
        rev: (base.deviceId === deviceId ? base.rev : 0) + 1,
        baseUpdatedAt: base.updatedAt,
        payload: choice
      };
    }
    if (choice === "local" || choice === "remote") {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      winner = {
        ...winner,
        updatedAt: now,
        deviceId,
        rev: (winner.deviceId === deviceId ? winner.rev : 0) + 1,
        baseUpdatedAt: info ? [info.local.updatedAt, info.remote.updatedAt].sort().at(-1) : winner.updatedAt
      };
    }
    await store.putDoc(winner);
    conflicts.delete(key);
    setState({});
    void writeThrough(winner);
    return winner;
  }
  return {
    appId,
    deviceId,
    isSupported: () => isFolderSyncSupported(),
    getState,
    subscribe,
    init,
    mapFolder,
    unmapFolder,
    requestPermission,
    put,
    get,
    list,
    delete: deleteDoc,
    sync,
    onConflict,
    listConflicts,
    resolveConflict
  };
}
function groupByCollection(docs) {
  const out = {};
  for (const doc of docs) {
    if (!out[doc.collection]) out[doc.collection] = [];
    out[doc.collection].push(doc);
  }
  return out;
}

exports.compareUpdatedAt = compareUpdatedAt;
exports.createLocalSync = createLocalSync;
exports.effectiveTime = effectiveTime;
exports.getOrCreateDeviceId = getOrCreateDeviceId;
exports.isFolderSyncSupported = isFolderSyncSupported;
exports.mergeDocuments = mergeDocuments;
exports.mergeOne = mergeOne;
exports.pickNewer = pickNewer;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map