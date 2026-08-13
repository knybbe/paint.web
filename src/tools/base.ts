import type { Color } from "../core/color";
import type { PdDocument } from "../core/document";
import type { HistoryStack } from "../core/history";
import type { Selection, SelectionCombine } from "../core/selection";
import type { Viewport } from "../core/viewport";
import type { Compositor } from "../core/renderer";
import type { Rect } from "../core/geometry";
import { restoreBytes, snapshotBytes } from "../core/pixel-buffer";
import type { FloatingSelection } from "../core/floating";

export type ToolId =
  | "rectangleSelect"
  | "lassoSelect"
  | "ellipseSelect"
  | "magicWand"
  | "movePixels"
  | "moveSelection"
  | "zoom"
  | "pan"
  | "paintBucket"
  | "gradient"
  | "paintbrush"
  | "eraser"
  | "pencil"
  | "colorPicker"
  | "cloneStamp"
  | "recolor"
  | "text"
  | "lineCurve"
  | "rectangle"
  | "roundedRectangle"
  | "ellipse"
  | "freeform";

export type ShapeDrawMode = "outline" | "filled" | "both";
export type GradientType = "linear" | "radial" | "diamond" | "conical";
export type FloodMode = "contiguous" | "global";
export type SampleMode = "layer" | "image";

export interface ToolOptions {
  brushWidth: number;
  hardness: number;
  antialias: boolean;
  tolerance: number;
  floodMode: FloodMode;
  sampleMode: SampleMode;
  selectionMode: SelectionCombine;
  shapeMode: ShapeDrawMode;
  cornerRadius: number;
  gradientType: GradientType;
  gradientAlphaOnly: boolean;
  fontFamily: string;
  fontSize: number;
  fontBold: boolean;
  fontItalic: boolean;
  fontAlign: "left" | "center" | "right";
  pressure: boolean;
}

export const DEFAULT_TOOL_OPTIONS: ToolOptions = {
  brushWidth: 13,
  hardness: 0.75,
  antialias: true,
  tolerance: 50,
  floodMode: "contiguous",
  sampleMode: "layer",
  selectionMode: "replace",
  shapeMode: "outline",
  cornerRadius: 10,
  gradientType: "linear",
  gradientAlphaOnly: false,
  fontFamily: "Segoe UI, system-ui, sans-serif",
  fontSize: 12,
  fontBold: false,
  fontItalic: false,
  fontAlign: "left",
  pressure: true,
};

export interface ToolPointer {
  imageX: number;
  imageY: number;
  screenX: number;
  screenY: number;
  button: number;
  buttons: number;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  pressure: number;
}

export interface ToolContext {
  document: PdDocument;
  selection: Selection;
  viewport: Viewport;
  primary: Color;
  secondary: Color;
  options: ToolOptions;
  compositor: Compositor;
  history: HistoryStack;
  status: (msg: string) => void;
  notify: (type: string) => void;
  setPrimary: (c: Color) => void;
  setSecondary: (c: Color) => void;
  setZoom: (z: number, around?: { x: number; y: number }) => void;
  commitPixels: (name: string, icon: string, layerId: string, before: Uint8ClampedArray, rect?: Rect) => void;
  floating: FloatingSelection | null;
  placeFloating: (x: number, y: number) => void;
}

export interface Tool {
  id: ToolId;
  name: string;
  shortcut: string;
  group: "select" | "move" | "view" | "fill" | "draw" | "shape" | "text";
  cursor: string;
  pointerDown(e: ToolPointer, ctx: ToolContext): void;
  pointerMove(e: ToolPointer, ctx: ToolContext): void;
  pointerUp(e: ToolPointer, ctx: ToolContext): void;
  keyDown?(e: KeyboardEvent, ctx: ToolContext): boolean;
  drawOverlay?(c: CanvasRenderingContext2D, vp: Viewport): void;
  commit?(ctx: ToolContext): void;
  cancel?(ctx: ToolContext): void;
  reset?(): void;
}

export function paintColor(e: ToolPointer, ctx: ToolContext): Color {
  return e.button === 2 ? ctx.secondary : ctx.primary;
}

export function oppositeColor(e: ToolPointer, ctx: ToolContext): Color {
  return e.button === 2 ? ctx.primary : ctx.secondary;
}

export function snapshotLayer(ctx: ToolContext): { id: string; data: Uint8ClampedArray } {
  const layer = ctx.document.activeLayer;
  return { id: layer.id, data: snapshotBytes(layer.buffer) };
}

export function pushSnapshot(ctx: ToolContext, name: string, icon: string, snap: { id: string; data: Uint8ClampedArray }): void {
  const layer = ctx.document.layerById(snap.id);
  if (!layer) return;
  const after = snapshotBytes(layer.buffer);
  const before = snap.data;
  ctx.history.push({
    name,
    icon,
    undo: () => {
      const l = ctx.document.layerById(snap.id);
      if (l) restoreBytes(l.buffer, before);
    },
    redo: () => {
      const l = ctx.document.layerById(snap.id);
      if (l) restoreBytes(l.buffer, after);
    },
  });
  ctx.document.dirty = true;
  ctx.compositor.invalidate();
  ctx.notify("history");
  ctx.notify("document");
}

export const SELECT_CYCLE: ToolId[] = ["rectangleSelect", "lassoSelect", "ellipseSelect", "magicWand"];
export const MOVE_CYCLE: ToolId[] = ["movePixels", "moveSelection"];
export const SHAPE_CYCLE: ToolId[] = ["lineCurve", "rectangle", "roundedRectangle", "ellipse", "freeform"];

export function nextInCycle(cycle: ToolId[], current: ToolId, reverse = false): ToolId {
  const i = cycle.indexOf(current);
  if (i < 0) return reverse ? cycle[cycle.length - 1] : cycle[0];
  const n = cycle.length;
  return cycle[reverse ? (i - 1 + n) % n : (i + 1) % n];
}
