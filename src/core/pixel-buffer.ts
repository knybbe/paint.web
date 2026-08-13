import { type Color, rgba } from "./color";
import { clipRectTo, type Rect } from "./geometry";

export class PixelBuffer {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;

  constructor(width: number, height: number, data?: Uint8ClampedArray) {
    if (width < 1 || height < 1) throw new Error("PixelBuffer size must be at least 1x1");
    this.width = width | 0;
    this.height = height | 0;
    const expected = this.width * this.height * 4;
    if (data) {
      if (data.length !== expected) {
        throw new Error(`PixelBuffer data length ${data.length} != ${expected}`);
      }
      this.data = data;
    } else {
      this.data = new Uint8ClampedArray(expected);
    }
  }

  static create(width: number, height: number, fill?: Color): PixelBuffer {
    const buf = new PixelBuffer(width, height);
    if (fill) buf.fill(fill);
    return buf;
  }

  static fromImageData(img: ImageData): PixelBuffer {
    return new PixelBuffer(img.width, img.height, new Uint8ClampedArray(img.data));
  }

  index(x: number, y: number): number {
    return (y * this.width + x) * 4;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  getPixel(x: number, y: number): Color {
    const i = this.index(x, y);
    return rgba(this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]);
  }

  setPixel(x: number, y: number, c: Color): void {
    const i = this.index(x, y);
    this.data[i] = c.r;
    this.data[i + 1] = c.g;
    this.data[i + 2] = c.b;
    this.data[i + 3] = c.a;
  }

  blendOver(x: number, y: number, c: Color): void {
    if (!this.inBounds(x, y) || c.a === 0) return;
    const i = this.index(x, y);
    if (c.a >= 255) {
      this.data[i] = c.r;
      this.data[i + 1] = c.g;
      this.data[i + 2] = c.b;
      this.data[i + 3] = 255;
      return;
    }
    const sa = c.a / 255;
    const da = this.data[i + 3] / 255;
    const outA = sa + da * (1 - sa);
    if (outA <= 0) {
      this.data[i] = this.data[i + 1] = this.data[i + 2] = this.data[i + 3] = 0;
      return;
    }
    this.data[i] = Math.round((c.r * sa + this.data[i] * da * (1 - sa)) / outA);
    this.data[i + 1] = Math.round((c.g * sa + this.data[i + 1] * da * (1 - sa)) / outA);
    this.data[i + 2] = Math.round((c.b * sa + this.data[i + 2] * da * (1 - sa)) / outA);
    this.data[i + 3] = Math.round(outA * 255);
  }

