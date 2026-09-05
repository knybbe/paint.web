import type { AppState } from "../app-state";
import { ALL_TOOLS, getTool } from "../tools/registry";
import { svgEl, TOOL_SVG, UI_ICONS } from "./icons";
import { effectsByMenu } from "../effects/registry";
import type { EffectDef } from "../effects/base";
import { BLEND_MODES, type BlendMode } from "../core/blend";
import { hsvToRgb, rgbToHsv, fromHex, cssRgba, type Color } from "../core/color";
import { openCommandPalette } from "./react/command-palette";

export type MobileSheet = "none" | "tools" | "toolOpts" | "color" | "layers" | "fx" | "more";

export function mobileSheetTitle(sheet: MobileSheet, app: AppState): string {
  if (sheet === "toolOpts") return `${getTool(app.currentTool).name} Options`;
  const titles: Record<MobileSheet, string> = {
    none: "",
    tools: "Select Tool",
    toolOpts: "",
    color: "Color Studio",
    layers: "Layer Manager",
    fx: "Adjustments & Effects",
    more: "Commands & Settings",
  };
  return titles[sheet];
}

export function contextChipLabel(app: AppState): string {
  const curTool = getTool(app.currentTool);
  let detail = "";
  if (
    ["paintbrush", "eraser", "pencil", "cloneStamp", "recolor", "lineCurve", "rectangle", "roundedRectangle", "ellipse", "freeform"].includes(
      app.currentTool,
    )
  ) {
    detail = `${app.options.brushWidth}px`;
  } else if (["magicWand", "paintBucket"].includes(app.currentTool)) {
    detail = `Tol: ${app.options.tolerance}%`;
  } else if (app.currentTool === "text") {
    detail = `${app.options.fontSize}pt`;
  }
  return detail ? `${curTool.name} (${detail})` : curTool.name;
}

export function renderMobileSheetBody(sheet: MobileSheet, app: AppState, onDone: () => void): HTMLElement {
  if (sheet === "tools") return renderToolsSheet(app, onDone);
  if (sheet === "toolOpts") return renderToolOptionsSheet(app, onDone);
  if (sheet === "color") return renderColorSheet(app);
  if (sheet === "layers") return renderLayersSheet(app);
  if (sheet === "fx") return renderFxSheet(app, onDone);
  if (sheet === "more") return renderMoreSheet(app, onDone);
  return document.createElement("div");
}

// ---------------------------------------------
// MOBILE SHEET RENDERERS
// ---------------------------------------------

function renderToolsSheet(app: AppState, onDone: () => void): HTMLElement {
  const grid = document.createElement("div");
  grid.className = "mobile-tools-grid";

  for (const tool of ALL_TOOLS) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `mobile-tool-card ${app.currentTool === tool.id ? "active" : ""}`;
    card.dataset.tool = tool.id;
    card.dataset.testid = `mobile-tool-${tool.id}`;

    card.append(svgEl(TOOL_SVG[tool.id]));
    const name = document.createElement("span");
    name.className = "tool-card-name";
    name.textContent = tool.name;
    card.append(name);

    card.addEventListener("click", () => {
      app.setTool(tool.id);
      onDone();
    });
    grid.append(card);
  }
  return grid;
}

