import { drawChecker } from "./layer";
import type { PdDocument } from "./document";
import type { Selection } from "./selection";
import type { Viewport } from "./viewport";
import { PixelBuffer } from "./pixel-buffer";
import { Colors } from "./color";
import { compositeLayer } from "./blend";

export class Compositor {
  private cache: PixelBuffer | null = null;
  private version = -1;
  currentVersion = 0;

  invalidate(): void {
    this.currentVersion++;
  }

  get(doc: PdDocument): PixelBuffer {
    if (!this.cache || this.cache.width !== doc.width || this.cache.height !== doc.height) {
      this.cache = PixelBuffer.create(doc.width, doc.height, Colors.transparent);
      this.version = -1;
    }
    if (this.version !== this.currentVersion) {
      this.cache.fill(Colors.transparent);
      for (const layer of doc.layers) {
        if (!layer.visible) continue;
        compositeLayer(this.cache, layer.buffer, layer.blendMode, layer.opacity, layer.effectiveMask);
      }
      this.version = this.currentVersion;
    }
    return this.cache;
  }
}

let checkerTile: HTMLCanvasElement | null | undefined;

function getCheckerTile(): HTMLCanvasElement | null {
  if (checkerTile !== undefined) return checkerTile;
  checkerTile = null;
  if (typeof document === "undefined") return null;
  try {
    const c = document.createElement("canvas");
    c.width = 16;
    c.height = 16;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    drawChecker(ctx, 16, 16, 8);
    checkerTile = c;
  } catch {
    checkerTile = null;
  }
  return checkerTile;
}

export interface OverlayDrawer {
  (ctx: CanvasRenderingContext2D, vp: Viewport): void;
}

export function renderWorkspace(
  ctx: CanvasRenderingContext2D,
  doc: PdDocument,
  compositor: Compositor,
  vp: Viewport,
  selection: Selection,
  antsPhase: number,
  overlay?: OverlayDrawer,
): void {
  const { width: vw, height: vh } = ctx.canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, vw, vh);
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, vw, vh);

  const dw = doc.width * vp.zoom;
  const dh = doc.height * vp.zoom;
  const dx = vp.panX;
  const dy = vp.panY;

  const tile = getCheckerTile();
  if (tile) {
    const pattern = ctx.createPattern(tile, "repeat");
    if (pattern) {
      ctx.save();
      ctx.translate(dx, dy);
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, dw, dh);
      ctx.restore();
    }
  } else {
    ctx.fillStyle = "#fff";
    ctx.fillRect(dx, dy, dw, dh);
  }

  const composite = compositor.get(doc);
  const tmp = getScratch(doc.width, doc.height);
  tmp.ctx.putImageData(composite.asImageData(), 0, 0);

  ctx.imageSmoothingEnabled = vp.zoom < 1;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(tmp.canvas, 0, 0, doc.width, doc.height, dx, dy, dw, dh);

  if (vp.showPixelGrid && vp.zoom >= vp.pixelGridMinZoom) {
    drawPixelGrid(ctx, vp, doc.width, doc.height);
  }

  if (vp.showGuides) {
    drawGuides(ctx, vp, doc.width, doc.height);
  }

  if (!selection.empty) {
    drawMarchingAnts(ctx, selection, vp, antsPhase);
  }

  if (overlay) overlay(ctx, vp);

  // document shadow / border
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 1;
  ctx.strokeRect(dx - 0.5, dy - 0.5, dw + 1, dh + 1);
}

function drawPixelGrid(ctx: CanvasRenderingContext2D, vp: Viewport, w: number, h: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = 1;
  const x0 = Math.max(0, Math.floor((0 - vp.panX) / vp.zoom));
  const y0 = Math.max(0, Math.floor((0 - vp.panY) / vp.zoom));
  const x1 = Math.min(w, Math.ceil((vp.viewWidth - vp.panX) / vp.zoom));
  const y1 = Math.min(h, Math.ceil((vp.viewHeight - vp.panY) / vp.zoom));
  for (let x = x0; x <= x1; x++) {
    const sx = Math.round(x * vp.zoom + vp.panX) + 0.5;
    ctx.moveTo(sx, y0 * vp.zoom + vp.panY);
    ctx.lineTo(sx, y1 * vp.zoom + vp.panY);
  }
  for (let y = y0; y <= y1; y++) {
    const sy = Math.round(y * vp.zoom + vp.panY) + 0.5;
    ctx.moveTo(x0 * vp.zoom + vp.panX, sy);
    ctx.lineTo(x1 * vp.zoom + vp.panX, sy);
  }
  ctx.stroke();
  ctx.restore();
}

