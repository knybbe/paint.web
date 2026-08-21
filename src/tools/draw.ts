import { cloneStamp, drawAliasedLine, forEachStamp, recolorStamp, stampAlong, type StampOptions } from "../core/draw";
import type { Point } from "../core/geometry";
import { type Color } from "../core/color";
import { type Tool, type ToolContext, type ToolPointer, paintColor, pushSnapshot, snapshotLayer } from "./base";

function brushOpts(ctx: ToolContext, color: Color, erase: boolean, pressure: number): StampOptions {
  return {
    size: ctx.options.brushWidth,
    hardness: ctx.options.hardness,
    antialias: ctx.options.antialias,
    color,
    erase,
    pressure: ctx.options.pressure ? Math.max(0.05, pressure) : 1,
    selection: ctx.selection.empty ? undefined : ctx.selection,
  };
}

function makeStrokeTool(id: Tool["id"], name: string, shortcut: string, kind: "brush" | "eraser" | "pencil"): Tool {
  let last: Point | null = null;
  let snap: ReturnType<typeof snapshotLayer> | null = null;
  let button = 0;

  return {
    id,
    name,
    shortcut,
    group: "draw",
    cursor: "crosshair",
    pointerDown(e, ctx) {
      if (ctx.document.activeLayer.locked) return;
      snap = snapshotLayer(ctx);
      button = e.button;
      last = { x: e.imageX, y: e.imageY };
      paint(ctx, last, last, e);
      ctx.compositor.invalidate();
      ctx.notify("document");
    },
    pointerMove(e, ctx) {
      if (!last || !snap) return;
      const p = { x: e.imageX, y: e.imageY };
      paint(ctx, last, p, e);
      last = p;
      ctx.compositor.invalidate();
      ctx.notify("document");
    },
    pointerUp(_e, ctx) {
      if (snap) pushSnapshot(ctx, name, id, snap);
      last = null;
      snap = null;
    },
    cancel(ctx) {
      last = null;
      snap = null;
      ctx.notify("overlay");
    },
  };

  function paint(ctx: ToolContext, a: Point, b: Point, e: ToolPointer) {
    const layer = ctx.document.activeLayer;
    if (kind === "pencil") {
      const c = paintColor({ ...e, button }, ctx);
      drawAliasedLine(layer.buffer, a.x, a.y, b.x, b.y, c, ctx.selection.empty ? undefined : ctx.selection);
      return;
    }
    const color = paintColor({ ...e, button }, ctx);
    stampAlong(layer.buffer, a, b, brushOpts(ctx, color, kind === "eraser", e.pressure));
  }
}

export const paintbrush = makeStrokeTool("paintbrush", "Paintbrush", "B", "brush");
export const eraser = makeStrokeTool("eraser", "Eraser", "E", "eraser");
export const pencil = makeStrokeTool("pencil", "Pencil", "P", "pencil");

export const colorPicker: Tool = {
  id: "colorPicker",
  name: "Color Picker",
  shortcut: "K",
  group: "draw",
  cursor: "crosshair",
  pointerDown(e, ctx) {
    pick(e, ctx);
  },
  pointerMove(e, ctx) {
    if (e.buttons) pick(e, ctx);
  },
  pointerUp() {},
};

function pick(e: ToolPointer, ctx: ToolContext) {
  const x = e.imageX | 0;
  const y = e.imageY | 0;
  const src =
    ctx.options.sampleMode === "image" ? ctx.document.composite() : ctx.document.activeLayer.buffer;
  if (!src.inBounds(x, y)) return;
  const c = src.getPixel(x, y);
  if (e.button === 2) ctx.setSecondary(c);
  else ctx.setPrimary(c);
}