function renderToolOptionsSheet(app: AppState, onDone: () => void): HTMLElement {
  const container = document.createElement("div");
  container.className = "mobile-tool-options";

  const id = app.currentTool;
  const needsBrush = [
    "paintbrush", "eraser", "cloneStamp", "recolor", "lineCurve", "rectangle",
    "roundedRectangle", "ellipse", "freeform", "pencil",
  ].includes(id);

  if (needsBrush) {
    container.append(
      touchSlider("Brush Width", app.options.brushWidth, 1, 200, "px", (v) => {
        app.options.brushWidth = v;
        app.notify("tool");
      }),
    );
  }

  if (["paintbrush", "eraser", "cloneStamp", "recolor"].includes(id)) {
    container.append(
      touchSlider("Hardness", Math.round(app.options.hardness * 100), 0, 100, "%", (v) => {
        app.options.hardness = v / 100;
      }),
    );
    container.append(
      touchSwitch("Smooth Anti-Aliasing", app.options.antialias, (v) => {
        app.options.antialias = v;
      }),
    );
    container.append(
      touchSwitch("Stylus Pressure Sensitivity", app.options.pressure, (v) => {
        app.options.pressure = v;
      }),
    );
  }

  if (["magicWand", "paintBucket", "recolor"].includes(id)) {
    container.append(
      touchSlider("Tolerance", app.options.tolerance, 0, 100, "%", (v) => {
        app.options.tolerance = v;
      }),
    );
    container.append(
      touchSegmented(
        "Flood Mode",
        [
          { label: "Contiguous", value: "contiguous" },
          { label: "Global", value: "global" },
        ],
        app.options.floodMode,
        (v) => {
          app.options.floodMode = v as "contiguous" | "global";
        },
      ),
    );
    container.append(
      touchSegmented(
        "Sampling",
        [
          { label: "Layer", value: "layer" },
          { label: "Image", value: "image" },
        ],
        app.options.sampleMode,
        (v) => {
          app.options.sampleMode = v as "layer" | "image";
        },
      ),
    );
  }

  if (["rectangle", "roundedRectangle", "ellipse", "freeform"].includes(id)) {
    container.append(
      touchSegmented(
        "Draw Mode",
        [
          { label: "Outline", value: "outline" },
          { label: "Filled", value: "filled" },
          { label: "Both", value: "both" },
        ],
        app.options.shapeMode,
        (v) => {
          app.options.shapeMode = v as "outline" | "filled" | "both";
        },
      ),
    );
  }

  if (id === "roundedRectangle") {
    container.append(
      touchSlider("Corner Radius", app.options.cornerRadius, 0, 100, "px", (v) => {
        app.options.cornerRadius = v;
      }),
    );
  }

  if (id === "gradient") {
    container.append(
      touchSegmented(
        "Gradient Type",
        [
          { label: "Linear", value: "linear" },
          { label: "Radial", value: "radial" },
          { label: "Diamond", value: "diamond" },
          { label: "Conical", value: "conical" },
        ],
        app.options.gradientType,
        (v) => {
          app.options.gradientType = v as typeof app.options.gradientType;
        },
      ),
    );
    container.append(
      touchSwitch("Alpha Only", app.options.gradientAlphaOnly, (v) => {
        app.options.gradientAlphaOnly = v;
      }),
    );
    const fin = touchButton("Commit Gradient", () => {
      app.commitActiveTool();
      onDone();
    }, true);
    container.append(fin);
  }

  if (id === "text") {
    container.append(
      touchSlider("Font Size", app.options.fontSize, 8, 120, "pt", (v) => {
        app.options.fontSize = v;
      }),
    );
    container.append(
      touchSwitch("Bold", app.options.fontBold, (v) => {
        app.options.fontBold = v;
      }),
    );
    container.append(
      touchSwitch("Italic", app.options.fontItalic, (v) => {
        app.options.fontItalic = v;
      }),
    );
    const fin = touchButton("Commit Text", () => {
      app.commitActiveTool();
      onDone();
    }, true);
    container.append(fin);
  }

  if (app.session.floating) {
    const btnRow = document.createElement("div");
    btnRow.className = "touch-btn-row";
    btnRow.append(
      touchButton("Apply Paste", () => {
        app.commitFloating();
        onDone();
      }, true),
      touchButton("Cancel", () => {
        app.cancelFloating();
        onDone();
      }, false),
    );
    container.append(btnRow);
  }

  return container;
}

