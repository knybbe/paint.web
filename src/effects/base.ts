import type { PixelBuffer } from "../core/pixel-buffer";
import type { Selection } from "../core/selection";
import { clamp } from "../core/geometry";

export type EffectParamType = "range" | "checkbox" | "choice";

export interface EffectParam {
  key: string;
  label: string;
  type: EffectParamType;
  min?: number;
  max?: number;
  step?: number;
  value: number | boolean | string;
  choices?: string[];
}

export interface EffectDef {
  id: string;
  name: string;
  menu: "Adjustments" | "Blurs" | "Distort" | "Noise" | "Photo" | "Render" | "Stylize";
  shortcut?: string;
  params: EffectParam[];
  apply: (src: PixelBuffer, params: Record<string, number | boolean | string>, sel?: Selection) => PixelBuffer;
}

export function paramMap(params: EffectParam[]): Record<string, number | boolean | string> {
  const o: Record<string, number | boolean | string> = {};
  for (const p of params) o[p.key] = p.value;
  return o;
}

export function num(p: Record<string, number | boolean | string>, key: string, fallback = 0): number {
  const v = p[key];
  return typeof v === "number" ? v : fallback;
}

export function bool(p: Record<string, number | boolean | string>, key: string, fallback = false): boolean {
  const v = p[key];
  return typeof v === "boolean" ? v : fallback;
}

export function str(p: Record<string, number | boolean | string>, key: string, fallback = ""): string {
  const v = p[key];
  return typeof v === "string" ? v : fallback;
}

export function mapSelected(
  src: PixelBuffer,
  sel: Selection | undefined,
  fn: (r: number, g: number, b: number, a: number, x: number, y: number) => [number, number, number, number],
): PixelBuffer {
  const dest = src.clone();
  const d = dest.data;
  const s = src.data;
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      if (sel && !sel.allows(x, y)) continue;
      const i = (y * src.width + x) * 4;
      const [r, g, b, a] = fn(s[i], s[i + 1], s[i + 2], s[i + 3], x, y);
      d[i] = clamp(r, 0, 255);
      d[i + 1] = clamp(g, 0, 255);
      d[i + 2] = clamp(b, 0, 255);
      d[i + 3] = clamp(a, 0, 255);
    }
  }
  return dest;
}

export function sample(src: PixelBuffer, x: number, y: number): [number, number, number, number] {
  const xx = clamp(x, 0, src.width - 1);
  const yy = clamp(y, 0, src.height - 1);
  const i = (yy * src.width + xx) * 4;
  return [src.data[i], src.data[i + 1], src.data[i + 2], src.data[i + 3]];
}
