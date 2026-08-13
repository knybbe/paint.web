import type { AppState } from "../app-state";
import { svgEl, UI_ICONS } from "./icons";
import { ALL_TOOLS } from "../tools/registry";
import type { ToolId } from "../tools/base";

export function mountToolbar(root: HTMLElement, app: AppState): void {
  const paint = () => {
    root.className = "toolbar";
    root.dataset.testid = "toolbar";
    root.innerHTML = "";

    const actions = document.createElement("div");
    actions.className = "tb-group";
    actions.append(
      btn(UI_ICONS.new, "New (Ctrl+N)", () => app.openDialog({ type: "new" })),
      btn(UI_ICONS.open, "Open (Ctrl+O)", () => void app.openFiles()),
      btn(UI_ICONS.save, "Save (Ctrl+S)", () => void app.save(false)),
      sep(),
      btn(UI_ICONS.undo, app.history.canUndo ? `Undo ${app.history.undoName}` : "Undo", () => app.undo(), !app.history.canUndo),
      btn(UI_ICONS.redo, app.history.canRedo ? `Redo ${app.history.redoName}` : "Redo", () => app.redo(), !app.history.canRedo),
      sep(),
      btn(UI_ICONS.cut, "Cut", () => void app.cut()),
      btn(UI_ICONS.copy, "Copy", () => void app.copy(false)),
      btn(UI_ICONS.paste, "Paste", () => void app.paste("normal")),
      sep(),
      btn(UI_ICONS.crop, "Crop to Selection", () => app.cropToSelection(), app.selection.empty),
    );
    root.append(actions);

    const toolSel = document.createElement("select");
    toolSel.title = "Tool (Alt+T)";
    for (const t of ALL_TOOLS) {
      const o = document.createElement("option");
      o.value = t.id;
      o.textContent = t.name;
      if (t.id === app.currentTool) o.selected = true;
      toolSel.append(o);
    }
    toolSel.addEventListener("change", () => app.setTool(toolSel.value as ToolId));
    const toolGroup = document.createElement("div");
    toolGroup.className = "tb-group";
    toolGroup.append(labelWrap("Tool", toolSel));
    root.append(sep(), toolGroup);

    const opts = document.createElement("div");
    opts.className = "tb-group";
    const id = app.currentTool;
    const needsBrush = ["paintbrush", "eraser", "cloneStamp", "recolor", "lineCurve", "rectangle", "roundedRectangle", "ellipse", "freeform", "pencil"].includes(id);
    if (needsBrush) {
      opts.append(numField("Brush width", app.options.brushWidth, 1, 2000, (v) => { app.options.brushWidth = v; app.notify("tool"); }));
    }
    if (["paintbrush", "eraser", "cloneStamp", "recolor"].includes(id)) {
      opts.append(numField("Hardness", Math.round(app.options.hardness * 100), 0, 100, (v) => { app.options.hardness = v / 100; }));
    }
    if (["paintbrush", "eraser", "cloneStamp", "recolor", "lineCurve", "rectangle", "roundedRectangle", "ellipse", "freeform", "text"].includes(id)) {
      opts.append(check("Anti-aliasing", app.options.antialias, (v) => { app.options.antialias = v; }));
    }
    if (["paintbrush", "eraser", "cloneStamp", "recolor"].includes(id)) {
      opts.append(check("Pressure", app.options.pressure, (v) => { app.options.pressure = v; }));
    }
    if (["magicWand", "paintBucket", "recolor"].includes(id)) {
      opts.append(numField("Tolerance", app.options.tolerance, 0, 100, (v) => { app.options.tolerance = v; }));
      opts.append(selectField("Flooding", app.options.floodMode, ["contiguous", "global"], (v) => { app.options.floodMode = v as "contiguous" | "global"; }));
      opts.append(selectField("Sampling", app.options.sampleMode, ["layer", "image"], (v) => { app.options.sampleMode = v as "layer" | "image"; }));
    }
    if (["rectangle", "roundedRectangle", "ellipse", "freeform"].includes(id)) {
      opts.append(selectField("Draw", app.options.shapeMode, ["outline", "filled", "both"], (v) => { app.options.shapeMode = v as "outline" | "filled" | "both"; }));
    }
    if (id === "roundedRectangle") {
      opts.append(numField("Radius", app.options.cornerRadius, 0, 500, (v) => { app.options.cornerRadius = v; }));
    }
    if (id === "gradient") {
      opts.append(selectField("Type", app.options.gradientType, ["linear", "radial", "diamond", "conical"], (v) => { app.options.gradientType = v as typeof app.options.gradientType; }));
      opts.append(check("Alpha only", app.options.gradientAlphaOnly, (v) => { app.options.gradientAlphaOnly = v; }));
      const fin = document.createElement("button");
      fin.className = "btn";
      fin.textContent = "Finish";
      fin.addEventListener("click", () => app.commitActiveTool());
      opts.append(fin);
    }
    if (id === "text" || id === "lineCurve") {
      const fin = document.createElement("button");
      fin.className = "btn";
      fin.textContent = "Finish";
      fin.addEventListener("click", () => app.commitActiveTool());
      opts.append(fin);
    }
    if (app.session.floating) {
      const fin = document.createElement("button");
      fin.className = "btn primary";
      fin.textContent = "Apply paste";
      fin.addEventListener("click", () => app.commitFloating());
      const cancel = document.createElement("button");
      cancel.className = "btn";
      cancel.textContent = "Cancel";
      cancel.addEventListener("click", () => app.cancelFloating());
      opts.append(fin, cancel);
    }
    if (id === "text") {
      const fonts = ["Segoe UI, system-ui, sans-serif", "Georgia, serif", "Courier New, monospace", "Impact, sans-serif", "Times New Roman, serif", "Arial, sans-serif"];
      opts.append(selectField("Font", app.options.fontFamily, fonts, (v) => { app.options.fontFamily = v; }));
      opts.append(numField("Size", app.options.fontSize, 4, 400, (v) => { app.options.fontSize = v; }));
      opts.append(check("Bold", app.options.fontBold, (v) => { app.options.fontBold = v; }));
      opts.append(check("Italic", app.options.fontItalic, (v) => { app.options.fontItalic = v; }));
    }
    root.append(opts);
  };

  paint();
  app.addEventListener("tool", paint);
  app.addEventListener("history", paint);
  app.addEventListener("selection", paint);
  app.addEventListener("document", paint);
}

