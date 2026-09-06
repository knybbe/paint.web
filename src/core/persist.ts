import type { Color } from "./color";
import type { BlendMode } from "./blend";
import { BLEND_MODES } from "./blend";
import { PdDocument, type BackgroundKind } from "./document";
import { Layer, noteLayerId } from "./layer";
import { PixelBuffer } from "./pixel-buffer";
import { Selection } from "./selection";
import { Viewport } from "./viewport";
import { HistoryStack, type HistoryEntry } from "./history";
import type { FloatingSelection } from "./floating";
import { type AppSettings } from "./settings";
import type { ToolId, ToolOptions } from "../tools/base";
import { idbGet, idbSet } from "./idb";

export const WORKSPACE_KEY = "snapshot";

export interface SerializedLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: BlendMode;
  width: number;
  height: number;
  pixels: ArrayBuffer;
  mask: ArrayBuffer | null;
  maskEnabled: boolean;
}

export interface SerializedDocument {
  name: string;
  dpi: number;
  background: BackgroundKind;
  dirty: boolean;
  activeLayerId: string;
  layers: SerializedLayer[];
}

export interface SerializedHistoryStep {
  name: string;
  icon: string;
  after: SerializedDocument;
}

export interface SerializedSelection {
  width: number;
  height: number;
  mask: ArrayBuffer | null;
}

export interface SerializedFloating {
  x: number;
  y: number;
  width: number;
  height: number;
  pixels: ArrayBuffer;
  mask: ArrayBuffer | null;
}

export interface SerializedViewport {
  zoom: number;
  panX: number;
  panY: number;
  showRulers: boolean;
  showPixelGrid: boolean;
  showGuides: boolean;
  guides: Viewport["guides"];
}

export interface SerializedSession {
  id: string;
  document: SerializedDocument;
  selection: SerializedSelection;
  viewport: SerializedViewport;
  floating: SerializedFloating | null;
  history: {
    baseline: SerializedDocument;
    undo: SerializedHistoryStep[];
    redo: SerializedHistoryStep[];
  };
}

export interface SerializedWorkspace {
  version: 1;
  activeSessionId: string;
  sessions: SerializedSession[];
  primary: Color;
  secondary: Color;
  activeColor: "primary" | "secondary";
  currentTool: ToolId;
  options: ToolOptions;
  windows: { tools: boolean; history: boolean; layers: boolean; colors: boolean };
  settings: AppSettings;
  lastEffect: { id: string; params: Record<string, number | boolean | string> } | null;
  clipboard: SerializedFloating | null;
}

function copyBytes(data: Uint8Array | Uint8ClampedArray): ArrayBuffer {
  const out = new Uint8Array(data.length);
  out.set(data);
  return out.buffer;
}

export function serializeDocument(doc: PdDocument): SerializedDocument {
  return {
    name: doc.name,
    dpi: doc.dpi,
    background: doc.background,
    dirty: doc.dirty,
    activeLayerId: doc.activeLayerId,
    layers: doc.layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      locked: layer.locked,
      opacity: layer.opacity,
      blendMode: layer.blendMode,
      width: layer.width,
      height: layer.height,
      pixels: copyBytes(layer.buffer.data),
      mask: layer.mask ? copyBytes(layer.mask) : null,
      maskEnabled: layer.maskEnabled,
    })),
  };
}

export function restoreDocument(snap: SerializedDocument): PdDocument {
  const w = snap.layers[0]?.width ?? 1;
  const h = snap.layers[0]?.height ?? 1;
  const doc = new PdDocument(w, h, { name: snap.name, dpi: snap.dpi, background: snap.background });
  doc.layers = snap.layers.map((s) => {
    const buf = new PixelBuffer(s.width, s.height, new Uint8ClampedArray(s.pixels.slice(0)));
    const layer = Layer.fromBuffer(buf, s.name);
    layer.id = s.id;
    noteLayerId(s.id);
    layer.visible = s.visible;
    layer.locked = s.locked;
    layer.opacity = s.opacity;
    layer.blendMode = BLEND_MODES.includes(s.blendMode) ? s.blendMode : "Normal";
    layer.mask = s.mask ? new Uint8Array(s.mask.slice(0)) : null;
    layer.maskEnabled = s.maskEnabled;
    return layer;
  });
  if (!doc.layers.length) doc.layers.push(new Layer(w, h, "Background"));
  doc.activeLayerId = doc.layers.some((l) => l.id === snap.activeLayerId)
    ? snap.activeLayerId
    : doc.layers[doc.layers.length - 1].id;
  doc.dirty = snap.dirty;
  return doc;
}

