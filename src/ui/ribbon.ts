import type { AppState } from "../app-state";
import { getTool } from "../tools/registry";
import type { ToolId } from "../tools/base";
import { svgEl, TOOL_SVG, UI_ICONS } from "./icons";
import { effectsByMenu, getEffect } from "../effects/registry";
import type { EffectDef } from "../effects/base";

export type RibbonTab = "home" | "tools" | "image" | "adjustFx" | "layers" | "view";

export function mountRibbon(root: HTMLElement, app: AppState): void {
  root.classList.add("ribbon-bar");
  root.dataset.testid = "ribbon-bar";

  let activeTab: RibbonTab = "home";

  const render = () => {
    root.replaceChildren();

    // 1. Quick Access Title Bar
    const topBar = document.createElement("div");
    topBar.className = "ribbon-top-bar";

    const brand = document.createElement("div");
    brand.className = "ribbon-brand";
    brand.innerHTML = `
      <span class="ribbon-brand-icon">🎨</span>
      <span class="ribbon-brand-title">paint.web</span>
    `;

    const quickActions = document.createElement("div");
    quickActions.className = "ribbon-quick-actions";

    const undoBtn = iconBtn(
      UI_ICONS.undo,
      app.history.canUndo ? `Undo ${app.history.undoName} (Ctrl+Z)` : "Undo (Ctrl+Z)",
      () => app.undo(),
      !app.history.canUndo,
      "ribbon-undo",
    );
    const redoBtn = iconBtn(
      UI_ICONS.redo,
      app.history.canRedo ? `Redo ${app.history.redoName} (Ctrl+Y)` : "Redo (Ctrl+Y)",
      () => app.redo(),
      !app.history.canRedo,
      "ribbon-redo",
    );
    const fitBtn = iconBtn(UI_ICONS.fit, "Fit to View (Ctrl+B)", () => app.fitToView(), false, "ribbon-fit");
    const saveBtn = iconBtn(UI_ICONS.save, "Save (Ctrl+S)", () => void app.save(false), false, "ribbon-save");

    const themeBtn = iconBtn(
      app.settings.theme === "dark" ? UI_ICONS.sun : UI_ICONS.moon,
      `Switch to ${app.settings.theme === "dark" ? "Light" : "Dark"} theme`,
      () => {
        app.settings.theme = app.settings.theme === "dark" ? "light" : "dark";
        app.applyTheme();
        void app.persistSettings();
      },
      false,
      "ribbon-theme",
    );

    quickActions.append(undoBtn, redoBtn, fitBtn, saveBtn, themeBtn);

    const sessionInfo = document.createElement("div");
    sessionInfo.className = "ribbon-session-info";
    sessionInfo.textContent = `${app.document.name} (${Math.round(app.viewport.zoom * 100)}%)`;

    topBar.append(brand, quickActions, sessionInfo);

    // 2. Ribbon Tabs Navigation
    const tabsBar = document.createElement("nav");
    tabsBar.className = "ribbon-tabs";
    tabsBar.setAttribute("role", "tablist");

    const tabs: { id: RibbonTab; label: string }[] = [
      { id: "home", label: "Home" },
      { id: "tools", label: "Tools" },
      { id: "image", label: "Image" },
      { id: "adjustFx", label: "Adjust & FX" },
      { id: "layers", label: "Layers" },
      { id: "view", label: "View" },
    ];

    for (const t of tabs) {
      const tabBtn = document.createElement("button");
      tabBtn.type = "button";
      tabBtn.className = `ribbon-tab-btn ${activeTab === t.id ? "active" : ""}`;
      tabBtn.setAttribute("role", "tab");
      tabBtn.setAttribute("aria-selected", String(activeTab === t.id));
      tabBtn.dataset.testid = `ribbon-tab-${t.id}`;
      tabBtn.textContent = t.label;
      tabBtn.addEventListener("click", () => {
        if (activeTab !== t.id) {
          activeTab = t.id;
          render();
        }
      });
      tabsBar.append(tabBtn);
    }

    // 3. Ribbon Body / Active Panel
    const body = document.createElement("div");
    body.className = "ribbon-body";
    body.setAttribute("role", "tabpanel");

    if (activeTab === "home") {
      body.append(renderHomeTab(app));
    } else if (activeTab === "tools") {
      body.append(renderToolsTab(app));
    } else if (activeTab === "image") {
      body.append(renderImageTab(app));
    } else if (activeTab === "adjustFx") {
      body.append(renderAdjustFxTab(app));
    } else if (activeTab === "layers") {
      body.append(renderLayersTab(app));
    } else if (activeTab === "view") {
      body.append(renderViewTab(app));
    }

    // 4. Contextual Tool Options Strip
    const contextualStrip = renderContextualStrip(app);

    root.append(topBar, tabsBar, body, contextualStrip);
  };

  render();
  app.addEventListener("tool", render);
  app.addEventListener("history", render);
  app.addEventListener("selection", render);
  app.addEventListener("layers", render);
  app.addEventListener("theme", render);
  app.addEventListener("viewport", render);
  app.addEventListener("document", render);
}