function btn(svg: string, title: string, onClick: () => void, disabled = false): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = "tb-btn";
  b.title = title;
  b.disabled = disabled;
  b.append(svgEl(svg));
  b.addEventListener("click", onClick);
  return b;
}

function sep(): HTMLElement {
  const s = document.createElement("div");
  s.className = "tb-sep";
  return s;
}

function labelWrap(text: string, el: HTMLElement): HTMLElement {
  const l = document.createElement("label");
  l.className = "tb";
  l.append(text, el);
  return l;
}

function numField(label: string, value: number, min: number, max: number, on: (v: number) => void): HTMLElement {
  const input = document.createElement("input");
  input.type = "number";
  input.min = String(min);
  input.max = String(max);
  input.value = String(value);
  input.addEventListener("change", () => on(Math.max(min, Math.min(max, Number(input.value) || min))));
  return labelWrap(label, input);
}

function check(label: string, value: boolean, on: (v: boolean) => void): HTMLElement {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = value;
  input.addEventListener("change", () => on(input.checked));
  return labelWrap(label, input);
}

function selectField(label: string, value: string, choices: string[], on: (v: string) => void): HTMLElement {
  const s = document.createElement("select");
  for (const c of choices) {
    const o = document.createElement("option");
    o.value = c;
    o.textContent = c[0].toUpperCase() + c.slice(1);
    if (c === value) o.selected = true;
    s.append(o);
  }
  s.addEventListener("change", () => on(s.value));
  return labelWrap(label, s);
}