export function applyDocument(doc: PdDocument, snap: SerializedDocument): void {
  const restored = restoreDocument(snap);
  doc.name = restored.name;
  doc.dpi = restored.dpi;
  doc.background = restored.background;
  doc.layers = restored.layers;
  doc.activeLayerId = restored.activeLayerId;
  doc.dirty = restored.dirty;
}

export function serializeSelection(sel: Selection): SerializedSelection {
  return {
    width: sel.width,
    height: sel.height,
    mask: sel.mask ? copyBytes(sel.mask) : null,
  };
}

export function restoreSelection(snap: SerializedSelection): Selection {
  const sel = new Selection(snap.width, snap.height);
  if (snap.mask) sel.applyMask(new Uint8Array(snap.mask.slice(0)), "replace");
  return sel;
}

export function serializeFloating(f: FloatingSelection | null): SerializedFloating | null {
  if (!f) return null;
  return {
    x: f.x,
    y: f.y,
    width: f.buffer.width,
    height: f.buffer.height,
    pixels: copyBytes(f.buffer.data),
    mask: f.mask ? copyBytes(f.mask) : null,
  };
}

export function restoreFloating(snap: SerializedFloating | null): FloatingSelection | null {
  if (!snap) return null;
  return {
    x: snap.x,
    y: snap.y,
    buffer: new PixelBuffer(snap.width, snap.height, new Uint8ClampedArray(snap.pixels.slice(0))),
    mask: snap.mask ? new Uint8Array(snap.mask.slice(0)) : null,
  };
}

export function serializeViewport(vp: Viewport): SerializedViewport {
  return {
    zoom: vp.zoom,
    panX: vp.panX,
    panY: vp.panY,
    showRulers: vp.showRulers,
    showPixelGrid: vp.showPixelGrid,
    showGuides: vp.showGuides,
    guides: vp.guides.map((g) => ({ ...g })),
  };
}

export function restoreViewport(vp: Viewport, snap: SerializedViewport): void {
  vp.setZoom(snap.zoom);
  vp.panX = snap.panX;
  vp.panY = snap.panY;
  vp.showRulers = snap.showRulers;
  vp.showPixelGrid = snap.showPixelGrid;
  vp.showGuides = snap.showGuides;
  vp.guides = snap.guides.map((g) => ({ ...g }));
}

export function rebuildHistory(
  limit: number,
  baseline: SerializedDocument,
  undo: SerializedHistoryStep[],
  redo: SerializedHistoryStep[],
  apply: (snap: SerializedDocument) => void,
): HistoryStack {
  const stack = new HistoryStack(limit);
  stack.baseline = baseline;
  stack.applySnapshot = apply as (snap: unknown) => void;
  let prev = baseline;
  for (const step of undo) {
    const before = prev;
    const after = step.after;
    stack.push({
      name: step.name,
      icon: step.icon,
      undo: () => apply(before),
      redo: () => apply(after),
      after,
    });
    prev = after;
  }
  stack.afterPush = null;
  const reapply = redo.slice().reverse();
  let rprev = undo.at(-1)?.after ?? baseline;
  const redoBuilt: HistoryEntry[] = [];
  for (const step of reapply) {
    const before = rprev;
    const after = step.after;
    redoBuilt.push({
      name: step.name,
      icon: step.icon,
      undo: () => apply(before),
      redo: () => apply(after),
      after,
    });
    rprev = after;
  }
  for (let i = redoBuilt.length - 1; i >= 0; i--) stack.addRedoEntry(redoBuilt[i]);
  return stack;
}

export function serializeHistory(stack: HistoryStack): SerializedSession["history"] {
  const baseline = (stack.baseline as SerializedDocument | null) ?? {
    name: "Untitled.png",
    dpi: 96,
    background: "White",
    dirty: false,
    activeLayerId: "",
    layers: [],
  };
  return {
    baseline,
    undo: stack.undoEntries
      .filter((e) => e.after)
      .map((e) => ({ name: e.name, icon: e.icon, after: e.after as SerializedDocument })),
    redo: stack.redoEntries
      .filter((e) => e.after)
      .map((e) => ({ name: e.name, icon: e.icon, after: e.after as SerializedDocument })),
  };
}

export async function saveWorkspace(state: SerializedWorkspace): Promise<void> {
  await idbSet("workspace", WORKSPACE_KEY, state);
}

export async function loadWorkspace(): Promise<SerializedWorkspace | undefined> {
  return idbGet<SerializedWorkspace>("workspace", WORKSPACE_KEY);
}
