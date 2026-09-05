import { describe, expect, it } from "vitest";
import { rgb } from "../src/core/color";
import { PdDocument } from "../src/core/document";
import {
  applyDocument,
  rebuildHistory,
  restoreDocument,
  restoreViewport,
  serializeDocument,
} from "../src/core/persist";
import { MIN_ZOOM, Viewport } from "../src/core/viewport";

describe("workspace persistence", () => {
  it("round-trips layer pixels and metadata", () => {
    const doc = new PdDocument(4, 3, { name: "Shot.png", background: "Transparent" });
    doc.activeLayer.buffer.setPixel(1, 1, rgb(9, 8, 7));
    doc.addLayer("Ink");
    doc.activeLayer.opacity = 128;
    doc.activeLayer.buffer.setPixel(2, 2, rgb(1, 2, 3));
    const snap = serializeDocument(doc);
    const restored = restoreDocument(snap);
    expect(restored.name).toBe("Shot.png");
    expect(restored.layers).toHaveLength(2);
    expect(restored.layers[1].name).toBe("Ink");
    expect(restored.layers[1].opacity).toBe(128);
    expect(restored.layers[0].buffer.getPixel(1, 1)).toEqual({ r: 9, g: 8, b: 7, a: 255 });
    expect(restored.layers[1].buffer.getPixel(2, 2)).toEqual({ r: 1, g: 2, b: 3, a: 255 });
    expect(restored.activeLayerId).toBe(doc.activeLayerId);
  });

  it("rebuilds undo and redo from snapshots", () => {
    const a = new PdDocument(2, 2, { background: "White" });
    a.activeLayer.buffer.setPixel(0, 0, rgb(255, 0, 0));
    const b = new PdDocument(2, 2, { background: "White" });
    b.activeLayer.buffer.setPixel(0, 0, rgb(0, 255, 0));
    const live = restoreDocument(serializeDocument(a));
    const apply = (snap: ReturnType<typeof serializeDocument>) => applyDocument(live, snap);
    const hist = rebuildHistory(
      20,
      serializeDocument(a),
      [{ name: "Paint", icon: "pencil", after: serializeDocument(b) }],
      [],
      apply,
    );
    expect(hist.canUndo).toBe(true);
    apply(serializeDocument(b));
    hist.undo();
    expect(live.activeLayer.buffer.getPixel(0, 0).r).toBe(255);
    hist.redo();
    expect(live.activeLayer.buffer.getPixel(0, 0).g).toBe(255);
  });

  it("restoreViewport clamps zoom below the floor", () => {
    const vp = new Viewport();
    restoreViewport(vp, {
      zoom: 0.001,
      panX: 12,
      panY: 34,
      showRulers: false,
      showPixelGrid: true,
      showGuides: false,
      guides: [{ orientation: "h", position: 10 }],
    });
    expect(vp.zoom).toBe(MIN_ZOOM);
    expect(vp.panX).toBe(12);
    expect(vp.panY).toBe(34);
    expect(vp.showRulers).toBe(false);
    expect(vp.showPixelGrid).toBe(true);
    expect(vp.showGuides).toBe(false);
    expect(vp.guides).toEqual([{ orientation: "h", position: 10 }]);
  });
});