// ---------------------------------------------
// TAB RENDERERS
// ---------------------------------------------

function renderHomeTab(app: AppState): HTMLElement {
  const container = document.createElement("div");
  container.className = "ribbon-deck";

  // File Group
  const fileGroup = ribbonGroup("File");
  fileGroup.append(
    ribbonAction(UI_ICONS.new, "New", "Ctrl+N", () => app.openDialog({ type: "new" }), false, "ribbon-file-new"),
    ribbonAction(UI_ICONS.open, "Open", "Ctrl+O", () => void app.openFiles(), false, "ribbon-file-open"),
    ribbonAction(UI_ICONS.save, "Save", "Ctrl+S", () => void app.save(false), false, "ribbon-file-save"),
    ribbonAction(UI_ICONS.save, "Save As", "Ctrl+Shift+S", () => void app.save(true), false, "ribbon-file-saveas"),
  );

  // Clipboard Group
  const clipGroup = ribbonGroup("Clipboard");
  clipGroup.append(
    ribbonAction(UI_ICONS.paste, "Paste", "Ctrl+V", () => void app.paste("normal"), false, "ribbon-paste"),
    ribbonAction(UI_ICONS.cut, "Cut", "Ctrl+X", () => void app.cut(), false, "ribbon-cut"),
    ribbonAction(UI_ICONS.copy, "Copy", "Ctrl+C", () => void app.copy(false), false, "ribbon-copy"),
    ribbonAction(UI_ICONS.copy, "Merged", "Ctrl+Shift+C", () => void app.copy(true), false, "ribbon-copy-merged"),
  );

  // Selection Group
  const selGroup = ribbonGroup("Selection");
  selGroup.append(
    ribbonAction(UI_ICONS.crop, "Crop", "Ctrl+Shift+X", () => app.cropToSelection(), app.selection.empty, "ribbon-crop"),
    ribbonAction(UI_ICONS.deselect, "Deselect", "Ctrl+D", () => app.deselect(), app.selection.empty, "ribbon-deselect"),
    ribbonAction(TOOL_SVG.rectangleSelect, "Select All", "Ctrl+A", () => app.selectAll(), false, "ribbon-select-all"),
    ribbonAction(UI_ICONS.swap, "Invert", "Ctrl+I", () => app.invertSelection(), false, "ribbon-invert-sel"),
  );

  // History & Docks
  const docksGroup = ribbonGroup("Panels");
  docksGroup.append(
    ribbonAction(UI_ICONS.palette, "Colors", "F8", () => app.toggleWindow("colors"), false, "ribbon-win-colors"),
    ribbonAction(UI_ICONS.layers, "Layers", "F7", () => app.toggleWindow("layers"), false, "ribbon-win-layers"),
    ribbonAction(UI_ICONS.history, "History", "F6", () => app.toggleWindow("history"), false, "ribbon-win-history"),
  );

  container.append(fileGroup, clipGroup, selGroup, docksGroup);
  return container;
}

