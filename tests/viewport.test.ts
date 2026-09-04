import { describe, expect, it } from "vitest";
import { Viewport, zoomFactorFromWheel, ZOOM_STEPS } from "../src/core/viewport";

describe("Viewport", () => {
  it("maps screen coordinates in CSS pixels", () => {
    const vp = new Viewport();
    vp.zoom = 2;
    vp.panX = 100;
    vp.panY = 50;
    expect(vp.screenToImage(100, 50)).toEqual({ x: 0, y: 0 });
    expect(vp.screenToImage(102, 52)).toEqual({ x: 1, y: 1 });
    expect(vp.imageToScreen(10, 5)).toEqual({ x: 120, y: 60 });
  });

  it("keeps the image point under the cursor when zooming", () => {
    const vp = new Viewport();
    vp.zoom = 1;
    vp.panX = 40;
    vp.panY = 20;
    const around = { x: 140, y: 80 };
    const before = vp.screenToImage(around.x, around.y);
    vp.setZoom(2, around);
    const after = vp.screenToImage(around.x, around.y);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it("fits the document as large as possible inside the view", () => {
    const vp = new Viewport();
    vp.viewWidth = 400;
    vp.viewHeight = 300;
    vp.fitToWindow(800, 600, 0);
    expect(vp.zoom).toBeCloseTo(0.5, 6);
    expect(vp.panX).toBeCloseTo(0, 6);
    expect(vp.panY).toBeCloseTo(0, 6);

    vp.fitToWindow(100, 100, 0);
    expect(vp.zoom).toBeCloseTo(3, 6);
    expect(vp.panX).toBeCloseTo((400 - 300) / 2, 6);
    expect(vp.panY).toBeCloseTo(0, 6);
  });

  it("damps trackpad pinch deltas instead of jumping zoom steps", () => {
    let z = 1;
    for (let i = 0; i < 12; i++) z *= zoomFactorFromWheel(8, 0);
    expect(z).toBeGreaterThan(0.7);
    expect(z).toBeLessThan(1);

    let stepped = 1;
    for (let i = 0; i < 12; i++) {
      let prev = ZOOM_STEPS[0];
      for (const s of ZOOM_STEPS) {
        if (s < stepped - 1e-6) prev = s;
      }
      stepped = prev;
    }
    expect(z).toBeGreaterThan(stepped * 4);
  });

  it("clamps a single huge wheel notch", () => {
    expect(zoomFactorFromWheel(400, 0)).toBe(0.85);
    expect(zoomFactorFromWheel(-400, 0)).toBe(1.15);
  });

  it("clamps setZoom below the floor to 10%", () => {
    const vp = new Viewport();
    vp.setZoom(0.05);
    expect(vp.zoom).toBe(0.1);
  });

  it("zoomOut floors at 10%", () => {
    const vp = new Viewport();
    vp.setZoom(0.125);
    vp.zoomOut();
    expect(vp.zoom).toBe(0.1);
    vp.zoomOut();
    expect(vp.zoom).toBe(0.1);
  });

  it("fitToWindow of a huge document floors at 10%", () => {
    const vp = new Viewport();
    vp.viewWidth = 400;
    vp.viewHeight = 300;
    vp.fitToWindow(10000, 10000);
    expect(vp.zoom).toBe(0.1);
  });
});
