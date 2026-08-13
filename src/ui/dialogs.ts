import type { AppState } from "../app-state";
import { getEffect } from "../effects/registry";
import { paramMap } from "../effects/base";
import type { SaveFormat } from "../core/file-io";
import { BLEND_MODES, type BlendMode } from "../core/blend";

export function mountDialogHost(host: HTMLElement, app: AppState): void {
  const paint = () => {
    host.innerHTML = "";
    const d = app.dialog;
    if (!d) return;
    const back = document.createElement("div");
    back.className = "modal-back";
    back.addEventListener("mousedown", (e) => {
      if (e.target === back) app.closeDialog();
    });
    const box = document.createElement("div");
    box.className = "dialog";
    box.dataset.testid = "dialog";
    back.dataset.testid = "modal";
    back.append(box);
    host.append(back);

    if (d.type === "new") renderNew(box, app);
    else if (d.type === "resize") renderResize(box, app);
    else if (d.type === "canvas") renderCanvas(box, app);
    else if (d.type === "layerProps") renderLayerProps(box, app);
    else if (d.type === "effect") renderEffect(box, app, d.effectId);
    else if (d.type === "about") renderAbout(box, app);
    else if (d.type === "settings") renderSettings(box, app);
    else if (d.type === "shortcuts") renderShortcuts(box, app);
    else if (d.type === "saveAs") renderSaveAs(box, app, d.format);
    else if (d.type === "rotateZoom") renderRotateZoom(box, app);
  };
  paint();
  app.addEventListener("dialog", paint);
}

function header(box: HTMLElement, title: string): HTMLElement {
  const h = document.createElement("h2");
  h.textContent = title;
  const body = document.createElement("div");
  body.className = "body";
  box.append(h, body);
  return body;
}

function actions(box: HTMLElement, primary: string, onOk: () => void, app: AppState, extra?: HTMLElement): void {
  const row = document.createElement("div");
  row.className = "actions";
  if (extra) row.append(extra);
  const cancel = document.createElement("button");
  cancel.className = "btn";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", () => app.closeDialog());
  const ok = document.createElement("button");
  ok.className = "btn primary";
  ok.textContent = primary;
  ok.addEventListener("click", onOk);
  row.append(cancel, ok);
  box.append(row);
}

function field(grid: HTMLElement, label: string, el: HTMLElement): void {
  const l = document.createElement("label");
  l.textContent = label;
  grid.append(l, el);
}

function num(value: number, min = 1, max = 32000): HTMLInputElement {
  const i = document.createElement("input");
  i.type = "number";
  i.min = String(min);
  i.max = String(max);
  i.value = String(value);
  return i;
}

function renderNew(box: HTMLElement, app: AppState): void {
  const body = header(box, "New Image");
  const g = document.createElement("div");
  g.className = "form-grid";
  const w = num(app.settings.defaultWidth);
  const h = num(app.settings.defaultHeight);
  const dpi = num(app.settings.defaultDpi, 1, 2400);
  const bg = document.createElement("select");
  for (const b of ["White", "Black", "Transparent"] as const) {
    const o = document.createElement("option");
    o.value = b;
    o.textContent = b;
    if (b === app.settings.defaultBackground) o.selected = true;
    bg.append(o);
  }
  field(g, "Width", w);
  field(g, "Height", h);
  field(g, "Resolution (DPI)", dpi);
  field(g, "Background", bg);
  body.append(g);
  actions(box, "OK", () => {
    app.newDocument({
      width: Number(w.value) || 800,
      height: Number(h.value) || 600,
      dpi: Number(dpi.value) || 96,
      background: bg.value as "White" | "Black" | "Transparent",
    });
    app.viewport.fitToWindow(app.document.width, app.document.height);
    app.notify("viewport");
    app.closeDialog();
  }, app);
}

