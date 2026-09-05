import type { AppState } from "../app-state";
import { ZOOM_SLIDER_MAX, sliderToZoom, zoomToSlider } from "../core/viewport";
import { TOOL_LAYOUT } from "../tools/registry";
import { getTool } from "../tools/registry";
import { svgEl, TOOL_SVG, UI_ICONS } from "./icons";
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
  range.min = "0";
  range.max = String(ZOOM_SLIDER_MAX);
  range.step = "1";
  range.title = "Zoom — 1% to 100% left of center, 100% to 2000% right";
  const txt = document.createElement("input");
  txt.type = "text";
  txt.dataset.testid = "zoom-percent";
  txt.title = "Zoom percent — double-click to fit";
  range.addEventListener("input", () => {
    app.viewport.setZoom(sliderToZoom(Number(range.value)), {
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
    if (document.activeElement !== range) range.value = String(Math.round(zoomToSlider(app.viewport.zoom)));
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
