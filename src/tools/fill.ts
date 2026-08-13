import { type Color, lerpColor } from "../core/color";
import { floodMask, fillMask, sampleSource } from "../core/flood-fill";
import { drawNub } from "../core/renderer";
import type { Point } from "../core/geometry";
import { type Tool, type ToolContext, type ToolPointer, paintColor, pushSnapshot, snapshotLayer } from "./base";

export const paintBucket: Tool = {
  id: "paintBucket",
  name: "Paint Bucket",
  shortcut: "F",
  group: "fill",
  cursor: "crosshair",
  pointerDown(e, ctx) {
    if (ctx.document.activeLayer.locked) return;
    const snap = snapshotLayer(ctx);
    const x = e.imageX | 0;
    const y = e.imageY | 0;
    const merged = ctx.document.composite();
    const src = sampleSource(merged, ctx.document.activeLayer.buffer, ctx.options.sampleMode === "image");
    const contiguous = e.shiftKey ? ctx.options.floodMode === "global" : ctx.options.floodMode === "contiguous";
    const mask = floodMask(
      src,
      x,
      y,
      { tolerance: ctx.options.tolerance, contiguous, sampleMerged: ctx.options.sampleMode === "image" },
      ctx.selection.empty ? undefined : ctx.selection,
    );
    fillMask(ctx.document.activeLayer.buffer, mask, paintColor(e, ctx), ctx.selection.empty ? undefined : ctx.selection);
    pushSnapshot(ctx, "Fill", "paintBucket", snap);
  },
  pointerMove() {},
  pointerUp() {},
};

interface GradDrag {
  a: Point;
  b: Point;
  button: number;
  committed: boolean;
}

export const gradientTool: Tool = (() => {
  let drag: GradDrag | null = null;
  let snap: ReturnType<typeof snapshotLayer> | null = null;

  const tool: Tool = {
    id: "gradient",
    name: "Gradient",
    shortcut: "G",
    group: "fill",
    cursor: "crosshair",
    pointerDown(e, ctx) {
      if (ctx.document.activeLayer.locked) return;
      if (drag && !drag.committed) {
        const nub = hitNub(e, drag, ctx);
        if (nub === "a" || nub === "b") {
          (tool as unknown as { _nub: "a" | "b" })._nub = nub;
          return;
        }
        if (nub === "move") {
          (tool as unknown as { _nub: "move"; _last: Point })._nub = "move";
          (tool as unknown as { _last: Point })._last = { x: e.imageX, y: e.imageY };
          return;
        }
        if (e.button === 2) {
          const t = drag.a;
          drag.a = drag.b;
          drag.b = t;
          preview(ctx);
          return;
        }
      }
      snap = snapshotLayer(ctx);
      drag = { a: { x: e.imageX, y: e.imageY }, b: { x: e.imageX, y: e.imageY }, button: e.button, committed: false };
    },
    pointerMove(e, ctx) {
      if (!drag) return;
      const nub = (tool as unknown as { _nub?: "a" | "b" | "move" })._nub;
      if (nub === "a") drag.a = { x: e.imageX, y: e.imageY };
      else if (nub === "b") drag.b = { x: e.imageX, y: e.imageY };
      else if (nub === "move") {
        const last = (tool as unknown as { _last: Point })._last;
        const dx = e.imageX - last.x;
        const dy = e.imageY - last.y;
        drag.a.x += dx;
        drag.a.y += dy;
        drag.b.x += dx;
        drag.b.y += dy;
        (tool as unknown as { _last: Point })._last = { x: e.imageX, y: e.imageY };
      } else {
        drag.b = { x: e.imageX, y: e.imageY };
      }
      preview(ctx);
    },
    pointerUp(_e, ctx) {
      (tool as unknown as { _nub?: string })._nub = undefined;
      if (drag) preview(ctx);
    },
    commit(ctx) {
      if (snap && drag) {
        preview(ctx);
        pushSnapshot(ctx, "Gradient", "gradient", snap);
      }
      drag = null;
      snap = null;
    },
    cancel(ctx) {
      if (snap) {
        const layer = ctx.document.layerById(snap.id);
        if (layer) layer.buffer.data.set(snap.data);
        ctx.compositor.invalidate();
        ctx.notify("document");
      }
      drag = null;
      snap = null;
    },
    keyDown(e, ctx) {
      if (e.key === "Enter" && drag) {
        tool.commit?.(ctx);
        return true;
      }
      if (e.key === "Escape" && drag) {
        tool.cancel?.(ctx);
        return true;
      }
      return false;
    },
    drawOverlay(c, vp) {
      if (!drag) return;
      const a = vp.imageToScreen(drag.a.x, drag.a.y);
      const b = vp.imageToScreen(drag.b.x, drag.b.y);
      c.save();
      c.strokeStyle = "#000";
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
      c.stroke();
      c.strokeStyle = "#fff";
      c.setLineDash([4, 4]);
      c.stroke();
      drawNub(c, a.x, a.y);
      drawNub(c, b.x, b.y);
      c.restore();
    },
    reset() {
      drag = null;
      snap = null;
    },
  };
  return tool;

  function preview(ctx: ToolContext) {
    if (!drag || !snap) return;
    const layer = ctx.document.layerById(snap.id);
    if (!layer) return;
    layer.buffer.data.set(snap.data);
    const c0 = drag.button === 2 ? ctx.secondary : ctx.primary;
    const c1 = drag.button === 2 ? ctx.primary : ctx.secondary;
    applyGradient(layer.buffer, drag.a, drag.b, c0, c1, ctx);
    ctx.compositor.invalidate();
    ctx.notify("document");
    ctx.notify("overlay");
  }
})();

