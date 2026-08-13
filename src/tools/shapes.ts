import { constrainSquare, cubicPoint, ellipsePoints, normalizeRect, roundedRectPoints, type Point, type Rect } from "../core/geometry";
import { drawNub } from "../core/renderer";
import { drawAliasedLine, stampCircle, strokeWidthLine } from "../core/draw";
import { type Color } from "../core/color";
import {
  type Tool,
  type ToolContext,
  type ToolId,
  type ToolPointer,
  oppositeColor,
  paintColor,
  pushSnapshot,
  snapshotLayer,
} from "./base";

interface ShapeDrag {
  start: Point;
  end: Point;
  square: boolean;
  button: number;
  points: Point[];
}

function paintShape(
  ctx: ToolContext,
  kind: "rect" | "ellipse" | "round" | "freeform",
  drag: ShapeDrag,
  color: Color,
  fillColor: Color,
): void {
  const buf = ctx.document.activeLayer.buffer;
  const sel = ctx.selection.empty ? undefined : ctx.selection;
  const mode = ctx.options.shapeMode;
  const width = ctx.options.brushWidth;
  const aa = ctx.options.antialias;

  const fillPts = (pts: Point[], c: Color) => {
    for (const p of pts) {
      if (sel && !sel.allows(p.x, p.y)) continue;
      if (buf.inBounds(p.x, p.y)) buf.setPixel(p.x, p.y, c);
    }
  };

  const strokePts = (pts: Point[], c: Color) => {
    for (const p of pts) {
      if (width <= 1 && !aa) {
        if (sel && !sel.allows(p.x, p.y)) continue;
        if (buf.inBounds(p.x, p.y)) buf.setPixel(p.x, p.y, c);
      } else {
        stampCircle(buf, p.x + 0.5, p.y + 0.5, {
          size: width,
          hardness: 1,
          antialias: aa,
          color: c,
          selection: sel,
        });
      }
    }
  };

  if (kind === "freeform") {
    if (mode !== "outline") fillPts(fillPolygonPts(drag.points, buf.width, buf.height), mode === "both" ? fillColor : color);
    if (mode !== "filled") {
      for (let i = 1; i < drag.points.length; i++) {
        strokeWidthLine(buf, drag.points[i - 1].x, drag.points[i - 1].y, drag.points[i].x, drag.points[i].y, {
          size: width,
          hardness: 1,
          antialias: aa,
          color: mode === "both" ? color : color,
          selection: sel,
        });
      }
    }
    return;
  }

  let end = drag.end;
  if (drag.square) end = constrainSquare(drag.start.x, drag.start.y, drag.end.x, drag.end.y);
  const r = normalizeRect(drag.start.x, drag.start.y, end.x, end.y);
  const fill =
    kind === "ellipse"
      ? ellipsePoints(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, true)
      : kind === "round"
        ? roundedRectPoints(r.x, r.y, r.w, r.h, ctx.options.cornerRadius, true)
        : rectFill(r);
  const stroke =
    kind === "ellipse"
      ? ellipsePoints(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, false)
      : kind === "round"
        ? roundedRectPoints(r.x, r.y, r.w, r.h, ctx.options.cornerRadius, false)
        : rectStroke(r);

  if (mode === "filled") fillPts(fill, color);
  else if (mode === "both") {
    fillPts(fill, fillColor);
    strokePts(stroke, color);
  } else strokePts(stroke, color);
}

function rectFill(r: Rect): Point[] {
  const pts: Point[] = [];
  const x0 = Math.round(r.x);
  const y0 = Math.round(r.y);
  const x1 = Math.round(r.x + r.w);
  const y1 = Math.round(r.y + r.h);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) pts.push({ x, y });
  return pts;
}

function rectStroke(r: Rect): Point[] {
  const pts: Point[] = [];
  const x0 = Math.round(r.x);
  const y0 = Math.round(r.y);
  const x1 = Math.round(r.x + r.w) - 1;
  const y1 = Math.round(r.y + r.h) - 1;
  for (let x = x0; x <= x1; x++) {
    pts.push({ x, y: y0 }, { x, y: y1 });
  }
  for (let y = y0; y <= y1; y++) {
    pts.push({ x: x0, y }, { x: x1, y });
  }
  return pts;
}

