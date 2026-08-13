import { type Color, Colors } from "./color";
import { compositeLayer } from "./blend";
import { Layer } from "./layer";
import { PixelBuffer } from "./pixel-buffer";
import { Selection } from "./selection";

export type BackgroundKind = "White" | "Black" | "Transparent";

export interface DocumentMeta {
  name: string;
  width: number;
  height: number;
  dpi: number;
  background: BackgroundKind;
}

export class PdDocument {
  name: string;
  dpi: number;
  background: BackgroundKind;
  layers: Layer[] = [];
  activeLayerId: string;
  dirty = false;

  constructor(width: number, height: number, opts?: Partial<DocumentMeta>) {
    this.name = opts?.name ?? "Untitled.png";
    this.dpi = opts?.dpi ?? 96;
    this.background = opts?.background ?? "White";
    const fill = backgroundColor(this.background);
    const base = new Layer(width, height, "Background", fill);
    this.layers.push(base);
    this.activeLayerId = base.id;
  }

  get width(): number {
    return this.layers[0]?.width ?? 0;
  }

  get height(): number {
    return this.layers[0]?.height ?? 0;
  }

  get activeLayer(): Layer {
    return this.layers.find((l) => l.id === this.activeLayerId) ?? this.layers[this.layers.length - 1];
  }

  get activeIndex(): number {
    return this.layers.findIndex((l) => l.id === this.activeLayerId);
  }

  setActive(id: string): void {
    if (this.layers.some((l) => l.id === id)) this.activeLayerId = id;
  }

  layerById(id: string): Layer | undefined {
    return this.layers.find((l) => l.id === id);
  }

  addLayer(name?: string, fill: Color = Colors.transparent, at?: number): Layer {
    const layer = new Layer(this.width, this.height, name ?? nextLayerName(this.layers), fill);
    const idx = at ?? this.activeIndex + 1;
    this.layers.splice(idx, 0, layer);
    this.activeLayerId = layer.id;
    this.dirty = true;
    return layer;
  }

  insertLayer(layer: Layer, at: number): void {
    this.layers.splice(at, 0, layer);
    this.activeLayerId = layer.id;
    this.dirty = true;
  }

  deleteLayer(id: string): Layer | null {
    if (this.layers.length <= 1) return null;
    const idx = this.layers.findIndex((l) => l.id === id);
    if (idx < 0) return null;
    const [removed] = this.layers.splice(idx, 1);
    const next = this.layers[Math.min(idx, this.layers.length - 1)];
    this.activeLayerId = next.id;
    this.dirty = true;
    return removed;
  }

  duplicateLayer(id: string): Layer | null {
    const src = this.layerById(id);
    if (!src) return null;
    const copy = src.clone();
    copy.name = `${src.name} copy`;
    const idx = this.layers.indexOf(src);
    this.layers.splice(idx + 1, 0, copy);
    this.activeLayerId = copy.id;
    this.dirty = true;
    return copy;
  }

  mergeDown(id: string): boolean {
    const idx = this.layers.findIndex((l) => l.id === id);
    if (idx <= 0) return false;
    const upper = this.layers[idx];
    const lower = this.layers[idx - 1];
    compositeLayer(lower.buffer, upper.buffer, upper.blendMode, upper.opacity, upper.effectiveMask);
    this.layers.splice(idx, 1);
    this.activeLayerId = lower.id;
    this.dirty = true;
    return true;
  }

  flatten(): void {
    const flat = this.composite();
    const layer = Layer.fromBuffer(flat, "Background");
    this.layers = [layer];
    this.activeLayerId = layer.id;
    this.dirty = true;
  }

  moveLayer(from: number, to: number): void {
    if (from === to || from < 0 || to < 0 || from >= this.layers.length || to >= this.layers.length) return;
    const [layer] = this.layers.splice(from, 1);
    this.layers.splice(to, 0, layer);
    this.dirty = true;
  }

  composite(): PixelBuffer {
    const out = PixelBuffer.create(this.width, this.height, Colors.transparent);
    for (const layer of this.layers) {
      if (!layer.visible) continue;
      compositeLayer(out, layer.buffer, layer.blendMode, layer.opacity, layer.effectiveMask);
    }
    return out;
  }

  resizeImage(width: number, height: number, mode: "nearest" | "bilinear" = "bilinear"): void {
    const ow = this.width;
    const oh = this.height;
    for (const layer of this.layers) {
      layer.buffer = layer.buffer.resize(width, height, mode);
      if (layer.mask) {
        const mb = PixelBuffer.create(ow, oh);
        for (let i = 0; i < layer.mask.length; i++) mb.data[i * 4 + 3] = layer.mask[i];
        const resized = mb.resize(width, height, mode);
        const m = new Uint8Array(width * height);
        for (let i = 0; i < m.length; i++) m[i] = resized.data[i * 4 + 3];
        layer.mask = m;
      }
    }
    this.dirty = true;
  }

  resizeCanvas(width: number, height: number, ox: number, oy: number): void {
    for (const layer of this.layers) {
      layer.resize(width, height, ox, oy, Colors.transparent);
    }
    this.dirty = true;
  }

  transform(kind: "rotate90cw" | "rotate90ccw" | "rotate180" | "flipH" | "flipV"): void {
    for (const layer of this.layers) {
      switch (kind) {
        case "rotate90cw":
          layer.buffer = layer.buffer.rotate90(1);
          break;
        case "rotate90ccw":
          layer.buffer = layer.buffer.rotate90(-1);
          break;
        case "rotate180":
          layer.buffer = layer.buffer.rotate180();
          break;
        case "flipH":
          layer.buffer = layer.buffer.flip(true, false);
          break;
        case "flipV":
          layer.buffer = layer.buffer.flip(false, true);
          break;
      }
      layer.mask = null;
    }
    this.dirty = true;
  }

  clone(): PdDocument {
    const doc = new PdDocument(this.width, this.height, {
      name: this.name,
      dpi: this.dpi,
      background: this.background,
    });
    doc.layers = this.layers.map((l) => l.clone());
    doc.activeLayerId = this.activeLayerId;
    // remap active id to cloned layer with same name/index
    const idx = this.activeIndex;
    if (idx >= 0) doc.activeLayerId = doc.layers[idx].id;
    doc.dirty = this.dirty;
    return doc;
  }
}

export function backgroundColor(kind: BackgroundKind): Color {
  if (kind === "Black") return Colors.black;
  if (kind === "Transparent") return Colors.transparent;
  return Colors.white;
}

export function nextLayerName(layers: Layer[]): string {
  let n = layers.length;
  let name = `Layer ${n}`;
  const names = new Set(layers.map((l) => l.name));
  while (names.has(name)) {
    n += 1;
    name = `Layer ${n}`;
  }
  return name;
}

export function createBlankSelection(doc: PdDocument): Selection {
  return new Selection(doc.width, doc.height);
}