function hitNub(e: ToolPointer, drag: GradDrag, ctx: ToolContext): "a" | "b" | "move" | null {
  const tol = 8 / ctx.viewport.zoom;
  if (Math.hypot(e.imageX - drag.a.x, e.imageY - drag.a.y) <= tol) return "a";
  if (Math.hypot(e.imageX - drag.b.x, e.imageY - drag.b.y) <= tol) return "b";
  const mx = (drag.a.x + drag.b.x) / 2;
  const my = (drag.a.y + drag.b.y) / 2;
  if (Math.hypot(e.imageX - mx, e.imageY - my) <= tol * 1.4) return "move";
  return null;
}

function applyGradient(
  buf: import("../core/pixel-buffer").PixelBuffer,
  a: Point,
  b: Point,
  c0: Color,
  c1: Color,
  ctx: ToolContext,
): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  const type = ctx.options.gradientType;
  const sel = ctx.selection.empty ? null : ctx.selection;
  for (let y = 0; y < buf.height; y++) {
    for (let x = 0; x < buf.width; x++) {
      if (sel && !sel.allows(x, y)) continue;
      const px = x + 0.5 - a.x;
      const py = y + 0.5 - a.y;
      let t: number;
      if (type === "linear") {
        t = (px * dx + py * dy) / len2;
      } else if (type === "radial") {
        t = Math.hypot(px, py) / Math.sqrt(len2);
      } else if (type === "diamond") {
        const ang = Math.atan2(dy, dx);
        const ca = Math.cos(-ang);
        const sa = Math.sin(-ang);
        const rx = (px * ca - py * sa) / Math.sqrt(len2);
        const ry = (px * sa + py * ca) / Math.sqrt(len2);
        t = Math.abs(rx) + Math.abs(ry);
      } else {
        const ang0 = Math.atan2(dy, dx);
        let ang = Math.atan2(py, px) - ang0;
        if (ang < 0) ang += Math.PI * 2;
        t = ang / (Math.PI * 2);
      }
      t = Math.max(0, Math.min(1, t));
      let color = lerpColor(c0, c1, t);
      if (ctx.options.gradientAlphaOnly) {
        const cur = buf.getPixel(x, y);
        color = { r: cur.r, g: cur.g, b: cur.b, a: color.a };
      }
      buf.blendOver(x, y, color);
    }
  }
}