export const cloneStampTool: Tool = (() => {
  let source: Point | null = null;
  let last: Point | null = null;
  let snap: ReturnType<typeof snapshotLayer> | null = null;
  let offset: Point | null = null;

  return {
    id: "cloneStamp",
    name: "Clone Stamp",
    shortcut: "L",
    group: "draw",
    cursor: "crosshair",
    pointerDown(e, ctx) {
      if (e.ctrlKey) {
        source = { x: e.imageX, y: e.imageY };
        ctx.status("Clone source set");
        ctx.notify("overlay");
        return;
      }
      if (!source) {
        ctx.status("Ctrl+Click to set clone source");
        return;
      }
      if (ctx.document.activeLayer.locked) return;
      snap = snapshotLayer(ctx);
      last = { x: e.imageX, y: e.imageY };
      offset = { x: source.x - e.imageX, y: source.y - e.imageY };
      stamp(ctx, e);
    },
    pointerMove(e, ctx) {
      if (!snap || !last || !offset) return;
      const next = { x: e.imageX, y: e.imageY };
      const off = offset;
      forEachStamp(last, next, ctx.options.brushWidth, (pt) => {
        cloneStamp(ctx.document.activeLayer.buffer, ctx.options.sampleMode === "image" ? ctx.document.composite() : ctx.document.activeLayer.buffer, pt.x, pt.y, pt.x + off.x, pt.y + off.y, {
          size: ctx.options.brushWidth,
          hardness: ctx.options.hardness,
          antialias: ctx.options.antialias,
          color: ctx.primary,
          pressure: ctx.options.pressure ? e.pressure : 1,
          selection: ctx.selection.empty ? undefined : ctx.selection,
        });
      });
      last = next;
      ctx.compositor.invalidate();
      ctx.notify("document");
    },
    pointerUp(_e, ctx) {
      if (snap) pushSnapshot(ctx, "Clone Stamp", "cloneStamp", snap);
      snap = null;
      last = null;
      offset = null;
    },
    drawOverlay(c, vp) {
      if (!source) return;
      const s = vp.imageToScreen(source.x, source.y);
      c.save();
      c.strokeStyle = "#fff";
      c.beginPath();
      c.arc(s.x, s.y, 6, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = "#000";
      c.beginPath();
      c.moveTo(s.x - 8, s.y);
      c.lineTo(s.x + 8, s.y);
      c.moveTo(s.x, s.y - 8);
      c.lineTo(s.x, s.y + 8);
      c.stroke();
      c.restore();
    },
    reset() {
      source = null;
    },
  };

  function stamp(ctx: ToolContext, e: ToolPointer) {
    if (!last || !offset) return;
    const src = ctx.options.sampleMode === "image" ? ctx.document.composite() : ctx.document.activeLayer.buffer;
    cloneStamp(ctx.document.activeLayer.buffer, src, last.x, last.y, last.x + offset.x, last.y + offset.y, {
      size: ctx.options.brushWidth,
      hardness: ctx.options.hardness,
      antialias: ctx.options.antialias,
      color: ctx.primary,
      pressure: ctx.options.pressure ? e.pressure : 1,
      selection: ctx.selection.empty ? undefined : ctx.selection,
    });
    ctx.compositor.invalidate();
    ctx.notify("document");
  }
})();

export const recolorTool: Tool = (() => {
  let last: Point | null = null;
  let snap: ReturnType<typeof snapshotLayer> | null = null;
  let button = 0;

  return {
    id: "recolor",
    name: "Recolor",
    shortcut: "R",
    group: "draw",
    cursor: "crosshair",
    pointerDown(e, ctx) {
      if (ctx.document.activeLayer.locked) return;
      snap = snapshotLayer(ctx);
      last = { x: e.imageX, y: e.imageY };
      button = e.button;
      paint(ctx, e);
    },
    pointerMove(e, ctx) {
      if (!last) return;
      const next = { x: e.imageX, y: e.imageY };
      const sample = button === 2 ? ctx.primary : ctx.secondary;
      const replace = button === 2 ? ctx.secondary : ctx.primary;
      forEachStamp(last, next, ctx.options.brushWidth, (pt) => {
        recolorStamp(ctx.document.activeLayer.buffer, pt.x, pt.y, sample, replace, ctx.options.tolerance, {
          size: ctx.options.brushWidth,
          hardness: ctx.options.hardness,
          antialias: ctx.options.antialias,
          color: replace,
          pressure: ctx.options.pressure ? e.pressure : 1,
          selection: ctx.selection.empty ? undefined : ctx.selection,
        });
      });
      last = next;
      ctx.compositor.invalidate();
      ctx.notify("document");
    },
    pointerUp(_e, ctx) {
      if (snap) pushSnapshot(ctx, "Recolor", "recolor", snap);
      last = null;
      snap = null;
    },
  };

  function paint(ctx: ToolContext, e: ToolPointer) {
    if (!last) return;
    const sample = button === 2 ? ctx.primary : ctx.secondary;
    const replace = button === 2 ? ctx.secondary : ctx.primary;
    recolorStamp(ctx.document.activeLayer.buffer, last.x, last.y, sample, replace, ctx.options.tolerance, {
      size: ctx.options.brushWidth,
      hardness: ctx.options.hardness,
      antialias: ctx.options.antialias,
      color: replace,
      pressure: ctx.options.pressure ? e.pressure : 1,
      selection: ctx.selection.empty ? undefined : ctx.selection,
    });
    ctx.compositor.invalidate();
    ctx.notify("document");
  }
})();
