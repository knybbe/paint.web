import { drawNub } from "../core/renderer";
import { PixelBuffer } from "../core/pixel-buffer";
import { snapshotBytes, restoreBytes } from "../core/pixel-buffer";
import type { Point, Rect } from "../core/geometry";
import { clamp, rotatePoint } from "../core/geometry";
import { Colors } from "../core/color";
import type { Tool, ToolContext, ToolPointer } from "./base";

type Handle = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | "rotate" | null;

interface MoveDrag {
  handle: Handle;
  start: Point;
  origBounds: Rect;
  copy: boolean;
  angle0: number;
  pixels?: PixelBuffer;
  hole?: Uint8ClampedArray;
  layerId?: string;
}

function hitHandle(p: Point, b: Rect, zoom: number): Handle {
  const handles: { id: Handle; x: number; y: number }[] = [
    { id: "nw", x: b.x, y: b.y },
    { id: "n", x: b.x + b.w / 2, y: b.y },
    { id: "ne", x: b.x + b.w, y: b.y },
    { id: "e", x: b.x + b.w, y: b.y + b.h / 2 },
    { id: "se", x: b.x + b.w, y: b.y + b.h },
    { id: "s", x: b.x + b.w / 2, y: b.y + b.h },
    { id: "sw", x: b.x, y: b.y + b.h },
    { id: "w", x: b.x, y: b.h / 2 + b.y },
  ];
  const tol = 8 / zoom;
  for (const h of handles) {
    if (Math.hypot(p.x - h.x, p.y - h.y) <= tol) return h.id;
  }
  if (p.x >= b.x && p.y >= b.y && p.x <= b.x + b.w && p.y <= b.y + b.h) return "move";
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  if (Math.hypot(p.x - cx, p.y - cy) > Math.max(b.w, b.h) * 0.4) return "rotate";
  return null;
}

function transformRect(b: Rect, handle: Handle, dx: number, dy: number, shift: boolean, alt: boolean): Rect {
  let { x, y, w, h } = b;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const apply = (nx: number, ny: number, nw: number, nh: number) => {
    if (shift && nw && nh) {
      const s = Math.min(Math.abs(nw / b.w), Math.abs(nh / b.h));
      nw = b.w * s * Math.sign(nw || 1);
      nh = b.h * s * Math.sign(nh || 1);
    }
    if (alt) {
      return { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh };
    }
    return { x: nx, y: ny, w: nw, h: nh };
  };
  switch (handle) {
    case "move":
      return { x: x + dx, y: y + dy, w, h };
    case "e":
      return apply(x, y, w + dx, h);
    case "w":
      return apply(x + dx, y, w - dx, h);
    case "s":
      return apply(x, y, w, h + dy);
    case "n":
      return apply(x, y + dy, w, h - dy);
    case "se":
      return apply(x, y, w + dx, h + dy);
    case "nw":
      return apply(x + dx, y + dy, w - dx, h - dy);
    case "ne":
      return apply(x, y + dy, w + dx, h - dy);
    case "sw":
      return apply(x + dx, y, w - dx, h + dy);
    default:
      return b;
  }
}

export const moveSelection: Tool = {
  id: "moveSelection",
  name: "Move Selection",
  shortcut: "M",
  group: "move",
  cursor: "move",
  pointerDown(e, ctx) {
    const b = ctx.selection.bounds;
    if (!b) return;
    const handle = e.button === 2 ? "rotate" : hitHandle({ x: e.imageX, y: e.imageY }, b, ctx.viewport.zoom);
    if (!handle) return;
    (this as unknown as { _drag: MoveDrag })._drag = {
      handle,
      start: { x: e.imageX, y: e.imageY },
      origBounds: { ...b },
      copy: e.ctrlKey,
      angle0: Math.atan2(e.imageY - (b.y + b.h / 2), e.imageX - (b.x + b.w / 2)),
    };
  },
  pointerMove(e, ctx) {
    const drag = (this as unknown as { _drag?: MoveDrag })._drag;
    if (!drag) return;
    applySelectionTransform(ctx, drag, e);
  },
  pointerUp(e, ctx) {
    const drag = (this as unknown as { _drag?: MoveDrag })._drag;
    if (!drag) return;
    applySelectionTransform(ctx, drag, e);
    (this as unknown as { _drag?: MoveDrag })._drag = undefined;
    ctx.notify("selection");
  },
  keyDown(e, ctx) {
    if (!ctx.selection.bounds) return false;
    const step = e.ctrlKey ? 10 : 1;
    const map: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const d = map[e.key];
    if (!d) return false;
    ctx.selection.translate(d[0], d[1]);
    ctx.notify("selection");
    return true;
  },
  drawOverlay(c, vp) {
    /* handles drawn from canvas-view using selection bounds */
    void c;
    void vp;
  },
};

