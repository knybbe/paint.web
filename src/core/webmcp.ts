import type { AppState } from "../app-state";
import { ALL_TOOLS, getTool } from "../tools/registry";
import { ALL_EFFECTS, getEffect } from "../effects/registry";
import { fromHex, toHex, type Color } from "./color";
import { type BlendMode } from "./blend";
import { stampAlong, drawAliasedLine, setAliasedPixel } from "./draw";
import { pushSnapshot, snapshotLayer } from "../tools/base";
import { localSync, runFolderSync } from "./sync";

export interface WebMcpTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
  execute: (input: any) => Promise<unknown> | unknown;
  readOnlyHint?: boolean;
  consequentialHint?: boolean;
}

export interface WebMcpModelContext {
  registerTool: (tool: WebMcpTool) => () => void;
  unregisterTool: (name: string) => boolean;
  getTools: () => WebMcpTool[];
  executeTool: (name: string, args?: Record<string, unknown>) => Promise<unknown>;
  hasTool: (name: string) => boolean;
}

export function ensureWebMcpPolyfill(): WebMcpModelContext {
  if (typeof document === "undefined") {
    return createPolyfillContext();
  }

  const doc = document as unknown as { modelContext?: WebMcpModelContext };
  const nav = (typeof navigator !== "undefined" ? navigator : {}) as { modelContext?: WebMcpModelContext };

  if (doc.modelContext && typeof doc.modelContext.registerTool === "function") {
    if (!nav.modelContext) nav.modelContext = doc.modelContext;
    return doc.modelContext;
  }

  const polyfill = createPolyfillContext();
  doc.modelContext = polyfill;
  if (!nav.modelContext) nav.modelContext = polyfill;
  return polyfill;
}

function createPolyfillContext(): WebMcpModelContext {
  const registry = new Map<string, WebMcpTool>();

  return {
    registerTool(tool: WebMcpTool) {
      registry.set(tool.name, tool);
      return () => {
        registry.delete(tool.name);
      };
    },
    unregisterTool(name: string) {
      return registry.delete(name);
    },
    getTools() {
      return Array.from(registry.values());
    },
    async executeTool(name: string, args: Record<string, unknown> = {}) {
      const tool = registry.get(name);
      if (!tool) {
        throw new Error(`WebMCP tool "${name}" not found`);
      }
      return await tool.execute(args);
    },
    hasTool(name: string) {
      return registry.has(name);
    },
  };
}

function parseColorInput(val: unknown, fallback: Color): Color {
  if (!val) return fallback;
  if (typeof val === "string") {
    const c = fromHex(val);
    if (c) return c;
  }
  if (typeof val === "object" && val !== null) {
    const obj = val as Record<string, unknown>;
    const r = typeof obj.r === "number" ? obj.r : fallback.r;
    const g = typeof obj.g === "number" ? obj.g : fallback.g;
    const b = typeof obj.b === "number" ? obj.b : fallback.b;
    const a = typeof obj.a === "number" ? obj.a : fallback.a;
    return { r, g, b, a };
  }
  return fallback;
}

