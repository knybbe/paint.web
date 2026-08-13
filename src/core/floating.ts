import { PixelBuffer } from "./pixel-buffer";
import { Selection } from "./selection";

export interface FloatingSelection {
  buffer: PixelBuffer;
  mask: Uint8Array | null;
  x: number;
  y: number;
}

export function cloneFloating(f: FloatingSelection): FloatingSelection {
  return {
    buffer: f.buffer.clone(),
    mask: f.mask ? new Uint8Array(f.mask) : null,
    x: f.x,
    y: f.y,
  };
}

export function stampFloating(dest: PixelBuffer, f: FloatingSelection): void {
  const w = f.buffer.width;
  const h = f.buffer.height;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (f.mask && !f.mask[y * w + x]) continue;
      const tx = f.x + x;
      const ty = f.y + y;
      if (!dest.inBounds(tx, ty)) continue;
      dest.blendOver(tx, ty, f.buffer.getPixel(x, y));
    }
  }
}

export function selectionFromFloating(sel: Selection, f: FloatingSelection): void {
  const w = f.buffer.width;
  const h = f.buffer.height;
  if (f.mask) {
    const full = new Uint8Array(sel.width * sel.height);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!f.mask[y * w + x]) continue;
        const tx = f.x + x;
        const ty = f.y + y;
        if (tx < 0 || ty < 0 || tx >= sel.width || ty >= sel.height) continue;
        full[ty * sel.width + tx] = 255;
      }
    }
    sel.applyMask(full, "replace");
    return;
  }
  sel.applyRect({ x: f.x, y: f.y, w, h }, "replace");
}

export function maskedDisplayBuffer(f: FloatingSelection): PixelBuffer {
  if (!f.mask) return f.buffer;
  const out = f.buffer.clone();
  for (let i = 0; i < f.mask.length; i++) {
    if (!f.mask[i]) out.data[i * 4 + 3] = 0;
  }
  return out;
}