function renderToolsTab(app: AppState): HTMLElement {
  const container = document.createElement("div");
  container.className = "ribbon-deck";

  const categories: { title: string; tools: ToolId[] }[] = [
    {
      title: "Select & Move",
      tools: ["rectangleSelect", "lassoSelect", "ellipseSelect", "magicWand", "movePixels", "moveSelection"],
    },
    {
      title: "Draw & Paint",
      tools: ["paintbrush", "pencil", "eraser", "lineCurve", "cloneStamp", "recolor", "text"],
    },
    {
      title: "Fill & Sample",
      tools: ["paintBucket", "gradient", "colorPicker"],
    },
    {
      title: "Shapes",
      tools: ["rectangle", "roundedRectangle", "ellipse", "freeform"],
    },
  ];

  for (const cat of categories) {
    const group = ribbonGroup(cat.title);
    const grid = document.createElement("div");
    grid.className = "ribbon-tools-grid";

    for (const toolId of cat.tools) {
      const t = getTool(toolId);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `ribbon-tool-chip ${app.currentTool === toolId ? "active" : ""}`;
      btn.dataset.tool = toolId;
      btn.dataset.testid = `tool-${toolId}`;
      btn.title = `${t.name} (${t.shortcut})`;
      btn.append(svgEl(TOOL_SVG[toolId]));
      const label = document.createElement("span");
      label.className = "tool-label";
      label.textContent = t.name;
      btn.append(label);
      btn.addEventListener("click", () => app.setTool(toolId));
      grid.append(btn);
    }
    group.append(grid);
    container.append(group);
  }

  return container;
}

function renderImageTab(app: AppState): HTMLElement {
  const container = document.createElement("div");
  container.className = "ribbon-deck";

  const sizeGroup = ribbonGroup("Canvas & Size");
  sizeGroup.append(
    ribbonAction(UI_ICONS.crop, "Crop", "Ctrl+Shift+X", () => app.cropToSelection(), app.selection.empty, "ribbon-img-crop"),
    ribbonAction(UI_ICONS.resize, "Resize...", "Ctrl+R", () => app.openDialog({ type: "resize" }), false, "ribbon-img-resize"),
    ribbonAction(UI_ICONS.resize, "Canvas Size...", "Ctrl+Shift+R", () => app.openDialog({ type: "canvas" }), false, "ribbon-img-canvas"),
    ribbonAction(UI_ICONS.flatten, "Flatten", "Ctrl+Shift+F", () => app.flatten(), false, "ribbon-img-flatten"),
  );

  const rotGroup = ribbonGroup("Rotate");
  rotGroup.append(
    ribbonAction(UI_ICONS.rotate, "90° CW", "Ctrl+H", () => app.transform("rotate90cw"), false, "ribbon-rot-90cw"),
    ribbonAction(UI_ICONS.rotate, "90° CCW", "Ctrl+G", () => app.transform("rotate90ccw"), false, "ribbon-rot-90ccw"),
    ribbonAction(UI_ICONS.rotate, "180°", "", () => app.transform("rotate180"), false, "ribbon-rot-180"),
  );

  const flipGroup = ribbonGroup("Flip");
  flipGroup.append(
    ribbonAction(UI_ICONS.flip, "Flip Horiz", "", () => app.transform("flipH"), false, "ribbon-flip-h"),
    ribbonAction(UI_ICONS.flip, "Flip Vert", "", () => app.transform("flipV"), false, "ribbon-flip-v"),
  );

  container.append(sizeGroup, rotGroup, flipGroup);
  return container;
}

function renderAdjustFxTab(app: AppState): HTMLElement {
  const container = document.createElement("div");
  container.className = "ribbon-deck";

  // Quick Adjustments Group
  const adjGroup = ribbonGroup("Adjustments");
  const adjGrid = document.createElement("div");
  adjGrid.className = "ribbon-action-grid";

  const adjs = effectsByMenu("Adjustments");
  for (const e of adjs) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ribbon-compact-btn";
    b.textContent = e.name;
    b.title = e.name + (e.shortcut ? ` (${e.shortcut})` : "");
    b.dataset.testid = `adj-${e.id}`;
    b.addEventListener("click", () => applyOrOpenEffect(app, e));
    adjGrid.append(b);
  }
  adjGroup.append(adjGrid);

  // Effects Group
  const fxGroup = ribbonGroup("Effects Categories");
  const fxCategories: EffectDef["menu"][] = ["Blurs", "Distort", "Noise", "Photo", "Render", "Stylize"];

  const fxGrid = document.createElement("div");
  fxGrid.className = "ribbon-fx-category-list";

  // Repeat last effect button
  const repeatBtn = document.createElement("button");
  repeatBtn.type = "button";
  repeatBtn.className = "ribbon-compact-btn highlight";
  repeatBtn.disabled = !app.lastEffect;
  repeatBtn.textContent = app.lastEffect ? `Repeat ${getEffect(app.lastEffect.id)?.name ?? "Effect"}` : "Repeat Last Effect (Ctrl+F)";
  repeatBtn.addEventListener("click", () => {
    if (app.lastEffect) {
      const e = getEffect(app.lastEffect.id);
      if (e) app.applyEffect(e, app.lastEffect.params);
    }
  });
  fxGrid.append(repeatBtn);

  for (const cat of fxCategories) {
    const list = effectsByMenu(cat);
    const sel = document.createElement("select");
    sel.className = "ribbon-select";
    const header = document.createElement("option");
    header.textContent = `▼ ${cat} (${list.length})`;
    header.disabled = true;
    header.selected = true;
    sel.append(header);

    for (const ef of list) {
      const opt = document.createElement("option");
      opt.value = ef.id;
      opt.textContent = ef.name;
      sel.append(opt);
    }
    sel.addEventListener("change", () => {
      const id = sel.value;
      const target = getEffect(id);
      if (target) applyOrOpenEffect(app, target);
      sel.selectedIndex = 0;
    });
    fxGrid.append(sel);
  }
  fxGroup.append(fxGrid);

  container.append(adjGroup, fxGroup);
  return container;
}

