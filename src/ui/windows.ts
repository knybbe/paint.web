import type { AppState } from "../app-state";
import { TOOL_LAYOUT } from "../tools/registry";
import { getTool } from "../tools/registry";
import { svgEl, TOOL_SVG, UI_ICONS } from "./icons";
import { hsvToRgb, rgbToHsv, toHex, fromHex, cssRgba, type Color } from "../core/color";
import { BLEND_MODES, type BlendMode } from "../core/blend";
import type { ToolId } from "../tools/base";

export function windowChrome(title: string, onClose: () => void): { root: HTMLElement; body: HTMLElement } {
  const root = document.createElement("section");
  root.className = "pdn-win";
  root.dataset.testid = `window-${title.toLowerCase()}`;
  const head = document.createElement("div");
  head.className = "title";
  head.innerHTML = `<span>${title}</span>`;
  const close = document.createElement("button");
  close.textContent = "×";
  close.title = "Close";
  close.addEventListener("click", onClose);
  head.append(close);
  const body = document.createElement("div");
  body.className = "body";
  root.append(head, body);
  return { root, body };
}

export function mountToolsWindow(host: HTMLElement, app: AppState): void {
  const paint = () => {
    host.innerHTML = "";
    if (!app.windows.tools) return;
    const { root, body } = windowChrome("Tools", () => app.toggleWindow("tools"));
    const grid = document.createElement("div");
    grid.className = "tools-grid";
    for (const row of TOOL_LAYOUT) {
      for (const id of row) {
        const t = getTool(id);
        const b = document.createElement("button");
        b.className = "tool-btn" + (app.currentTool === id ? " active" : "");
        b.dataset.tool = id;
        b.dataset.testid = `tool-${id}`;
        b.title = `${t.name} (${t.shortcut})`;
        b.append(svgEl(TOOL_SVG[id]));
        b.addEventListener("click", () => app.setTool(id));
        grid.append(b);
      }
    }
    body.append(grid);
    host.append(root);
  };
  paint();
  app.addEventListener("tool", paint);
  app.addEventListener("windows", paint);
}

