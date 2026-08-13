import { clipRectTo, type Point, type Rect } from "./geometry";

export type SelectionCombine = "replace" | "add" | "subtract" | "invert" | "intersect";

export class Selection {
  width: number;
  height: number;
  /** 0 = unselected, 255 = selected. Null means empty. */
  mask: Uint8Array | null = null;
  private _bounds: Rect | null = null;
  private boundsDirty = true;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  get empty(): boolean {
    return !this.mask;
  }

  ensureMask(): Uint8Array {
    if (!this.mask) this.mask = new Uint8Array(this.width * this.height);
    return this.mask;
  }

  clear(): void {
    this.mask = null;
    this._bounds = null;
    this.boundsDirty = false;
  }

  selectAll(): void {
    this.mask = new Uint8Array(this.width * this.height).fill(255);
    this._bounds = { x: 0, y: 0, w: this.width, h: this.height };
    this.boundsDirty = false;
  }

  contains(x: number, y: number): boolean {
    if (!this.mask) return false;
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    return this.mask[y * this.width + x] !== 0;
  }

  /** True if there is no selection (operate on whole image) or the pixel is selected. */
  allows(x: number, y: number): boolean {
    if (!this.mask) return true;
    return this.contains(x, y);
  }

  clone(): Selection {
    const s = new Selection(this.width, this.height);
    if (this.mask) s.mask = new Uint8Array(this.mask);
    s._bounds = this._bounds ? { ...this._bounds } : null;
    s.boundsDirty = this.boundsDirty;
    return s;
  }

  resizeCanvas(width: number, height: number, ox = 0, oy = 0): void {
    if (!this.mask) {
      this.width = width;
      this.height = height;
      return;
    }
    const next = new Uint8Array(width * height);
    const old = this.mask;
    for (let y = 0; y < this.height; y++) {
      const ny = y + oy;
      if (ny < 0 || ny >= height) continue;
      for (let x = 0; x < this.width; x++) {
        const nx = x + ox;
        if (nx < 0 || nx >= width) continue;
        next[ny * width + nx] = old[y * this.width + x];
      }
    }
    this.width = width;
    this.height = height;
    this.mask = next;
    this.boundsDirty = true;
    if (!next.some((v) => v)) this.clear();
  }

  get bounds(): Rect | null {
    if (!this.mask) return null;
    if (!this.boundsDirty && this._bounds) return this._bounds;
    let minX = this.width,
      minY = this.height,
      maxX = -1,
      maxY = -1;
    const m = this.mask;
    for (let y = 0; y < this.height; y++) {
      const row = y * this.width;
      for (let x = 0; x < this.width; x++) {
        if (m[row + x]) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    this._bounds = maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    this.boundsDirty = false;
    if (!this._bounds) this.mask = null;
    return this._bounds;
  }

  markDirty(): void {
    this.boundsDirty = true;
  }

  invert(): void {
    const m = this.ensureMask();
    for (let i = 0; i < m.length; i++) m[i] = m[i] ? 0 : 255;
    this.boundsDirty = true;
    if (!m.some((v) => v)) this.clear();
  }

  applyRect(r: Rect, mode: SelectionCombine): void {
    const clip = clipRectTo(
      { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) },
      this.width,
      this.height,
    );
    if (mode === "replace") {
      this.mask = new Uint8Array(this.width * this.height);
      if (!clip) {
        this.clear();
        return;
      }
      this.fillRect(clip, 255);
      return;
    }
    if (mode === "intersect" && !this.mask) {
      this.clear();
      return;
    }
    this.ensureMask();
    if (!clip) {
      if (mode === "intersect") this.clear();
      return;
    }
    this.combineRect(clip, mode);
  }

  applyPoints(points: Point[], mode: SelectionCombine): void {
    if (mode === "replace") this.mask = new Uint8Array(this.width * this.height);
    else this.ensureMask();
    if (mode === "intersect" && !this.mask) {
      this.clear();
      return;
    }
    const scratch = new Uint8Array(this.width * this.height);
    for (const p of points) {
      const x = p.x | 0;
      const y = p.y | 0;
      if (x >= 0 && y >= 0 && x < this.width && y < this.height) scratch[y * this.width + x] = 255;
    }
    this.combineMask(scratch, mode);
  }

  applyMask(src: Uint8Array, mode: SelectionCombine): void {
    if (mode === "replace") {
      this.mask = new Uint8Array(src);
      this.boundsDirty = true;
      if (!this.mask.some((v) => v)) this.clear();
      return;
    }
    this.ensureMask();
    this.combineMask(src, mode);
  }

  translate(dx: number, dy: number): void {
    if (!this.mask || (!dx && !dy)) return;
    const next = new Uint8Array(this.width * this.height);
    for (let y = 0; y < this.height; y++) {
      const ny = y + dy;
      if (ny < 0 || ny >= this.height) continue;
      for (let x = 0; x < this.width; x++) {
        const nx = x + dx;
        if (nx < 0 || nx >= this.width) continue;
        next[ny * this.width + nx] = this.mask[y * this.width + x];
      }
    }
    this.mask = next;
    this.boundsDirty = true;
    if (!next.some((v) => v)) this.clear();
  }

  private fillRect(r: Rect, value: number): void {
    const m = this.ensureMask();
    for (let y = r.y; y < r.y + r.h; y++) {
      m.fill(value, y * this.width + r.x, y * this.width + r.x + r.w);
    }
    this.boundsDirty = true;
  }

  private combineRect(r: Rect, mode: SelectionCombine): void {
    const m = this.ensureMask();
    for (let y = r.y; y < r.y + r.h; y++) {
      const row = y * this.width;
      for (let x = r.x; x < r.x + r.w; x++) {
        const i = row + x;
        m[i] = combine(m[i], 255, mode);
      }
    }
    if (mode === "intersect") {
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          if (x < r.x || x >= r.x + r.w || y < r.y || y >= r.y + r.h) {
            m[y * this.width + x] = 0;
          }
        }
      }
    }
    this.boundsDirty = true;
    if (!m.some((v) => v)) this.clear();
  }

  private combineMask(src: Uint8Array, mode: SelectionCombine): void {
    const m = this.ensureMask();
    for (let i = 0; i < m.length; i++) m[i] = combine(m[i], src[i], mode);
    this.boundsDirty = true;
    if (!m.some((v) => v)) this.clear();
  }
}

function combine(cur: number, incoming: number, mode: SelectionCombine): number {
  switch (mode) {
    case "replace":
    case "add":
      return incoming ? 255 : cur;
    case "subtract":
      return incoming ? 0 : cur;
    case "invert":
      return incoming ? (cur ? 0 : 255) : cur;
    case "intersect":
      return incoming && cur ? 255 : 0;
    default:
      return cur;
  }
}

export function combineFromModifiers(e: { ctrlKey: boolean; altKey: boolean; button: number }): SelectionCombine {
  if (e.ctrlKey && e.button === 2) return "invert";
  if (e.altKey && e.button === 2) return "intersect";
  if (e.ctrlKey) return "add";
  if (e.altKey) return "subtract";
  return "replace";
}
