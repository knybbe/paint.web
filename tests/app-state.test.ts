import { describe, expect, it } from "vitest";
import { AppState } from "../src/app-state";
import { rgb } from "../src/core/color";

describe("AppState integration", () => {
  it("boots a default document and records pixel edits in history", async () => {
    const app = new AppState();
    await app.init();
    expect(app.document.width).toBe(800);
    expect(app.document.height).toBe(600);
    expect(app.sessions).toHaveLength(1);
    expect(app.history.canUndo).toBe(false);

    app.mutateLayerPixels("Pencil", "pencil", () => {
      app.document.activeLayer.buffer.setPixel(10, 10, rgb(255, 0, 0));
    });
    expect(app.document.activeLayer.buffer.getPixel(10, 10).r).toBe(255);
    expect(app.history.canUndo).toBe(true);

    app.undo();
    expect(app.document.activeLayer.buffer.getPixel(10, 10).r).toBe(255);
    expect(app.document.activeLayer.buffer.getPixel(10, 10).g).toBe(255);

    app.redo();
    expect(app.document.activeLayer.buffer.getPixel(10, 10).r).toBe(255);
    expect(app.document.activeLayer.buffer.getPixel(10, 10).g).toBe(0);
  });

  it("adds a layer and can flatten", async () => {
    const app = new AppState();
    await app.init();
    app.addLayer();
    expect(app.document.layers).toHaveLength(2);
    app.document.activeLayer.buffer.setPixel(0, 0, rgb(0, 128, 0));
    app.flatten();
    expect(app.document.layers).toHaveLength(1);
    expect(app.document.composite().getPixel(0, 0).g).toBe(128);
  });

  it("bumps revision on notify", async () => {
    const app = new AppState();
    await app.init();
    const start = app.revision;
    expect(start).toBeGreaterThan(0);
    app.notify("status");
    expect(app.revision).toBe(start + 1);
  });
});
