import { describe, expect, it } from "vitest";
import { AppState } from "../src/app-state";
import { rgb } from "../src/core/color";
import { PixelBuffer } from "../src/core/pixel-buffer";
import { setMemoryClipboard } from "../src/core/clipboard";
import { stampFloating } from "../src/core/floating";

describe("floating paste", () => {
  it("does not stamp destination pixels until commit", async () => {
    const app = new AppState();
    await app.init();
    const dest = app.document.activeLayer.buffer;
    dest.setPixel(0, 0, rgb(0, 128, 0));
    dest.setPixel(2, 2, rgb(0, 0, 200));

    const clip = PixelBuffer.create(2, 2, rgb(255, 0, 0));
    setMemoryClipboard({ buffer: clip, mask: null });
    await app.paste("normal");

    expect(app.session.floating).not.toBeNull();
    expect(dest.getPixel(0, 0)).toEqual({ r: 0, g: 128, b: 0, a: 255 });
    expect(dest.getPixel(2, 2)).toEqual({ r: 0, g: 0, b: 200, a: 255 });

    app.placeFloating(2, 2);
    expect(dest.getPixel(2, 2)).toEqual({ r: 0, g: 0, b: 200, a: 255 });

    app.commitFloating();
    expect(app.session.floating).toBeNull();
    expect(dest.getPixel(2, 2).r).toBe(255);
    expect(dest.getPixel(0, 0)).toEqual({ r: 0, g: 128, b: 0, a: 255 });
  });

  it("cancel leaves the destination unchanged", async () => {
    const app = new AppState();
    await app.init();
    app.document.activeLayer.buffer.setPixel(1, 1, rgb(10, 20, 30));
    setMemoryClipboard({ buffer: PixelBuffer.create(3, 3, rgb(255, 255, 0)), mask: null });
    await app.paste("normal");
    app.placeFloating(1, 1);
    app.cancelFloating();
    expect(app.session.floating).toBeNull();
    expect(app.document.activeLayer.buffer.getPixel(1, 1)).toEqual({ r: 10, g: 20, b: 30, a: 255 });
  });

  it("stamps only masked pixels", () => {
    const dest = PixelBuffer.create(4, 4, rgb(0, 0, 255));
    const buf = PixelBuffer.create(2, 2, rgb(255, 0, 0));
    const mask = new Uint8Array([255, 0, 0, 255]);
    stampFloating(dest, { buffer: buf, mask, x: 1, y: 1 });
    expect(dest.getPixel(1, 1).r).toBe(255);
    expect(dest.getPixel(2, 1).b).toBe(255);
    expect(dest.getPixel(1, 2).b).toBe(255);
    expect(dest.getPixel(2, 2).r).toBe(255);
  });
});