function fillPolygonPts(points: Point[], w: number, h: number): Point[] {
  const pts: Point[] = [];
  if (points.length < 3) return pts;
  const ys = points.map((p) => p.y);
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(h - 1, Math.ceil(Math.max(...ys)));
  for (let y = minY; y <= maxY; y++) {
    const nodes: number[] = [];
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const pi = points[i],
        pj = points[j];
      if ((pi.y < y && pj.y >= y) || (pj.y < y && pi.y >= y)) {
        nodes.push(pi.x + ((y - pi.y) / (pj.y - pi.y || 1)) * (pj.x - pi.x));
      }
    }
    nodes.sort((a, b) => a - b);
    for (let i = 0; i < nodes.length; i += 2) {
      const x0 = Math.max(0, Math.round(nodes[i]));
      const x1 = Math.min(w - 1, Math.round(nodes[i + 1] ?? nodes[i]));
      for (let x = x0; x <= x1; x++) pts.push({ x, y });
    }
  }
  return pts;
}

function makeShape(id: ToolId, name: string, kind: "rect" | "ellipse" | "round" | "freeform"): Tool {
  let drag: ShapeDrag | null = null;
  let snap: ReturnType<typeof snapshotLayer> | null = null;

  return {
    id,
    name,
    shortcut: "O",
    group: "shape",
    cursor: "crosshair",
    pointerDown(e, ctx) {
      if (ctx.document.activeLayer.locked) return;
      snap = snapshotLayer(ctx);
      drag = {
        start: { x: e.imageX, y: e.imageY },
        end: { x: e.imageX, y: e.imageY },
        square: e.shiftKey,
        button: e.button,
        points: [{ x: e.imageX, y: e.imageY }],
      };
    },
    pointerMove(e, ctx) {
      if (!drag || !snap) return;
      drag.end = { x: e.imageX, y: e.imageY };
      drag.square = e.shiftKey;
      if (kind === "freeform") drag.points.push({ x: e.imageX, y: e.imageY });
      const layer = ctx.document.layerById(snap.id);
      if (!layer) return;
      layer.buffer.data.set(snap.data);
      const c = paintColor({ ...e, button: drag.button }, ctx);
      const f = oppositeColor({ ...e, button: drag.button }, ctx);
      paintShape(ctx, kind, drag, c, f);
      ctx.compositor.invalidate();
      ctx.notify("document");
    },
    pointerUp(_e, ctx) {
      if (snap) pushSnapshot(ctx, name, id, snap);
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
  };
}

export const rectangleShape = makeShape("rectangle", "Rectangle", "rect");
export const roundedRectangleShape = makeShape("roundedRectangle", "Rounded Rectangle", "round");
export const ellipseShape = makeShape("ellipse", "Ellipse", "ellipse");
export const freeformShape = makeShape("freeform", "Freeform Shape", "freeform");

export const lineCurve: Tool = (() => {
  let points: Point[] = [];
  let snap: ReturnType<typeof snapshotLayer> | null = null;
  let dragging = -1;
  let button = 0;

  const tool: Tool = {
    id: "lineCurve",
    name: "Line / Curve",
    shortcut: "O",
    group: "shape",
    cursor: "crosshair",
    pointerDown(e, ctx) {
      if (ctx.document.activeLayer.locked) return;
      if (points.length >= 2) {
        const idx = hitCurveNub(e, points, ctx);
        if (idx >= 0) {
          dragging = idx;
          return;
        }
      }
      if (points.length === 0) {
        snap = snapshotLayer(ctx);
        button = e.button;
        points = [
          { x: e.imageX, y: e.imageY },
          { x: e.imageX, y: e.imageY },
        ];
      }
    },
    pointerMove(e, ctx) {
      if (!snap) return;
      if (dragging >= 0) points[dragging] = { x: e.imageX, y: e.imageY };
      else if (points.length === 2 && dragging < 0) points[1] = { x: e.imageX, y: e.imageY };
      preview(ctx);
    },
    pointerUp(e, ctx) {
      if (dragging >= 0) {
        dragging = -1;
        preview(ctx);
        return;
      }
      if (points.length === 2) {
        points[1] = { x: e.imageX, y: e.imageY };
        // add two interior nubs for cubic (Paint.NET style 4-nub curve)
        const a = points[0];
        const b = points[1];
        points = [
          a,
          { x: a.x + (b.x - a.x) / 3, y: a.y + (b.y - a.y) / 3 },
          { x: a.x + (2 * (b.x - a.x)) / 3, y: a.y + (2 * (b.y - a.y)) / 3 },
          b,
        ];
        preview(ctx);
      }
    },
    commit(ctx) {
      if (snap) {
        preview(ctx);
        pushSnapshot(ctx, "Line / Curve", "lineCurve", snap);
      }
      points = [];
      snap = null;
    },
    cancel(ctx) {
      if (snap) {
        const layer = ctx.document.layerById(snap.id);
        if (layer) layer.buffer.data.set(snap.data);
        ctx.compositor.invalidate();
        ctx.notify("document");
      }
      points = [];
      snap = null;
    },
    keyDown(e, ctx) {
      if (e.key === "Enter" && points.length) {
        tool.commit?.(ctx);
        return true;
      }
      if (e.key === "Escape") {
        tool.cancel?.(ctx);
        return true;
      }
      return false;
    },
    drawOverlay(c, vp) {
      if (points.length < 2) return;
      c.save();
      c.strokeStyle = "rgba(0,0,0,0.5)";
      c.setLineDash([3, 3]);
      c.beginPath();
      points.forEach((p, i) => {
        const s = vp.imageToScreen(p.x, p.y);
        if (i === 0) c.moveTo(s.x, s.y);
        else c.lineTo(s.x, s.y);
      });
      c.stroke();
      for (const p of points) {
        const s = vp.imageToScreen(p.x, p.y);
        drawNub(c, s.x, s.y);
      }
      c.restore();
    },
    reset() {
      points = [];
      snap = null;
    },
  };
  return tool;

  function preview(ctx: ToolContext) {
    if (!snap || points.length < 2) return;
    const layer = ctx.document.layerById(snap.id);
    if (!layer) return;
    layer.buffer.data.set(snap.data);
    const c = button === 2 ? ctx.secondary : ctx.primary;
    const sel = ctx.selection.empty ? undefined : ctx.selection;
    if (points.length === 2) {
      strokeWidthLine(layer.buffer, points[0].x, points[0].y, points[1].x, points[1].y, {
        size: ctx.options.brushWidth,
        hardness: 1,
        antialias: ctx.options.antialias,
        color: c,
        selection: sel,
      });
    } else {
      const p0 = points[0],
        p1 = points[1],
        p2 = points[2],
        p3 = points[3];
      let prev = p0;
      const steps = Math.max(16, Math.hypot(p3.x - p0.x, p3.y - p0.y) * 2);
      for (let i = 1; i <= steps; i++) {
        const pt = cubicPoint(p0, p1, p2, p3, i / steps);
        if (ctx.options.brushWidth <= 1 && !ctx.options.antialias) {
          drawAliasedLine(layer.buffer, prev.x, prev.y, pt.x, pt.y, c, sel);
        } else {
          strokeWidthLine(layer.buffer, prev.x, prev.y, pt.x, pt.y, {
            size: ctx.options.brushWidth,
            hardness: 1,
            antialias: ctx.options.antialias,
            color: c,
            selection: sel,
          });
        }
        prev = pt;
      }
    }
    ctx.compositor.invalidate();
    ctx.notify("document");
    ctx.notify("overlay");
  }
})();

function hitCurveNub(e: ToolPointer, points: Point[], ctx: ToolContext): number {
  const tol = 8 / ctx.viewport.zoom;
  for (let i = 0; i < points.length; i++) {
    if (Math.hypot(e.imageX - points[i].x, e.imageY - points[i].y) <= tol) return i;
  }
  return -1;
}

export const textTool: Tool = (() => {
  let pos: Point | null = null;
  let text = "";
  let snap: ReturnType<typeof snapshotLayer> | null = null;

  const tool: Tool = {
    id: "text",
    name: "Text",
    shortcut: "T",
    group: "text",
    cursor: "text",
    pointerDown(e, ctx) {
      if (pos && text) tool.commit?.(ctx);
      if (ctx.document.activeLayer.locked) return;
      snap = snapshotLayer(ctx);
      pos = { x: e.imageX, y: e.imageY };
      text = "";
      ctx.status("Type text, Enter to commit, Esc to cancel");
      ctx.notify("overlay");
    },
    pointerMove(e, ctx) {
      if (!pos || !snap) return;
      if (e.buttons) {
        pos = { x: e.imageX, y: e.imageY };
        preview(ctx);
      }
    },
    pointerUp() {},
    keyDown(e, ctx) {
      if (!pos) return false;
      if (e.key === "Escape") {
        tool.cancel?.(ctx);
        return true;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        tool.commit?.(ctx);
        return true;
      }
      if (e.key === "Backspace") {
        text = text.slice(0, -1);
        preview(ctx);
        return true;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        text += e.key;
        preview(ctx);
        return true;
      }
      return false;
    },
    commit(ctx) {
      if (snap && text) {
        preview(ctx);
        pushSnapshot(ctx, "Text", "text", snap);
      } else if (snap) {
        const layer = ctx.document.layerById(snap.id);
        if (layer) layer.buffer.data.set(snap.data);
      }
      pos = null;
      text = "";
      snap = null;
      ctx.compositor.invalidate();
      ctx.notify("document");
    },
    cancel(ctx) {
      if (snap) {
        const layer = ctx.document.layerById(snap.id);
        if (layer) layer.buffer.data.set(snap.data);
      }
      pos = null;
      text = "";
      snap = null;
      ctx.compositor.invalidate();
      ctx.notify("document");
    },
    drawOverlay(c, vp) {
      if (!pos) return;
      const s = vp.imageToScreen(pos.x, pos.y);
      c.save();
      c.strokeStyle = "#000";
      c.beginPath();
      c.moveTo(s.x, s.y);
      c.lineTo(s.x, s.y + ctxFontPx(vp));
      c.stroke();
      c.restore();
    },
    reset() {
      pos = null;
      text = "";
      snap = null;
    },
  };
  return tool;

  function ctxFontPx(vp: { zoom: number }): number {
    return 12 * vp.zoom;
  }

  function preview(ctx: ToolContext) {
    if (!snap || !pos) return;
    const layer = ctx.document.layerById(snap.id);
    if (!layer) return;
    layer.buffer.data.set(snap.data);
    if (!text) {
      ctx.compositor.invalidate();
      ctx.notify("document");
      return;
    }
    const c = document.createElement("canvas");
    c.width = layer.buffer.width;
    c.height = layer.buffer.height;
    const g = c.getContext("2d")!;
    g.clearRect(0, 0, c.width, c.height);
    const style = `${ctx.options.fontItalic ? "italic " : ""}${ctx.options.fontBold ? "bold " : ""}${ctx.options.fontSize}px ${ctx.options.fontFamily}`;
    g.font = style;
    g.fillStyle = `rgba(${ctx.primary.r},${ctx.primary.g},${ctx.primary.b},${ctx.primary.a / 255})`;
    g.textBaseline = "top";
    g.textAlign = ctx.options.fontAlign;
    g.imageSmoothingEnabled = ctx.options.antialias;
    g.fillText(text, pos.x, pos.y);
    const img = g.getImageData(0, 0, c.width, c.height);
    const sel = ctx.selection.empty ? null : ctx.selection;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        if (img.data[i + 3] === 0) continue;
        if (sel && !sel.allows(x, y)) continue;
        layer.buffer.blendOver(x, y, {
          r: img.data[i],
          g: img.data[i + 1],
          b: img.data[i + 2],
          a: img.data[i + 3],
        });
      }
    }
    ctx.compositor.invalidate();
    ctx.notify("document");
    ctx.notify("overlay");
  }
})();
