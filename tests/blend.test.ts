import { describe, expect, it } from "vitest";
import { blendRgb, compositePixel } from "../src/core/blend";
import { rgb, rgba } from "../src/core/color";
import { PixelBuffer } from "../src/core/pixel-buffer";
import { compositeLayer } from "../src/core/blend";

describe("blend modes", () => {
  it("multiplies channels", () => {
    const r = blendRgb(rgb(200, 100, 50), rgb(128, 128, 128), "Multiply");
    expect(r.r).toBeCloseTo(100, 0);
    expect(r.g).toBeCloseTo(50, 0);
  });

  it("screen is inverse multiply", () => {
    const r = blendRgb(rgb(0, 0, 0), rgb(255, 128, 0), "Screen");
    expect(r.r).toBe(255);
    expect(r.g).toBe(128);
  });

  it("xor is bitwise", () => {
    const r = blendRgb(rgb(255, 0, 15), rgb(1, 1, 1), "Xor");
    expect(r.r).toBe(254);
    expect(r.b).toBe(14);
  });

  it("composites with opacity and source-over", () => {
    const out = compositePixel(rgb(0, 0, 0), rgba(255, 0, 0, 128), "Normal", 255);
    expect(out.r).toBeGreaterThan(120);
    expect(out.a).toBeGreaterThan(120);
    const faded = compositePixel(rgb(0, 0, 255), rgb(255, 0, 0), "Normal", 0);
    expect(faded.b).toBe(255);
  });

  it("composites a whole layer", () => {
    const dst = PixelBuffer.create(2, 1, rgb(0, 0, 0));
    const src = PixelBuffer.create(2, 1, rgba(255, 255, 255, 255));
    compositeLayer(dst, src, "Normal", 128);
    expect(dst.getPixel(0, 0).r).toBeGreaterThan(100);
  });
});