function renderLayersTab(app: AppState): HTMLElement {
  const container = document.createElement("div");
  container.className = "ribbon-deck";

  const ops = ribbonGroup("Layer Operations");
  ops.append(
    ribbonAction(UI_ICONS.addLayer, "Add Layer", "Ctrl+Shift+N", () => app.addLayer(), false, "ribbon-layer-add"),
    ribbonAction(UI_ICONS.duplicateLayer, "Duplicate", "Ctrl+Shift+D", () => app.duplicateLayer(), false, "ribbon-layer-dup"),
    ribbonAction(UI_ICONS.deleteLayer, "Delete", "Ctrl+Shift+Del", () => app.deleteLayer(), app.document.layers.length <= 1, "ribbon-layer-del"),
    ribbonAction(UI_ICONS.merge, "Merge Down", "Ctrl+M", () => app.mergeDown(), app.document.activeIndex <= 0, "ribbon-layer-merge"),
  );

  const props = ribbonGroup("Layer Properties");
  props.append(
    ribbonAction(UI_ICONS.settings, "Properties...", "F4", () => app.openDialog({ type: "layerProps" }), false, "ribbon-layer-props"),
    ribbonAction(UI_ICONS.rotate, "Rotate / Zoom...", "Ctrl+Shift+Z", () => app.openDialog({ type: "rotateZoom" }), false, "ribbon-layer-rotzoom"),
    ribbonAction(UI_ICONS.layers, "Toggle Panel", "F7", () => app.toggleWindow("layers"), false, "ribbon-layer-panel"),
  );

  container.append(ops, props);
  return container;
}

function renderViewTab(app: AppState): HTMLElement {
  const container = document.createElement("div");
  container.className = "ribbon-deck";

  const zoomGroup = ribbonGroup("Zoom & Navigation");
  zoomGroup.append(
    ribbonAction(UI_ICONS.zoomIn, "Zoom In", "Ctrl++", () => { app.viewport.zoomIn(); app.notify("viewport"); }, false, "ribbon-zoom-in"),
    ribbonAction(UI_ICONS.zoomOut, "Zoom Out", "Ctrl+-", () => { app.viewport.zoomOut(); app.notify("viewport"); }, false, "ribbon-zoom-out"),
    ribbonAction(UI_ICONS.fit, "Fit to View", "Ctrl+B", () => app.fitToView(), false, "ribbon-zoom-fit"),
    ribbonAction(UI_ICONS.resize, "Actual Size", "Ctrl+0", () => { app.viewport.actualSize(app.document.width, app.document.height); app.notify("viewport"); }, false, "ribbon-actual-size"),
  );

  const guidesGroup = ribbonGroup("Guides");
  const rulersBtn = ribbonAction(
    UI_ICONS.ruler,
    app.viewport.showRulers ? "✓ Rulers" : "Rulers",
    "",
    () => {
      app.viewport.showRulers = !app.viewport.showRulers;
      app.notify("viewport");
    },
    false,
    "ribbon-rulers",
  );
  const gridBtn = ribbonAction(
    UI_ICONS.grid,
    app.viewport.showPixelGrid ? "✓ Pixel Grid" : "Pixel Grid",
    "",
    () => {
      app.viewport.showPixelGrid = !app.viewport.showPixelGrid;
      app.notify("viewport");
    },
    false,
    "ribbon-pixel-grid",
  );
  guidesGroup.append(rulersBtn, gridBtn);

  const infoGroup = ribbonGroup("Help & Shortcuts");
  infoGroup.append(
    ribbonAction(UI_ICONS.settings, "Shortcuts", "F1", () => app.openDialog({ type: "shortcuts" }), false, "ribbon-shortcuts"),
    ribbonAction(UI_ICONS.more, "About", "", () => app.openDialog({ type: "about" }), false, "ribbon-about"),
  );

  container.append(zoomGroup, guidesGroup, infoGroup);
  return container;
}

