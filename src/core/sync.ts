import {
  createExplorer,
  createLocalSync,
  isFolderSyncSupported,
  isNotFoundError,
  STALE_HANDLE_MESSAGE,
  type ConflictInfo,
  type Explorer,
  type ExplorerFileNode,
  type ExplorerFolderNode,
  type ExplorerNode,
  type LocalSync,
  type LocalSyncState,
  type SyncDocument,
} from "@yearlylabs/local-sync";
import type { AppState } from "../app-state";
import { PdDocument, type BackgroundKind } from "./document";
import type { BlendMode } from "./blend";
import { idbDelete } from "./idb";
import { Layer, noteLayerId } from "./layer";
import { PixelBuffer } from "./pixel-buffer";

export { STALE_HANDLE_MESSAGE, isNotFoundError };
export type { ConflictInfo, Explorer, ExplorerFileNode, ExplorerFolderNode, ExplorerNode, LocalSync, LocalSyncState, SyncDocument };

export interface SyncedLayerPayload {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: BlendMode;
  width: number;
  height: number;
  pixelsBase64: string;
  maskBase64: string | null;
  maskEnabled: boolean;
}

export interface SyncedDocumentPayload {
  name: string;
  dpi: number;
  background: BackgroundKind;
  dirty: boolean;
  activeLayerId: string;
  width: number;
  height: number;
  layers: SyncedLayerPayload[];
}

export const localSync: LocalSync = createLocalSync({
  appRootName: "paint",
  conflictPolicy: "detect",
});

function explorerDisplayName(doc: SyncDocument): string {
  const payload = doc.payload as { name?: unknown } | null;
  if (payload && typeof payload.name === "string" && payload.name.trim()) {
    return payload.name.trim();
  }
  return doc.id;
}

export const explorer: Explorer = createExplorer(localSync, {
  collections: ["documents"],
  getDisplayName: explorerDisplayName,
});

function uint8ToBase64(bytes: Uint8Array | Uint8ClampedArray): string {
  let binary = "";
  const len = bytes.byteLength;
  const chunk = 8192;
  for (let i = 0; i < len; i += chunk) {
    const sub = bytes.subarray(i, Math.min(i + chunk, len));
    binary += String.fromCharCode.apply(null, sub as unknown as number[]);
  }
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function documentToSyncPayload(doc: PdDocument): SyncedDocumentPayload {
  return {
    name: doc.name,
    dpi: doc.dpi,
    background: doc.background,
    dirty: doc.dirty,
    activeLayerId: doc.activeLayerId,
    width: doc.width,
    height: doc.height,
    layers: doc.layers.map((l) => ({
      id: l.id,
      name: l.name,
      visible: l.visible,
      locked: l.locked,
      opacity: l.opacity,
      blendMode: l.blendMode,
      width: l.width,
      height: l.height,
      pixelsBase64: uint8ToBase64(l.buffer.data),
      maskBase64: l.mask ? uint8ToBase64(l.mask) : null,
      maskEnabled: l.maskEnabled,
    })),
  };
}

export function documentFromSyncPayload(payload: SyncedDocumentPayload): PdDocument {
  const w = payload.width || payload.layers[0]?.width || 800;
  const h = payload.height || payload.layers[0]?.height || 600;
  const doc = new PdDocument(w, h, {
    name: payload.name,
    dpi: payload.dpi,
    background: payload.background,
  });
  doc.layers = payload.layers.map((sl) => {
    const pixels = base64ToUint8(sl.pixelsBase64);
    const buf = new PixelBuffer(sl.width, sl.height, new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, pixels.byteLength));
    const layer = Layer.fromBuffer(buf, sl.name);
    layer.id = sl.id;
    noteLayerId(sl.id);
    layer.visible = sl.visible;
    layer.locked = sl.locked;
    layer.opacity = sl.opacity;
    layer.blendMode = sl.blendMode;
    layer.mask = sl.maskBase64 ? base64ToUint8(sl.maskBase64) : null;
    layer.maskEnabled = sl.maskEnabled;
    return layer;
  });
  if (!doc.layers.length) doc.layers.push(new Layer(w, h, "Background"));
  doc.activeLayerId = doc.layers.some((l) => l.id === payload.activeLayerId)
    ? payload.activeLayerId
    : doc.layers[doc.layers.length - 1].id;
  doc.dirty = payload.dirty;
  return doc;
}

let syncInitialized = false;
let syncTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleSyncWhenMapped(delayMs = 400): void {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    if (localSync.getState().status === "mapped") {
      void runFolderSync().catch(() => {
        /* Non-fatal background sync */
      });
    }
  }, delayMs);
}

export async function awaitSyncWhenMapped(): Promise<LocalSyncState | null> {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  if (localSync.getState().status === "mapped") {
    try {
      return await runFolderSync();
    } catch {
      return localSync.getState();
    }
  }
  return null;
}

export async function clearAutosaveDocument(docId: string): Promise<void> {
  try {
    await idbDelete("autosave", docId);
  } catch {
    /* Non-fatal */
  }
}

export async function seedOpenSessionsIntoSync(app: AppState): Promise<void> {
  for (const session of app.sessions) {
    try {
      await syncSaveDocument(session.id, session.document);
    } catch {
      /* Non-fatal */
    }
  }
}

export async function initLocalSync(app: AppState): Promise<LocalSyncState> {
  if (syncInitialized) return localSync.getState();
  syncInitialized = true;

  localSync.subscribe(() => {
    app.notify("sync");
  });

  const state = await localSync.init();

  if (typeof window !== "undefined") {
    const triggerSync = () => {
      if (localSync.getState().status === "mapped") {
        void runFolderSync().catch(() => {
          /* Non-fatal */
        });
      }
    };
    window.addEventListener("focus", triggerSync);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          triggerSync();
        }
      });
    }
  }

  return state;
}

export async function syncSaveDocument(docId: string, doc: PdDocument): Promise<void> {
  try {
    const payload = documentToSyncPayload(doc);
    await localSync.put("documents", docId, payload);
    try {
      await explorer.ensurePlacement("documents", docId, null, payload.name);
    } catch {
      /* Placement is best-effort */
    }
    scheduleSyncWhenMapped();
  } catch {
    /* Non-fatal: local IDB remains primary */
  }
}

export async function syncDeleteDocument(docId: string): Promise<void> {
  try {
    await localSync.delete("documents", docId);
  } catch {
    /* Non-fatal */
  }
  await clearAutosaveDocument(docId);
  scheduleSyncWhenMapped();
}

export async function syncSavePref<T = unknown>(key: string, value: T): Promise<void> {
  try {
    await localSync.put("prefs", key, value);
  } catch {
    /* Non-fatal */
  }
}

export async function runFolderSync(): Promise<LocalSyncState> {
  try {
    return await localSync.sync();
  } catch (err: unknown) {
    const e = err as Error;
    const curr = localSync.getState();
    return {
      status: "error",
      folderName: curr.folderName,
      lastSyncedAt: curr.lastSyncedAt,
      lastError: e?.message || "Sync failed",
      supported: isFolderSyncSupported(),
      pendingConflicts: curr.pendingConflicts,
    };
  }
}

export function isSyncSupported(): boolean {
  return isFolderSyncSupported();
}