export function mountColorsWindow(host: HTMLElement, app: AppState): void {
  const { root, body } = windowChrome("Colors", () => app.toggleWindow("colors"));
  body.classList.add("colors-body");

  const wheel = document.createElement("canvas");
  wheel.width = 168;
  wheel.height = 168;
  const wrap = document.createElement("div");
  wrap.className = "wheel-wrap";
  wrap.append(wheel);

  const row = document.createElement("div");
  row.className = "swatches-row";
  const ps = document.createElement("div");
  ps.className = "primary-secondary";
  const primaryEl = swatch(app.primary, "primary", true);
  const secondaryEl = swatch(app.secondary, "secondary", false);
  primaryEl.addEventListener("click", () => {
    app.activeColor = "primary";
    app.notify("colors");
  });
  secondaryEl.addEventListener("click", () => {
    app.activeColor = "secondary";
    app.notify("colors");
  });
  ps.append(secondaryEl, primaryEl);
  const sr = document.createElement("div");
  sr.className = "swap-reset";
  const swap = document.createElement("button");
  swap.className = "icon-btn";
  swap.title = "Swap (X)";
  swap.append(svgEl(UI_ICONS.swap));
  swap.addEventListener("click", () => app.swapColors());
  sr.append(swap);
  row.append(ps, sr);

  const sliders = document.createElement("div");
  sliders.className = "sliders";
  const sliderCtrls: { range: HTMLInputElement; num: HTMLInputElement }[] = [];

  const active = () => (app.activeColor === "primary" ? app.primary : app.secondary);

  const addLiveSlider = (
    label: string,
    min: number,
    max: number,
    read: () => number,
    write: (v: number) => void,
  ): void => {
    const l = document.createElement("span");
    l.textContent = label;
    const r = document.createElement("input");
    r.type = "range";
    r.min = String(min);
    r.max = String(max);
    r.value = String(Math.round(read()));
    const n = document.createElement("input");
    n.type = "number";
    n.min = String(min);
    n.max = String(max);
    n.value = String(Math.round(read()));
    const sync = (v: number) => {
      r.value = n.value = String(v);
      write(v);
    };
    r.addEventListener("input", () => sync(Number(r.value)));
    n.addEventListener("change", () => sync(Number(n.value)));
    sliders.append(l, r, n);
    sliderCtrls.push({ range: r, num: n });
  };

  addLiveSlider("H", 0, 360, () => rgbToHsv(active()).h, (v) => {
    const hsv = rgbToHsv(active());
    setHsv(app, { ...hsv, h: v, a: active().a });
  });
  addLiveSlider("S", 0, 100, () => Math.round(rgbToHsv(active()).s * 100), (v) => {
    const hsv = rgbToHsv(active());
    setHsv(app, { ...hsv, s: v / 100, a: active().a });
  });
  addLiveSlider("V", 0, 100, () => Math.round(rgbToHsv(active()).v * 100), (v) => {
    const hsv = rgbToHsv(active());
    setHsv(app, { ...hsv, v: v / 100, a: active().a });
  });
  addLiveSlider("R", 0, 255, () => active().r, (v) => setRgb(app, { ...active(), r: v }));
  addLiveSlider("G", 0, 255, () => active().g, (v) => setRgb(app, { ...active(), g: v }));
  addLiveSlider("B", 0, 255, () => active().b, (v) => setRgb(app, { ...active(), b: v }));
  addLiveSlider("A", 0, 255, () => active().a, (v) => setRgb(app, { ...active(), a: v }));

  const hex = document.createElement("div");
  hex.className = "hex-row";
  const hexInp = document.createElement("input");
  hexInp.type = "text";
  hexInp.addEventListener("change", () => {
    const parsed = fromHex(hexInp.value);
    if (parsed) app.setActiveColorValue(parsed);
  });
  hex.append("Hex", hexInp);

  const palette = document.createElement("div");
  palette.className = "palette-grid";

  body.append(row, wrap, sliders, hex, palette);

  const paintPalette = (): void => {
    palette.innerHTML = "";
    app.settings.palette.forEach((col, i) => {
      const cell = document.createElement("div");
      cell.className = "palette-cell";
      cell.style.background = cssRgba(col);
      cell.title = toHex(col, true);
      cell.addEventListener("mousedown", (e) => {
        e.preventDefault();
        if (e.button === 2) app.setSecondary(col);
        else app.setPrimary(col);
      });
      cell.addEventListener("contextmenu", (e) => e.preventDefault());
      cell.addEventListener("dblclick", () => {
        app.settings.palette[i] = { ...active() };
        void app.persistSettings();
        app.notify("colors");
      });
      palette.append(cell);
    });
  };

  const reads = [
    () => rgbToHsv(active()).h,
    () => Math.round(rgbToHsv(active()).s * 100),
    () => Math.round(rgbToHsv(active()).v * 100),
    () => active().r,
    () => active().g,
    () => active().b,
    () => active().a,
  ];

  const paint = () => {
    if (!app.windows.colors) {
      host.innerHTML = "";
      return;
    }
    if (!host.contains(root)) {
      host.innerHTML = "";
      host.append(root);
    }
    primaryEl.style.background = cssRgba(app.primary);
    secondaryEl.style.background = cssRgba(app.secondary);
    primaryEl.classList.toggle("active", app.activeColor === "primary");
    secondaryEl.classList.toggle("active", app.activeColor === "secondary");
    const c = active();
    const hsv = rgbToHsv(c);
    drawWheel(wheel, hsv);
    sliderCtrls.forEach((ctrl, i) => {
      const v = String(Math.round(reads[i]()));
      if (document.activeElement !== ctrl.range) ctrl.range.value = v;
      if (document.activeElement !== ctrl.num) ctrl.num.value = v;
    });
    if (document.activeElement !== hexInp) hexInp.value = toHex(c, true);
    paintPalette();
  };

  wheel.addEventListener("pointerdown", (e) => pickWheel(e, wheel, app));
  wheel.addEventListener("pointermove", (e) => {
    if (e.buttons) pickWheel(e, wheel, app);
  });

  paint();
  app.addEventListener("colors", paint);
  app.addEventListener("windows", paint);
}