// ---------------------------------------------
// CONTEXTUAL TOOL STRIP
// ---------------------------------------------

function renderContextualStrip(app: AppState): HTMLElement {
  const strip = document.createElement("div");
  strip.className = "ribbon-context-strip";
  strip.dataset.testid = "ribbon-context-strip";

  const cur = getTool(app.currentTool);
  const indicator = document.createElement("div");
  indicator.className = "context-tool-indicator";
  indicator.append(svgEl(TOOL_SVG[app.currentTool]));
  const name = document.createElement("span");
  name.className = "context-tool-name";
  name.textContent = cur.name;
  indicator.append(name);
  strip.append(indicator);

  const opts = document.createElement("div");
  opts.className = "context-options-row";

  const id = app.currentTool;
  const needsBrush = [
    "paintbrush", "eraser", "cloneStamp", "recolor", "lineCurve", "rectangle",
    "roundedRectangle", "ellipse", "freeform", "pencil",
  ].includes(id);

  if (needsBrush) {
    opts.append(
      sliderField("Size", app.options.brushWidth, 1, 200, (v) => {
        app.options.brushWidth = v;
        app.notify("tool");
      }),
    );
  }

  if (["paintbrush", "eraser", "cloneStamp", "recolor"].includes(id)) {
    opts.append(
      sliderField("Hardness", Math.round(app.options.hardness * 100), 0, 100, (v) => {
        app.options.hardness = v / 100;
      }),
    );
    opts.append(
      checkField("Anti-alias", app.options.antialias, (v) => {
        app.options.antialias = v;
      }),
    );
    opts.append(
      checkField("Pressure", app.options.pressure, (v) => {
        app.options.pressure = v;
      }),
    );
  }

  if (["magicWand", "paintBucket", "recolor"].includes(id)) {
    opts.append(
      sliderField("Tolerance", app.options.tolerance, 0, 100, (v) => {
        app.options.tolerance = v;
      }),
    );
    opts.append(
      selectField("Flood", app.options.floodMode, ["contiguous", "global"], (v) => {
        app.options.floodMode = v as "contiguous" | "global";
      }),
    );
    opts.append(
      selectField("Sampling", app.options.sampleMode, ["layer", "image"], (v) => {
        app.options.sampleMode = v as "layer" | "image";
      }),
    );
  }

  if (["rectangle", "roundedRectangle", "ellipse", "freeform"].includes(id)) {
    opts.append(
      selectField("Draw", app.options.shapeMode, ["outline", "filled", "both"], (v) => {
        app.options.shapeMode = v as "outline" | "filled" | "both";
      }),
    );
  }

  if (id === "roundedRectangle") {
    opts.append(
      sliderField("Radius", app.options.cornerRadius, 0, 100, (v) => {
        app.options.cornerRadius = v;
      }),
    );
  }

  if (id === "gradient") {
    opts.append(
      selectField("Type", app.options.gradientType, ["linear", "radial", "diamond", "conical"], (v) => {
        app.options.gradientType = v as typeof app.options.gradientType;
      }),
    );
    opts.append(
      checkField("Alpha only", app.options.gradientAlphaOnly, (v) => {
        app.options.gradientAlphaOnly = v;
      }),
    );
    const fin = document.createElement("button");
    fin.className = "context-btn primary";
    fin.textContent = "Finish";
    fin.addEventListener("click", () => app.commitActiveTool());
    opts.append(fin);
  }

  if (id === "text" || id === "lineCurve") {
    const fin = document.createElement("button");
    fin.className = "context-btn primary";
    fin.textContent = "Finish";
    fin.addEventListener("click", () => app.commitActiveTool());
    opts.append(fin);
  }

  if (app.session.floating) {
    const fin = document.createElement("button");
    fin.className = "context-btn primary";
    fin.textContent = "Apply paste";
    fin.addEventListener("click", () => app.commitFloating());
    const cancel = document.createElement("button");
    cancel.className = "context-btn";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => app.cancelFloating());
    opts.append(fin, cancel);
  }

  if (id === "text") {
    const fonts = [
      "Segoe UI, system-ui, sans-serif",
      "Georgia, serif",
      "Courier New, monospace",
      "Impact, sans-serif",
      "Arial, sans-serif",
    ];
    opts.append(
      selectField("Font", app.options.fontFamily, fonts, (v) => {
        app.options.fontFamily = v;
      }),
    );
    opts.append(
      sliderField("Size", app.options.fontSize, 8, 120, (v) => {
        app.options.fontSize = v;
      }),
    );
    opts.append(
      checkField("Bold", app.options.fontBold, (v) => {
        app.options.fontBold = v;
      }),
    );
    opts.append(
      checkField("Italic", app.options.fontItalic, (v) => {
        app.options.fontItalic = v;
      }),
    );
  }

  strip.append(opts);
  return strip;
}