function applySelectionTransform(ctx: ToolContext, drag: MoveDrag, e: ToolPointer): void {
  const dx = e.imageX - drag.start.x;
  const dy = e.imageY - drag.start.y;
  const orig = ctx.selection.clone();
  if (drag.handle === "rotate") {
    const b = drag.origBounds;
    const origin = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    let ang = Math.atan2(e.imageY - origin.y, e.imageX - origin.x) - drag.angle0;
    if (e.shiftKey) ang = Math.round(ang / (Math.PI / 12)) * (Math.PI / 12);
    rotateSelection(ctx, orig, origin, ang);
  } else if (drag.handle === "move") {
    ctx.selection.mask = orig.mask ? new Uint8Array(orig.mask) : null;
    ctx.selection.translate(Math.round(dx), Math.round(dy));
  } else {
    const nb = transformRect(drag.origBounds, drag.handle, dx, dy, e.shiftKey, e.altKey);
    scaleSelection(ctx, orig, drag.origBounds, nb);
  }
  ctx.notify("selection");
}

function rotateSelection(ctx: ToolContext, orig: { mask: Uint8Array | null; width: number; height: number }, origin: Point, ang: number): void {
  const next = new Uint8Array(ctx.selection.width * ctx.selection.height);
  if (!orig.mask) return;
  for (let y = 0; y < ctx.selection.height; y++) {
    for (let x = 0; x < ctx.selection.width; x++) {
      const src = rotatePoint({ x: x + 0.5, y: y + 0.5 }, origin, -ang);
      const sx = Math.round(src.x - 0.5);
      const sy = Math.round(src.y - 0.5);
      if (sx < 0 || sy < 0 || sx >= orig.width || sy >= orig.height) continue;
      next[y * ctx.selection.width + x] = orig.mask[sy * orig.width + sx];
    }
  }
  ctx.selection.applyMask(next, "replace");
}

function scaleSelection(
  ctx: ToolContext,
  orig: { mask: Uint8Array | null; width: number; height: number },
  from: Rect,
  to: Rect,
): void {
  const next = new Uint8Array(ctx.selection.width * ctx.selection.height);
  if (!orig.mask || to.w === 0 || to.h === 0) {
    ctx.selection.applyMask(next, "replace");
    return;
  }
  for (let y = 0; y < ctx.selection.height; y++) {
    for (let x = 0; x < ctx.selection.width; x++) {
      const u = (x + 0.5 - to.x) / to.w;
      const v = (y + 0.5 - to.y) / to.h;
      if (u < 0 || v < 0 || u > 1 || v > 1) continue;
      const sx = Math.round(from.x + u * from.w - 0.5);
      const sy = Math.round(from.y + v * from.h - 0.5);
      if (sx < 0 || sy < 0 || sx >= orig.width || sy >= orig.height) continue;
      next[y * ctx.selection.width + x] = orig.mask[sy * orig.width + sx];
    }
  }
  ctx.selection.applyMask(next, "replace");
}