function renderColorSheet(app: AppState): HTMLElement {
  const container = document.createElement("div");
  container.className = "mobile-color-studio";

  // Swatches & Swap Row
  const swatchesRow = document.createElement("div");
  swatchesRow.className = "mobile-swatches-row";

  const primaryBox = document.createElement("button");
  primaryBox.type = "button";
  primaryBox.className = `mobile-swatch ${app.activeColor === "primary" ? "active" : ""}`;
  primaryBox.style.background = cssRgba(app.primary);
  primaryBox.innerHTML = `<span>Primary</span>`;
  primaryBox.addEventListener("click", () => {
    app.activeColor = "primary";
    app.notify("colors");
  });

  const secondaryBox = document.createElement("button");
  secondaryBox.type = "button";
  secondaryBox.className = `mobile-swatch ${app.activeColor === "secondary" ? "active" : ""}`;
  secondaryBox.style.background = cssRgba(app.secondary);
  secondaryBox.innerHTML = `<span>Secondary</span>`;
  secondaryBox.addEventListener("click", () => {
    app.activeColor = "secondary";
    app.notify("colors");
  });

  const swapBtn = document.createElement("button");
  swapBtn.type = "button";
  swapBtn.className = "mobile-swap-btn";
  swapBtn.append(svgEl(UI_ICONS.swap));
  swapBtn.addEventListener("click", () => app.swapColors());

  swatchesRow.append(primaryBox, secondaryBox, swapBtn);
  container.append(swatchesRow);

  // Quick Preset Swatches
  const presets = [
    "#000000", "#ffffff", "#ef4444", "#f97316", "#facc15",
    "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  ];
  const presetGrid = document.createElement("div");
  presetGrid.className = "mobile-color-presets";
  for (const hex of presets) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "preset-chip";
    chip.style.backgroundColor = hex;
    chip.addEventListener("click", () => {
      const c = fromHex(hex);
      if (c) app.setActiveColorValue(c);
    });
    presetGrid.append(chip);
  }
  container.append(presetGrid);

  // Interactive Color Wheel
  const wheelWrap = document.createElement("div");
  wheelWrap.className = "mobile-wheel-wrap";
  const wheel = document.createElement("canvas");
  wheel.width = 180;
  wheel.height = 180;
  wheelWrap.append(wheel);
  container.append(wheelWrap);

  drawMobileWheel(wheel, app.activeColor === "primary" ? app.primary : app.secondary);
  bindWheelTouch(wheel, app);

  // Live RGB Sliders
  const activeColor = app.activeColor === "primary" ? app.primary : app.secondary;
  const sliders = document.createElement("div");
  sliders.className = "mobile-sliders-list";

  sliders.append(
    touchSlider("Red", activeColor.r, 0, 255, "", (v) => {
      const c = { ...activeColor, r: v };
      app.setActiveColorValue(c);
    }),
    touchSlider("Green", activeColor.g, 0, 255, "", (v) => {
      const c = { ...activeColor, g: v };
      app.setActiveColorValue(c);
    }),
    touchSlider("Blue", activeColor.b, 0, 255, "", (v) => {
      const c = { ...activeColor, b: v };
      app.setActiveColorValue(c);
    }),
    touchSlider("Alpha", Math.round((activeColor.a / 255) * 100), 0, 100, "%", (v) => {
      const c = { ...activeColor, a: Math.round((v / 100) * 255) };
      app.setActiveColorValue(c);
    }),
  );

  container.append(sliders);
  return container;
}

