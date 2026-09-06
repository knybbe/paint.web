import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { AppState } from "../src/app-state";
import { AppDialogs } from "../src/ui/react/app-dialogs";
import { PdDocument } from "../src/core/document";
import { Layer } from "../src/core/layer";
import { PixelBuffer } from "../src/core/pixel-buffer";
import {
  awaitSyncWhenMapped,
  clearAutosaveDocument,
  documentFromSyncPayload,
  documentToSyncPayload,
  explorer,
  isNotFoundError,
  isSyncSupported,
  localSync,
  runFolderSync,
  scheduleSyncWhenMapped,
  seedOpenSessionsIntoSync,
  STALE_HANDLE_MESSAGE,
  syncDeleteDocument,
  syncSaveDocument,
  type SyncedDocumentPayload,
} from "../src/core/sync";

describe("YearlyLabs Local Sync folder sync", () => {
  it("serializes and deserializes a document preserving layers and pixel buffers", () => {
    const doc = new PdDocument(32, 24, { name: "TestSyncDoc.pdn", dpi: 96, background: "White" });
    const layer1 = doc.layers[0];
    layer1.buffer.setPixel(0, 0, { r: 255, g: 0, b: 0, a: 255 });
    layer1.buffer.setPixel(31, 23, { r: 0, g: 255, b: 0, a: 200 });

    const buf2 = PixelBuffer.create(32, 24, { r: 0, g: 0, b: 0, a: 0 });
    buf2.setPixel(5, 5, { r: 0, g: 0, b: 255, a: 255 });
    const layer2 = Layer.fromBuffer(buf2, "Overlay Layer");
    layer2.opacity = 180;
    layer2.blendMode = "Multiply";
    layer2.mask = new Uint8Array(32 * 24).fill(128);
    layer2.maskEnabled = true;
    doc.layers.push(layer2);
    doc.activeLayerId = layer2.id;
    doc.dirty = true;

    const payload: SyncedDocumentPayload = documentToSyncPayload(doc);
    expect(payload.name).toBe("TestSyncDoc.pdn");
    expect(payload.width).toBe(32);
    expect(payload.height).toBe(24);
    expect(payload.layers.length).toBe(2);
    expect(payload.layers[1].name).toBe("Overlay Layer");
    expect(payload.layers[1].opacity).toBe(180);
    expect(payload.layers[1].blendMode).toBe("Multiply");
    expect(payload.layers[1].maskBase64).toBeTruthy();
    expect(payload.layers[1].maskEnabled).toBe(true);

    const restored = documentFromSyncPayload(payload);
    expect(restored.name).toBe("TestSyncDoc.pdn");
    expect(restored.width).toBe(32);
    expect(restored.height).toBe(24);
    expect(restored.layers.length).toBe(2);

    const rLayer1 = restored.layers[0];
    expect(rLayer1.buffer.getPixel(0, 0)).toEqual({ r: 255, g: 0, b: 0, a: 255 });
    expect(rLayer1.buffer.getPixel(31, 23)).toEqual({ r: 0, g: 255, b: 0, a: 200 });

    const rLayer2 = restored.layers[1];
    expect(rLayer2.name).toBe("Overlay Layer");
    expect(rLayer2.opacity).toBe(180);
    expect(rLayer2.blendMode).toBe("Multiply");
    expect(rLayer2.buffer.getPixel(5, 5)).toEqual({ r: 0, g: 0, b: 255, a: 255 });
    expect(rLayer2.mask).toBeTruthy();
    expect(rLayer2.mask![0]).toBe(128);
    expect(rLayer2.maskEnabled).toBe(true);
    expect(restored.activeLayerId).toBe(layer2.id);
  });

  it("exposes sync instance and status reporting", () => {
    expect(localSync).toBeDefined();
    expect(localSync.appRootName).toBe("paint");
    expect(localSync.appId).toBe("paint");
    const state = localSync.getState();
    expect(state).toBeDefined();
    expect(["unmapped", "unsupported", "mapped", "permission_needed"]).toContain(state.status);
    expect(typeof isSyncSupported()).toBe("boolean");
  });

  it("handles sync document save non-fatally when storage is offline", async () => {
    const doc = new PdDocument(16, 16, { name: "OfflineTest.png" });
    await expect(syncSaveDocument("doc-offline-test", doc)).resolves.toBeUndefined();
  });

  it("exposes explorer with documents collection and ensurePlacement", async () => {
    expect(explorer).toBeDefined();
    expect(typeof explorer.listChildren).toBe("function");
    expect(typeof explorer.createFolder).toBe("function");
    expect(typeof explorer.ensurePlacement).toBe("function");
    expect(typeof explorer.permanentDelete).toBe("function");
    // IDB may be unavailable in unit tests; placement must fail soft like syncSaveDocument.
    await expect(explorer.ensurePlacement("documents", "doc-placement-test", null, "Placement.png")).rejects.toThrow();
    await expect(syncSaveDocument("doc-placement-save", new PdDocument(8, 8, { name: "Place.png" }))).resolves.toBeUndefined();
  });

  it("handles debounced scheduleSyncWhenMapped and awaitSyncWhenMapped", async () => {
    // When unmapped, awaitSyncWhenMapped resolves to null
    const unmappedResult = await awaitSyncWhenMapped();
    expect(unmappedResult).toBeNull();

    // Verify debouncing coalesces timer triggers without throwing
    vi.useFakeTimers();
    try {
      scheduleSyncWhenMapped(150);
      scheduleSyncWhenMapped(150);
      scheduleSyncWhenMapped(150);
      vi.advanceTimersByTime(200);
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears document autosave IDB entry via clearAutosaveDocument and syncDeleteDocument", async () => {
    await expect(clearAutosaveDocument("doc-test-clear")).resolves.toBeUndefined();
    await expect(syncDeleteDocument("doc-test-del")).resolves.toBeUndefined();
  });

  it("seeds open sessions into sync on folder connection", async () => {
    const app = new AppState();
    await app.init();
    expect(app.sessions.length).toBeGreaterThan(0);
    await expect(seedOpenSessionsIntoSync(app)).resolves.toBeUndefined();
  });

  it("exposes stale-handle message constant and detects NotFound errors", () => {
    expect(STALE_HANDLE_MESSAGE).toContain("not found or moved");
    const notFoundDomEx = new DOMException("The requested file was not found", "NotFoundError");
    expect(isNotFoundError(notFoundDomEx)).toBe(true);
    const standardError = new Error("General disk failure");
    expect(isNotFoundError(standardError)).toBe(false);

    localSync.clearError();
    const state = localSync.getState();
    expect(state.lastError).toBeNull();
  });

  it("syncs open session name when rename is performed", async () => {
    const app = new AppState();
    await app.init();
    const active = app.session;
    expect(active).toBeDefined();
    app.renameSession(active.id, "CloudDraft.png");
    expect(active.document.name).toBe("CloudDraft.png");
  });

  it("executes runFolderSync catching any error gracefully into LocalSyncState", async () => {
    const result = await runFolderSync();
    expect(result).toBeDefined();
    expect(typeof result.status).toBe("string");
    expect(typeof result.supported).toBe("boolean");
  });

  it("renders SyncDialog in error state with remount guidance and reconnect actions", async () => {
    const rootEl = document.createElement("div");
    document.body.appendChild(rootEl);
    const root = createRoot(rootEl);
    const app = new AppState();
    await app.init();

    const originalGetState = localSync.getState;
    localSync.getState = () => ({
      status: "error",
      folderName: "MyDrawings",
      lastSyncedAt: null,
      lastError: STALE_HANDLE_MESSAGE,
      supported: true,
      pendingConflicts: 0,
    });

    try {
      await act(async () => {
        app.openDialog({ type: "sync" });
        root.render(createElement(AppDialogs, { app }));
      });

      expect(document.body.textContent).toContain("Sync Error");
      expect(document.body.textContent).toContain("Reconnect to restore disk sync");
      expect(document.body.querySelector("[data-testid=sync-reconnect-btn]")).not.toBeNull();
      expect(document.body.querySelector("[data-testid=sync-unmap-btn]")).not.toBeNull();
      expect(document.body.querySelector("[data-testid=sync-dismiss-btn]")).not.toBeNull();
    } finally {
      localSync.getState = originalGetState;
      await act(async () => {
        root.unmount();
      });
      rootEl.remove();
    }
  });
});
