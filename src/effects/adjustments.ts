import { hsvToRgb, rgbToHsv } from "../core/color";
import type { PixelBuffer } from "../core/pixel-buffer";
import { clamp } from "../core/geometry";
import { type EffectDef, mapSelected, num } from "./base";

export const autoLevel: EffectDef = {
  id: "autoLevel",
  name: "Auto-Level",
  menu: "Adjustments",
  shortcut: "Ctrl+Shift+L",
  params: [],
  apply(src, _p, sel) {
    let min = 255,
      max = 0;
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        if (sel && !sel.allows(x, y)) continue;
        const i = (y * src.width + x) * 4;
        if (src.data[i + 3] === 0) continue;
        const l = (src.data[i] + src.data[i + 1] + src.data[i + 2]) / 3;
        if (l < min) min = l;
        if (l > max) max = l;
      }
    }
    const range = Math.max(1, max - min);
    return mapSelected(src, sel, (r, g, b, a) => [
      ((r - min) * 255) / range,
      ((g - min) * 255) / range,
      ((b - min) * 255) / range,
      a,
    ]);
  },
};

export const blackAndWhite: EffectDef = {
  id: "blackAndWhite",
  name: "Black and White",
  menu: "Adjustments",
  shortcut: "Ctrl+Shift+G",
  params: [],
  apply(src, _p, sel) {
    return mapSelected(src, sel, (r, g, b, a) => {
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      return [y, y, y, a];
    });
  },
};

export const brightnessContrast: EffectDef = {
  id: "brightnessContrast",
  name: "Brightness / Contrast",
  menu: "Adjustments",
  shortcut: "Ctrl+Shift+T",
  params: [
    { key: "brightness", label: "Brightness", type: "range", min: -100, max: 100, step: 1, value: 0 },
    { key: "contrast", label: "Contrast", type: "range", min: -100, max: 100, step: 1, value: 0 },
  ],
  apply(src, p, sel) {
    const br = num(p, "brightness") * 2.55;
    const c = num(p, "contrast");
    const f = (259 * (c + 255)) / (255 * (259 - c));
    const adj = (v: number) => clamp(f * (v - 128) + 128 + br, 0, 255);
    return mapSelected(src, sel, (r, g, b, a) => [adj(r), adj(g), adj(b), a]);
  },
};

export const curves: EffectDef = {
  id: "curves",
  name: "Curves",
  menu: "Adjustments",
  shortcut: "Ctrl+Shift+M",
  params: [
    { key: "shadows", label: "Shadows", type: "range", min: -100, max: 100, step: 1, value: 0 },
    { key: "midtones", label: "Midtones", type: "range", min: -100, max: 100, step: 1, value: 0 },
    { key: "highlights", label: "Highlights", type: "range", min: -100, max: 100, step: 1, value: 0 },
  ],
  apply(src, p, sel) {
    const s = num(p, "shadows") / 100;
    const m = num(p, "midtones") / 100;
    const h = num(p, "highlights") / 100;
    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      const wS = Math.max(0, 1 - t * 2);
      const wH = Math.max(0, t * 2 - 1);
      const wM = 1 - wS - wH;
      lut[i] = clamp(Math.round((t + s * wS * 0.5 + m * wM * 0.5 + h * wH * 0.5) * 255), 0, 255);
    }
    return mapSelected(src, sel, (r, g, b, a) => [lut[r], lut[g], lut[b], a]);
  },
};

export const hueSaturation: EffectDef = {
  id: "hueSaturation",
  name: "Hue / Saturation",
  menu: "Adjustments",
  shortcut: "Ctrl+Shift+U",
  params: [
    { key: "hue", label: "Hue", type: "range", min: -180, max: 180, step: 1, value: 0 },
    { key: "sat", label: "Saturation", type: "range", min: -100, max: 100, step: 1, value: 0 },
    { key: "light", label: "Lightness", type: "range", min: -100, max: 100, step: 1, value: 0 },
  ],
  apply(src, p, sel) {
    const dh = num(p, "hue");
    const ds = num(p, "sat") / 100;
    const dl = num(p, "light") / 100;
    return mapSelected(src, sel, (r, g, b, a) => {
      const hsv = rgbToHsv({ r, g, b, a });
      hsv.h = (hsv.h + dh + 360) % 360;
      hsv.s = clamp(hsv.s * (1 + ds), 0, 1);
      hsv.v = clamp(hsv.v + dl, 0, 1);
      const c = hsvToRgb(hsv.h, hsv.s, hsv.v, a);
      return [c.r, c.g, c.b, a];
    });
  },
};