  fill(c: Color): void {
    const { data } = this;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = c.r;
      data[i + 1] = c.g;
      data[i + 2] = c.b;
      data[i + 3] = c.a;
    }
  }

  fillRect(r: Rect, c: Color): void {
    const clip = clipRectTo(r, this.width, this.height);
    if (!clip) return;
    const x1 = clip.x + clip.w;
    const y1 = clip.y + clip.h;
    for (let y = clip.y; y < y1; y++) {
      for (let x = clip.x; x < x1; x++) this.setPixel(x, y, c);
    }
  }

  clear(): void {
    this.data.fill(0);
  }

  clone(): PixelBuffer {
    return new PixelBuffer(this.width, this.height, new Uint8ClampedArray(this.data));
  }

  cloneRect(r: Rect): { rect: Rect; buffer: PixelBuffer } | null {
    const clip = clipRectTo(r, this.width, this.height);
    if (!clip || clip.w < 1 || clip.h < 1) return null;
    const out = new PixelBuffer(clip.w, clip.h);
    this.copyTo(out, 0, 0, clip);
    return { rect: clip, buffer: out };
  }

  copyTo(dest: PixelBuffer, dx: number, dy: number, src?: Rect): void {
    const s = src ?? { x: 0, y: 0, w: this.width, h: this.height };
    for (let y = 0; y < s.h; y++) {
      const sy = s.y + y;
      const ty = dy + y;
      if (sy < 0 || sy >= this.height || ty < 0 || ty >= dest.height) continue;
      for (let x = 0; x < s.w; x++) {
        const sx = s.x + x;
        const tx = dx + x;
        if (sx < 0 || sx >= this.width || tx < 0 || tx >= dest.width) continue;
        const si = this.index(sx, sy);
        const di = dest.index(tx, ty);
        dest.data[di] = this.data[si];
        dest.data[di + 1] = this.data[si + 1];
        dest.data[di + 2] = this.data[si + 2];
        dest.data[di + 3] = this.data[si + 3];
      }
    }
  }

  blitOver(src: PixelBuffer, dx: number, dy: number, srcRect?: Rect): void {
    const s = srcRect ?? { x: 0, y: 0, w: src.width, h: src.height };
    for (let y = 0; y < s.h; y++) {
      const sy = s.y + y;
      const ty = dy + y;
      if (sy < 0 || sy >= src.height || ty < 0 || ty >= this.height) continue;
      for (let x = 0; x < s.w; x++) {
        const sx = s.x + x;
        const tx = dx + x;
        if (sx < 0 || sx >= src.width || tx < 0 || tx >= this.width) continue;
        this.blendOver(tx, ty, src.getPixel(sx, sy));
      }
    }
  }

  toImageData(): ImageData {
    return new ImageData(new Uint8ClampedArray(this.data) as unknown as ImageDataArray, this.width, this.height);
  }

  /** Shares the underlying buffer with an ImageData view (browser only). */
  asImageData(): ImageData {
    return new ImageData(this.data as unknown as ImageDataArray, this.width, this.height);
  }

  resize(width: number, height: number, mode: "nearest" | "bilinear" = "bilinear"): PixelBuffer {
    const dest = new PixelBuffer(width, height);
    if (mode === "nearest") {
      for (let y = 0; y < height; y++) {
        const sy = Math.min(this.height - 1, Math.floor(((y + 0.5) * this.height) / height));
        for (let x = 0; x < width; x++) {
          const sx = Math.min(this.width - 1, Math.floor(((x + 0.5) * this.width) / width));
          dest.setPixel(x, y, this.getPixel(sx, sy));
        }
      }
      return dest;
    }
    for (let y = 0; y < height; y++) {
      const fy = ((y + 0.5) * this.height) / height - 0.5;
      const y0 = Math.max(0, Math.floor(fy));
      const y1 = Math.min(this.height - 1, y0 + 1);
      const ty = fy - y0;
      for (let x = 0; x < width; x++) {
        const fx = ((x + 0.5) * this.width) / width - 0.5;
        const x0 = Math.max(0, Math.floor(fx));
        const x1 = Math.min(this.width - 1, x0 + 1);
        const tx = fx - x0;
        const c00 = this.getPixel(x0, y0);
        const c10 = this.getPixel(x1, y0);
        const c01 = this.getPixel(x0, y1);
        const c11 = this.getPixel(x1, y1);
        dest.setPixel(x, y, {
          r: Math.round(bilerp(c00.r, c10.r, c01.r, c11.r, tx, ty)),
          g: Math.round(bilerp(c00.g, c10.g, c01.g, c11.g, tx, ty)),
          b: Math.round(bilerp(c00.b, c10.b, c01.b, c11.b, tx, ty)),
          a: Math.round(bilerp(c00.a, c10.a, c01.a, c11.a, tx, ty)),
        });
      }
    }
    return dest;
  }

  rotate90(dir: 1 | -1): PixelBuffer {
    const dest = new PixelBuffer(this.height, this.width);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const c = this.getPixel(x, y);
        if (dir === 1) dest.setPixel(this.height - 1 - y, x, c);
        else dest.setPixel(y, this.width - 1 - x, c);
      }
    }
    return dest;
  }

  rotate180(): PixelBuffer {
    const dest = new PixelBuffer(this.width, this.height);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        dest.setPixel(this.width - 1 - x, this.height - 1 - y, this.getPixel(x, y));
      }
    }
    return dest;
  }

  flip(horizontal: boolean, vertical: boolean): PixelBuffer {
    const dest = new PixelBuffer(this.width, this.height);
    for (let y = 0; y < this.height; y++) {
      const sy = vertical ? this.height - 1 - y : y;
      for (let x = 0; x < this.width; x++) {
        const sx = horizontal ? this.width - 1 - x : x;
        dest.setPixel(x, y, this.getPixel(sx, sy));
      }
    }
    return dest;
  }
}

function bilerp(c00: number, c10: number, c01: number, c11: number, tx: number, ty: number): number {
  return c00 * (1 - tx) * (1 - ty) + c10 * tx * (1 - ty) + c01 * (1 - tx) * ty + c11 * tx * ty;
}

export function snapshotBytes(buffer: PixelBuffer, rect?: Rect): Uint8ClampedArray {
  if (!rect) return new Uint8ClampedArray(buffer.data);
  const clip = clipRectTo(rect, buffer.width, buffer.height);
  if (!clip) return new Uint8ClampedArray(0);
  const out = new Uint8ClampedArray(clip.w * clip.h * 4);
  for (let y = 0; y < clip.h; y++) {
    const src = buffer.index(clip.x, clip.y + y);
    out.set(buffer.data.subarray(src, src + clip.w * 4), y * clip.w * 4);
  }
  return out;
}

export function restoreBytes(buffer: PixelBuffer, data: Uint8ClampedArray, rect?: Rect): void {
  if (!rect) {
    buffer.data.set(data);
    return;
  }
  const clip = clipRectTo(rect, buffer.width, buffer.height);
  if (!clip) return;
  for (let y = 0; y < clip.h; y++) {
    const dest = buffer.index(clip.x, clip.y + y);
    const src = y * clip.w * 4;
    buffer.data.set(data.subarray(src, src + clip.w * 4), dest);
  }
}
