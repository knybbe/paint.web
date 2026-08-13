import { clamp, type Point, type Rect } from "./geometry";

export const MIN_ZOOM = 0.01;
export const MAX_ZOOM = 32;
export const ZOOM_STEPS = [
  0.01, 0.02, 0.03, 0.04, 0.05, 0.0625, 0.0833, 0.125, 0.1667, 0.25, 0.333, 0.5, 0.666, 1, 1.5, 2, 3, 4, 5, 6, 8, 12,
  16, 24, 32,
];

export class Viewport {
  zoom = 1;
  /** Top-left of the document in screen pixels (inside the canvas element). */
  panX = 0;
  panY = 0;
  viewWidth = 800;
  viewHeight = 600;
  showRulers = true;
  showPixelGrid = true;
  showGuides = true;
  guides: { orientation: "h" | "v"; position: number }[] = [];
  pixelGridMinZoom = 8;

  screenToImage(sx: number, sy: number): Point {
    return { x: (sx - this.panX) / this.zoom, y: (sy - this.panY) / this.zoom };
  }

  imageToScreen(ix: number, iy: number): Point {
    return { x: ix * this.zoom + this.panX, y: iy * this.zoom + this.panY };
  }

  setZoom(z: number, around?: Point): void {
    const next = clamp(z, MIN_ZOOM, MAX_ZOOM);
    if (around) {
      const img = this.screenToImage(around.x, around.y);
      this.zoom = next;
      this.panX = around.x - img.x * this.zoom;
      this.panY = around.y - img.y * this.zoom;
    } else {
      this.zoom = next;
    }
  }

  zoomIn(around?: Point): void {
    const next = ZOOM_STEPS.find((s) => s > this.zoom + 1e-6) ?? MAX_ZOOM;
    this.setZoom(next, around);
  }

  zoomOut(around?: Point): void {
    let prev = MIN_ZOOM;
    for (const s of ZOOM_STEPS) {
      if (s < this.zoom - 1e-6) prev = s;
    }
    this.setZoom(prev, around);
  }

  actualSize(docW: number, docH: number): void {
    this.zoom = 1;
    this.center(docW, docH);
  }

  fitToWindow(docW: number, docH: number, padding = 24): void {
    const aw = Math.max(1, this.viewWidth - padding * 2);
    const ah = Math.max(1, this.viewHeight - padding * 2);
    this.zoom = clamp(Math.min(aw / docW, ah / docH), MIN_ZOOM, MAX_ZOOM);
    this.center(docW, docH);
  }

  fitSelection(sel: Rect, padding = 40): void {
    if (sel.w < 1 || sel.h < 1) return;
    const aw = Math.max(1, this.viewWidth - padding * 2);
    const ah = Math.max(1, this.viewHeight - padding * 2);
    this.zoom = clamp(Math.min(aw / sel.w, ah / sel.h), MIN_ZOOM, MAX_ZOOM);
    this.panX = this.viewWidth / 2 - (sel.x + sel.w / 2) * this.zoom;
    this.panY = this.viewHeight / 2 - (sel.y + sel.h / 2) * this.zoom;
  }

  center(docW: number, docH: number): void {
    this.panX = (this.viewWidth - docW * this.zoom) / 2;
    this.panY = (this.viewHeight - docH * this.zoom) / 2;
  }

  pan(dx: number, dy: number): void {
    this.panX += dx;
    this.panY += dy;
  }

  visibleImageRect(docW: number, docH: number): Rect {
    const tl = this.screenToImage(0, 0);
    const br = this.screenToImage(this.viewWidth, this.viewHeight);
    const x = Math.max(0, Math.floor(tl.x));
    const y = Math.max(0, Math.floor(tl.y));
    const r = Math.min(docW, Math.ceil(br.x));
    const b = Math.min(docH, Math.ceil(br.y));
    return { x, y, w: Math.max(0, r - x), h: Math.max(0, b - y) };
  }
}