function renderResize(box: HTMLElement, app: AppState): void {
  const body = header(box, "Resize");
  const g = document.createElement("div");
  g.className = "form-grid";
  const w = num(app.document.width);
  const h = num(app.document.height);
  const keep = document.createElement("input");
  keep.type = "checkbox";
  keep.checked = true;
  const ratio = app.document.width / app.document.height;
  w.addEventListener("input", () => {
    if (keep.checked) h.value = String(Math.max(1, Math.round(Number(w.value) / ratio)));
  });
  h.addEventListener("input", () => {
    if (keep.checked) w.value = String(Math.max(1, Math.round(Number(h.value) * ratio)));
  });
  const resampling = document.createElement("select");
  resampling.innerHTML = `<option value="bilinear">Bilinear (Best Quality)</option><option value="nearest">Nearest Neighbor</option>`;
  field(g, "Width", w);
  field(g, "Height", h);
  field(g, "Maintain aspect", keep);
  field(g, "Resampling", resampling);
  body.append(g);
  actions(box, "OK", () => {
    app.resizeImage(Number(w.value) || 1, Number(h.value) || 1, resampling.value as "nearest" | "bilinear");
    app.closeDialog();
  }, app);
}

function renderCanvas(box: HTMLElement, app: AppState): void {
  const body = header(box, "Canvas Size");
  const g = document.createElement("div");
  g.className = "form-grid";
  const w = num(app.document.width);
  const h = num(app.document.height);
  const anchor = document.createElement("select");
  const anchors = [
    ["center", "Middle"],
    ["nw", "Top Left"],
    ["n", "Top"],
    ["ne", "Top Right"],
    ["w", "Left"],
    ["e", "Right"],
    ["sw", "Bottom Left"],
    ["s", "Bottom"],
    ["se", "Bottom Right"],
  ];
  for (const [v, l] of anchors) {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = l;
    anchor.append(o);
  }
  field(g, "Width", w);
  field(g, "Height", h);
  field(g, "Anchor", anchor);
  body.append(g);
  actions(box, "OK", () => {
    const nw = Number(w.value) || 1;
    const nh = Number(h.value) || 1;
    const dw = nw - app.document.width;
    const dh = nh - app.document.height;
    const a = anchor.value;
    const ox = a.includes("e") ? 0 : a.includes("w") ? dw : Math.round(dw / 2);
    const oy = a.includes("s") ? 0 : a.includes("n") ? dh : Math.round(dh / 2);
    app.resizeCanvas(nw, nh, ox, oy);
    app.closeDialog();
  }, app);
}

function renderLayerProps(box: HTMLElement, app: AppState): void {
  const layer = app.document.activeLayer;
  const body = header(box, "Layer Properties");
  const g = document.createElement("div");
  g.className = "form-grid";
  const name = document.createElement("input");
  name.type = "text";
  name.value = layer.name;
  const op = num(layer.opacity, 0, 255);
  const blend = document.createElement("select");
  for (const m of BLEND_MODES) {
    const o = document.createElement("option");
    o.value = m;
    o.textContent = m;
    if (m === layer.blendMode) o.selected = true;
    blend.append(o);
  }
  const vis = document.createElement("input");
  vis.type = "checkbox";
  vis.checked = layer.visible;
  const lock = document.createElement("input");
  lock.type = "checkbox";
  lock.checked = layer.locked;
  field(g, "Name", name);
  field(g, "Opacity (0–255)", op);
  field(g, "Blend mode", blend);
  field(g, "Visible", vis);
  field(g, "Locked", lock);
  body.append(g);
  actions(box, "OK", () => {
    app.setLayerProps(layer.id, {
      name: name.value || layer.name,
      opacity: Number(op.value),
      blendMode: blend.value as BlendMode,
      visible: vis.checked,
      locked: lock.checked,
    });
    app.closeDialog();
  }, app);
}

