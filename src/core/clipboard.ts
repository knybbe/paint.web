import { PixelBuffer } from "./pixel-buffer";
import { Selection } from "./selection";
import type { PdDocument } from "./document";

export interface ClipboardPayload {
  buffer: PixelBuffer;
  mask: Uint8Array | null;
}

let memoryClip: ClipboardPayload | null = null;

export function setMemoryClipboard(payload: ClipboardPayload | null): void {
  memoryClip = payload;
}

export function getMemoryClipboard(): ClipboardPayload | null {
  return memoryClip;
}

export function extractSelection(doc: PdDocument, selection: Selection, merged: boolean): ClipboardPayload | null {
  const layer = doc.activeLayer;
  const src = merged ? doc.composite() : layer.buffer;
  if (selection.empty) {
    return { buffer: src.clone(), mask: null };
  }
  const b = selection.bounds;
  if (!b) return null;
  const buf = PixelBuffer.create(b.w, b.h);
  const mask = new Uint8Array(b.w * b.h);
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (!selection.contains(b.x + x, b.y + y)) continue;
      buf.setPixel(x, y, src.getPixel(b.x + x, b.y + y));
      mask[y * b.w + x] = 255;
    }
  }
  return { buffer: buf, mask };
}

export async function writeClipboardImage(buffer: PixelBuffer): Promise<void> {
  if (!getMemoryClipboard()) setMemoryClipboard({ buffer: buffer.clone(), mask: null });
  if (!navigator.clipboard || typeof ClipboardItem === "undefined") return;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = buffer.width;
    canvas.height = buffer.height;
    canvas.getContext("2d")!.putImageData(buffer.asImageData(), 0, 0);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) return;
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  } catch {
    /* permission or insecure context — memory clipboard still works */
  }
}

export async function readClipboardImage(): Promise<PixelBuffer | null> {
  if (navigator.clipboard && navigator.clipboard.read) {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (!type) continue;
        const blob = await item.getType(type);
        const bmp = await createImageBitmap(blob);
        const c = document.createElement("canvas");
        c.width = bmp.width;
        c.height = bmp.height;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(bmp, 0, 0);
        bmp.close();
        return PixelBuffer.fromImageData(ctx.getImageData(0, 0, c.width, c.height));
      }
    } catch {
      /* fall through */
    }
  }
  return memoryClip?.buffer.clone() ?? null;
}