function renderLayersSheet(app: AppState): HTMLElement {
  const container = document.createElement("div");
  container.className = "mobile-layers-manager";

  // Action Buttons row
  const actionRow = document.createElement("div");
  actionRow.className = "mobile-layers-actions";

  actionRow.append(
    touchBtnWithIcon(UI_ICONS.addLayer, "Add", () => app.addLayer(), false, "mobile-layer-add"),
    touchBtnWithIcon(UI_ICONS.duplicateLayer, "Duplicate", () => app.duplicateLayer(), false, "mobile-layer-dup"),
    touchBtnWithIcon(UI_ICONS.arrowUp, "Up", () => app.moveActiveLayer(1), app.document.activeIndex >= app.document.layers.length - 1, "mobile-layer-up"),
    touchBtnWithIcon(UI_ICONS.arrowDown, "Down", () => app.moveActiveLayer(-1), app.document.activeIndex <= 0, "mobile-layer-down"),
    touchBtnWithIcon(UI_ICONS.merge, "Merge", () => app.mergeDown(), app.document.activeIndex <= 0, "mobile-layer-merge"),
    touchBtnWithIcon(UI_ICONS.deleteLayer, "Delete", () => app.deleteLayer(), app.document.layers.length <= 1, "mobile-layer-del"),
  );
  container.append(actionRow);

  // Layer list
  const list = document.createElement("div");
  list.className = "mobile-layers-list";

  app.document.layers.forEach((layer) => {
    const item = document.createElement("div");
    const isActive = layer.id === app.document.activeLayerId;
    item.className = `mobile-layer-item ${isActive ? "active" : ""}`;

    const eyeBtn = document.createElement("button");
    eyeBtn.type = "button";
    eyeBtn.className = "mobile-layer-eye";
    eyeBtn.append(svgEl(layer.visible ? UI_ICONS.eye : UI_ICONS.eyeOff));
    eyeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      layer.visible = !layer.visible;
      app.compositor.invalidate();
      app.document.dirty = true;
      app.notify("document");
      app.notify("layers");
    });

    const thumb = document.createElement("img");
    thumb.className = "mobile-layer-thumb";
    thumb.src = layer.thumbnailDataUrl(48);

    const name = document.createElement("span");
    name.className = "mobile-layer-name";
    name.textContent = layer.name;

    item.append(eyeBtn, thumb, name);
    item.addEventListener("click", () => {
      app.document.setActive(layer.id);
      app.notify("layers");
    });

    list.append(item);
  });
  container.append(list);

  // Active Layer Opacity & Blend Mode
  const curLayer = app.document.activeLayer;
  const propGroup = document.createElement("div");
  propGroup.className = "mobile-layer-props-group";

  propGroup.append(
    touchSlider("Opacity", Math.round((curLayer.opacity / 255) * 100), 0, 100, "%", (v) => {
      curLayer.opacity = Math.round((v / 100) * 255);
      app.compositor.invalidate();
      app.document.dirty = true;
    }),
  );

  const blendLabel = document.createElement("div");
  blendLabel.className = "touch-select-wrap";
  blendLabel.textContent = "Blend Mode: ";
  const blendSel = document.createElement("select");
  blendSel.className = "touch-select";
  for (const m of BLEND_MODES) {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    if (m === curLayer.blendMode) opt.selected = true;
    blendSel.append(opt);
  }
  blendSel.addEventListener("change", () => {
    curLayer.blendMode = blendSel.value as BlendMode;
    app.compositor.invalidate();
    app.document.dirty = true;
  });
  blendLabel.append(blendSel);
  propGroup.append(blendLabel);

  container.append(propGroup);
  return container;
}

function renderFxSheet(app: AppState, onDone: () => void): HTMLElement {
  const container = document.createElement("div");
  container.className = "mobile-fx-sheet";

  const categories: { name: string; list: EffectDef[] }[] = [
    { name: "Adjustments", list: effectsByMenu("Adjustments") },
    { name: "Blurs", list: effectsByMenu("Blurs") },
    { name: "Distort", list: effectsByMenu("Distort") },
    { name: "Noise", list: effectsByMenu("Noise") },
    { name: "Photo", list: effectsByMenu("Photo") },
    { name: "Render", list: effectsByMenu("Render") },
    { name: "Stylize", list: effectsByMenu("Stylize") },
  ];

  for (const cat of categories) {
    const header = document.createElement("h4");
    header.className = "mobile-fx-cat-title";
    header.textContent = cat.name;
    container.append(header);

    const grid = document.createElement("div");
    grid.className = "mobile-fx-grid";

    for (const ef of cat.list) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mobile-fx-btn";
      btn.textContent = ef.name;
      btn.addEventListener("click", () => {
        onDone();
        if (ef.params.length) {
          app.openDialog({ type: "effect", effectId: ef.id });
        } else {
          const params: Record<string, number | boolean | string> = {};
          for (const p of ef.params) params[p.key] = p.value;
          app.applyEffect(ef, params);
        }
      });
      grid.append(btn);
    }
    container.append(grid);
  }
  return container;
}