function renderEffect(box: HTMLElement, app: AppState, id: string): void {
  const effect = getEffect(id);
  if (!effect) {
    app.closeDialog();
    return;
  }
  const body = header(box, effect.name);
  const params = effect.params.map((p) => ({ ...p }));
  const layer = app.document.activeLayer;
  const original = layer.buffer.clone();

  const previewRow = document.createElement("div");
  previewRow.className = "preview-row";
  const before = document.createElement("canvas");
  const after = document.createElement("canvas");
  previewRow.append(before, after);
  body.append(previewRow);

  const g = document.createElement("div");
  g.className = "form-grid";
  const controls: HTMLElement[] = [];
  for (const p of params) {
    if (p.type === "range") {
      const wrap = document.createElement("div");
      const r = document.createElement("input");
      r.type = "range";
      r.min = String(p.min ?? 0);
      r.max = String(p.max ?? 100);
      r.step = String(p.step ?? 1);
      r.value = String(p.value);
      const n = document.createElement("input");
      n.type = "number";
      n.value = String(p.value);
      const sync = () => {
        p.value = Number(r.value);
        n.value = r.value;
        runPreview();
      };
      r.addEventListener("input", sync);
      n.addEventListener("change", () => {
        r.value = n.value;
        sync();
      });
      wrap.append(r, n);
      field(g, p.label, wrap);
      controls.push(wrap);
    }
  }
  body.append(g);

  const restore = () => {
    layer.buffer = original;
    app.compositor.invalidate();
    app.notify("document");
  };

  const runPreview = () => {
    const result = effect.apply(original, paramMap(params), app.selection.empty ? undefined : app.selection);
    drawPreview(before, original);
    drawPreview(after, result);
    layer.buffer = result;
    app.compositor.invalidate();
    app.notify("document");
  };
  runPreview();

  let committed = false;
  actions(box, "OK", () => {
    committed = true;
    restore();
    app.applyEffect(effect, paramMap(params));
    app.closeDialog();
  }, app);

  const onDialog = () => {
    if (!committed) restore();
    app.removeEventListener("dialog", onDialog);
  };
  app.addEventListener("dialog", onDialog);
}

function drawPreview(canvas: HTMLCanvasElement, buf: import("../core/pixel-buffer").PixelBuffer): void {
  const max = 220;
  const scale = Math.min(1, max / buf.width, 140 / buf.height);
  canvas.width = Math.max(1, Math.round(buf.width * scale));
  canvas.height = Math.max(1, Math.round(buf.height * scale));
  const ctx = canvas.getContext("2d")!;
  const tmp = document.createElement("canvas");
  tmp.width = buf.width;
  tmp.height = buf.height;
  tmp.getContext("2d")!.putImageData(buf.asImageData(), 0, 0);
  ctx.imageSmoothingEnabled = scale < 1;
  ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
}

function renderAbout(box: HTMLElement, app: AppState): void {
  const body = header(box, "About paint.web");
  body.innerHTML = `
    <p><strong>paint.web</strong> is an unofficial, independent Progressive Web App inspired by
    Paint.NET (Rick Brewster / dotPDN LLC). It is not affiliated with or endorsed by the Paint.NET authors.</p>
    <p>Runs entirely in your browser. After the first visit the app is cached and works offline.
    Install it from the browser address bar for a standalone window.</p>
    <p>Version 1.0.0 · MIT License</p>
  `;
  const row = document.createElement("div");
  row.className = "actions";
  const ok = document.createElement("button");
  ok.className = "btn primary";
  ok.textContent = "OK";
  ok.addEventListener("click", () => app.closeDialog());
  row.append(ok);
  box.append(row);
}

function renderSettings(box: HTMLElement, app: AppState): void {
  const body = header(box, "Settings");
  const g = document.createElement("div");
  g.className = "form-grid";
  const theme = document.createElement("select");
  theme.innerHTML = `<option value="dark">Dark</option><option value="light">Light</option>`;
  theme.value = app.settings.theme;
  const w = num(app.settings.defaultWidth);
  const h = num(app.settings.defaultHeight);
  const dpi = num(app.settings.defaultDpi, 1, 2400);
  const rulers = document.createElement("input");
  rulers.type = "checkbox";
  rulers.checked = app.settings.showRulers;
  const grid = document.createElement("input");
  grid.type = "checkbox";
  grid.checked = app.settings.showPixelGrid;
  field(g, "Theme", theme);
  field(g, "Default width", w);
  field(g, "Default height", h);
  field(g, "Default DPI", dpi);
  field(g, "Show rulers", rulers);
  field(g, "Show pixel grid", grid);
  body.append(g);
  actions(box, "OK", () => {
    app.settings.theme = theme.value as "dark" | "light";
    app.settings.defaultWidth = Number(w.value);
    app.settings.defaultHeight = Number(h.value);
    app.settings.defaultDpi = Number(dpi.value);
    app.settings.showRulers = rulers.checked;
    app.settings.showPixelGrid = grid.checked;
    app.viewport.showRulers = rulers.checked;
    app.viewport.showPixelGrid = grid.checked;
    app.applyTheme();
    void app.persistSettings();
    app.notify("viewport");
    app.closeDialog();
  }, app);
}

