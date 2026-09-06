import { beforeEach, describe, expect, it } from "vitest";
import { AppState } from "../src/app-state";
import { ensureWebMcpPolyfill, registerWebMcpTools } from "../src/core/webmcp";

describe("WebMCP Tool Registry & Tools", () => {
  let app: AppState;

  beforeEach(async () => {
    app = new AppState();
    await app.init();
  });

  it("polyfils document.modelContext and navigator.modelContext", () => {
    const ctx = ensureWebMcpPolyfill();
    expect(ctx).toBeDefined();
    expect(typeof ctx.registerTool).toBe("function");
    expect(typeof ctx.unregisterTool).toBe("function");
    expect(typeof ctx.getTools).toBe("function");
    expect(typeof ctx.executeTool).toBe("function");
    expect(typeof ctx.hasTool).toBe("function");
    expect((document as any).modelContext).toBe(ctx);
    expect((navigator as any).modelContext).toBe(ctx);
  });

  it("registers comprehensive set of WebMCP tools for the paint application", () => {
    const unregister = registerWebMcpTools(app);
    const ctx = ensureWebMcpPolyfill();
    const tools = ctx.getTools();
    expect(tools.length).toBeGreaterThanOrEqual(40);

    const toolNames = new Set(tools.map((t) => t.name));
    expect(toolNames.has("get_document_info")).toBe(true);
    expect(toolNames.has("list_layers")).toBe(true);
    expect(toolNames.has("add_layer")).toBe(true);
    expect(toolNames.has("delete_layer")).toBe(true);
    expect(toolNames.has("duplicate_layer")).toBe(true);
    expect(toolNames.has("draw_stroke")).toBe(true);
    expect(toolNames.has("draw_shape")).toBe(true);
    expect(toolNames.has("flood_fill")).toBe(true);
    expect(toolNames.has("fill_layer")).toBe(true);
    expect(toolNames.has("clear_layer")).toBe(true);
    expect(toolNames.has("select_rectangle")).toBe(true);
    expect(toolNames.has("crop_to_selection")).toBe(true);
    expect(toolNames.has("undo")).toBe(true);
    expect(toolNames.has("redo")).toBe(true);
    expect(toolNames.has("get_history")).toBe(true);
    expect(toolNames.has("jump_to_history")).toBe(true);
    expect(toolNames.has("delete_history_entry")).toBe(true);
    expect(toolNames.has("export_image_data_url")).toBe(true);
    expect(toolNames.has("get_sync_status")).toBe(true);
    expect(toolNames.has("trigger_sync")).toBe(true);
    expect(toolNames.has("resolve_sync_conflict")).toBe(true);

    unregister();
  });

  it("executes document inspection and layer management tools", async () => {
    registerWebMcpTools(app);
    const ctx = ensureWebMcpPolyfill();

    const info = (await ctx.executeTool("get_document_info")) as any;
    expect(info.width).toBe(app.document.width);
    expect(info.height).toBe(app.document.height);
    expect(info.layerCount).toBe(app.document.layers.length);

    const layersBefore = (await ctx.executeTool("list_layers")) as any[];
    const initialCount = layersBefore.length;

    const added = (await ctx.executeTool("add_layer", { name: "MCP Test Layer", opacity: 200 })) as any;
    expect(added.name).toBe("MCP Test Layer");
    expect(added.opacity).toBe(200);
    expect(app.document.layers.length).toBe(initialCount + 1);

    const dup = (await ctx.executeTool("duplicate_layer", { layerId: added.id })) as any;
    expect(dup.id).not.toBe(added.id);
    expect(app.document.layers.length).toBe(initialCount + 2);

    const del = (await ctx.executeTool("delete_layer", { layerId: dup.id })) as any;
    expect(del.deletedLayerId).toBe(dup.id);
    expect(app.document.layers.length).toBe(initialCount + 1);
  });

  it("executes drawing, shape, and fill tools with undo/redo support", async () => {
    registerWebMcpTools(app);
    const ctx = ensureWebMcpPolyfill();

    // Draw stroke
    const strokeResult = (await ctx.executeTool("draw_stroke", {
      points: [
        { x: 10, y: 10 },
        { x: 20, y: 20 },
      ],
      kind: "brush",
      color: "#ff0000",
      size: 4,
    })) as any;
    expect(strokeResult.pointsDrawn).toBe(2);
    expect(app.history.canUndo).toBe(true);

    // Draw shape
    const shapeResult = (await ctx.executeTool("draw_shape", {
      shape: "rectangle",
      x0: 5,
      y0: 5,
      x1: 30,
      y1: 30,
      color: "#00ff00",
      mode: "filled",
    })) as any;
    expect(shapeResult.drawn).toBe(true);

    // Fill entire layer
    const fillResult = (await ctx.executeTool("fill_layer", { color: "#0000ff" })) as any;
    expect(fillResult.filled).toBe(true);

    // Undo fill
    const undoRes = (await ctx.executeTool("undo")) as any;
    expect(undoRes.success).toBe(true);

    // Redo fill
    const redoRes = (await ctx.executeTool("redo")) as any;
    expect(redoRes.success).toBe(true);
  });

  it("executes effects and selections", async () => {
    registerWebMcpTools(app);
    const ctx = ensureWebMcpPolyfill();

    const effects = (await ctx.executeTool("list_effects")) as any[];
    expect(effects.length).toBeGreaterThan(0);
    const hasInvert = effects.some((e) => e.id === "invertColors");
    expect(hasInvert).toBe(true);

    const applyRes = (await ctx.executeTool("apply_effect", { effectId: "invertColors" })) as any;
    expect(applyRes.applied).toBe(true);

    const selRes = (await ctx.executeTool("select_rectangle", { x: 0, y: 0, width: 50, height: 50 })) as any;
    expect(selRes.empty).toBe(false);
    expect(app.selection.empty).toBe(false);

    const deselRes = (await ctx.executeTool("deselect")) as any;
    expect(deselRes.empty).toBe(true);
    expect(app.selection.empty).toBe(true);
  });

  it("executes sync status tools", async () => {
    registerWebMcpTools(app);
    const ctx = ensureWebMcpPolyfill();

    const syncStatus = (await ctx.executeTool("get_sync_status")) as any;
    expect(syncStatus).toBeDefined();
    expect(syncStatus.status).toBeDefined();

    const triggerRes = (await ctx.executeTool("trigger_sync")) as any;
    expect(triggerRes).toBeDefined();
    expect(triggerRes.status).toBeDefined();
  });

  it("manages history with get_history, jump_to_history, non-destructive branching, and delete_history_entry", async () => {
    registerWebMcpTools(app);
    const ctx = ensureWebMcpPolyfill();

    // 1. Initial history check
    const initialHist = (await ctx.executeTool("get_history")) as any;
    expect(initialHist.position).toBe(0);
    expect(initialHist.canUndo).toBe(false);
    expect(initialHist.timeline).toHaveLength(1);
    expect(initialHist.timeline[0].name).toBe("New Image");

    // 2. Perform two edits: draw stroke, then draw shape
    await ctx.executeTool("draw_stroke", {
      points: [{ x: 5, y: 5 }, { x: 15, y: 15 }],
      kind: "brush",
      color: "#ff0000",
      size: 2,
    });
    await ctx.executeTool("draw_shape", {
      shape: "rectangle",
      x0: 10,
      y0: 10,
      x1: 25,
      y1: 25,
      color: "#00ff00",
      mode: "filled",
    });

    const histAfterEdits = (await ctx.executeTool("get_history")) as any;
    expect(histAfterEdits.position).toBe(2);
    expect(histAfterEdits.canUndo).toBe(true);
    expect(histAfterEdits.timeline).toHaveLength(3);

    // 3. Undo one step
    const undoRes = (await ctx.executeTool("undo")) as any;
    expect(undoRes.success).toBe(true);
    expect(app.history.position).toBe(1);

    // 4. Draw new shape: branches non-destructively!
    await ctx.executeTool("draw_shape", {
      shape: "ellipse",
      x0: 2,
      y0: 2,
      x1: 8,
      y1: 8,
      color: "#0000ff",
      mode: "outline",
    });

    const branchedHist = (await ctx.executeTool("get_history")) as any;
    // Appended branch root and new edit without destroying prior branch
    expect(branchedHist.timeline.length).toBeGreaterThanOrEqual(4);
    expect(branchedHist.canUndo).toBe(true);

    // 5. Jump back to alternate branch step
    const jumpRes = (await ctx.executeTool("jump_to_history", { index: 2 })) as any;
    expect(jumpRes.success).toBe(true);
    expect(jumpRes.position).toBe(2);

    // 6. Safe delete: cannot delete index 0 (baseline)
    const deleteZero = (await ctx.executeTool("delete_history_entry", { index: 0 })) as any;
    expect(deleteZero.success).toBe(false);

    // 7. Safe delete: delete future/current entry
    const countBefore = app.history.timeline.length;
    const deleteRes = (await ctx.executeTool("delete_history_entry", { index: 2 })) as any;
    expect(deleteRes.success).toBe(true);
    expect(app.history.timeline.length).toBe(countBefore - 1);
  });
});
