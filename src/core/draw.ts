import { type Color, withinTolerance } from "./color";
import type { PixelBuffer } from "./pixel-buffer";
import type { Selection } from "./selection";
import { dist, type Point } from "./geometry";

export interface StampOptions {
  size: number;
  hardness: number;
  antialias: boolean;
  color: Color;
  erase?: boolean;
  pressure?: number;
  selection?: Selection;
}

export function stampCircle(buf: PixelBuffer, cx: number, cy: number, opt: StampOptions): void {
  const pressure = opt.pressure == null || opt.pressure <= 0 ? 1 : opt.pressure;
  const radius = Math.max(0.5, (opt.size / 2) * pressure);
  const hard = Math.max(0, Math.min(1, opt.hardness));
  const inner = radius * hard;
  const x0 = Math.max(0, Math.floor(cx - radius - 1));
  const y0 = Math.max(0, Math.floor(cy - radius - 1));
  const x1 = Math.min(buf.width - 1, Math.ceil(cx + radius + 1));
  const y1 = Math.min(buf.height - 1, Math.ceil(cy + radius + 1));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (opt.selection && !opt.selection.allows(x, y)) continue;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > radius + (opt.antialias ? 0.5 : 0)) continue;
      let cov = 1;
      if (opt.antialias) {
        if (d > inner) {
          const t = (d - inner) / Math.max(0.0001, radius - inner + 0.5);
          cov = 1 - Math.max(0, Math.min(1, t));
        }
      } else if (d > radius) continue;
      if (opt.erase) {
        const i = buf.index(x, y);
        buf.data[i + 3] = Math.round(buf.data[i + 3] * (1 - cov));
        if (buf.data[i + 3] === 0) {
          buf.data[i] = buf.data[i + 1] = buf.data[i + 2] = 0;
        }
      } else {
        const c = { ...opt.color, a: Math.round(opt.color.a * cov) };
        buf.blendOver(x, y, c);
      }
    }
  }
}

export function forEachStamp(a: Point, b: Point, size: number, fn: (p: Point) => void, spacing = 0.25): Point {
  const gap = Math.max(0.5, size * spacing);
  const d = dist(a, b);
  if (d === 0) {
    fn(b);
    return b;
  }
  const steps = Math.max(1, Math.ceil(d / gap));
  let last = a;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    last = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    fn(last);
  }
  return last;
}

export function stampAlong(buf: PixelBuffer, a: Point, b: Point, opt: StampOptions, spacing = 0.25): Point {
  return forEachStamp(a, b, opt.size, (p) => stampCircle(buf, p.x, p.y, opt), spacing);
}

export function setAliasedPixel(buf: PixelBuffer, x: number, y: number, c: Color, sel?: Selection): void {
  const px = x | 0;
  const py = y | 0;
  if (!buf.inBounds(px, py)) return;
  if (sel && !sel.allows(px, py)) return;
  buf.setPixel(px, py, c);
}

export function drawAliasedLine(
  buf: PixelBuffer,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  c: Color,
  sel?: Selection,
): void {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const xEnd = Math.round(x1);
  const yEnd = Math.round(y1);
  const dx = Math.abs(xEnd - x);
  const dy = Math.abs(yEnd - y);
  const sx = x < xEnd ? 1 : -1;
  const sy = y < yEnd ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    setAliasedPixel(buf, x, y, c, sel);
    if (x === xEnd && y === yEnd) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

export function strokeWidthLine(
  buf: PixelBuffer,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  opt: StampOptions,
): void {
  if (opt.size <= 1 && !opt.antialias) {
    drawAliasedLine(buf, x0, y0, x1, y1, opt.color, opt.selection);
    return;
  }
  stampAlong(buf, { x: x0, y: y0 }, { x: x1, y: y1 }, opt, 0.2);
}

export function cloneStamp(
  dest: PixelBuffer,
  src: PixelBuffer,
  dx: number,
  dy: number,
  sx: number,
  sy: number,
  opt: StampOptions,
): void {
  const pressure = opt.pressure == null || opt.pressure <= 0 ? 1 : opt.pressure;
  const radius = Math.max(0.5, (opt.size / 2) * pressure);
  const hard = Math.max(0, Math.min(1, opt.hardness));
  const inner = radius * hard;
  const x0 = Math.max(0, Math.floor(dx - radius - 1));
  const y0 = Math.max(0, Math.floor(dy - radius - 1));
  const x1 = Math.min(dest.width - 1, Math.ceil(dx + radius + 1));
  const y1 = Math.min(dest.height - 1, Math.ceil(dy + radius + 1));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (opt.selection && !opt.selection.allows(x, y)) continue;
      const d = Math.hypot(x + 0.5 - dx, y + 0.5 - dy);
      if (d > radius + 0.5) continue;
      let cov = 1;
      if (d > inner) cov = 1 - Math.max(0, Math.min(1, (d - inner) / Math.max(0.0001, radius - inner + 0.5)));
      const ox = Math.round(sx + (x - dx));
      const oy = Math.round(sy + (y - dy));
      if (!src.inBounds(ox, oy)) continue;
      const c = src.getPixel(ox, oy);
      dest.blendOver(x, y, { ...c, a: Math.round(c.a * cov) });
    }
  }
}

export function recolorStamp(
  buf: PixelBuffer,
  cx: number,
  cy: number,
  sample: Color,
  replace: Color,
  tolerance: number,
  opt: StampOptions,
): void {
  const pressure = opt.pressure == null || opt.pressure <= 0 ? 1 : opt.pressure;
  const radius = Math.max(0.5, (opt.size / 2) * pressure);
  const x0 = Math.max(0, Math.floor(cx - radius - 1));
  const y0 = Math.max(0, Math.floor(cy - radius - 1));
  const x1 = Math.min(buf.width - 1, Math.ceil(cx + radius + 1));
  const y1 = Math.min(buf.height - 1, Math.ceil(cy + radius + 1));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (opt.selection && !opt.selection.allows(x, y)) continue;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > radius) continue;
      const cur = buf.getPixel(x, y);
      if (!withinTolerance(cur, sample, tolerance)) continue;
      const cov = opt.antialias && d > radius - 1 ? radius - d : 1;
      buf.blendOver(x, y, { ...replace, a: Math.round(replace.a * cov) });
    }
  }
}