export function registerWebMcpTools(app: AppState): () => void {
  const mc = ensureWebMcpPolyfill();
  const unregisterFns: (() => void)[] = [];

  function reg(tool: WebMcpTool) {
    unregisterFns.push(mc.registerTool(tool));
  }

  // 1. get_document_info
  reg({
    name: "get_document_info",
    description: "Get active document dimensions, DPI, dirty flag, layer count, and open sessions.",
    readOnlyHint: true,
    inputSchema: { type: "object", properties: {} },
    execute: () => {
      const doc = app.document;
      return {
        activeSessionId: app.activeSessionId,
        name: doc.name,
        width: doc.width,
        height: doc.height,
        dpi: doc.dpi,
        background: doc.background,
        dirty: doc.dirty,
        activeLayerId: doc.activeLayerId,
        layerCount: doc.layers.length,
        layers: doc.layers.map((l, i) => ({
          index: i,
          id: l.id,
          name: l.name,
          visible: l.visible,
          locked: l.locked,
          opacity: l.opacity,
          blendMode: l.blendMode,
        })),
        sessionCount: app.sessions.length,
      };
    },
  });

  // 2. list_sessions
  reg({
    name: "list_sessions",
    description: "List all open image documents/sessions in the paint editor.",
    readOnlyHint: true,
    inputSchema: { type: "object", properties: {} },
    execute: () => {
      return app.sessions.map((s) => ({
        id: s.id,
        name: s.document.name,
        width: s.document.width,
        height: s.document.height,
        dirty: s.document.dirty,
        isActive: s.id === app.activeSessionId,
      }));
    },
  });

  // 3. new_image
  reg({
    name: "new_image",
    description: "Create a new canvas/document session with specified dimensions, background, and name.",
    inputSchema: {
      type: "object",
      properties: {
        width: { type: "number", description: "Canvas width in pixels (default 800)" },
        height: { type: "number", description: "Canvas height in pixels (default 600)" },
        dpi: { type: "number", description: "Dots per inch resolution (default 96)" },
        background: { type: "string", enum: ["White", "Black", "Transparent"], description: "Initial background kind" },
        name: { type: "string", description: "Document title (e.g. Untitled.png)" },
      },
    },
    execute: (args: { width?: number; height?: number; dpi?: number; background?: "White" | "Black" | "Transparent"; name?: string }) => {
      const session = app.newDocument({
        width: args.width || 800,
        height: args.height || 600,
        dpi: args.dpi || 96,
        background: args.background || "White",
        name: args.name,
      });
      app.fitToView();
      return {
        sessionId: session.id,
        name: session.document.name,
        width: session.document.width,
        height: session.document.height,
      };
    },
  });

  // 4. switch_session
  reg({
    name: "switch_session",
    description: "Switch the active document tab to the specified session ID.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "The session ID to activate" },
      },
      required: ["sessionId"],
    },
    execute: (args: { sessionId: string }) => {
      app.activateSession(args.sessionId);
      return { activeSessionId: app.activeSessionId, name: app.document.name };
    },
  });

  // 5. close_session
  reg({
    name: "close_session",
    description: "Close an open document session by ID.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "Session ID to close (defaults to active session)" },
        force: { type: "boolean", description: "If true, discard unsaved changes without prompting" },
      },
    },
    execute: async (args: { sessionId?: string; force?: boolean }) => {
      const id = args.sessionId || app.activeSessionId;
      await app.closeSession(id, args.force ?? true);
      return { closedSessionId: id, remainingSessions: app.sessions.length };
    },
  });

  // 6. list_layers
  reg({
    name: "list_layers",
    description: "List all layers in the active document.",
    readOnlyHint: true,
    inputSchema: { type: "object", properties: {} },
    execute: () => {
      return app.document.layers.map((l, i) => ({
        index: i,
        id: l.id,
        name: l.name,
        visible: l.visible,
        locked: l.locked,
        opacity: l.opacity,
        blendMode: l.blendMode,
        width: l.width,
        height: l.height,
        isActive: l.id === app.document.activeLayerId,
      }));
    },
  });

  // 7. add_layer
  reg({
    name: "add_layer",
    description: "Add a new transparent layer to the active document.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name of the new layer" },
        opacity: { type: "number", description: "Opacity from 0 to 255 (default 255)" },
        blendMode: { type: "string", description: "Blend mode (e.g. Normal, Multiply, Screen, Overlay)" },
      },
    },
    execute: (args: { name?: string; opacity?: number; blendMode?: BlendMode }) => {
      app.addLayer();
      const layer = app.document.activeLayer;
      if (args.name) layer.name = args.name;
      if (typeof args.opacity === "number") layer.opacity = Math.max(0, Math.min(255, args.opacity));
      if (args.blendMode) layer.blendMode = args.blendMode;
      app.compositor.invalidate();
      app.notify("document");
      app.notify("layers");
      return { id: layer.id, name: layer.name, opacity: layer.opacity, blendMode: layer.blendMode };
    },
  });

  // 8. delete_layer
  reg({
    name: "delete_layer",
    description: "Delete a layer by ID (defaults to active layer).",
    inputSchema: {
      type: "object",
      properties: {
        layerId: { type: "string", description: "Layer ID to delete" },
      },
    },
    execute: (args: { layerId?: string }) => {
      const layer = args.layerId ? app.document.layerById(args.layerId) : app.document.activeLayer;
      if (!layer) throw new Error("Layer not found");
      app.document.activeLayerId = layer.id;
      app.deleteLayer();
      return { deletedLayerId: layer.id, remainingLayers: app.document.layers.length };
    },
  });

  // 9. duplicate_layer
  reg({
    name: "duplicate_layer",
    description: "Duplicate the active layer or a specified layer.",
    inputSchema: {
      type: "object",
      properties: {
        layerId: { type: "string", description: "Layer ID to duplicate" },
      },
    },
    execute: (args: { layerId?: string }) => {
      const target = args.layerId ? app.document.layerById(args.layerId) : app.document.activeLayer;
      if (!target) throw new Error("Layer not found");
      app.document.activeLayerId = target.id;
      app.duplicateLayer();
      const dup = app.document.activeLayer;
      return { id: dup.id, name: dup.name };
    },
  });

  // 10. merge_layer_down
  reg({
    name: "merge_layer_down",
    description: "Merge the active layer down into the layer beneath it.",
    inputSchema: { type: "object", properties: {} },
    execute: () => {
      app.mergeDown();
      return { activeLayerId: app.document.activeLayerId, layers: app.document.layers.map((l) => l.name) };
    },
  });

  // 11. set_layer_properties
  reg({
    name: "set_layer_properties",
    description: "Update properties of a layer (name, opacity, blendMode, visible, locked).",
    inputSchema: {
      type: "object",
      properties: {
        layerId: { type: "string", description: "Layer ID (defaults to active layer)" },
        name: { type: "string", description: "New layer name" },
        opacity: { type: "number", description: "Opacity 0-255" },
        blendMode: { type: "string", description: "Blend mode" },
        visible: { type: "boolean", description: "Visibility flag" },
        locked: { type: "boolean", description: "Lock flag" },
      },
    },
    execute: (args: {
      layerId?: string;
      name?: string;
      opacity?: number;
      blendMode?: BlendMode;
      visible?: boolean;
      locked?: boolean;
    }) => {
      const id = args.layerId || app.document.activeLayerId;
      const target = app.document.layerById(id);
      if (!target) throw new Error("Layer not found");
      app.setLayerProps(id, {
        name: args.name ?? target.name,
        opacity: args.opacity ?? target.opacity,
        blendMode: args.blendMode ?? target.blendMode,
        visible: args.visible ?? target.visible,
        locked: args.locked ?? target.locked,
      });
      return { id: target.id, name: target.name, opacity: target.opacity, blendMode: target.blendMode, visible: target.visible, locked: target.locked };
    },
  });

  // 12. reorder_layer
  reg({
    name: "reorder_layer",
    description: "Move a layer from one position index to another.",
    inputSchema: {
      type: "object",
      properties: {
        fromIndex: { type: "number", description: "Source index" },
        toIndex: { type: "number", description: "Destination index" },
      },
      required: ["fromIndex", "toIndex"],
    },
    execute: (args: { fromIndex: number; toIndex: number }) => {
      app.document.moveLayer(args.fromIndex, args.toIndex);
      app.compositor.invalidate();
      app.notify("document");
      app.notify("layers");
      return { layers: app.document.layers.map((l, i) => ({ index: i, id: l.id, name: l.name })) };
    },
  });

  // 13. select_tool
  reg({
    name: "select_tool",
    description: "Select the active drawing or editing tool and update tool options.",
    inputSchema: {
      type: "object",
      properties: {
        tool: {
          type: "string",
          enum: ALL_TOOLS.map((t) => t.id),
          description: "Tool identifier",
        },
        brushWidth: { type: "number", description: "Brush width in pixels (1-200)" },
        hardness: { type: "number", description: "Brush hardness (0-1)" },
        tolerance: { type: "number", description: "Magic wand / bucket tolerance (0-100)" },
        antialias: { type: "boolean", description: "Antialiasing toggle" },
      },
      required: ["tool"],
    },
    execute: (args: {
      tool: string;
      brushWidth?: number;
      hardness?: number;
      tolerance?: number;
      antialias?: boolean;
    }) => {
      app.setTool(args.tool as any);
      if (typeof args.brushWidth === "number") app.options.brushWidth = args.brushWidth;
      if (typeof args.hardness === "number") app.options.hardness = args.hardness;
      if (typeof args.tolerance === "number") app.options.tolerance = args.tolerance;
      if (typeof args.antialias === "boolean") app.options.antialias = args.antialias;
      app.notify("tool");
      return {
        currentTool: app.currentTool,
        options: app.options,
      };
    },
  });

  // 14. get_tool_state
  reg({
    name: "get_tool_state",
    description: "Get active tool name, ID, and tool configuration options.",
    readOnlyHint: true,
    inputSchema: { type: "object", properties: {} },
    execute: () => {
      const tool = getTool(app.currentTool);
      return {
        id: app.currentTool,
        name: tool.name,
        options: { ...app.options },
        primaryColor: toHex(app.primary, true),
        secondaryColor: toHex(app.secondary, true),
      };
    },
  });

  // 15. set_colors
  reg({
    name: "set_colors",
    description: "Set primary and/or secondary drawing color (hex code or RGBA).",
    inputSchema: {
      type: "object",
      properties: {
        primary: { type: "string", description: "Primary color hex code (e.g. #ff0000)" },
        secondary: { type: "string", description: "Secondary color hex code (e.g. #00ff00)" },
      },
    },
    execute: (args: { primary?: string; secondary?: string }) => {
      if (args.primary) app.setPrimary(parseColorInput(args.primary, app.primary));
      if (args.secondary) app.setSecondary(parseColorInput(args.secondary, app.secondary));
      return {
        primary: toHex(app.primary, true),
        secondary: toHex(app.secondary, true),
      };
    },
  });

  // 16. get_colors
  reg({
    name: "get_colors",
    description: "Get current primary and secondary drawing colors.",
    readOnlyHint: true,
    inputSchema: { type: "object", properties: {} },
    execute: () => ({
      primary: toHex(app.primary, true),
      secondary: toHex(app.secondary, true),
      activeColor: app.activeColor,
    }),
  });

  // 17. draw_stroke
  reg({
    name: "draw_stroke",
    description: "Draw a continuous brush, pencil, or eraser stroke along a path of points.",
    inputSchema: {
      type: "object",
      properties: {
        points: {
          type: "array",
          items: {
            type: "object",
            properties: {
              x: { type: "number" },
              y: { type: "number" },
              pressure: { type: "number" },
            },
            required: ["x", "y"],
          },
          description: "List of pixel points along the stroke",
        },
        kind: { type: "string", enum: ["brush", "pencil", "eraser"], description: "Stroke kind (default brush)" },
        color: { type: "string", description: "Color hex (defaults to primary color)" },
        size: { type: "number", description: "Brush size (defaults to current brushWidth)" },
      },
      required: ["points"],
    },
    execute: (args: {
      points: { x: number; y: number; pressure?: number }[];
      kind?: "brush" | "pencil" | "eraser";
      color?: string;
      size?: number;
    }) => {
      if (!args.points.length) return { pointsDrawn: 0 };
      const layer = app.document.activeLayer;
      const col = args.color ? parseColorInput(args.color, app.primary) : app.primary;
      const size = args.size ?? app.options.brushWidth;
      const erase = args.kind === "eraser";

      const toolCtx = app.toolContext();
      const snap = snapshotLayer(toolCtx);

      if (args.kind === "pencil") {
        for (let i = 0; i < args.points.length - 1; i++) {
          const p0 = args.points[i];
          const p1 = args.points[i + 1];
          drawAliasedLine(layer.buffer, p0.x, p0.y, p1.x, p1.y, col, app.selection.empty ? undefined : app.selection);
        }
        if (args.points.length === 1) {
          const pt = args.points[0];
          setAliasedPixel(layer.buffer, pt.x, pt.y, col, app.selection.empty ? undefined : app.selection);
        }
      } else {
        const stampOpts = {
          size,
          hardness: app.options.hardness,
          antialias: app.options.antialias,
          color: col,
          erase,
          pressure: 1,
          selection: app.selection.empty ? undefined : app.selection,
        };

        if (args.points.length === 1) {
          const p = args.points[0];
          stampAlong(layer.buffer, p, p, { ...stampOpts, pressure: p.pressure ?? 1 });
        } else {
          for (let i = 0; i < args.points.length - 1; i++) {
            const p0 = args.points[i];
            const p1 = args.points[i + 1];
            stampAlong(layer.buffer, p0, p1, { ...stampOpts, pressure: p1.pressure ?? p0.pressure ?? 1 });
          }
        }
      }

      pushSnapshot(toolCtx, args.kind === "eraser" ? "Eraser" : "Paintbrush", args.kind === "eraser" ? "eraser" : "paintbrush", snap);
      return { pointsDrawn: args.points.length };
    },
  });

  // 18. draw_shape
  reg({
    name: "draw_shape",
    description: "Draw a geometric shape (rectangle, roundedRectangle, ellipse, line) between two corner points.",
    inputSchema: {
      type: "object",
      properties: {
        shape: { type: "string", enum: ["rectangle", "roundedRectangle", "ellipse", "line"], description: "Shape type" },
        x0: { type: "number", description: "Start X" },
        y0: { type: "number", description: "Start Y" },
        x1: { type: "number", description: "End X" },
        y1: { type: "number", description: "End Y" },
        mode: { type: "string", enum: ["outline", "filled", "both"], description: "Shape fill mode (default outline)" },
        color: { type: "string", description: "Outline color (defaults to primary)" },
        fillColor: { type: "string", description: "Fill color (defaults to secondary)" },
        lineWidth: { type: "number", description: "Line width (default brushWidth)" },
        cornerRadius: { type: "number", description: "Corner radius for roundedRectangle (default 10)" },
      },
      required: ["shape", "x0", "y0", "x1", "y1"],
    },
    execute: (args: {
      shape: "rectangle" | "roundedRectangle" | "ellipse" | "line";
      x0: number;
      y0: number;
      x1: number;
      y1: number;
      mode?: "outline" | "filled" | "both";
      color?: string;
      fillColor?: string;
      lineWidth?: number;
      cornerRadius?: number;
    }) => {
      const strokeCol = args.color ? parseColorInput(args.color, app.primary) : app.primary;
      const fillCol = args.fillColor ? parseColorInput(args.fillColor, app.secondary) : app.secondary;
      const lw = args.lineWidth ?? app.options.brushWidth;
      const mode = args.mode ?? "outline";

      const toolCtx = app.toolContext();
      const snap = snapshotLayer(toolCtx);
      const layer = app.document.activeLayer;

      const minX = Math.round(Math.min(args.x0, args.x1));
      const maxX = Math.round(Math.max(args.x0, args.x1));
      const minY = Math.round(Math.min(args.y0, args.y1));
      const maxY = Math.round(Math.max(args.y0, args.y1));

      if (args.shape === "line") {
        drawAliasedLine(layer.buffer, args.x0, args.y0, args.x1, args.y1, strokeCol, app.selection.empty ? undefined : app.selection);
      } else if (args.shape === "rectangle" || args.shape === "roundedRectangle") {
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            if (!layer.buffer.inBounds(x, y)) continue;
            if (!app.selection.empty && !app.selection.allows(x, y)) continue;
            const isBorder = (x - minX < lw) || (maxX - x < lw) || (y - minY < lw) || (maxY - y < lw);
            if (isBorder && (mode === "outline" || mode === "both")) {
              layer.buffer.blendOver(x, y, strokeCol);
            } else if (!isBorder && (mode === "filled" || mode === "both")) {
              layer.buffer.blendOver(x, y, fillCol);
            }
          }
        }
      } else if (args.shape === "ellipse") {
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const rx = Math.max(0.5, (maxX - minX) / 2);
        const ry = Math.max(0.5, (maxY - minY) / 2);
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            if (!layer.buffer.inBounds(x, y)) continue;
            if (!app.selection.empty && !app.selection.allows(x, y)) continue;
            const norm = Math.pow((x - cx) / rx, 2) + Math.pow((y - cy) / ry, 2);
            if (norm <= 1) {
              const innerNorm = Math.pow((x - cx) / Math.max(0.1, rx - lw), 2) + Math.pow((y - cy) / Math.max(0.1, ry - lw), 2);
              const isBorder = innerNorm > 1;
              if (isBorder && (mode === "outline" || mode === "both")) {
                layer.buffer.blendOver(x, y, strokeCol);
              } else if (!isBorder && (mode === "filled" || mode === "both")) {
                layer.buffer.blendOver(x, y, fillCol);
              }
            }
          }
        }
      }

      pushSnapshot(toolCtx, `Draw ${args.shape}`, "rectangle", snap);
      return { shape: args.shape, drawn: true };
    },
  });

  // 19. flood_fill
  reg({
    name: "flood_fill",
    description: "Flood fill pixels starting from point (x, y).",
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "number", description: "Target X coordinate" },
        y: { type: "number", description: "Target Y coordinate" },
        color: { type: "string", description: "Fill color (defaults to primary)" },
        tolerance: { type: "number", description: "Color tolerance (0-100, default from app options)" },
        contiguous: { type: "boolean", description: "If true, fill contiguous region; otherwise global (default true)" },
      },
      required: ["x", "y"],
    },
    execute: (args: { x: number; y: number; color?: string; tolerance?: number; contiguous?: boolean }) => {
      const col = args.color ? parseColorInput(args.color, app.primary) : app.primary;
      const tol = args.tolerance ?? app.options.tolerance;
      const cont = args.contiguous ?? (app.options.floodMode === "contiguous");

      const toolCtx = app.toolContext();
      const snap = snapshotLayer(toolCtx);
      const layer = app.document.activeLayer;
      const buf = layer.buffer;
      const x = Math.round(args.x);
      const y = Math.round(args.y);

      if (!buf.inBounds(x, y)) throw new Error(`Coordinates (${x}, ${y}) out of bounds`);
      const target = buf.getPixel(x, y);

      const withinTol = (c: Color) => {
        const d = Math.abs(c.r - target.r) + Math.abs(c.g - target.g) + Math.abs(c.b - target.b) + Math.abs(c.a - target.a);
        return (d / 1020) * 100 <= tol;
      };

      if (!cont) {
        for (let py = 0; py < buf.height; py++) {
          for (let px = 0; px < buf.width; px++) {
            if (app.selection.empty || app.selection.allows(px, py)) {
              if (withinTol(buf.getPixel(px, py))) buf.setPixel(px, py, col);
            }
          }
        }
      } else {
        const visited = new Uint8Array(buf.width * buf.height);
        const queue: [number, number][] = [[x, y]];
        visited[y * buf.width + x] = 1;

        while (queue.length > 0) {
          const [cx, cy] = queue.pop()!;
          if (app.selection.empty || app.selection.allows(cx, cy)) {
            buf.setPixel(cx, cy, col);
          }

          const neighbors: [number, number][] = [
            [cx + 1, cy],
            [cx - 1, cy],
            [cx, cy + 1],
            [cx, cy - 1],
          ];

          for (const [nx, ny] of neighbors) {
            if (buf.inBounds(nx, ny)) {
              const idx = ny * buf.width + nx;
              if (!visited[idx] && withinTol(buf.getPixel(nx, ny))) {
                visited[idx] = 1;
                queue.push([nx, ny]);
              }
            }
          }
        }
      }

      pushSnapshot(toolCtx, "Fill Layer", "paintBucket", snap);
      return { filled: true };
    },
  });

  // 20. fill_layer
  reg({
    name: "fill_layer",
    description: "Fill the entire active layer (or within selection) with a solid color.",
    inputSchema: {
      type: "object",
      properties: {
        color: { type: "string", description: "Color hex code (defaults to primary)" },
      },
    },
    execute: (args: { color?: string }) => {
      const col = args.color ? parseColorInput(args.color, app.primary) : app.primary;
      const toolCtx = app.toolContext();
      const snap = snapshotLayer(toolCtx);
      const layer = app.document.activeLayer;
      for (let y = 0; y < layer.buffer.height; y++) {
        for (let x = 0; x < layer.buffer.width; x++) {
          if (app.selection.empty || app.selection.allows(x, y)) {
            layer.buffer.setPixel(x, y, col);
          }
        }
      }
      pushSnapshot(toolCtx, "Fill Layer", "paintBucket", snap);
      return { filled: true };
    },
  });

  // 21. clear_layer
  reg({
    name: "clear_layer",
    description: "Erase all pixels on the active layer (or within selection), making them transparent.",
    inputSchema: { type: "object", properties: {} },
    execute: () => {
      const toolCtx = app.toolContext();
      const snap = snapshotLayer(toolCtx);
      const layer = app.document.activeLayer;
      if (app.selection.empty) {
        layer.buffer.clear();
      } else {
        const trans = { r: 0, g: 0, b: 0, a: 0 };
        for (let y = 0; y < layer.buffer.height; y++) {
          for (let x = 0; x < layer.buffer.width; x++) {
            if (app.selection.allows(x, y)) layer.buffer.setPixel(x, y, trans);
          }
        }
      }
      pushSnapshot(toolCtx, "Clear Layer", "eraser", snap);
      return { cleared: true };
    },
  });

  // 22. select_rectangle
  reg({
    name: "select_rectangle",
    description: "Set a rectangular selection area with combine mode (replace, add, subtract, intersect).",
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        width: { type: "number" },
        height: { type: "number" },
        mode: { type: "string", enum: ["replace", "add", "subtract", "intersect"], description: "Combine mode (default replace)" },
      },
      required: ["x", "y", "width", "height"],
    },
    execute: (args: { x: number; y: number; width: number; height: number; mode?: "replace" | "add" | "subtract" | "intersect" }) => {
      app.selection.applyRect(
        { x: args.x, y: args.y, w: args.width, h: args.height },
        args.mode ?? "replace"
      );
      app.notify("selection");
      return { bounds: app.selection.bounds, empty: app.selection.empty };
    },
  });

  // 23. select_all
  reg({
    name: "select_all",
    description: "Select the entire canvas area.",
    inputSchema: { type: "object", properties: {} },
    execute: () => {
      app.selectAll();
      return { bounds: app.selection.bounds };
    },
  });

  // 24. deselect
  reg({
    name: "deselect",
    description: "Clear active selection.",
    inputSchema: { type: "object", properties: {} },
    execute: () => {
      app.deselect();
      return { empty: true };
    },
  });

  // 25. invert_selection
  reg({
    name: "invert_selection",
    description: "Invert current selection area.",
    inputSchema: { type: "object", properties: {} },
    execute: () => {
      app.invertSelection();
      return { bounds: app.selection.bounds, empty: app.selection.empty };
    },
  });

  // 26. resize_image
  reg({
    name: "resize_image",
    description: "Resample and resize the entire document/image dimensions.",
    inputSchema: {
      type: "object",
      properties: {
        width: { type: "number", description: "New image width in pixels" },
        height: { type: "number", description: "New image height in pixels" },
        resampling: { type: "string", enum: ["bilinear", "nearest"], description: "Interpolation mode (default bilinear)" },
      },
      required: ["width", "height"],
    },
    execute: (args: { width: number; height: number; resampling?: "bilinear" | "nearest" }) => {
      app.resizeImage(args.width, args.height, args.resampling ?? "bilinear");
      return { width: app.document.width, height: app.document.height };
    },
  });

  // 27. resize_canvas
  reg({
    name: "resize_canvas",
    description: "Change canvas dimensions with offset positioning.",
    inputSchema: {
      type: "object",
      properties: {
        width: { type: "number", description: "New canvas width" },
        height: { type: "number", description: "New canvas height" },
        offsetX: { type: "number", description: "Horizontal pixel offset (default 0)" },
        offsetY: { type: "number", description: "Vertical pixel offset (default 0)" },
      },
      required: ["width", "height"],
    },
    execute: (args: { width: number; height: number; offsetX?: number; offsetY?: number }) => {
      app.resizeCanvas(args.width, args.height, args.offsetX ?? 0, args.offsetY ?? 0);
      return { width: app.document.width, height: app.document.height };
    },
  });

  // 28. crop_to_selection
  reg({
    name: "crop_to_selection",
    description: "Crop the document to the current active selection bounds.",
    inputSchema: { type: "object", properties: {} },
    execute: () => {
      app.cropToSelection();
      return { width: app.document.width, height: app.document.height };
    },
  });

  // 29. flip_image
  reg({
    name: "flip_image",
    description: "Flip the active layer or entire document horizontally or vertically.",
    inputSchema: {
      type: "object",
      properties: {
        direction: { type: "string", enum: ["horizontal", "vertical"], description: "Flip orientation" },
      },
      required: ["direction"],
    },
    execute: (args: { direction: "horizontal" | "vertical" }) => {
      app.transform(args.direction === "horizontal" ? "flipH" : "flipV");
      return { flipped: args.direction };
    },
  });

  // 30. rotate_image
  reg({
    name: "rotate_image",
    description: "Rotate the active layer 90 degrees clockwise, 90 degrees counter-clockwise, or 180 degrees.",
    inputSchema: {
      type: "object",
      properties: {
        angle: { type: "string", enum: ["90cw", "90ccw", "180"], description: "Rotation angle" },
      },
      required: ["angle"],
    },
    execute: (args: { angle: "90cw" | "90ccw" | "180" }) => {
      if (args.angle === "90cw") app.transform("rotate90cw");
      else if (args.angle === "90ccw") app.transform("rotate90ccw");
      else app.transform("rotate180");
      return { rotated: args.angle };
    },
  });

  // 31. flatten_image
  reg({
    name: "flatten_image",
    description: "Flatten all visible layers into a single background layer.",
    inputSchema: { type: "object", properties: {} },
    execute: () => {
      app.flatten();
      return { layersCount: app.document.layers.length };
    },
  });

  // 32. list_effects
  reg({
    name: "list_effects",
    description: "List all built-in effects and adjustment filters with their category and parameter schemas.",
    readOnlyHint: true,
    inputSchema: { type: "object", properties: {} },
    execute: () => {
      return ALL_EFFECTS.map((e) => ({
        id: e.id,
        name: e.name,
        menu: e.menu,
        params: e.params.map((p) => ({
          key: p.key,
          label: p.label,
          type: p.type,
          min: p.min,
          max: p.max,
          default: p.value,
        })),
      }));
    },
  });

  // 33. apply_effect
  reg({
    name: "apply_effect",
    description: "Apply an effect or adjustment filter to the active layer with custom parameters.",
    inputSchema: {
      type: "object",
      properties: {
        effectId: { type: "string", description: "Effect ID (e.g. gaussianBlur, brightnessContrast, invertColors, sepia, etc.)" },
        params: { type: "object", description: "Key-value parameter map" },
      },
      required: ["effectId"],
    },
    execute: (args: { effectId: string; params?: Record<string, number | boolean | string> }) => {
      const e = getEffect(args.effectId);
      if (!e) throw new Error(`Effect "${args.effectId}" not found`);
      const pMap: Record<string, number | boolean | string> = {};
      for (const p of e.params) {
        pMap[p.key] = args.params?.[p.key] ?? p.value;
      }
      app.applyEffect(e, pMap);
      return { applied: true, effectId: e.id, name: e.name, params: pMap };
    },
  });

  // 34. undo
  reg({
    name: "undo",
    description: "Undo the last editing step.",
    inputSchema: { type: "object", properties: {} },
    execute: () => {
      const canUndo = app.history.canUndo;
      if (canUndo) app.undo();
      return { success: canUndo, canUndo: app.history.canUndo, canRedo: app.history.canRedo };
    },
  });

  // 35. redo
  reg({
    name: "redo",
    description: "Redo the previously undone editing step.",
    inputSchema: { type: "object", properties: {} },
    execute: () => {
      const canRedo = app.history.canRedo;
      if (canRedo) app.redo();
      return { success: canRedo, canUndo: app.history.canUndo, canRedo: app.history.canRedo };
    },
  });

  // 36. get_history
  reg({
    name: "get_history",
    description: "Get the history timeline of undoable and redoable steps.",
    readOnlyHint: true,
    inputSchema: { type: "object", properties: {} },
    execute: () => {
      return {
        position: app.history.position,
        canUndo: app.history.canUndo,
        canRedo: app.history.canRedo,
        timeline: app.history.timeline,
      };
    },
  });

  // jump_to_history
  reg({
    name: "jump_to_history",
    description: "Jump to a specific index in the history timeline.",
    inputSchema: {
      type: "object",
      properties: {
        index: { type: "number", description: "Target index in the history timeline to jump to." },
      },
      required: ["index"],
    },
    execute: (args: { index: number }) => {
      const success = app.jumpToHistory(args.index);
      return {
        success,
        position: app.history.position,
        canUndo: app.history.canUndo,
        canRedo: app.history.canRedo,
        timeline: app.history.timeline,
      };
    },
  });

  // delete_history_entry
  reg({
    name: "delete_history_entry",
    description: "Delete an entry from the history timeline safely (safe rule: cannot delete index 0 baseline).",
    inputSchema: {
      type: "object",
      properties: {
        index: { type: "number", description: "Index in the history timeline to delete (must be > 0)." },
      },
      required: ["index"],
    },
    execute: (args: { index: number }) => {
      const success = app.deleteHistoryEntry(args.index);
      return {
        success,
        position: app.history.position,
        canUndo: app.history.canUndo,
        canRedo: app.history.canRedo,
        timeline: app.history.timeline,
      };
    },
  });

  // 37. export_image_data_url
  reg({
    name: "export_image_data_url",
    description: "Export the composite document image as a PNG or JPEG data URL.",
    readOnlyHint: true,
    inputSchema: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["png", "jpeg", "webp"], description: "Image format (default png)" },
        quality: { type: "number", description: "JPEG/WebP quality from 0 to 1 (default 0.92)" },
      },
    },
    execute: (args: { format?: "png" | "jpeg" | "webp"; quality?: number }) => {
      const canvas = document.createElement("canvas");
      canvas.width = app.document.width;
      canvas.height = app.document.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.putImageData(app.document.composite().asImageData(), 0, 0);
      }
      const mime = `image/${args.format ?? "png"}`;
      const dataUrl = typeof canvas.toDataURL === "function" ? canvas.toDataURL(mime, args.quality ?? 0.92) : "data:image/png;base64,";
      return {
        dataUrl,
        format: args.format ?? "png",
        width: canvas.width,
        height: canvas.height,
      };
    },
  });

  // 38. load_image_from_data_url
  reg({
    name: "load_image_from_data_url",
    description: "Load an image from a Data URL into a new document session or active layer.",
    inputSchema: {
      type: "object",
      properties: {
        dataUrl: { type: "string", description: "Data URL string (data:image/...)" },
        target: { type: "string", enum: ["newSession", "activeLayer"], description: "Destination (default newSession)" },
        name: { type: "string", description: "Name for the image or layer" },
      },
      required: ["dataUrl"],
    },
    execute: (args: { dataUrl: string; target?: "newSession" | "activeLayer"; name?: string }) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0);
          const idata = ctx.getImageData(0, 0, w, h);

          if (args.target === "activeLayer") {
            const toolCtx = app.toolContext();
            const snap = snapshotLayer(toolCtx);
            const layer = app.document.activeLayer;
            // Draw on active layer
            const buf = layer.buffer;
            for (let y = 0; y < Math.min(h, buf.height); y++) {
              for (let x = 0; x < Math.min(w, buf.width); x++) {
                const i = (y * w + x) * 4;
                buf.blendOver(x, y, {
                  r: idata.data[i],
                  g: idata.data[i + 1],
                  b: idata.data[i + 2],
                  a: idata.data[i + 3],
                });
              }
            }
            pushSnapshot(toolCtx, "Paste Image", "paste", snap);
            resolve({ target: "activeLayer", width: w, height: h });
          } else {
            const session = app.newDocument({
              width: w,
              height: h,
              name: args.name || "Imported Image.png",
              background: "Transparent",
            });
            const layer = session.document.activeLayer;
            layer.buffer.data.set(idata.data);
            app.compositor.invalidate();
            app.fitToView();
            app.notify("document");
            app.notify("sessions");
            resolve({ sessionId: session.id, width: w, height: h, name: session.document.name });
          }
        };
        img.onerror = () => reject(new Error("Failed to load image from Data URL"));
        img.src = args.dataUrl;
      });
    },
  });

  // 39. get_sync_status
  reg({
    name: "get_sync_status",
    description: "Get folder sync status, folder name, last synced time, and pending conflict count.",
    readOnlyHint: true,
    inputSchema: { type: "object", properties: {} },
    execute: () => {
      const state = localSync.getState();
      return {
        status: state.status,
        folderName: state.folderName,
        lastSyncedAt: state.lastSyncedAt,
        lastError: state.lastError,
        supported: state.supported,
        pendingConflicts: state.pendingConflicts,
        conflicts: localSync.listConflicts().map((c) => ({
          collection: c.collection,
          id: c.id,
          localUpdatedAt: c.local.updatedAt,
          remoteUpdatedAt: c.remote.updatedAt,
        })),
      };
    },
  });

  // 40. trigger_sync
  reg({
    name: "trigger_sync",
    description: "Trigger a folder sync cycle with the mapped local folder.",
    inputSchema: { type: "object", properties: {} },
    execute: async () => {
      const result = await runFolderSync();
      return {
        status: result.status,
        folderName: result.folderName,
        lastSyncedAt: result.lastSyncedAt,
        lastError: result.lastError,
        pendingConflicts: result.pendingConflicts,
      };
    },
  });

  // 41. resolve_sync_conflict
  reg({
    name: "resolve_sync_conflict",
    description: "Resolve a file sync conflict by picking 'local' or 'remote' document version.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string", description: "Collection name (e.g. documents, prefs)" },
        id: { type: "string", description: "Document ID" },
        choice: { type: "string", enum: ["local", "remote"], description: "Winner version" },
      },
      required: ["collection", "id", "choice"],
    },
    execute: async (args: { collection: string; id: string; choice: "local" | "remote" }) => {
      const resolved = await localSync.resolveConflict(args.collection, args.id, args.choice);
      return {
        collection: resolved.collection,
        id: resolved.id,
        updatedAt: resolved.updatedAt,
        resolved: true,
      };
    },
  });

  return () => {
    for (const u of unregisterFns) u();
  };
}