function swatch(c: Color, cls: string, active: boolean): HTMLElement {
  const d = document.createElement("div");
  d.className = `swatch ${cls}` + (active ? " active" : "");
  d.style.background = cssRgba(c);
  return d;
}

function setHsv(app: AppState, hsv: { h: number; s: number; v: number; a: number }): void {
  app.setActiveColorValue(hsvToRgb(hsv.h, hsv.s, hsv.v, hsv.a));
}

function setRgb(app: AppState, c: Color): void {
  app.setActiveColorValue(c);
}

function drawWheel(canvas: HTMLCanvasElement, hsv: { h: number; s: number; v: number }): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const outer = w / 2 - 2;
  const inner = outer - 16;
  const img = ctx.createImageData(w, h);
  const data = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const r = Math.hypot(dx, dy);
      const i = (y * w + x) * 4;
      if (r <= outer && r >= inner) {
        let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (ang < 0) ang += 360;
        const c = hsvToRgb(ang, 1, 1);
        data[i] = c.r;
        data[i + 1] = c.g;
        data[i + 2] = c.b;
        data[i + 3] = 255;
      } else if (r <= inner - 4) {
        const tri = inner - 4;
        const sat = Math.max(0, Math.min(1, (dx / tri + 1) / 2));
        const val = Math.max(0, Math.min(1, 1 - (dy / tri + 1) / 2));
        const c = hsvToRgb(hsv.h, sat, val);
        data[i] = c.r;
        data[i + 1] = c.g;
        data[i + 2] = c.b;
        data[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  const tri = inner - 4;
  const hx = cx + Math.cos((hsv.h * Math.PI) / 180) * ((inner + outer) / 2);
  const hy = cy + Math.sin((hsv.h * Math.PI) / 180) * ((inner + outer) / 2);
  ctx.strokeStyle = "#000";
  ctx.beginPath();
  ctx.arc(hx, hy, 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#fff";
  ctx.beginPath();
  ctx.arc(hx, hy, 5, 0, Math.PI * 2);
  ctx.stroke();
  const sx = cx + (hsv.s * 2 - 1) * tri;
  const sy = cy + (1 - hsv.v) * 2 * tri - tri;
  ctx.strokeStyle = "#000";
  ctx.strokeRect(sx - 3, sy - 3, 6, 6);
  ctx.strokeStyle = "#fff";
  ctx.strokeRect(sx - 4, sy - 4, 8, 8);
}

function pickWheel(e: PointerEvent, canvas: HTMLCanvasElement, app: AppState): void {
  const r = canvas.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * canvas.width;
  const y = ((e.clientY - r.top) / r.height) * canvas.height;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const dx = x - cx;
  const dy = y - cy;
  const rad = Math.hypot(dx, dy);
  const outer = canvas.width / 2 - 2;
  const inner = outer - 16;
  const cur = rgbToHsv(app.activeColor === "primary" ? app.primary : app.secondary);
  if (rad >= inner && rad <= outer) {
    let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (ang < 0) ang += 360;
    if (e.shiftKey) ang = Math.round(ang / 15) * 15;
    const next = hsvToRgb(ang, cur.s, cur.v, cur.a);
    if (e.button === 2 || (e.buttons & 2)) app.setSecondary(next);
    else app.setActiveColorValue(next);
    return;
  }
  const tri = inner - 4;
  if (rad <= tri) {
    const sat = clamp01((dx / tri + 1) / 2);
    const val = clamp01(1 - (dy / tri + 1) / 2);
    const c = hsvToRgb(cur.h, sat, val, cur.a);
    if (e.button === 2 || (e.buttons & 2)) app.setSecondary(c);
    else app.setActiveColorValue(c);
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function mountLayersWindow(host: HTMLElement, app: AppState): void {
  const paint = () => {
    host.innerHTML = "";
    if (!app.windows.layers) return;
    const { root, body } = windowChrome("Layers", () => app.toggleWindow("layers"));
    const list = document.createElement("div");
    list.className = "layers-list";
    app.document.layers.forEach((layer, index) => {
      const row = document.createElement("div");
      row.className = "layer-row" + (layer.id === app.document.activeLayerId ? " active" : "");
      row.draggable = true;
      const eye = document.createElement("button");
      eye.className = "icon-btn";
      eye.title = "Visibility";
      eye.append(svgEl(layer.visible ? UI_ICONS.eye : UI_ICONS.eyeOff));
      eye.addEventListener("click", (e) => {
        e.stopPropagation();
        layer.visible = !layer.visible;
        app.compositor.invalidate();
        app.document.dirty = true;
        app.notify("document");
        app.notify("layers");
      });
      const thumb = document.createElement("div");
      thumb.className = "thumb";
      const img = document.createElement("img");
      img.alt = "";
      img.src = layer.thumbnailDataUrl(40);
      thumb.append(img);
      const name = document.createElement("span");
      name.textContent = layer.name + (layer.locked ? " 🔒" : "");
      row.append(eye, thumb, name);
      row.addEventListener("click", () => {
        app.document.setActive(layer.id);
        app.notify("layers");
      });
      row.addEventListener("dblclick", () => app.openDialog({ type: "layerProps" }));
      row.addEventListener("dragstart", (e) => {
        e.dataTransfer?.setData("text/plain", String(index));
      });
      row.addEventListener("dragover", (e) => e.preventDefault());
      row.addEventListener("drop", (e) => {
        e.preventDefault();
        const from = Number(e.dataTransfer?.getData("text/plain"));
        if (!Number.isNaN(from)) {
          app.document.moveLayer(from, index);
          app.compositor.invalidate();
          app.notify("document");
          app.notify("layers");
        }
      });
      list.append(row);
    });
    const actions = document.createElement("div");
    actions.className = "layer-actions";
    actions.append(
      iconBtn(UI_ICONS.addLayer, "Add", () => app.addLayer()),
      iconBtn(UI_ICONS.deleteLayer, "Delete", () => app.deleteLayer()),
      iconBtn(UI_ICONS.duplicateLayer, "Duplicate", () => app.duplicateLayer()),
      iconBtn(UI_ICONS.merge, "Merge Down", () => app.mergeDown()),
      iconBtn(UI_ICONS.arrowUp, "Move Up", () => app.moveActiveLayer(1)),
      iconBtn(UI_ICONS.arrowDown, "Move Down", () => app.moveActiveLayer(-1)),
    );
    const op = document.createElement("div");
    op.className = "opacity-row";
    const range = document.createElement("input");
    range.type = "range";
    range.min = "0";
    range.max = "255";
    range.value = String(app.document.activeLayer.opacity);
    const lab = document.createElement("span");
    lab.textContent = `${Math.round((app.document.activeLayer.opacity / 255) * 100)}%`;
    range.addEventListener("input", () => {
      app.document.activeLayer.opacity = Number(range.value);
      lab.textContent = `${Math.round((Number(range.value) / 255) * 100)}%`;
      app.compositor.invalidate();
    });
    range.addEventListener("change", () => {
      app.document.dirty = true;
      app.notify("layers");
    });
    op.append("Opacity", range, lab);
    const blend = document.createElement("select");
    for (const m of BLEND_MODES) {
      const o = document.createElement("option");
      o.value = m;
      o.textContent = m;
      if (m === app.document.activeLayer.blendMode) o.selected = true;
      blend.append(o);
    }
    blend.addEventListener("change", () => {
      app.document.activeLayer.blendMode = blend.value as BlendMode;
      app.compositor.invalidate();
      app.notify("document");
    });
    body.append(list, actions, op, blend);
    host.append(root);
  };
  paint();
  app.addEventListener("layers", paint);
  app.addEventListener("windows", paint);
  app.addEventListener("history", paint);
  app.addEventListener("sessions", paint);
}

function iconBtn(svg: string, title: string, on: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = "icon-btn";
  b.title = title;
  b.append(svgEl(svg));
  b.addEventListener("click", on);
  return b;
}

export function mountHistoryWindow(host: HTMLElement, app: AppState): void {
  const paint = () => {
    host.innerHTML = "";
    if (!app.windows.history) return;
    const { root, body } = windowChrome("History", () => app.toggleWindow("history"));
    const list = document.createElement("div");
    list.className = "history-list";
    const tl = app.history.timeline;
    const pos = app.history.position;
    for (const item of tl) {
      const row = document.createElement("div");
      row.className = "hist-row" + (item.index === pos ? " current" : item.index > pos ? " future" : "");
      row.textContent = item.name;
      row.addEventListener("click", () => {
        app.history.jumpTo(item.index);
        app.compositor.invalidate();
        app.notify("history");
        app.notify("document");
        app.notify("layers");
      });
      list.append(row);
    }
    body.append(list);
    host.append(root);
  };
  paint();
  app.addEventListener("history", paint);
  app.addEventListener("windows", paint);
}

export function mountStatus(root: HTMLElement, app: AppState): void {
  root.className = "statusbar";
  root.dataset.testid = "statusbar";
  const a = document.createElement("span");
  a.dataset.testid = "status-size";
  const b = document.createElement("span");
  b.dataset.testid = "status-pos";
  const c = document.createElement("span");
  c.dataset.testid = "status-sel";
  const d = document.createElement("span");
  d.className = "grow";
  d.dataset.testid = "status-msg";
  const z = document.createElement("div");
  z.className = "zoom-ctl";
  const fit = document.createElement("button");
  fit.type = "button";
  fit.className = "tb-btn";
  fit.title = "Fit to View (Ctrl+B)";
  fit.dataset.testid = "zoom-fit";
  fit.append(svgEl(UI_ICONS.fit));
  fit.addEventListener("click", () => app.fitToView());
  const range = document.createElement("input");
  range.type = "range";
  range.min = "1";
  range.max = "3200";
  range.title = "Zoom";
  const txt = document.createElement("input");
  txt.type = "text";
  txt.dataset.testid = "zoom-percent";
  txt.title = "Zoom percent — double-click to fit";
  range.addEventListener("input", () => {
    app.viewport.setZoom(Number(range.value) / 100, {
      x: app.viewport.viewWidth / 2,
      y: app.viewport.viewHeight / 2,
    });
    app.notify("viewport");
  });
  txt.addEventListener("change", () => {
    const n = parseFloat(txt.value);
    if (!Number.isNaN(n)) {
      app.viewport.setZoom(n / 100, {
        x: app.viewport.viewWidth / 2,
        y: app.viewport.viewHeight / 2,
      });
      app.notify("viewport");
    }
  });
  txt.addEventListener("dblclick", () => app.fitToView());
  z.append(fit, range, txt);
  root.append(a, b, c, d, z);

  const paint = () => {
    a.textContent = `${app.document.width} × ${app.document.height}px, ${app.document.dpi} dpi`;
    const pos = app.cursorImage;
    b.textContent = pos ? `${Math.floor(pos.x)}, ${Math.floor(pos.y)}` : "";
    const sel = app.selection.bounds;
    c.textContent = sel ? `Selection: ${sel.w} × ${sel.h}` : "";
    d.textContent = app.statusMessage || getTool(app.currentTool).name;
    const zp = Math.round(app.viewport.zoom * 100);
    if (document.activeElement !== range) range.value = String(zp);
    if (document.activeElement !== txt) txt.value = `${zp}%`;
  };
  paint();
  app.addEventListener("status", paint);
  app.addEventListener("viewport", paint);
  app.addEventListener("document", paint);
  app.addEventListener("selection", paint);
  app.addEventListener("tool", paint);
}

export function cycleToolById(_id: ToolId): void {
  /* helper reserved */
}