function renderShortcuts(box: HTMLElement, app: AppState): void {
  const body = header(box, "Keyboard Shortcuts");
  body.innerHTML = `
    <p>Shortcuts match Paint.NET as closely as possible.</p>
    <ul>
      <li><b>S</b> cycle selection tools · <b>M</b> move · <b>B</b> brush · <b>P</b> pencil · <b>E</b> eraser</li>
      <li><b>F</b> bucket · <b>G</b> gradient · <b>K</b> picker · <b>T</b> text · <b>O</b> shapes · <b>H</b> pan · <b>Z</b> zoom</li>
      <li><b>X</b> swap colors · <b>C</b> switch active color · <b>[ ]</b> brush size</li>
      <li><b>Ctrl+Z/Y</b> undo/redo · <b>Ctrl+C/X/V</b> copy/cut/paste · <b>Delete</b> erase · <b>Backspace</b> fill</li>
      <li><b>Ctrl+N/O/S</b> new/open/save · <b>F5–F8</b> tool windows · <b>F4</b> layer properties</li>
      <li><b>Space+drag</b> pan · <b>Ctrl+wheel</b> zoom · <b>Ctrl+0</b> actual size · <b>Ctrl+B</b> zoom to window</li>
    </ul>
  `;
  const row = document.createElement("div");
  row.className = "actions";
  const ok = document.createElement("button");
  ok.className = "btn primary";
  ok.textContent = "OK";
  ok.addEventListener("click", () => app.closeDialog());
  row.append(ok);
  box.append(row);
}

function renderSaveAs(box: HTMLElement, app: AppState, format: SaveFormat): void {
  const body = header(box, "Save As");
  const g = document.createElement("div");
  g.className = "form-grid";
  const name = document.createElement("input");
  name.type = "text";
  name.value = app.document.name.replace(/\.[^.]+$/, "");
  const fmt = document.createElement("select");
  for (const f of ["png", "jpeg", "bmp", "gif", "webp", "pdnweb"] as SaveFormat[]) {
    const o = document.createElement("option");
    o.value = f;
    o.textContent = f === "pdnweb" ? "paint.web layered (.pdnweb)" : f.toUpperCase();
    if (f === format) o.selected = true;
    fmt.append(o);
  }
  field(g, "File name", name);
  field(g, "Format", fmt);
  body.append(g);
  actions(box, "Save", () => {
    const f = fmt.value as SaveFormat;
    const ext = f === "jpeg" ? ".jpg" : f === "pdnweb" ? ".pdnweb" : `.${f}`;
    void app.saveWithFormat(f, name.value + ext);
    app.closeDialog();
  }, app);
}

function renderRotateZoom(box: HTMLElement, app: AppState): void {
  const body = header(box, "Rotate / Zoom Layer");
  const g = document.createElement("div");
  g.className = "form-grid";
  const ang = num(0, -180, 180);
  const zoom = num(100, 1, 800);
  field(g, "Angle (°)", ang);
  field(g, "Zoom (%)", zoom);
  body.append(g);
  actions(box, "OK", () => {
    const layer = app.document.activeLayer;
    const a = (Number(ang.value) * Math.PI) / 180;
    const z = Number(zoom.value) / 100;
    app.mutateLayerPixels("Rotate / Zoom", "rotateZoom", () => {
      const src = layer.buffer;
      const dest = src.clone();
      dest.clear();
      const cx = src.width / 2;
      const cy = src.height / 2;
      for (let y = 0; y < dest.height; y++) {
        for (let x = 0; x < dest.width; x++) {
          const dx = (x - cx) / z;
          const dy = (y - cy) / z;
          const sx = Math.round(cx + dx * Math.cos(-a) - dy * Math.sin(-a));
          const sy = Math.round(cy + dx * Math.sin(-a) + dy * Math.cos(-a));
          if (src.inBounds(sx, sy)) dest.setPixel(x, y, src.getPixel(sx, sy));
        }
      }
      layer.buffer = dest;
    });
    app.closeDialog();
  }, app);
}