export const movePixels: Tool = {
  id: "movePixels",
  name: "Move Selected Pixels",
  shortcut: "M",
  group: "move",
  cursor: "move",
  pointerDown(e, ctx) {
    if (ctx.floating) {
      const b = ctx.selection.bounds;
      if (!b) return;
      const handle = e.button === 2 ? "rotate" : hitHandle({ x: e.imageX, y: e.imageY }, b, ctx.viewport.zoom) ?? "move";
      (this as unknown as { _drag: MoveDrag })._drag = {
        handle,
        start: { x: e.imageX, y: e.imageY },
        origBounds: { x: ctx.floating.x, y: ctx.floating.y, w: ctx.floating.buffer.width, h: ctx.floating.buffer.height },
        copy: true,
        angle0: 0,
      };
      return;
    }
    const layer = ctx.document.activeLayer;
    if (layer.locked) return;
    if (ctx.selection.empty) ctx.selection.selectAll();
    const b = ctx.selection.bounds;
    if (!b) return;
    const handle = e.button === 2 ? "rotate" : hitHandle({ x: e.imageX, y: e.imageY }, b, ctx.viewport.zoom) ?? "move";
    const pixels = PixelBuffer.create(b.w, b.h, Colors.transparent);
    const before = snapshotBytes(layer.buffer);
    for (let y = 0; y < b.h; y++) {
      for (let x = 0; x < b.w; x++) {
        if (!ctx.selection.contains(b.x + x, b.y + y)) continue;
        pixels.setPixel(x, y, layer.buffer.getPixel(b.x + x, b.y + y));
        if (!e.ctrlKey) layer.buffer.setPixel(b.x + x, b.y + y, Colors.transparent);
      }
    }
    (this as unknown as { _drag: MoveDrag })._drag = {
      handle,
      start: { x: e.imageX, y: e.imageY },
      origBounds: { ...b },
      copy: e.ctrlKey,
      angle0: Math.atan2(e.imageY - (b.y + b.h / 2), e.imageX - (b.x + b.w / 2)),
      pixels,
      hole: before,
      layerId: layer.id,
    };
    ctx.compositor.invalidate();
    ctx.notify("document");
  },
  pointerMove(e, ctx) {
    const drag = (this as unknown as { _drag?: MoveDrag })._drag;
    if (ctx.floating && drag) {
      ctx.placeFloating(
        Math.round(drag.origBounds.x + (e.imageX - drag.start.x)),
        Math.round(drag.origBounds.y + (e.imageY - drag.start.y)),
      );
      return;
    }
    if (!drag?.pixels || !drag.layerId || !drag.hole) return;
    const layer = ctx.document.layerById(drag.layerId);
    if (!layer) return;
    restoreBytes(layer.buffer, drag.hole);
    if (!drag.copy) {
      const b = drag.origBounds;
      for (let y = 0; y < b.h; y++) {
        for (let x = 0; x < b.w; x++) {
          if (!drag.pixels.getPixel(x, y).a) continue;
          layer.buffer.setPixel(b.x + x, b.y + y, Colors.transparent);
        }
      }
    }
    const dx = Math.round(e.imageX - drag.start.x);
    const dy = Math.round(e.imageY - drag.start.y);
    let dest: Rect = { ...drag.origBounds, x: drag.origBounds.x + dx, y: drag.origBounds.y + dy };
    if (drag.handle && drag.handle !== "move" && drag.handle !== "rotate") {
      dest = transformRect(drag.origBounds, drag.handle, e.imageX - drag.start.x, e.imageY - drag.start.y, e.shiftKey, e.altKey);
      dest = { x: Math.round(dest.x), y: Math.round(dest.y), w: Math.max(1, Math.round(dest.w)), h: Math.max(1, Math.round(dest.h)) };
      const scaled = drag.pixels.resize(dest.w, dest.h, "nearest");
      layer.buffer.blitOver(scaled, dest.x, dest.y);
    } else if (drag.handle === "rotate") {
      const origin = { x: drag.origBounds.x + drag.origBounds.w / 2, y: drag.origBounds.y + drag.origBounds.h / 2 };
      let ang = Math.atan2(e.imageY - origin.y, e.imageX - origin.x) - drag.angle0;
      if (e.shiftKey) ang = Math.round(ang / (Math.PI / 12)) * (Math.PI / 12);
      blitRotated(layer.buffer, drag.pixels, origin, drag.origBounds, ang);
    } else {
      layer.buffer.blitOver(drag.pixels, dest.x, dest.y);
    }
    applySelectionTransform(ctx, drag, e);
    ctx.compositor.invalidate();
    ctx.notify("document");
  },
  pointerUp(_e, ctx) {
    const drag = (this as unknown as { _drag?: MoveDrag })._drag;
    if (ctx.floating && drag) {
      (this as unknown as { _drag?: MoveDrag })._drag = undefined;
      ctx.notify("selection");
      return;
    }
    if (!drag?.hole || !drag.layerId) return;
    const layer = ctx.document.layerById(drag.layerId);
    if (layer) {
      const after = snapshotBytes(layer.buffer);
      const before = drag.hole;
      const id = drag.layerId;
      ctx.history.push({
        name: drag.copy ? "Clone Selection" : "Move Selected Pixels",
        icon: "movePixels",
        undo: () => {
          const l = ctx.document.layerById(id);
          if (l) restoreBytes(l.buffer, before);
        },
        redo: () => {
          const l = ctx.document.layerById(id);
          if (l) restoreBytes(l.buffer, after);
        },
      });
    }
    (this as unknown as { _drag?: MoveDrag })._drag = undefined;
    ctx.document.dirty = true;
    ctx.compositor.invalidate();
    ctx.notify("history");
    ctx.notify("document");
  },
  keyDown(e, ctx) {
    if (!ctx.selection.bounds) return false;
    const step = e.ctrlKey ? 10 : 1;
    const map: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const d = map[e.key];
    if (!d) return false;
    if (ctx.floating) {
      ctx.placeFloating(ctx.floating.x + d[0], ctx.floating.y + d[1]);
      return true;
    }
    const fake = {
      imageX: d[0],
      imageY: d[1],
      screenX: 0,
      screenY: 0,
      button: 0,
      buttons: 1,
      shiftKey: false,
      ctrlKey: false,
      altKey: false,
      pressure: 1,
    };
    this.pointerDown(
      { ...fake, imageX: ctx.selection.bounds.x + 1, imageY: ctx.selection.bounds.y + 1 },
      ctx,
    );
    const drag = (this as unknown as { _drag?: MoveDrag })._drag;
    if (drag) {
      this.pointerMove(
        {
          ...fake,
          imageX: drag.start.x + d[0],
          imageY: drag.start.y + d[1],
        },
        ctx,
      );
      this.pointerUp(fake, ctx);
    }
    return true;
  },
};

