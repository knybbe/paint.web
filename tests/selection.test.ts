import { describe, expect, it } from "vitest";
import { Selection } from "../src/core/selection";
import { floodMask } from "../src/core/flood-fill";
import { PixelBuffer } from "../src/core/pixel-buffer";
import { rgb } from "../src/core/color";

describe("Selection", () => {
  it("starts empty and can select all / invert / clear", () => {
    const s = new Selection(4, 3);
    expect(s.empty).toBe(true);
    expect(s.allows(0, 0)).toBe(true);
    s.selectAll();
    expect(s.contains(2, 2)).toBe(true);
    expect(s.bounds).toEqual({ x: 0, y: 0, w: 4, h: 3 });
    s.invert();
    expect(s.empty).toBe(true);
    s.selectAll();
    s.clear();
    expect(s.empty).toBe(true);
  });

  it("combines rectangular selections", () => {
    const s = new Selection(10, 10);
    s.applyRect({ x: 1, y: 1, w: 4, h: 4 }, "replace");
    s.applyRect({ x: 3, y: 3, w: 4, h: 4 }, "add");
    expect(s.contains(2, 2)).toBe(true);
    expect(s.contains(6, 6)).toBe(true);
    s.applyRect({ x: 3, y: 3, w: 2, h: 2 }, "subtract");
    expect(s.contains(3, 3)).toBe(false);
    expect(s.contains(1, 1)).toBe(true);
  });

  it("translates the mask", () => {
    const s = new Selection(8, 8);
    s.applyRect({ x: 1, y: 1, w: 2, h: 2 }, "replace");
    s.translate(2, 1);
    expect(s.contains(1, 1)).toBe(false);
    expect(s.contains(3, 2)).toBe(true);
  });

  it("flood-fills contiguous pixels with tolerance", () => {
    const buf = PixelBuffer.create(5, 5, rgb(0, 0, 0));
    buf.setPixel(2, 2, rgb(10, 0, 0));
    buf.setPixel(3, 2, rgb(10, 0, 0));
    buf.setPixel(0, 0, rgb(255, 0, 0));
    const mask = floodMask(buf, 2, 2, { tolerance: 5, contiguous: true, sampleMerged: false });
    expect(mask[2 * 5 + 2]).toBe(255);
    expect(mask[2 * 5 + 3]).toBe(255);
    expect(mask[0]).toBe(0);
    const global = floodMask(buf, 2, 2, { tolerance: 5, contiguous: false, sampleMerged: false });
    expect(global[2 * 5 + 3]).toBe(255);
  });
});