function renderMoreSheet(app: AppState, onDone: () => void): HTMLElement {
  const container = document.createElement("div");
  container.className = "mobile-more-sheet";

  const sections: { title: string; items: { label: string; icon: string; action: () => void }[] }[] = [
    {
      title: "File Operations",
      items: [
        { label: "Search commands", icon: UI_ICONS.search, action: () => openCommandPalette() },
        { label: "New", icon: UI_ICONS.new, action: () => app.openDialog({ type: "new" }) },
        { label: "Open", icon: UI_ICONS.open, action: () => void app.openFiles() },
        { label: "Save", icon: UI_ICONS.save, action: () => void app.save(false) },
        { label: "Save As", icon: UI_ICONS.save, action: () => void app.save(true) },
        { label: "Folder Sync...", icon: UI_ICONS.sync, action: () => app.openDialog({ type: "sync" }) },
        { label: "Print", icon: UI_ICONS.save, action: () => app.print() },
      ],
    },
    {
      title: "Image & Canvas",
      items: [
        { label: "Crop to Selection", icon: UI_ICONS.crop, action: () => app.cropToSelection() },
        { label: "Resize Image...", icon: UI_ICONS.resize, action: () => app.openDialog({ type: "resize" }) },
        { label: "Canvas Size...", icon: UI_ICONS.resize, action: () => app.openDialog({ type: "canvas" }) },
        { label: "Rotate 90° CW", icon: UI_ICONS.rotate, action: () => app.transform("rotate90cw") },
        { label: "Rotate 90° CCW", icon: UI_ICONS.rotate, action: () => app.transform("rotate90ccw") },
        { label: "Flip Horizontal", icon: UI_ICONS.flip, action: () => app.transform("flipH") },
        { label: "Flip Vertical", icon: UI_ICONS.flip, action: () => app.transform("flipV") },
        { label: "Flatten Image", icon: UI_ICONS.flatten, action: () => app.flatten() },
      ],
    },
    {
      title: "View & Settings",
      items: [
        { label: "Settings", icon: UI_ICONS.settings, action: () => app.openDialog({ type: "settings" }) },
        { label: "Keyboard Shortcuts", icon: UI_ICONS.settings, action: () => app.openDialog({ type: "shortcuts" }) },
        { label: "About paint.web", icon: UI_ICONS.more, action: () => app.openDialog({ type: "about" }) },
      ],
    },
  ];

  for (const sec of sections) {
    const title = document.createElement("h4");
    title.className = "mobile-more-sec-title";
    title.textContent = sec.title;
    container.append(title);

    const list = document.createElement("div");
    list.className = "mobile-more-list";

    for (const item of sec.items) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "mobile-more-row";
      row.append(svgEl(item.icon));
      const lbl = document.createElement("span");
      lbl.textContent = item.label;
      row.append(lbl);

      row.addEventListener("click", () => {
        onDone();
        item.action();
      });
      list.append(row);
    }
    container.append(list);
  }

  container.append(
    touchSegmented(
      "Finger on canvas",
      [
        { label: "Draw", value: "draw" },
        { label: "Pan", value: "pan" },
      ],
      app.options.touchFingerMode,
      (v) => {
        app.options.touchFingerMode = v as "draw" | "pan";
        app.notify("tool");
      },
    ),
  );

  return container;
}

// ---------------------------------------------
// TOUCH HELPERS
// ---------------------------------------------

function touchButton(label: string, on: () => void, primary = false): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `touch-btn ${primary ? "primary" : ""}`;
  b.textContent = label;
  b.addEventListener("click", on);
  return b;
}

function touchBtnWithIcon(svg: string, label: string, on: () => void, disabled = false, testid?: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "touch-icon-btn";
  b.disabled = disabled;
  if (testid) b.dataset.testid = testid;
  b.append(svgEl(svg));
  const span = document.createElement("span");
  span.textContent = label;
  b.append(span);
  b.addEventListener("click", on);
  return b;
}

function touchSlider(label: string, val: number, min: number, max: number, unit: string, on: (v: number) => void): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "touch-slider-field";

  const header = document.createElement("div");
  header.className = "slider-header";
  const name = document.createElement("span");
  name.textContent = label;
  const num = document.createElement("span");
  num.className = "slider-value";
  num.textContent = `${val}${unit}`;
  header.append(name, num);

  const range = document.createElement("input");
  range.type = "range";
  range.min = String(min);
  range.max = String(max);
  range.value = String(val);

  range.addEventListener("input", () => {
    num.textContent = `${range.value}${unit}`;
    on(Number(range.value));
  });

  wrap.append(header, range);
  return wrap;
}

