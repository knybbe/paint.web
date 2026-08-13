import { describe, expect, it, beforeEach } from "vitest";
import { PdDocument } from "../src/core/document";
import { resetLayerSeq } from "../src/core/layer";
import { Colors, rgb } from "../src/core/color";

describe("PdDocument", () => {
  beforeEach(() => resetLayerSeq(1));

  it("creates a background layer matching canvas size and fill", () => {
    const white = new PdDocument(80, 60, { background: "White" });
    expect(white.width).toBe(80);
    expect(white.height).toBe(60);
    expect(white.layers).toHaveLength(1);
    expect(white.layers[0].name).toBe("Background");
    expect(white.layers[0].buffer.getPixel(0, 0)).toEqual(Colors.white);

    const clear = new PdDocument(10, 10, { background: "Transparent" });
    expect(clear.layers[0].buffer.getPixel(0, 0).a).toBe(0);
  });

  it("adds, duplicates, reorders, and deletes layers", () => {
    const doc = new PdDocument(8, 8);
    const added = doc.addLayer("Overlay");
    expect(doc.layers).toHaveLength(2);
    expect(doc.activeLayerId).toBe(added.id);

    const dup = doc.duplicateLayer(added.id);
    expect(dup?.name).toBe("Overlay copy");
    expect(doc.layers).toHaveLength(3);

    doc.moveLayer(2, 0);
    expect(doc.layers[0].name).toBe("Overlay copy");

    expect(doc.deleteLayer(doc.layers[0].id)).not.toBeNull();
    expect(doc.layers).toHaveLength(2);
    expect(doc.deleteLayer(doc.layers[0].id)).not.toBeNull();
    expect(doc.deleteLayer(doc.layers[0].id)).toBeNull();
  });

  it("merges down and flattens with blending", () => {
    const doc = new PdDocument(2, 2, { background: "White" });
    const top = doc.addLayer("Ink");
    top.buffer.setPixel(0, 0, rgb(255, 0, 0));
    expect(doc.mergeDown(top.id)).toBe(true);
    expect(doc.layers).toHaveLength(1);
    expect(doc.layers[0].buffer.getPixel(0, 0).r).toBe(255);

    const extra = doc.addLayer();
    extra.buffer.setPixel(1, 1, rgb(0, 0, 255));
    doc.flatten();
    expect(doc.layers).toHaveLength(1);
    const flat = doc.composite();
    expect(flat.getPixel(1, 1).b).toBe(255);
  });

  it("resizes the image and canvas", () => {
    const doc = new PdDocument(4, 4, { background: "Black" });
    doc.layers[0].buffer.setPixel(0, 0, rgb(255, 0, 0));
    doc.resizeImage(8, 8, "nearest");
    expect(doc.width).toBe(8);
    expect(doc.layers[0].buffer.getPixel(0, 0).r).toBe(255);

    doc.resizeCanvas(10, 10, 1, 1);
    expect(doc.width).toBe(10);
    expect(doc.layers[0].buffer.getPixel(1, 1).r).toBe(255);
    expect(doc.layers[0].buffer.getPixel(0, 0).a).toBe(0);
  });

  it("rotates and flips every layer", () => {
    const doc = new PdDocument(2, 3, { background: "Transparent" });
    doc.layers[0].buffer.setPixel(0, 0, rgb(255, 0, 0));
    doc.transform("rotate90cw");
    expect(doc.width).toBe(3);
    expect(doc.height).toBe(2);
    expect(doc.layers[0].buffer.getPixel(2, 0).r).toBe(255);

    doc.transform("flipH");
    expect(doc.layers[0].buffer.getPixel(0, 0).r).toBe(255);
  });
});
