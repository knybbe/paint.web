import { PdDocument } from "./document";
import { Layer } from "./layer";
import { PixelBuffer } from "./pixel-buffer";
import { documentToPdnWeb, isNativePdn, isPdnWeb, pdnWebToDocument, PDNWEB_EXT, type PdnWebFile } from "./pdn";
import { Colors } from "./color";

export type SaveFormat = "png" | "jpeg" | "bmp" | "gif" | "webp" | "pdnweb";

export interface FileHandleLike {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: Blob | BufferSource | string): Promise<void>; close(): Promise<void> }>;
}

export async function decodeImageFile(file: File): Promise<PdDocument> {
  const name = file.name || "Untitled.png";
  if (name.toLowerCase().endsWith(PDNWEB_EXT) || file.type === "application/json" || file.type === "application/x-paint-web") {
    const text = await file.text();
    if (isPdnWeb(text)) return pdnWebToDocument(JSON.parse(text) as PdnWebFile);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (isNativePdn(bytes)) {
    throw new Error(
      "Native Paint.NET .pdn files are a proprietary .NET binary format and cannot be opened. Save a flattened PNG from Paint.NET, or use paint.web's .pdnweb layered format.",
    );
  }
  if (looksLikePdnWebJson(bytes)) {
    const text = new TextDecoder().decode(bytes);
    if (isPdnWeb(text)) return pdnWebToDocument(JSON.parse(text) as PdnWebFile);
  }
  const bitmap = await decodeToImage(file, bytes);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();
  const buf = PixelBuffer.fromImageData(ctx.getImageData(0, 0, canvas.width, canvas.height));
  const doc = new PdDocument(buf.width, buf.height, { name, background: "Transparent" });
  doc.layers = [Layer.fromBuffer(buf, "Background")];
  doc.activeLayerId = doc.layers[0].id;
  return doc;
}

function looksLikePdnWebJson(bytes: Uint8Array): boolean {
  const n = Math.min(bytes.length, 64);
  let s = "";
  for (let i = 0; i < n; i++) s += String.fromCharCode(bytes[i]);
  return s.includes("pdnweb") || s.trimStart().startsWith("{");
}

async function decodeToImage(file: File, bytes: Uint8Array): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file);
  } catch {
    /* try data URL */
  }
  if (isBmp(bytes)) {
    const buf = decodeBmp(bytes);
    const c = document.createElement("canvas");
    c.width = buf.width;
    c.height = buf.height;
    c.getContext("2d")!.putImageData(buf.asImageData(), 0, 0);
    return createImageBitmap(c);
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not decode ${file.name}`));
    };
    img.src = url;
  });
}

export async function encodeDocument(doc: PdDocument, format: SaveFormat, quality = 0.92): Promise<Blob> {
  if (format === "pdnweb") {
    const json = JSON.stringify(await documentToPdnWeb(doc));
    return new Blob([json], { type: "application/json" });
  }
  const flat = doc.composite();
  if (format === "bmp") return encodeBmp(flat);
  if (format === "gif") return encodeGif(flat);

  const canvas = document.createElement("canvas");
  canvas.width = flat.width;
  canvas.height = flat.height;
  const ctx = canvas.getContext("2d")!;
  if (format === "jpeg") {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.putImageData(flat.asImageData(), 0, 0);
  const mime = format === "jpeg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality));
  if (!blob) throw new Error("Encode failed");
  return blob;
}

export function extensionFor(format: SaveFormat): string {
  if (format === "jpeg") return ".jpg";
  if (format === "pdnweb") return ".pdnweb";
  return `.${format}`;
}

export function formatFromName(name: string): SaveFormat {
  const n = name.toLowerCase();
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "jpeg";
  if (n.endsWith(".bmp")) return "bmp";
  if (n.endsWith(".gif")) return "gif";
  if (n.endsWith(".webp")) return "webp";
  if (n.endsWith(".pdnweb")) return "pdnweb";
  return "png";
}

export function downloadBlob(blob: Blob, filename: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export async function pickOpenFiles(): Promise<File[]> {
  const anyWin = window as unknown as {
    showOpenFilePicker?: (opts: unknown) => Promise<FileHandleLike[]>;
  };
  if (typeof anyWin.showOpenFilePicker === "function") {
    try {
      const handles = await anyWin.showOpenFilePicker({
        multiple: true,
        types: [
          {
            description: "Images",
            accept: {
              "image/*": [".png", ".jpg", ".jpeg", ".bmp", ".gif", ".webp", ".tif", ".tiff"],
              "application/json": [".pdnweb", ".json"],
            },
          },
        ],
      });
      const files: File[] = [];
      for (const h of handles) files.push(await h.getFile());
      return files;
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return [];
      throw e;
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,.pdnweb,.pdn,.json";
    input.multiple = true;
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.click();
  });
}

export async function pickSaveFile(
  suggestedName: string,
  format: SaveFormat,
): Promise<FileHandleLike | null> {
  const anyWin = window as unknown as {
    showSaveFilePicker?: (opts: unknown) => Promise<FileHandleLike>;
  };
  if (typeof anyWin.showSaveFilePicker !== "function") return null;
  const ext = extensionFor(format);
  const mime =
    format === "jpeg"
      ? "image/jpeg"
      : format === "bmp"
        ? "image/bmp"
        : format === "gif"
          ? "image/gif"
          : format === "webp"
            ? "image/webp"
            : format === "pdnweb"
              ? "application/json"
              : "image/png";
  try {
    return await anyWin.showSaveFilePicker({
      suggestedName: suggestedName.endsWith(ext) ? suggestedName : suggestedName.replace(/\.[^.]+$/, "") + ext,
      types: [{ description: format.toUpperCase(), accept: { [mime]: [ext] } }],
    });
  } catch (e) {
    if ((e as DOMException).name === "AbortError") return null;
    throw e;
  }
}

function isBmp(bytes: Uint8Array): boolean {
  return bytes.length > 14 && bytes[0] === 0x42 && bytes[1] === 0x4d;
}

export function decodeBmp(bytes: Uint8Array): PixelBuffer {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dataOff = view.getUint32(10, true);
  const dib = view.getUint32(14, true);
  const w = view.getInt32(18, true);
  const hRaw = view.getInt32(22, true);
  const h = Math.abs(hRaw);
  const bpp = view.getUint16(28, true);
  const comp = view.getUint32(30, true);
  if (bpp !== 24 && bpp !== 32) throw new Error("Only 24/32-bit BMP is supported");
  if (comp !== 0) throw new Error("Compressed BMP is not supported");
  const bottomUp = hRaw > 0;
  const rowBytes = Math.floor((bpp * w + 31) / 32) * 4;
  const buf = PixelBuffer.create(w, h, Colors.transparent);
  for (let y = 0; y < h; y++) {
    const srcY = bottomUp ? h - 1 - y : y;
    const row = dataOff + srcY * rowBytes;
    for (let x = 0; x < w; x++) {
      if (bpp === 24) {
        const i = row + x * 3;
        buf.setPixel(x, y, { r: bytes[i + 2], g: bytes[i + 1], b: bytes[i], a: 255 });
      } else {
        const i = row + x * 4;
        const a = dib >= 56 ? bytes[i + 3] : 255;
        buf.setPixel(x, y, { r: bytes[i + 2], g: bytes[i + 1], b: bytes[i], a });
      }
    }
  }
  return buf;
}

export function encodeBmp(buf: PixelBuffer): Blob {
  const w = buf.width;
  const h = buf.height;
  const rowBytes = Math.floor((24 * w + 31) / 32) * 4;
  const pixelSize = rowBytes * h;
  const fileSize = 54 + pixelSize;
  const bytes = new Uint8Array(fileSize);
  const view = new DataView(bytes.buffer);
  bytes[0] = 0x42;
  bytes[1] = 0x4d;
  view.setUint32(2, fileSize, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, w, true);
  view.setInt32(22, h, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(34, pixelSize, true);
  for (let y = 0; y < h; y++) {
    const destY = h - 1 - y;
    const row = 54 + destY * rowBytes;
    for (let x = 0; x < w; x++) {
      const c = buf.getPixel(x, y);
      const i = row + x * 3;
      bytes[i] = c.b;
      bytes[i + 1] = c.g;
      bytes[i + 2] = c.r;
    }
  }
  return new Blob([bytes], { type: "image/bmp" });
}

/** Single-frame GIF87a (no animation, 256-color median-cut-ish palette). */
export function encodeGif(buf: PixelBuffer): Blob {
  const w = buf.width;
  const h = buf.height;
  const { palette, index } = quantize256(buf);
  const bits = 8;
  const out: number[] = [];
  const pushStr = (s: string) => {
    for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
  };
  pushStr("GIF87a");
  out.push(w & 255, (w >> 8) & 255, h & 255, (h >> 8) & 255);
  out.push(0x80 | (bits - 1) | ((bits - 1) << 4), 0, 0);
  for (let i = 0; i < 256; i++) {
    const c = palette[i] ?? { r: 0, g: 0, b: 0 };
    out.push(c.r, c.g, c.b);
  }
  out.push(0x2c, 0, 0, 0, 0, w & 255, (w >> 8) & 255, h & 255, (h >> 8) & 255, 0);
  const lzw = lzwEncode(index, 8);
  out.push(8);
  for (let i = 0; i < lzw.length; i += 255) {
    const chunk = lzw.subarray(i, i + 255);
    out.push(chunk.length);
    for (let j = 0; j < chunk.length; j++) out.push(chunk[j]);
  }
  out.push(0, 0x3b);
  return new Blob([new Uint8Array(out)], { type: "image/gif" });
}

function quantize256(buf: PixelBuffer): { palette: { r: number; g: number; b: number }[]; index: Uint8Array } {
  const palette: { r: number; g: number; b: number }[] = [];
  const map = new Map<number, number>();
  const index = new Uint8Array(buf.width * buf.height);
  for (let i = 0, p = 0; i < buf.data.length; i += 4, p++) {
    const r = buf.data[i] & 0xe0;
    const g = buf.data[i + 1] & 0xe0;
    const b = buf.data[i + 2] & 0xc0;
    const key = (r << 16) | (g << 8) | b;
    let idx = map.get(key);
    if (idx === undefined) {
      if (palette.length < 256) {
        idx = palette.length;
        palette.push({ r: buf.data[i], g: buf.data[i + 1], b: buf.data[i + 2] });
        map.set(key, idx);
      } else {
        idx = 0;
      }
    }
    index[p] = idx;
  }
  while (palette.length < 256) palette.push({ r: 0, g: 0, b: 0 });
  return { palette, index };
}

function lzwEncode(index: Uint8Array, minCode: number): Uint8Array {
  const clear = 1 << minCode;
  const eoi = clear + 1;
  let codeSize = minCode + 1;
  let nextCode = eoi + 1;
  const dict = new Map<string, number>();
  for (let i = 0; i < clear; i++) dict.set(String.fromCharCode(i), i);

  const bits: number[] = [];
  let acc = 0;
  let nbits = 0;
  const write = (code: number) => {
    acc |= code << nbits;
    nbits += codeSize;
    while (nbits >= 8) {
      bits.push(acc & 255);
      acc >>= 8;
      nbits -= 8;
    }
  };

  write(clear);
  let w = String.fromCharCode(index[0] ?? 0);
  for (let i = 1; i < index.length; i++) {
    const c = String.fromCharCode(index[i]);
    const wc = w + c;
    if (dict.has(wc)) w = wc;
    else {
      write(dict.get(w)!);
      if (nextCode < 4096) {
        dict.set(wc, nextCode++);
        if (nextCode > 1 << codeSize && codeSize < 12) codeSize++;
      }
      w = c;
    }
  }
  write(dict.get(w)!);
  write(eoi);
  if (nbits > 0) bits.push(acc & 255);
  return new Uint8Array(bits);
}
