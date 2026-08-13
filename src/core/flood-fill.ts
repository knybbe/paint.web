import { type Color, withinTolerance } from "./color";
import type { PixelBuffer } from "./pixel-buffer";
import type { Selection } from "./selection";

export interface FloodOptions {
  tolerance: number;
  contiguous: boolean;
  sampleMerged: boolean;
}

export function floodMask(
  source: PixelBuffer,
  x: number,
  y: number,
  opts: FloodOptions,
  clip?: Selection,
): Uint8Array {
  const w = source.width;
  const h = source.height;
  const mask = new Uint8Array(w * h);
  if (x < 0 || y < 0 || x >= w || y >= h) return mask;
  if (clip && !clip.allows(x, y)) return mask;
  const target = source.getPixel(x | 0, y | 0);

  if (!opts.contiguous) {
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        if (clip && !clip.allows(px, py)) continue;
        if (withinTolerance(source.getPixel(px, py), target, opts.tolerance)) mask[py * w + px] = 255;
      }
    }
    return mask;
  }

  const stack: number[] = [(y | 0) * w + (x | 0)];
  const seen = new Uint8Array(w * h);
  while (stack.length) {
    const i = stack.pop()!;
    if (seen[i]) continue;
    seen[i] = 1;
    const px = i % w;
    const py = (i / w) | 0;
    if (clip && !clip.allows(px, py)) continue;
    if (!withinTolerance(source.getPixel(px, py), target, opts.tolerance)) continue;
    mask[i] = 255;
    if (px > 0) stack.push(i - 1);
    if (px + 1 < w) stack.push(i + 1);
    if (py > 0) stack.push(i - w);
    if (py + 1 < h) stack.push(i + w);
  }
  return mask;
}

export function fillMask(dest: PixelBuffer, mask: Uint8Array, color: Color, selection?: Selection): { x: number; y: number; w: number; h: number } | null {
  let minX = dest.width,
    minY = dest.height,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < dest.height; y++) {
    for (let x = 0; x < dest.width; x++) {
      if (!mask[y * dest.width + x]) continue;
      if (selection && !selection.allows(x, y)) continue;
      dest.blendOver(x, y, color);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export function sampleSource(merged: PixelBuffer, layer: PixelBuffer, sampleMerged: boolean): PixelBuffer {
  return sampleMerged ? merged : layer;
}
