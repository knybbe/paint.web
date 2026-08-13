export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function normalizeRect(x0: number, y0: number, x1: number, y1: number): Rect {
  const x = Math.min(x0, x1);
  const y = Math.min(y0, y1);
  return { x, y, w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
}

export function constrainSquare(x0: number, y0: number, x1: number, y1: number): Point {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const s = Math.max(Math.abs(dx), Math.abs(dy));
  return { x: x0 + Math.sign(dx || 1) * s, y: y0 + Math.sign(dy || 1) * s };
}

export function rectIntersect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.w, b.x + b.w);
  const btm = Math.min(a.y + a.h, b.y + b.h);
  if (r <= x || btm <= y) return null;
  return { x, y, w: r - x, h: btm - y };
}

export function rectUnion(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  };
}

export function inflateRect(r: Rect, pad: number): Rect {
  return { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 };
}

export function pointInRect(p: Point, r: Rect): boolean {
  return p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;
}

export function floorRect(r: Rect): Rect {
  const x = Math.floor(r.x);
  const y = Math.floor(r.y);
  return {
    x,
    y,
    w: Math.ceil(r.x + r.w) - x,
    h: Math.ceil(r.y + r.h) - y,
  };
}

export function clipRectTo(r: Rect, w: number, h: number): Rect | null {
  return rectIntersect(r, { x: 0, y: 0, w, h });
}

export function rotatePoint(p: Point, origin: Point, radians: number): Point {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return { x: origin.x + dx * c - dy * s, y: origin.y + dx * s + dy * c };
}

export function linePoints(x0: number, y0: number, x1: number, y1: number): Point[] {
  const pts: Point[] = [];
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
    pts.push({ x, y });
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
  return pts;
}

export function ellipsePoints(cx: number, cy: number, rx: number, ry: number, fill: boolean): Point[] {
  const pts: Point[] = [];
  const x0 = Math.floor(cx - rx);
  const y0 = Math.floor(cy - ry);
  const x1 = Math.ceil(cx + rx);
  const y1 = Math.ceil(cy + ry);
  const rx2 = rx * rx || 0.25;
  const ry2 = ry * ry || 0.25;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const d = nx * nx + ny * ny;
      if (fill) {
        if (d <= 1) pts.push({ x, y });
      } else if (d <= 1) {
        const edge =
          ((x + 1.5 - cx) * (x + 1.5 - cx)) / rx2 + ((y + 0.5 - cy) * (y + 0.5 - cy)) / ry2 > 1 ||
          ((x - 0.5 - cx) * (x - 0.5 - cx)) / rx2 + ((y + 0.5 - cy) * (y + 0.5 - cy)) / ry2 > 1 ||
          ((x + 0.5 - cx) * (x + 0.5 - cx)) / rx2 + ((y + 1.5 - cy) * (y + 1.5 - cy)) / ry2 > 1 ||
          ((x + 0.5 - cx) * (x + 0.5 - cx)) / rx2 + ((y - 0.5 - cy) * (y - 0.5 - cy)) / ry2 > 1;
        if (edge) pts.push({ x, y });
      }
    }
  }
  return pts;
}

export function roundedRectPoints(
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  fill: boolean,
): Point[] {
  const r = Math.max(0, Math.min(radius, Math.floor(Math.min(w, h) / 2)));
  const pts: Point[] = [];
  const x1 = x + w;
  const y1 = y + h;
  for (let py = Math.floor(y); py < Math.ceil(y1); py++) {
    for (let px = Math.floor(x); px < Math.ceil(x1); px++) {
      const cx = clamp(px + 0.5, x + r, x1 - r);
      const cy = clamp(py + 0.5, y + r, y1 - r);
      const dx = px + 0.5 - cx;
      const dy = py + 0.5 - cy;
      const d = dx * dx + dy * dy;
      const inside = d <= r * r + 0.25;
      if (!inside) continue;
      if (fill) {
        pts.push({ x: px, y: py });
      } else {
        const onEdge =
          px <= x ||
          py <= y ||
          px >= x1 - 1 ||
          py >= y1 - 1 ||
          (dx * dx + dy * dy > (r - 1) * (r - 1) && (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1));
        if (onEdge) pts.push({ x: px, y: py });
      }
    }
  }
  return pts;
}

export function cubicPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}
