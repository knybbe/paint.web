import type { Color } from "./color";
import type { PixelBuffer } from "./pixel-buffer";

export const BLEND_MODES = [
  "Normal",
  "Multiply",
  "Additive",
  "Color Burn",
  "Color Dodge",
  "Reflect",
  "Glow",
  "Overlay",
  "Difference",
  "Negation",
  "Lighten",
  "Darken",
  "Screen",
  "Xor",
] as const;

export type BlendMode = (typeof BLEND_MODES)[number];

function clamp8(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function channel(mode: BlendMode, a: number, b: number): number {
  const A = a / 255;
  const B = b / 255;
  let r: number;
  switch (mode) {
    case "Normal":
      r = B;
      break;
    case "Multiply":
      r = A * B;
      break;
    case "Additive":
      r = A + B;
      break;
    case "Color Burn":
      r = B === 0 ? 0 : 1 - (1 - A) / B;
      break;
    case "Color Dodge":
      r = B === 1 ? 1 : A / (1 - B);
      break;
    case "Reflect":
      r = B === 1 ? 1 : (A * A) / (1 - B);
      break;
    case "Glow":
      r = A === 1 ? 1 : (B * B) / (1 - A);
      break;
    case "Overlay":
      r = A < 0.5 ? 2 * A * B : 1 - 2 * (1 - A) * (1 - B);
      break;
    case "Difference":
      r = Math.abs(A - B);
      break;
    case "Negation":
      r = 1 - Math.abs(1 - A - B);
      break;
    case "Lighten":
      r = Math.max(A, B);
      break;
    case "Darken":
      r = Math.min(A, B);
      break;
    case "Screen":
      r = 1 - (1 - A) * (1 - B);
      break;
    case "Xor":
      return (a ^ b) & 255;
    default:
      r = B;
  }
  return clamp8(Math.round(r * 255));
}

export function blendRgb(dst: Color, src: Color, mode: BlendMode): Color {
  return {
    r: channel(mode, dst.r, src.r),
    g: channel(mode, dst.g, src.g),
    b: channel(mode, dst.b, src.b),
    a: src.a,
  };
}

/**
 * Paint.NET-style layer composite: blend RGB, then Porter-Duff source-over
 * with `opacity` (0–255) multiplied into source alpha.
 */
export function compositePixel(dst: Color, src: Color, mode: BlendMode, opacity: number): Color {
  const sa = (src.a / 255) * (opacity / 255);
  if (sa <= 0) return dst;
  const blended = mode === "Normal" ? src : blendRgb(dst, src, mode);
  const da = dst.a / 255;
  const outA = sa + da * (1 - sa);
  if (outA <= 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: Math.round((blended.r * sa + dst.r * da * (1 - sa)) / outA),
    g: Math.round((blended.g * sa + dst.g * da * (1 - sa)) / outA),
    b: Math.round((blended.b * sa + dst.b * da * (1 - sa)) / outA),
    a: Math.round(outA * 255),
  };
}

export function compositeLayer(
  dest: PixelBuffer,
  src: PixelBuffer,
  mode: BlendMode,
  opacity: number,
  mask?: Uint8Array | null,
): void {
  const w = Math.min(dest.width, src.width);
  const h = Math.min(dest.height, src.height);
  const dd = dest.data;
  const sd = src.data;
  const op = opacity / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * src.width + x) * 4;
      const di = (y * dest.width + x) * 4;
      let sa = (sd[i + 3] / 255) * op;
      if (mask) sa *= mask[y * src.width + x] / 255;
      if (sa <= 0) continue;
      const srcA = Math.round(sa * 255);
      const blended = compositePixel(
        { r: dd[di], g: dd[di + 1], b: dd[di + 2], a: dd[di + 3] },
        { r: sd[i], g: sd[i + 1], b: sd[i + 2], a: srcA },
        mode,
        255,
      );
      dd[di] = blended.r;
      dd[di + 1] = blended.g;
      dd[di + 2] = blended.b;
      dd[di + 3] = blended.a;
    }
  }
}
