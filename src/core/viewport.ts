import { clamp, type Point, type Rect } from "./geometry";

/** 1% … 2000%. Slider midpoint is 100%. */
export const MIN_ZOOM = 0.01;
export const MAX_ZOOM = 20;
export const ZOOM_STEPS = [
  0.01, 0.02, 0.05, 0.1, 0.125, 0.1667, 0.25, 0.333, 0.5, 0.666, 1, 1.5, 2, 3, 4, 5, 6, 8, 12, 16, 20,
];

/** Discrete slider domain: 0–500 = 1%–100%, 500–1000 = 100%–2000%. */
export const ZOOM_SLIDER_MAX = 1000;
const ZOOM_SLIDER_MID = ZOOM_SLIDER_MAX / 2;
const ZOOM_PCT_MIN = MIN_ZOOM * 100;
const ZOOM_PCT_MID = 100;
const ZOOM_PCT_MAX = MAX_ZOOM * 100;

/** Map a zoom factor to the split size-slider position (0…1000). */
export function zoomToSlider(zoom: number): number {
  const pct = clamp(zoom * 100, ZOOM_PCT_MIN, ZOOM_PCT_MAX);
  if (pct <= ZOOM_PCT_MID) {
    return ((pct - ZOOM_PCT_MIN) / (ZOOM_PCT_MID - ZOOM_PCT_MIN)) * ZOOM_SLIDER_MID;
  }
  return ZOOM_SLIDER_MID + ((pct - ZOOM_PCT_MID) / (ZOOM_PCT_MAX - ZOOM_PCT_MID)) * ZOOM_SLIDER_MID;
}

/** Map a split size-slider position (0…1000) back to a zoom factor. */
export function sliderToZoom(pos: number): number {
  const t = clamp(pos, 0, ZOOM_SLIDER_MAX);
  if (t <= ZOOM_SLIDER_MID) {
    const pct = ZOOM_PCT_MIN + (t / ZOOM_SLIDER_MID) * (ZOOM_PCT_MID - ZOOM_PCT_MIN);
    return pct / 100;
  }
  const pct = ZOOM_PCT_MID + ((t - ZOOM_SLIDER_MID) / ZOOM_SLIDER_MID) * (ZOOM_PCT_MAX - ZOOM_PCT_MID);
  return pct / 100;
}

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

  /** Continuous zoom for trackpad pinch / ctrl+wheel. `around` is in CSS pixels. */
  zoomByFactor(factor: number, around?: Point): void {
    this.setZoom(this.zoom * factor, around);
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

  fitToWindow(docW: number, docH: number, padding = 8): void {
    const aw = Math.max(1, this.viewWidth - padding * 2);
    const ah = Math.max(1, this.viewHeight - padding * 2);
    this.zoom = clamp(Math.min(aw / Math.max(1, docW), ah / Math.max(1, docH)), MIN_ZOOM, MAX_ZOOM);
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

/**
 * Convert a wheel event into a multiplicative zoom factor.
 * Mac trackpad pinch is delivered as many small ctrl+wheel pixel deltas; a
 * discrete zoom-step per event makes that explode. Clamp so a single huge
 * notch cannot jump more than ~15%.
 */
export function zoomFactorFromWheel(deltaY: number, deltaMode = 0): number {
  const px = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 800 : deltaY;
  return clamp(Math.exp(-px * 0.0025), 0.85, 1.15);
}
