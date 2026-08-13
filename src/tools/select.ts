import { constrainSquare, ellipsePoints, normalizeRect, type Point } from "../core/geometry";
import { combineFromModifiers, type SelectionCombine } from "../core/selection";
import { floodMask, sampleSource } from "../core/flood-fill";
import type { Tool, ToolId } from "./base";

interface DragState {
  start: Point;
  current: Point;
  points: Point[];
  mode: SelectionCombine;
  square: boolean;
}

function makeSelectTool(id: ToolId, name: string, kind: "rect" | "ellipse" | "lasso"): Tool {
  let drag: DragState | null = null;

  return {
    id,
    name,
    shortcut: "S",
    group: "select",
    cursor: "crosshair",
    pointerDown(e, _ctx) {
      drag = {
        start: { x: e.imageX, y: e.imageY },
        current: { x: e.imageX, y: e.imageY },
        points: [{ x: e.imageX, y: e.imageY }],
        mode: combineFromModifiers(e),
        square: e.shiftKey,
      };
    },
    pointerMove(e) {
      if (!drag) return;
      drag.current = { x: e.imageX, y: e.imageY };
      drag.square = e.shiftKey;
      if (kind === "lasso") drag.points.push({ x: Math.round(e.imageX), y: Math.round(e.imageY) });
    },
    pointerUp(_e, ctx) {
      if (!drag) return;
      const d = drag;
      drag = null;
      if (kind === "lasso") {
        const filled = fillPolygon(d.points, ctx.document.width, ctx.document.height);
        ctx.selection.applyMask(filled, d.mode);
      } else {
        let end = d.current;
        if (d.square) end = constrainSquare(d.start.x, d.start.y, d.current.x, d.current.y);
        const r = normalizeRect(d.start.x, d.start.y, end.x, end.y);
        if (r.w < 1 && r.h < 1) {
          if (d.mode === "replace") ctx.selection.clear();
        } else if (kind === "rect") {
          ctx.selection.applyRect(r, d.mode);
        } else {
          const pts = ellipsePoints(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, true);
          ctx.selection.applyPoints(pts, d.mode);
        }
      }
      ctx.notify("selection");
    },
    cancel(ctx) {
      drag = null;
      ctx.notify("overlay");
    },
    drawOverlay(c, vp) {
      if (!drag) return;
      c.save();
      c.strokeStyle = "#000";
      c.setLineDash([4, 4]);
      c.lineWidth = 1;
      if (kind === "lasso") {
        c.beginPath();
        drag.points.forEach((p, i) => {
          const s = vp.imageToScreen(p.x, p.y);
          if (i === 0) c.moveTo(s.x, s.y);
          else c.lineTo(s.x, s.y);
        });
        c.stroke();
        c.strokeStyle = "#fff";
        c.lineDashOffset = 4;
        c.stroke();
      } else {
        let end = drag.current;
        if (drag.square) end = constrainSquare(drag.start.x, drag.start.y, drag.current.x, drag.current.y);
        const a = vp.imageToScreen(drag.start.x, drag.start.y);
        const b = vp.imageToScreen(end.x, end.y);
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        const w = Math.abs(b.x - a.x);
        const h = Math.abs(b.y - a.y);
        c.beginPath();
        if (kind === "ellipse") {
          c.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        } else {
          c.rect(x + 0.5, y + 0.5, w, h);
        }
        c.stroke();
        c.strokeStyle = "#fff";
        c.lineDashOffset = 4;
        c.stroke();
      }
      c.restore();
    },
    reset() {
      drag = null;
    },
  };
}

export const rectangleSelect = makeSelectTool("rectangleSelect", "Rectangle Select", "rect");
export const ellipseSelect = makeSelectTool("ellipseSelect", "Ellipse Select", "ellipse");
export const lassoSelect = makeSelectTool("lassoSelect", "Lasso Select", "lasso");

export const magicWand: Tool = {
  id: "magicWand",
  name: "Magic Wand",
  shortcut: "S",
  group: "select",
  cursor: "crosshair",
  pointerDown(e, ctx) {
    const x = e.imageX | 0;
    const y = e.imageY | 0;
    const merged = ctx.document.composite();
    const src = sampleSource(merged, ctx.document.activeLayer.buffer, ctx.options.sampleMode === "image");
    const contiguous = e.shiftKey ? ctx.options.floodMode === "global" : ctx.options.floodMode === "contiguous";
    const mask = floodMask(src, x, y, {
      tolerance: ctx.options.tolerance,
      contiguous,
      sampleMerged: ctx.options.sampleMode === "image",
    });
    ctx.selection.applyMask(mask, combineFromModifiers(e));
    ctx.notify("selection");
  },
  pointerMove() {},
  pointerUp() {},
};

function fillPolygon(points: Point[], w: number, h: number): Uint8Array {
  const mask = new Uint8Array(w * h);
  if (points.length < 3) return mask;
  const ys = points.map((p) => p.y);
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(h - 1, Math.ceil(Math.max(...ys)));
  for (let y = minY; y <= maxY; y++) {
    const nodes: number[] = [];
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const pi = points[i];
      const pj = points[j];
      if ((pi.y < y && pj.y >= y) || (pj.y < y && pi.y >= y)) {
        nodes.push(pi.x + ((y - pi.y) / (pj.y - pi.y || 1)) * (pj.x - pi.x));
      }
    }
    nodes.sort((a, b) => a - b);
    for (let i = 0; i < nodes.length; i += 2) {
      const x0 = Math.max(0, Math.round(nodes[i]));
      const x1 = Math.min(w - 1, Math.round(nodes[i + 1] ?? nodes[i]));
      mask.fill(255, y * w + x0, y * w + x1 + 1);
    }
  }
  return mask;
}
