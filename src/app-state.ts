import { type Color, cloneColor } from "./core/color";
import { PdDocument, type BackgroundKind } from "./core/document";
import { HistoryStack } from "./core/history";
import { Selection } from "./core/selection";
import { Viewport } from "./core/viewport";
import { Compositor } from "./core/renderer";
import { DEFAULT_SETTINGS, PRIMARY_DEFAULT, SECONDARY_DEFAULT, type AppSettings } from "./core/settings";
import {
  applyDomTheme,
  bindSystemTheme,
  parseThemePref,
  persistThemePref,
  resolveTheme,
  unbindSystemTheme,
} from "./core/theme";
import { idbGet, idbSet, pushRecentFile, type RecentFile } from "./core/idb";
import { syncSaveDocument } from "./core/sync";
import {
  applyDocument,
  loadWorkspace,
  rebuildHistory,
  restoreDocument,
  restoreFloating,
  restoreSelection,
  restoreViewport,
  saveWorkspace,
  serializeDocument,
  serializeFloating,
  serializeHistory,
  serializeSelection,
  serializeViewport,
  type SerializedDocument,
  type SerializedWorkspace,
} from "./core/persist";
import {
  decodeImageFile,
  downloadBlob,
  encodeDocument,
  extensionFor,
  formatFromName,
  pickOpenFiles,
  pickSaveFile,
  type SaveFormat,
} from "./core/file-io";
import { extractSelection, getMemoryClipboard, readClipboardImage, setMemoryClipboard, writeClipboardImage } from "./core/clipboard";
import { selectionFromFloating, stampFloating, type FloatingSelection } from "./core/floating";
import { restoreBytes, snapshotBytes } from "./core/pixel-buffer";
import { PixelBuffer } from "./core/pixel-buffer";
import { Colors } from "./core/color";
import { Layer } from "./core/layer";
import type { BlendMode } from "./core/blend";
import { getChromePhase, setTabletInspectorPane } from "./ui/chrome-phase";
import { DEFAULT_TOOL_OPTIONS, nextInCycle, MOVE_CYCLE, SELECT_CYCLE, SHAPE_CYCLE, type ToolContext, type ToolId, type ToolOptions } from "./tools/base";
import { getTool } from "./tools/registry";
import type { EffectDef } from "./effects/base";

export interface DocumentSession {
  id: string;
  document: PdDocument;
  history: HistoryStack;
  selection: Selection;
  viewport: Viewport;
  compositor: Compositor;
  fileHandle: { name: string; write: (blob: Blob) => Promise<void> } | null;
  zoomBeforeFit: number | null;
  floating: FloatingSelection | null;
  /** When true, canvas mount will not overwrite restored pan/zoom. */
  preserveViewport: boolean;
}

let sessionSeq = 1;

export function noteSessionId(id: string): void {
  const n = Number(id.replace(/^doc-/, ""));
  if (Number.isFinite(n) && n >= sessionSeq) sessionSeq = n + 1;
}

export class AppState extends EventTarget {
  sessions: DocumentSession[] = [];
  activeSessionId = "";
  primary: Color = cloneColor(PRIMARY_DEFAULT);
  secondary: Color = cloneColor(SECONDARY_DEFAULT);
  activeColor: "primary" | "secondary" = "primary";
  currentTool: ToolId = "paintbrush";
  options: ToolOptions = { ...DEFAULT_TOOL_OPTIONS };
  settings: AppSettings = { ...DEFAULT_SETTINGS, palette: DEFAULT_SETTINGS.palette.map((c) => ({ ...c })) };
  windows = { tools: true, history: true, layers: true, colors: true };
  statusMessage = "";
  cursorImage: { x: number; y: number } | null = null;
  spacePan = false;
  lastEffect: { id: string; params: Record<string, number | boolean | string> } | null = null;
  recent: RecentFile[] = [];
  dialog: DialogState | null = null;
  revision = 0;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private restoring = false;

  get session(): DocumentSession {
    return this.sessions.find((s) => s.id === this.activeSessionId) ?? this.sessions[0];
  }

  get document(): PdDocument {
    return this.session.document;
  }

  get history(): HistoryStack {
    return this.session.history;
  }

  get selection(): Selection {
    return this.session.selection;
  }

  get viewport(): Viewport {
    return this.session.viewport;
  }

