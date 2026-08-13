import { describe, expect, it } from "vitest";
import { colorDistance, fromHex, hsvToRgb, rgbToHsv, toHex, withinTolerance, rgb, rgba } from "../src/core/color";

describe("color", () => {
  it("round-trips hex", () => {
    const c = rgb(18, 52, 86);
    expect(fromHex(toHex(c))).toEqual({ r: 18, g: 52, b: 86, a: 255 });
    expect(fromHex("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 255 });
    expect(fromHex("#11223344")).toEqual({ r: 0x11, g: 0x22, b: 0x33, a: 0x44 });
  });

  it("converts hsv for primary hues", () => {
    const red = rgbToHsv(rgb(255, 0, 0));
    expect(red.h).toBeCloseTo(0, 0);
    expect(red.s).toBeCloseTo(1);
    expect(red.v).toBeCloseTo(1);
    const back = hsvToRgb(120, 1, 1);
    expect(back.g).toBe(255);
    expect(back.r).toBe(0);
  });

  it("measures tolerance like Paint.NET", () => {
    const a = rgb(0, 0, 0);
    const b = rgb(10, 0, 0);
    expect(withinTolerance(a, b, 0)).toBe(false);
    expect(withinTolerance(a, a, 0)).toBe(true);
    expect(withinTolerance(a, b, 100)).toBe(true);
    expect(colorDistance(a, rgba(0, 0, 0, 255))).toBe(0);
  });
});
