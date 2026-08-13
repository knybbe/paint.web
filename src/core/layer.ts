import { type Color, Colors } from "./color";
import type { BlendMode } from "./blend";
import { PixelBuffer } from "./pixel-buffer";

let layerSeq = 1;

export function resetLayerSeq(n = 1): void {
  layerSeq = n;
}

export function noteLayerId(id: string): void {
  const n = Number(id.replace(/^layer-/, ""));
  if (Number.isFinite(n) && n >= layerSeq) layerSeq = n + 1;
}

export class Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  /** 0–255, matching Paint.NET */
  opacity: number;
  blendMode: BlendMode;
  buffer: PixelBuffer;
  /** Optional grayscale mask (0 hide, 255 show). */
  mask: Uint8Array | null;
  maskEnabled: boolean;

  constructor(width: number, height: number, name = "Layer", fill?: Color) {
    this.id = `layer-${layerSeq++}`;
    this.name = name;
    this.visible = true;
    this.locked = false;
    this.opacity = 255;
    this.blendMode = "Normal";
    this.buffer = PixelBuffer.create(width, height, fill);
    this.mask = null;
    this.maskEnabled = true;
  }

  static fromBuffer(buffer: PixelBuffer, name = "Layer"): Layer {
    const layer = new Layer(buffer.width, buffer.height, name);
    layer.buffer = buffer;
    return layer;
  }

  get width(): number {
    return this.buffer.width;
  }

  get height(): number {
    return this.buffer.height;
  }

  get effectiveMask(): Uint8Array | null {
    return this.maskEnabled ? this.mask : null;
  }

  clone(): Layer {
    const layer = Layer.fromBuffer(this.buffer.clone(), this.name);
    layer.visible = this.visible;
    layer.locked = this.locked;
    layer.opacity = this.opacity;
    layer.blendMode = this.blendMode;
    layer.mask = this.mask ? new Uint8Array(this.mask) : null;
    layer.maskEnabled = this.maskEnabled;
    return layer;
  }

  resize(width: number, height: number, ox: number, oy: number, fill: Color = Colors.transparent): void {
    const oldW = this.width;
    const oldH = this.height;
    const oldMask = this.mask;
    const next = PixelBuffer.create(width, height, fill);
    this.buffer.copyTo(next, ox, oy);
    this.buffer = next;
    if (oldMask) {
      const m = new Uint8Array(width * height);
      for (let y = 0; y < height; y++) {
        const sy = y - oy;
        if (sy < 0 || sy >= oldH) continue;
        for (let x = 0; x < width; x++) {
          const sx = x - ox;
          if (sx < 0 || sx >= oldW) continue;
          m[y * width + x] = oldMask[sy * oldW + sx];
        }
      }
      this.mask = m;
    }
  }

  thumbnailDataUrl(size = 40): string {
    if (typeof document === "undefined") return "";
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    if (!ctx) return "";
    drawChecker(ctx, size, size, 4);
    const scale = Math.min(size / this.width, size / this.height);
    const w = Math.max(1, Math.round(this.width * scale));
    const h = Math.max(1, Math.round(this.height * scale));
    const tmp = document.createElement("canvas");
    tmp.width = this.width;
    tmp.height = this.height;
    tmp.getContext("2d")?.putImageData(this.buffer.asImageData(), 0, 0);
    ctx.imageSmoothingEnabled = scale < 1;
    ctx.drawImage(tmp, (size - w) / 2, (size - h) / 2, w, h);
    return c.toDataURL("image/png");
  }
}

export function drawChecker(ctx: CanvasRenderingContext2D | null, w: number, h: number, cell = 8): void {
  if (!ctx) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#cccccc";
  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      if (((x / cell) | 0) % 2 !== ((y / cell) | 0) % 2) ctx.fillRect(x, y, cell, cell);
    }
  }
}