// ---------------------------------------------
// UI HELPER FUNCTIONS
// ---------------------------------------------

function ribbonGroup(title: string): HTMLElement {
  const g = document.createElement("div");
  g.className = "ribbon-group";
  const label = document.createElement("div");
  label.className = "ribbon-group-title";
  label.textContent = title;
  g.append(label);
  return g;
}

function ribbonAction(
  iconSvg: string,
  label: string,
  shortcut: string,
  onClick: () => void,
  disabled = false,
  testid?: string,
): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "ribbon-action-btn";
  b.disabled = disabled;
  if (testid) b.dataset.testid = testid;
  b.title = shortcut ? `${label} (${shortcut})` : label;

  b.append(svgEl(iconSvg));
  const span = document.createElement("span");
  span.className = "btn-label";
  span.textContent = label;
  b.append(span);

  b.addEventListener("click", (e) => {
    e.preventDefault();
    onClick();
  });
  return b;
}

function iconBtn(
  svg: string,
  title: string,
  onClick: () => void,
  disabled = false,
  testid?: string,
): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "ribbon-quick-btn";
  b.title = title;
  b.disabled = disabled;
  if (testid) b.dataset.testid = testid;
  b.append(svgEl(svg));
  b.addEventListener("click", onClick);
  return b;
}

function sliderField(label: string, value: number, min: number, max: number, on: (v: number) => void): HTMLElement {
  const wrap = document.createElement("label");
  wrap.className = "context-field";
  const lab = document.createElement("span");
  lab.textContent = `${label}:`;

  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.value = String(value);

  const valDisplay = document.createElement("span");
  valDisplay.className = "field-val";
  valDisplay.textContent = String(value);

  input.addEventListener("input", () => {
    valDisplay.textContent = input.value;
    on(Number(input.value));
  });

  wrap.append(lab, input, valDisplay);
  return wrap;
}

function checkField(label: string, value: boolean, on: (v: boolean) => void): HTMLElement {
  const wrap = document.createElement("label");
  wrap.className = "context-check";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = value;
  input.addEventListener("change", () => on(input.checked));
  wrap.append(input, label);
  return wrap;
}

function selectField(label: string, value: string, choices: string[], on: (v: string) => void): HTMLElement {
  const wrap = document.createElement("label");
  wrap.className = "context-field";
  const lab = document.createElement("span");
  lab.textContent = `${label}:`;

  const s = document.createElement("select");
  for (const c of choices) {
    const o = document.createElement("option");
    o.value = c;
    o.textContent = c[0].toUpperCase() + c.slice(1);
    if (c === value) o.selected = true;
    s.append(o);
  }
  s.addEventListener("change", () => on(s.value));
  wrap.append(lab, s);
  return wrap;
}

function applyOrOpenEffect(app: AppState, e: EffectDef): void {
  if (e.params.length) {
    app.openDialog({ type: "effect", effectId: e.id });
  } else {
    const params: Record<string, number | boolean | string> = {};
    for (const p of e.params) params[p.key] = p.value;
    app.applyEffect(e, params);
  }
}