export const invertColors: EffectDef = {
  id: "invertColors",
  name: "Invert Colors",
  menu: "Adjustments",
  shortcut: "Ctrl+Shift+I",
  params: [],
  apply(src, _p, sel) {
    return mapSelected(src, sel, (r, g, b, a) => [255 - r, 255 - g, 255 - b, a]);
  },
};

export const invertAlpha: EffectDef = {
  id: "invertAlpha",
  name: "Invert Alpha",
  menu: "Adjustments",
  shortcut: "Ctrl+Alt+I",
  params: [],
  apply(src, _p, sel) {
    return mapSelected(src, sel, (r, g, b, a) => [r, g, b, 255 - a]);
  },
};

export const levels: EffectDef = {
  id: "levels",
  name: "Levels",
  menu: "Adjustments",
  shortcut: "Ctrl+L",
  params: [
    { key: "inBlack", label: "Input Black", type: "range", min: 0, max: 254, step: 1, value: 0 },
    { key: "inWhite", label: "Input White", type: "range", min: 1, max: 255, step: 1, value: 255 },
    { key: "gamma", label: "Gamma", type: "range", min: 10, max: 300, step: 1, value: 100 },
    { key: "outBlack", label: "Output Black", type: "range", min: 0, max: 254, step: 1, value: 0 },
    { key: "outWhite", label: "Output White", type: "range", min: 1, max: 255, step: 1, value: 255 },
  ],
  apply(src, p, sel) {
    const ib = num(p, "inBlack");
    const iw = Math.max(ib + 1, num(p, "inWhite"));
    const g = num(p, "gamma", 100) / 100;
    const ob = num(p, "outBlack");
    const ow = num(p, "outWhite");
    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      let t = clamp((i - ib) / (iw - ib), 0, 1);
      t = Math.pow(t, 1 / Math.max(0.01, g));
      lut[i] = clamp(Math.round(ob + t * (ow - ob)), 0, 255);
    }
    return mapSelected(src, sel, (r, gch, b, a) => [lut[r], lut[gch], lut[b], a]);
  },
};

export const posterize: EffectDef = {
  id: "posterize",
  name: "Posterize",
  menu: "Adjustments",
  shortcut: "Ctrl+Shift+P",
  params: [{ key: "levels", label: "Levels", type: "range", min: 2, max: 16, step: 1, value: 4 }],
  apply(src, p, sel) {
    const n = Math.max(2, num(p, "levels", 4));
    const step = 255 / (n - 1);
    const q = (v: number) => Math.round(v / step) * step;
    return mapSelected(src, sel, (r, g, b, a) => [q(r), q(g), q(b), a]);
  },
};

export const sepia: EffectDef = {
  id: "sepia",
  name: "Sepia",
  menu: "Adjustments",
  shortcut: "Ctrl+Shift+E",
  params: [],
  apply(src, _p, sel) {
    return mapSelected(src, sel, (r, g, b, a) => {
      return [
        clamp(0.393 * r + 0.769 * g + 0.189 * b, 0, 255),
        clamp(0.349 * r + 0.686 * g + 0.168 * b, 0, 255),
        clamp(0.272 * r + 0.534 * g + 0.131 * b, 0, 255),
        a,
      ];
    });
  },
};

export function applyToBuffer(
  src: PixelBuffer,
  fn: (r: number, g: number, b: number, a: number) => [number, number, number, number],
): PixelBuffer {
  return mapSelected(src, undefined, (r, g, b, a) => fn(r, g, b, a));
}