function drawGuides(ctx: CanvasRenderingContext2D, vp: Viewport, w: number, h: number): void {
  ctx.save();
  ctx.strokeStyle = "#19c8ff";
  ctx.lineWidth = 1;
  for (const g of vp.guides) {
    ctx.beginPath();
    if (g.orientation === "v") {
      const x = g.position * vp.zoom + vp.panX + 0.5;
      ctx.moveTo(x, vp.panY);
      ctx.lineTo(x, vp.panY + h * vp.zoom);
    } else {
      const y = g.position * vp.zoom + vp.panY + 0.5;
      ctx.moveTo(vp.panX, y);
      ctx.lineTo(vp.panX + w * vp.zoom, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function drawMarchingAnts(
  ctx: CanvasRenderingContext2D,
  selection: Selection,
  vp: Viewport,
  phase: number,
): void {
  const b = selection.bounds;
  if (!b || !selection.mask) return;
  ctx.save();
  const dash = 4;
  const off = phase % (dash * 2);

  // Fast path: full-image or solid rectangular selection
  if (isSolidRect(selection, b)) {
    const x = b.x * vp.zoom + vp.panX + 0.5;
    const y = b.y * vp.zoom + vp.panY + 0.5;
    const w = b.w * vp.zoom;
    const h = b.h * vp.zoom;
    ctx.lineWidth = 1;
    ctx.setLineDash([dash, dash]);
    ctx.lineDashOffset = -off;
    ctx.strokeStyle = "#000";
    ctx.strokeRect(x, y, w, h);
    ctx.lineDashOffset = -off + dash;
    ctx.strokeStyle = "#fff";
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
    return;
  }

  const scale = vp.zoom;
  const visX0 = Math.max(b.x, Math.floor((0 - vp.panX) / scale) - 1);
  const visY0 = Math.max(b.y, Math.floor((0 - vp.panY) / scale) - 1);
  const visX1 = Math.min(b.x + b.w, Math.ceil((vp.viewWidth - vp.panX) / scale) + 1);
  const visY1 = Math.min(b.y + b.h, Math.ceil((vp.viewHeight - vp.panY) / scale) + 1);
  const m = selection.mask;
  const sw = selection.width;

  if (scale >= 2) {
    for (let y = visY0; y < visY1; y++) {
      for (let x = visX0; x < visX1; x++) {
        if (!m[y * sw + x]) continue;
        const edge =
          x === 0 ||
          y === 0 ||
          x === sw - 1 ||
          y === selection.height - 1 ||
          !m[y * sw + x - 1] ||
          !m[y * sw + x + 1] ||
          !m[(y - 1) * sw + x] ||
          !m[(y + 1) * sw + x];
        if (!edge) continue;
        const on = ((x + y + (phase >> 0)) & 7) < 4;
        ctx.fillStyle = on ? "#000" : "#fff";
        ctx.fillRect(x * scale + vp.panX, y * scale + vp.panY, scale, 1);
        ctx.fillRect(x * scale + vp.panX, y * scale + vp.panY, 1, scale);
      }
    }
  } else {
    ctx.beginPath();
    for (let y = visY0; y < visY1; y++) {
      for (let x = visX0; x < visX1; x++) {
        if (!m[y * sw + x]) continue;
        const left = x === 0 || !m[y * sw + x - 1];
        const top = y === 0 || !m[(y - 1) * sw + x];
        if (left) {
          ctx.moveTo(x * scale + vp.panX, y * scale + vp.panY);
          ctx.lineTo(x * scale + vp.panX, (y + 1) * scale + vp.panY);
        }
        if (top) {
          ctx.moveTo(x * scale + vp.panX, y * scale + vp.panY);
          ctx.lineTo((x + 1) * scale + vp.panX, y * scale + vp.panY);
        }
      }
    }
    ctx.lineWidth = 1;
    ctx.setLineDash([dash, dash]);
    ctx.lineDashOffset = -off;
    ctx.strokeStyle = "#000";
    ctx.stroke();
    ctx.lineDashOffset = -off + dash;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
  }
  ctx.restore();
}

function isSolidRect(sel: Selection, b: { x: number; y: number; w: number; h: number }): boolean {
  if (!sel.mask) return false;
  for (let y = b.y; y < b.y + b.h; y++) {
    for (let x = b.x; x < b.x + b.w; x++) {
      if (!sel.mask[y * sel.width + x]) return false;
    }
  }
  return true;
}

interface Scratch {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
}

let scratch: Scratch | null = null;

function getScratch(w: number, h: number): Scratch {
  if (!scratch || scratch.w !== w || scratch.h !== h) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    scratch = { canvas, ctx: canvas.getContext("2d")!, w, h };
  }
  return scratch;
}

export function drawNub(ctx: CanvasRenderingContext2D, x: number, y: number, size = 6): void {
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(x - size / 2, y - size / 2, size, size);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