  get compositor(): Compositor {
    return this.session.compositor;
  }

  notify(type: string): void {
    this.revision++;
    this.dispatchEvent(new Event(type));
    if (
      !this.restoring &&
      (type === "document" ||
        type === "history" ||
        type === "layers" ||
        type === "selection" ||
        type === "viewport" ||
        type === "tool" ||
        type === "colors" ||
        type === "windows" ||
        type === "sessions" ||
        type === "theme")
    ) {
      this.schedulePersist();
    }
  }

  async init(): Promise<void> {
    try {
      const stored = await idbGet<AppSettings>("settings", "app");
      if (stored) {
        this.settings = {
          ...DEFAULT_SETTINGS,
          ...stored,
          theme: parseThemePref(stored.theme),
          palette: stored.palette ?? DEFAULT_SETTINGS.palette,
        };
        this.options.antialias = this.settings.antialias;
      }
      this.recent = (await idbGet<RecentFile[]>("recent", "list")) ?? [];
      const workspace = await loadWorkspace();
      if (workspace?.sessions?.length) {
        this.restoreWorkspace(workspace);
        this.applyTheme();
        return;
      }
    } catch {
      /* IndexedDB unavailable (private mode, older browsers) */
    }
    this.newDocument();
    this.applyTheme();
  }

  applyTheme(): void {
    const pref = parseThemePref(this.settings.theme);
    this.settings.theme = pref;
    applyDomTheme(resolveTheme(pref));
    persistThemePref(pref);
    if (pref === "system") bindSystemTheme(() => this.applyTheme());
    else unbindSystemTheme();
    this.notify("theme");
  }

  async persistSettings(): Promise<void> {
    persistThemePref(parseThemePref(this.settings.theme));
    try {
      await idbSet("settings", "app", this.settings);
    } catch {
      /* ignore storage failures */
    }
  }

  newDocument(opts?: { width?: number; height?: number; dpi?: number; background?: BackgroundKind; name?: string }): DocumentSession {
    const width = opts?.width ?? this.settings.defaultWidth;
    const height = opts?.height ?? this.settings.defaultHeight;
    let docName = opts?.name;
    if (!docName) {
      const baseName = "Untitled";
      if (!this.sessions.length) {
        docName = `${baseName}.png`;
      } else {
        const existing = new Set(this.sessions.map((s) => s.document.name.toLowerCase()));
        if (!existing.has(`${baseName.toLowerCase()}.png`)) {
          docName = `${baseName}.png`;
        } else {
          let num = 2;
          while (existing.has(`${baseName.toLowerCase()} ${num}.png`)) num++;
          docName = `${baseName} ${num}.png`;
        }
      }
    }
    const doc = new PdDocument(width, height, {
      name: docName,
      dpi: opts?.dpi ?? this.settings.defaultDpi,
      background: opts?.background ?? this.settings.defaultBackground,
    });
    const session = this.wrap(doc);
    this.sessions.push(session);
    this.activeSessionId = session.id;
    this.updateTitle();
    this.notify("sessions");
    this.notify("document");
    this.notify("history");
    this.notify("selection");
    this.notify("viewport");
    return session;
  }

  wrap(doc: PdDocument): DocumentSession {
    const vp = new Viewport();
    vp.showRulers = this.settings.showRulers;
    vp.showPixelGrid = this.settings.showPixelGrid;
    const session: DocumentSession = {
      id: `doc-${sessionSeq++}`,
      document: doc,
      history: new HistoryStack(this.settings.historyLimit),
      selection: new Selection(doc.width, doc.height),
      viewport: vp,
      compositor: new Compositor(),
      fileHandle: null,
      zoomBeforeFit: null,
      floating: null,
      preserveViewport: false,
    };
    session.history.baseline = serializeDocument(doc);
    session.history.afterPush = () => {
      const top = session.history.undoEntries.at(-1);
      if (top) top.after = serializeDocument(session.document);
    };
    return session;
  }

  schedulePersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.flushPersist();
    }, 350);
  }

  async flushPersist(): Promise<void> {
    if (this.restoring || !this.sessions.length) return;
    try {
      await saveWorkspace(this.captureWorkspace());
      if (this.session) {
        void syncSaveDocument(this.session.id, this.session.document);
      }
    } catch {
      /* quota or private mode */
    }
  }

  captureWorkspace(): SerializedWorkspace {
    const clip = getMemoryClipboard();
    return {
      version: 1,
      activeSessionId: this.activeSessionId,
      sessions: this.sessions.map((s) => ({
        id: s.id,
        document: serializeDocument(s.document),
        selection: serializeSelection(s.selection),
        viewport: serializeViewport(s.viewport),
        floating: serializeFloating(s.floating),
        history: (() => {
          const hist = serializeHistory(s.history);
          if (!hist.baseline.layers.length) hist.baseline = serializeDocument(s.document);
          return hist;
        })(),
      })),
      primary: cloneColor(this.primary),
      secondary: cloneColor(this.secondary),
      activeColor: this.activeColor,
      currentTool: this.currentTool,
      options: { ...this.options },
      windows: { ...this.windows },
      settings: { ...this.settings, palette: this.settings.palette.map((c) => ({ ...c })) },
      lastEffect: this.lastEffect,
      clipboard: serializeFloating(
        clip ? { buffer: clip.buffer, mask: clip.mask, x: 0, y: 0 } : null,
      ),
    };
  }

  restoreWorkspace(data: SerializedWorkspace): void {
    this.restoring = true;
    this.sessions = [];
    this.settings = { ...DEFAULT_SETTINGS, ...data.settings, palette: (data.settings.palette ?? DEFAULT_SETTINGS.palette).map((c) => ({ ...c })) };
    this.options = { ...DEFAULT_TOOL_OPTIONS, ...data.options };
    this.windows = { ...this.windows, ...data.windows };
    this.primary = cloneColor(data.primary);
    this.secondary = cloneColor(data.secondary);
    this.activeColor = data.activeColor;
    this.currentTool = data.currentTool;
    this.lastEffect = data.lastEffect;
    if (data.clipboard) {
      const f = restoreFloating(data.clipboard);
      if (f) setMemoryClipboard({ buffer: f.buffer, mask: f.mask });
    }
    for (const s of data.sessions) {
      noteSessionId(s.id);
      const doc = restoreDocument(s.document);
      const session = this.wrap(doc);
      session.id = s.id;
      session.selection = restoreSelection(s.selection);
      restoreViewport(session.viewport, s.viewport);
      session.preserveViewport = true;
      session.floating = restoreFloating(s.floating);
      const apply = (snap: SerializedDocument) => {
        applyDocument(session.document, snap);
        session.selection.width = session.document.width;
        session.selection.height = session.document.height;
        session.compositor.invalidate();
      };
      session.history = rebuildHistory(
        this.settings.historyLimit,
        s.history.baseline.layers.length ? s.history.baseline : serializeDocument(doc),
        s.history.undo,
        s.history.redo,
        apply,
      );
      session.history.afterPush = () => {
        const top = session.history.undoEntries.at(-1);
        if (top) top.after = serializeDocument(session.document);
      };
      this.sessions.push(session);
    }
    this.activeSessionId = this.sessions.some((s) => s.id === data.activeSessionId)
      ? data.activeSessionId
      : this.sessions[0].id;
    this.restoring = false;
    this.updateTitle();
    this.notify("sessions");
    this.notify("document");
    this.notify("history");
    this.notify("selection");
    this.notify("viewport");
    this.notify("tool");
    this.notify("colors");
    this.notify("windows");
    this.notify("layers");
  }

  activateSession(id: string): void {
    if (this.sessions.some((s) => s.id === id)) {
      this.commitActiveTool();
      this.commitFloating();
      this.activeSessionId = id;
      this.updateTitle();
      this.notify("sessions");
      this.notify("document");
      this.notify("history");
      this.notify("selection");
      this.notify("viewport");
    }
  }

  async closeSession(id?: string, force = false): Promise<void> {
    const sid = id ?? this.activeSessionId;
    const idx = this.sessions.findIndex((s) => s.id === sid);
    if (idx < 0) return;
    if (!force && this.sessions[idx].document.dirty) {
      this.openDialog({ type: "confirmClose", sessionId: sid });
      return;
    }
    this.closeSessionFinal(sid);
  }

  closeSessionFinal(sid: string): void {
    const idx = this.sessions.findIndex((s) => s.id === sid);
    if (idx < 0) return;
    this.sessions.splice(idx, 1);
    if (!this.sessions.length) this.newDocument();
    else {
      this.activeSessionId = this.sessions[Math.min(idx, this.sessions.length - 1)].id;
      this.updateTitle();
    }
    if (this.dialog?.type === "confirmClose" && this.dialog.sessionId === sid) {
      this.closeDialog();
    }
    this.notify("sessions");
    this.notify("document");
    this.notify("history");
    this.notify("selection");
    this.notify("viewport");
  }

  fitToView(): void {
    this.viewport.fitToWindow(this.document.width, this.document.height, 8);
    this.session.zoomBeforeFit = null;
    this.notify("viewport");
  }

  nextSession(dir: 1 | -1): void {
    const i = this.sessions.findIndex((s) => s.id === this.activeSessionId);
    const n = this.sessions[(i + dir + this.sessions.length) % this.sessions.length];
    this.activateSession(n.id);
  }

  updateTitle(): void {
    const dirty = this.document.dirty ? "*" : "";
    document.title = `${dirty}${this.document.name} - paint.web`;
  }

  toolContext(): ToolContext {
    return {
      document: this.document,
      selection: this.selection,
      viewport: this.viewport,
      primary: this.primary,
      secondary: this.secondary,
      options: this.options,
      compositor: this.compositor,
      history: this.history,
      status: (msg) => {
        this.statusMessage = msg;
        this.notify("status");
      },
      notify: (t) => this.notify(t),
      setPrimary: (c) => this.setPrimary(c),
      setSecondary: (c) => this.setSecondary(c),
      setZoom: (z, around) => {
        this.viewport.setZoom(z, around);
        this.notify("viewport");
      },
      floating: this.session.floating,
      placeFloating: (x, y) => this.placeFloating(x, y),
      commitPixels: (name, icon, layerId, before) => {
        const layer = this.document.layerById(layerId);
        if (!layer) return;
        const after = snapshotBytes(layer.buffer);
        this.history.push({
          name,
          icon,
          undo: () => {
            const l = this.document.layerById(layerId);
            if (l) restoreBytes(l.buffer, before);
          },
          redo: () => {
            const l = this.document.layerById(layerId);
            if (l) restoreBytes(l.buffer, after);
          },
        });
        this.document.dirty = true;
        this.compositor.invalidate();
        this.notify("history");
        this.notify("document");
      },
    };
  }

  setTool(id: ToolId): void {
    if (this.currentTool === id) return;
    this.commitActiveTool();
    if (id !== "movePixels") this.commitFloating();
    getTool(this.currentTool).reset?.();
    this.currentTool = id;
    this.notify("tool");
  }

  cycleTool(group: "select" | "move" | "shape", reverse = false): void {
    const cycle = group === "select" ? SELECT_CYCLE : group === "move" ? MOVE_CYCLE : SHAPE_CYCLE;
    this.setTool(nextInCycle(cycle, this.currentTool, reverse));
  }

  commitActiveTool(): void {
    getTool(this.currentTool).commit?.(this.toolContext());
  }

  cancelActiveTool(): void {
    getTool(this.currentTool).cancel?.(this.toolContext());
  }

  setPrimary(c: Color): void {
    this.primary = cloneColor(c);
    this.notify("colors");
  }

  setSecondary(c: Color): void {
    this.secondary = cloneColor(c);
    this.notify("colors");
  }

  swapColors(): void {
    const t = this.primary;
    this.primary = this.secondary;
    this.secondary = t;
    this.notify("colors");
  }

  switchActiveColor(): void {
    this.activeColor = this.activeColor === "primary" ? "secondary" : "primary";
    this.notify("colors");
  }

  setActiveColorValue(c: Color): void {
    if (this.activeColor === "primary") this.setPrimary(c);
    else this.setSecondary(c);
  }

  undo(): void {
    this.cancelActiveTool();
    this.cancelFloating();
    if (this.history.undo()) {
      this.compositor.invalidate();
      this.document.dirty = true;
      this.notify("history");
      this.notify("document");
      this.notify("layers");
    }
  }

  redo(): void {
    this.cancelActiveTool();
    this.cancelFloating();
    if (this.history.redo()) {
      this.compositor.invalidate();
      this.document.dirty = true;
      this.notify("history");
      this.notify("document");
      this.notify("layers");
    }
  }

  pushNamed(name: string, icon: string, undo: () => void, redo: () => void): void {
    this.history.push({ name, icon, undo, redo });
    this.document.dirty = true;
    this.compositor.invalidate();
    this.notify("history");
    this.notify("document");
    this.updateTitle();
  }

  mutateLayerPixels(name: string, icon: string, fn: () => void): void {
    const layer = this.document.activeLayer;
    if (layer.locked) {
      this.statusMessage = "Layer is locked";
      this.notify("status");
      return;
    }
    const id = layer.id;
    const before = snapshotBytes(layer.buffer);
    fn();
    const after = snapshotBytes(layer.buffer);
    this.pushNamed(
      name,
      icon,
      () => {
        const l = this.document.layerById(id);
        if (l) restoreBytes(l.buffer, before);
      },
      () => {
        const l = this.document.layerById(id);
        if (l) restoreBytes(l.buffer, after);
      },
    );
    this.notify("layers");
  }

  applyEffect(effect: EffectDef, params: Record<string, number | boolean | string>): void {
    this.mutateLayerPixels(effect.name, effect.id, () => {
      const layer = this.document.activeLayer;
      const src = layer.buffer;
      const sel = this.selection.empty ? undefined : this.selection;
      const result = effect.apply(src, params, sel);
      if (sel && sel.mask) {
        for (let y = 0; y < src.height; y++) {
          for (let x = 0; x < src.width; x++) {
            if (sel.contains(x, y)) src.setPixel(x, y, result.getPixel(x, y));
          }
        }
      } else {
        layer.buffer = result;
      }
    });
    this.lastEffect = { id: effect.id, params };
  }

  selectAll(): void {
    this.selection.selectAll();
    this.notify("selection");
  }

  deselect(): void {
    this.commitActiveTool();
    this.commitFloating();
    this.selection.clear();
    this.notify("selection");
  }

  placeFloating(x: number, y: number): void {
    const f = this.session.floating;
    if (!f) return;
    f.x = x;
    f.y = y;
    selectionFromFloating(this.selection, f);
    this.notify("selection");
    this.notify("overlay");
    this.notify("document");
  }

  commitFloating(): void {
    const f = this.session.floating;
    if (!f) return;
    this.session.floating = null;
    this.mutateLayerPixels("Paste", "paste", () => {
      stampFloating(this.document.activeLayer.buffer, f);
    });
    selectionFromFloating(this.selection, f);
    this.notify("selection");
  }

  cancelFloating(): void {
    if (!this.session.floating) return;
    this.session.floating = null;
    this.selection.clear();
    this.statusMessage = "Paste cancelled";
    this.notify("selection");
    this.notify("document");
    this.notify("status");
  }

  invertSelection(): void {
    this.selection.invert();
    this.notify("selection");
  }

  eraseSelection(): void {
    if (this.session.floating) {
      this.cancelFloating();
      return;
    }
    this.mutateLayerPixels("Erase Selection", "erase", () => {
      const layer = this.document.activeLayer;
      if (this.selection.empty) layer.buffer.fill(Colors.transparent);
      else {
        for (let y = 0; y < layer.height; y++) {
          for (let x = 0; x < layer.width; x++) {
            if (this.selection.contains(x, y)) layer.buffer.setPixel(x, y, Colors.transparent);
          }
        }
      }
    });
  }

  fillSelection(color?: Color): void {
    const c = color ?? this.primary;
    this.mutateLayerPixels("Fill Selection", "fill", () => {
      const layer = this.document.activeLayer;
      if (this.selection.empty) {
        for (let y = 0; y < layer.height; y++) {
          for (let x = 0; x < layer.width; x++) layer.buffer.blendOver(x, y, c);
        }
      } else {
        for (let y = 0; y < layer.height; y++) {
          for (let x = 0; x < layer.width; x++) {
            if (this.selection.contains(x, y)) layer.buffer.blendOver(x, y, c);
          }
        }
      }
    });
  }

  async copy(merged = false): Promise<void> {
    const payload = extractSelection(this.document, this.selection, merged);
    if (!payload) return;
    setMemoryClipboard(payload);
    await writeClipboardImage(payload.buffer);
    this.statusMessage = "Copied";
    this.notify("status");
  }

  async cut(): Promise<void> {
    await this.copy(false);
    this.eraseSelection();
  }

  async paste(mode: "normal" | "newLayer" | "newImage" = "normal"): Promise<void> {
    const mem = getMemoryClipboard();
    const buf = mem?.buffer.clone() ?? (await readClipboardImage());
    const pixels = buf;
    if (!pixels) {
      this.statusMessage = "Clipboard is empty";
      this.notify("status");
      return;
    }
    if (mode === "newImage") {
      const doc = new PdDocument(pixels.width, pixels.height, { name: "Pasted.png", background: "Transparent" });
      doc.layers = [Layer.fromBuffer(pixels.clone(), "Background")];
      doc.activeLayerId = doc.layers[0].id;
      const session = this.wrap(doc);
      this.sessions.push(session);
      this.activeSessionId = session.id;
      this.updateTitle();
      this.notify("sessions");
      this.notify("document");
      return;
    }
    if (mode === "newLayer") {
      this.commitFloating();
      const layer = Layer.fromBuffer(PixelBuffer.create(this.document.width, this.document.height), "Pasted");
      pixels.copyTo(layer.buffer, 0, 0);
      const idx = this.document.activeIndex + 1;
      const before = this.document.layers.slice();
      this.document.insertLayer(layer, idx);
      this.pushNamed(
        "Paste into New Layer",
        "paste",
        () => {
          this.document.layers = before;
        },
        () => {
          this.document.insertLayer(layer, idx);
        },
      );
      this.notify("layers");
      return;
    }
    this.commitFloating();
    this.commitActiveTool();
    const mask =
      mem && mem.buffer.width === pixels.width && mem.buffer.height === pixels.height ? mem.mask : null;
    this.session.floating = { buffer: pixels.clone(), mask: mask ? new Uint8Array(mask) : null, x: 0, y: 0 };
    this.currentTool = "movePixels";
    selectionFromFloating(this.selection, this.session.floating);
    this.statusMessage = "Pasted — drag to move, Enter to apply, Esc to cancel";
    this.notify("tool");
    this.notify("selection");
    this.notify("document");
    this.notify("status");
  }

  addLayer(): void {
    const before = this.document.layers.slice();
    const active = this.document.activeLayerId;
    this.document.addLayer();
    const after = this.document.layers.slice();
    const afterActive = this.document.activeLayerId;
    this.pushNamed(
      "Add New Layer",
      "addLayer",
      () => {
        this.document.layers = before;
        this.document.activeLayerId = active;
      },
      () => {
        this.document.layers = after;
        this.document.activeLayerId = afterActive;
      },
    );
    this.notify("layers");
  }

  deleteLayer(): void {
    if (this.document.layers.length <= 1) return;
    const before = this.document.layers.slice();
    const active = this.document.activeLayerId;
    this.document.deleteLayer(this.document.activeLayerId);
    const after = this.document.layers.slice();
    const afterActive = this.document.activeLayerId;
    this.pushNamed(
      "Delete Layer",
      "deleteLayer",
      () => {
        this.document.layers = before;
        this.document.activeLayerId = active;
      },
      () => {
        this.document.layers = after;
        this.document.activeLayerId = afterActive;
      },
    );
    this.notify("layers");
  }

  duplicateLayer(): void {
    const before = this.document.layers.slice();
    const active = this.document.activeLayerId;
    this.document.duplicateLayer(this.document.activeLayerId);
    const after = this.document.layers.slice();
    const afterActive = this.document.activeLayerId;
    this.pushNamed(
      "Duplicate Layer",
      "duplicateLayer",
      () => {
        this.document.layers = before;
        this.document.activeLayerId = active;
      },
      () => {
        this.document.layers = after;
        this.document.activeLayerId = afterActive;
      },
    );
    this.notify("layers");
  }

  mergeDown(): void {
    const idx = this.document.activeIndex;
    if (idx <= 0) return;
    const before = this.document.layers.map((l) => l.clone());
    const active = this.document.activeLayerId;
    this.document.mergeDown(this.document.activeLayerId);
    const after = this.document.layers.map((l) => l.clone());
    const afterActive = this.document.activeLayerId;
    this.pushNamed(
      "Merge Layer Down",
      "merge",
      () => {
        this.document.layers = before.map((l) => l.clone());
        this.document.activeLayerId = active;
      },
      () => {
        this.document.layers = after.map((l) => l.clone());
        this.document.activeLayerId = afterActive;
      },
    );
    this.notify("layers");
  }

  moveActiveLayer(dir: 1 | -1): void {
    const idx = this.document.layers.findIndex((l) => l.id === this.document.activeLayerId);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= this.document.layers.length) return;
    const before = this.document.layers.slice();
    this.document.moveLayer(idx, target);
    const after = this.document.layers.slice();
    const active = this.document.activeLayerId;
    this.pushNamed(
      dir > 0 ? "Move Layer Up" : "Move Layer Down",
      "layers",
      () => {
        this.document.layers = before;
        this.document.activeLayerId = active;
        this.compositor.invalidate();
      },
      () => {
        this.document.layers = after;
        this.document.activeLayerId = active;
        this.compositor.invalidate();
      },
    );
    this.compositor.invalidate();
    this.notify("layers");
    this.notify("document");
  }

  flatten(): void {
    const before = this.document.layers.map((l) => l.clone());
    const active = this.document.activeLayerId;
    this.document.flatten();
    const after = this.document.layers.map((l) => l.clone());
    this.pushNamed(
      "Flatten",
      "flatten",
      () => {
        this.document.layers = before.map((l) => l.clone());
        this.document.activeLayerId = active;
      },
      () => {
        this.document.layers = after.map((l) => l.clone());
        this.document.activeLayerId = this.document.layers[0].id;
      },
    );
    this.notify("layers");
  }

  setLayerProps(id: string, props: Partial<{ name: string; opacity: number; blendMode: BlendMode; visible: boolean; locked: boolean }>): void {
    const layer = this.document.layerById(id);
    if (!layer) return;
    const prev = { name: layer.name, opacity: layer.opacity, blendMode: layer.blendMode, visible: layer.visible, locked: layer.locked };
    Object.assign(layer, props);
    this.pushNamed(
      "Layer Properties",
      "layer",
      () => Object.assign(layer, prev),
      () => Object.assign(layer, { ...prev, ...props }),
    );
    this.notify("layers");
  }

  cropToSelection(): void {
    const b = this.selection.bounds;
    if (!b) return;
    const before = this.document.clone();
    this.document.resizeCanvas(b.w, b.h, -b.x, -b.y);
    this.selection.clear();
    this.selection.resizeCanvas(b.w, b.h, -b.x, -b.y);
    const after = this.document.clone();
    this.replaceDocument(before, after, "Crop to Selection", "crop");
    this.notify("selection");
    this.notify("layers");
    this.viewport.center(this.document.width, this.document.height);
    this.notify("viewport");
  }

  resizeImage(width: number, height: number, mode: "nearest" | "bilinear"): void {
    const before = this.document.clone();
    this.document.resizeImage(width, height, mode);
    this.selection.resizeCanvas(width, height, 0, 0);
    const after = this.document.clone();
    this.replaceDocument(before, after, "Resize", "resize");
    this.notify("selection");
    this.notify("layers");
  }

  resizeCanvas(width: number, height: number, ox: number, oy: number): void {
    const before = this.document.clone();
    this.document.resizeCanvas(width, height, ox, oy);
    this.selection.resizeCanvas(width, height, ox, oy);
    const after = this.document.clone();
    this.replaceDocument(before, after, "Canvas Size", "canvas");
    this.notify("selection");
    this.notify("layers");
  }

  transform(kind: "rotate90cw" | "rotate90ccw" | "rotate180" | "flipH" | "flipV"): void {
    const before = this.document.clone();
    this.document.transform(kind);
    this.selection.clear();
    this.selection.width = this.document.width;
    this.selection.height = this.document.height;
    const after = this.document.clone();
    const names = {
      rotate90cw: "Rotate 90° Clockwise",
      rotate90ccw: "Rotate 90° Counter-Clockwise",
      rotate180: "Rotate 180°",
      flipH: "Flip Horizontal",
      flipV: "Flip Vertical",
    };
    this.replaceDocument(before, after, names[kind], kind);
    this.notify("selection");
    this.notify("layers");
  }

  private replaceDocument(before: PdDocument, after: PdDocument, name: string, icon: string): void {
    const apply = (src: PdDocument) => {
      this.document.layers = src.layers.map((l) => l.clone());
      this.document.activeLayerId = this.document.layers[Math.min(src.activeIndex, this.document.layers.length - 1)]?.id;
      this.document.name = src.name;
      this.document.dpi = src.dpi;
      this.selection.width = this.document.width;
      this.selection.height = this.document.height;
    };
    this.pushNamed(
      name,
      icon,
      () => apply(before),
      () => apply(after),
    );
  }

  async openFiles(files?: File[]): Promise<void> {
    const list = files ?? (await pickOpenFiles());
    for (const file of list) {
      try {
        const doc = await decodeImageFile(file);
        const session = this.wrap(doc);
        this.sessions.push(session);
        this.activeSessionId = session.id;
        try {
          this.recent = await pushRecentFile(file);
        } catch {
          this.recent = [
            { id: `${Date.now()}-${file.name}`, name: file.name, openedAt: Date.now(), type: file.type },
            ...this.recent.filter((r) => r.name !== file.name),
          ].slice(0, 8);
        }
      } catch (err) {
        alert((err as Error).message);
      }
    }
    this.updateTitle();
    this.notify("sessions");
    this.notify("document");
    this.notify("layers");
    this.viewport.fitToWindow(this.document.width, this.document.height);
    this.session.preserveViewport = true;
    this.notify("viewport");
  }

  async openRecent(id: string): Promise<void> {
    const rec = this.recent.find((r) => r.id === id);
    if (!rec) return;
    try {
      const buf = await idbGet<ArrayBuffer>("recent-files", id);
      if (!buf) {
        this.statusMessage = "Recent file is no longer available — use File > Open";
        this.notify("status");
        return;
      }
      const file = new File([buf], rec.name, { type: rec.type || "" });
      await this.openFiles([file]);
    } catch (err) {
      this.statusMessage = (err as Error).message || "Could not open recent file";
      this.notify("status");
    }
  }

  async save(saveAs = false): Promise<void> {
    const format = formatFromName(this.document.name);
    if (!saveAs && this.session.fileHandle) {
      const blob = await encodeDocument(this.document, format);
      await this.session.fileHandle.write(blob);
      this.document.dirty = false;
      this.updateTitle();
      this.notify("sessions");
      return;
    }
    this.openDialog({ type: "saveAs", format });
  }

  async saveWithFormat(format: SaveFormat, filename?: string): Promise<void> {
    const name = filename ?? this.document.name.replace(/\.[^.]+$/, "") + extensionFor(format);
    const blob = await encodeDocument(this.document, format);
    const handle = await pickSaveFile(name, format);
    if (handle) {
      const w = await handle.createWritable();
      await w.write(blob);
      await w.close();
      this.session.fileHandle = {
        name: handle.name,
        write: async (b) => {
          const ww = await handle.createWritable();
          await ww.write(b);
          await ww.close();
        },
      };
      this.document.name = handle.name;
    } else {
      downloadBlob(blob, name);
      this.document.name = name;
    }
    this.document.dirty = false;
    this.updateTitle();
    this.notify("sessions");
    this.notify("document");
  }

  print(): void {
    const canvas = document.createElement("canvas");
    canvas.width = this.document.width;
    canvas.height = this.document.height;
    canvas.getContext("2d")!.putImageData(this.document.composite().asImageData(), 0, 0);
    const w = window.open("");
    if (!w) return;
    const img = w.document.createElement("img");
    img.style.maxWidth = "100%";
    img.onload = () => {
      w.focus();
      w.print();
    };
    w.document.body.style.margin = "0";
    w.document.body.append(img);
    img.src = canvas.toDataURL("image/png");
  }

  openDialog(dialog: DialogState): void {
    this.dialog = dialog;
    this.notify("dialog");
  }

  closeDialog(): void {
    this.dialog = null;
    this.notify("dialog");
  }

  toggleWindow(name: keyof AppState["windows"]): void {
    if (getChromePhase() === "tablet" && name !== "tools") {
      const turningOn = !this.windows[name];
      setTabletInspectorPane(this, turningOn ? name : null);
      return;
    }
    this.windows[name] = !this.windows[name];
    this.notify("windows");
  }
}

export type DialogState =
  | { type: "new" }
  | { type: "resize" }
  | { type: "canvas" }
  | { type: "layerProps" }
  | { type: "effect"; effectId: string }
  | { type: "about" }
  | { type: "settings" }
  | { type: "shortcuts" }
  | { type: "saveAs"; format: SaveFormat }
  | { type: "rotateZoom" }
  | { type: "confirmClose"; sessionId: string }
  | { type: "sync" };