function touchSwitch(label: string, checked: boolean, on: (v: boolean) => void): HTMLElement {
  const wrap = document.createElement("label");
  wrap.className = "touch-switch-field";

  const span = document.createElement("span");
  span.textContent = label;

  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.checked = checked;
  toggle.addEventListener("change", () => on(toggle.checked));

  wrap.append(span, toggle);
  return wrap;
}

function touchSegmented(
  title: string,
  options: { label: string; value: string }[],
  selected: string,
  on: (v: string) => void,
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "touch-segmented-field";

  const titleEl = document.createElement("div");
  titleEl.className = "segmented-title";
  titleEl.textContent = title;
  wrap.append(titleEl);

  const pills = document.createElement("div");
  pills.className = "segmented-pills";

  for (const opt of options) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `segmented-pill ${opt.value === selected ? "active" : ""}`;
    btn.textContent = opt.label;
    btn.addEventListener("click", () => {
      for (const c of pills.children) c.classList.remove("active");
      btn.classList.add("active");
      on(opt.value);
    });
    pills.append(btn);
  }
  wrap.append(pills);
  return wrap;
}

function drawMobileWheel(canvas: HTMLCanvasElement, activeColor: Color): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const outer = cx - 4;
  const inner = outer - 20;

  for (let angle = 0; angle < 360; angle += 1) {
    const start = ((angle - 0.5) * Math.PI) / 180;
    const end = ((angle + 0.5) * Math.PI) / 180;
    ctx.beginPath();
    ctx.arc(cx, cy, outer, start, end);
    ctx.arc(cx, cy, inner, end, start, true);
    ctx.closePath();
    ctx.fillStyle = `hsl(${angle}, 100%, 50%)`;
    ctx.fill();
  }

  // Inner saturation/brightness square or circle
  const tri = inner - 6;
  const imgData = ctx.createImageData(Math.floor(tri * 2), Math.floor(tri * 2));
  const curHsv = rgbToHsv(activeColor);

  for (let y = 0; y < imgData.height; y++) {
    for (let x = 0; x < imgData.width; x++) {
      const dx = x - tri;
      const dy = y - tri;
      const dist = Math.hypot(dx, dy);
      const idx = (y * imgData.width + x) * 4;
      if (dist <= tri) {
        const sat = clamp01((dx / tri + 1) / 2);
        const val = clamp01(1 - (dy / tri + 1) / 2);
        const rgb = hsvToRgb(curHsv.h, sat, val, 1);
        imgData.data[idx] = rgb.r;
        imgData.data[idx + 1] = rgb.g;
        imgData.data[idx + 2] = rgb.b;
        imgData.data[idx + 3] = 255;
      } else {
        imgData.data[idx + 3] = 0;
      }
    }
  }
  ctx.putImageData(imgData, cx - tri, cy - tri);
}

function bindWheelTouch(canvas: HTMLCanvasElement, app: AppState): void {
  const handler = (e: MouseEvent | TouchEvent) => {
    const r = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const x = ((clientX - r.left) / r.width) * canvas.width;
    const y = ((clientY - r.top) / r.height) * canvas.height;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    const rad = Math.hypot(dx, dy);
    const outer = canvas.width / 2 - 4;
    const inner = outer - 20;
    const cur = rgbToHsv(app.activeColor === "primary" ? app.primary : app.secondary);

    if (rad >= inner && rad <= outer) {
      let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (ang < 0) ang += 360;
      const next = hsvToRgb(ang, cur.s, cur.v, cur.a);
      app.setActiveColorValue(next);
      drawMobileWheel(canvas, next);
      return;
    }

    const tri = inner - 6;
    if (rad <= tri) {
      const sat = clamp01((dx / tri + 1) / 2);
      const val = clamp01(1 - (dy / tri + 1) / 2);
      const c = hsvToRgb(cur.h, sat, val, cur.a);
      app.setActiveColorValue(c);
      drawMobileWheel(canvas, c);
    }
  };

  canvas.addEventListener("pointerdown", handler);
  canvas.addEventListener("pointermove", (e) => {
    if (e.buttons > 0) handler(e);
  });
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
