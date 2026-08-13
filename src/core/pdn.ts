import type { BlendMode } from "./blend";
import { BLEND_MODES } from "./blend";
import { PdDocument } from "./document";
import { Layer } from "./layer";
import { PixelBuffer } from "./pixel-buffer";

export const PDNWEB_MIME = "application/x-paint-web";
export const PDNWEB_EXT = ".pdnweb";

export interface PdnWebLayer {
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: BlendMode;
  png: string;
  mask?: string;
}

export interface PdnWebFile {
  format: "pdnweb";
  version: 1;
  name: string;
  width: number;
  height: number;
  dpi: number;
  background: PdDocument["background"];
  activeLayer: number;
  layers: PdnWebLayer[];
}

export async function documentToPdnWeb(doc: PdDocument): Promise<PdnWebFile> {
  const layers: PdnWebLayer[] = [];
  for (const layer of doc.layers) {
    const png = await bufferToPngDataUrl(layer.buffer);
    const rec: PdnWebLayer = {
      name: layer.name,
      visible: layer.visible,
      locked: layer.locked,
      opacity: layer.opacity,
      blendMode: layer.blendMode,
      png,
    };
    if (layer.mask) rec.mask = bytesToB64(layer.mask);
    layers.push(rec);
  }
  return {
    format: "pdnweb",
    version: 1,
    name: doc.name,
    width: doc.width,
    height: doc.height,
    dpi: doc.dpi,
    background: doc.background,
    activeLayer: Math.max(0, doc.activeIndex),
    layers,
  };
}

export async function pdnWebToDocument(data: PdnWebFile): Promise<PdDocument> {
  const doc = new PdDocument(data.width, data.height, {
    name: data.name || "Untitled.pdnweb",
    dpi: data.dpi || 96,
    background: data.background ?? "Transparent",
  });
  doc.layers = [];
  for (const rec of data.layers) {
    const buf = await pngDataUrlToBuffer(rec.png);
    const layer = Layer.fromBuffer(buf, rec.name);
    layer.visible = rec.visible;
    layer.locked = rec.locked;
    layer.opacity = rec.opacity;
    layer.blendMode = BLEND_MODES.includes(rec.blendMode) ? rec.blendMode : "Normal";
    if (rec.mask) layer.mask = b64ToBytes(rec.mask);
    doc.layers.push(layer);
  }
  if (!doc.layers.length) {
    doc.layers.push(new Layer(data.width, data.height, "Background"));
  }
  const idx = Math.min(data.activeLayer ?? doc.layers.length - 1, doc.layers.length - 1);
  doc.activeLayerId = doc.layers[idx].id;
  return doc;
}

export function isPdnWeb(text: string): boolean {
  try {
    const j = JSON.parse(text) as { format?: string };
    return j.format === "pdnweb";
  } catch {
    return false;
  }
}

async function bufferToPngDataUrl(buf: PixelBuffer): Promise<string> {
  if (typeof document === "undefined") {
    return `data:application/x-raw-rgba;base64,${bytesToB64(new Uint8Array(buf.data))}`;
  }
  const c = document.createElement("canvas");
  c.width = buf.width;
  c.height = buf.height;
  c.getContext("2d")!.putImageData(buf.asImageData(), 0, 0);
  return c.toDataURL("image/png");
}

async function pngDataUrlToBuffer(url: string): Promise<PixelBuffer> {
  if (url.startsWith("data:application/x-raw-rgba")) {
    throw new Error("Raw RGBA payload requires width/height context");
  }
  const img = await loadImage(url);
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  return PixelBuffer.fromImageData(ctx.getImageData(0, 0, img.width, img.height));
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode PNG layer"));
    img.src = url;
  });
}

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Native Paint.NET .pdn files are a .NET binary serialization.
 * We detect the header and reject with a clear message rather than silently
 * corrupting the document.
 */
export function isNativePdn(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  const ascii = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  return ascii === "PDN3" || ascii.startsWith("PDN");
}