function blitRotated(dest: PixelBuffer, src: PixelBuffer, origin: Point, srcRect: Rect, ang: number): void {
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const ext = Math.ceil(Math.hypot(src.width, src.height));
  const x0 = clamp(Math.floor(origin.x - ext), 0, dest.width);
  const y0 = clamp(Math.floor(origin.y - ext), 0, dest.height);
  const x1 = clamp(Math.ceil(origin.x + ext), 0, dest.width);
  const y1 = clamp(Math.ceil(origin.y + ext), 0, dest.height);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const dx = x + 0.5 - origin.x;
      const dy = y + 0.5 - origin.y;
      const sx = dx * cos + dy * sin + origin.x - srcRect.x;
      const sy = -dx * sin + dy * cos + origin.y - srcRect.y;
      const ix = Math.round(sx);
      const iy = Math.round(sy);
      if (ix < 0 || iy < 0 || ix >= src.width || iy >= src.height) continue;
      const c = src.getPixel(ix, iy);
      if (c.a) dest.blendOver(x, y, c);
    }
  }
}

export function drawSelectionHandles(c: CanvasRenderingContext2D, bounds: Rect, vp: { imageToScreen(x: number, y: number): Point }): void {
  const pts: Point[] = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.w / 2, y: bounds.y },
    { x: bounds.x + bounds.w, y: bounds.y },
    { x: bounds.x + bounds.w, y: bounds.y + bounds.h / 2 },
    { x: bounds.x + bounds.w, y: bounds.y + bounds.h },
    { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h },
    { x: bounds.x, y: bounds.y + bounds.h },
    { x: bounds.x, y: bounds.y + bounds.h / 2 },
  ];
  for (const p of pts) {
    const s = vp.imageToScreen(p.x, p.y);
    drawNub(c, s.x, s.y);
  }
}

export const zoomTool: Tool = {
  id: "zoom",
  name: "Zoom",
  shortcut: "Z",
  group: "view",
  cursor: "zoom-in",
  pointerDown(e, ctx) {
    const around = { x: e.screenX, y: e.screenY };
    if (e.button === 2 || e.altKey) ctx.viewport.zoomOut(around);
    else ctx.viewport.zoomIn(around);
    ctx.notify("viewport");
  },
  pointerMove() {},
  pointerUp() {},
};

export const panTool: Tool = {
  id: "pan",
  name: "Pan",
  shortcut: "H",
  group: "view",
  cursor: "grab",
  pointerDown(e) {
    (this as unknown as { _last: Point })._last = { x: e.screenX, y: e.screenY };
  },
  pointerMove(e, ctx) {
    const last = (this as unknown as { _last?: Point })._last;
    if (!last) return;
    ctx.viewport.pan(e.screenX - last.x, e.screenY - last.y);
    (this as unknown as { _last: Point })._last = { x: e.screenX, y: e.screenY };
    ctx.notify("viewport");
  },
  pointerUp() {
    (this as unknown as { _last?: Point })._last = undefined;
  },
};
