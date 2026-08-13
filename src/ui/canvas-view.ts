import type { AppState } from "../app-state";
import { renderWorkspace } from "../core/renderer";
import { getTool } from "../tools/registry";
import { drawSelectionHandles } from "../tools/move";
import type { ToolPointer } from "../tools/base";
import { visualMode } from "../visual-mode";

export function mountCanvas(root: HTMLElement, app: AppState): void {
  root.className = "canvas-col";
  const tabs = document.createElement("div");
  tabs.className = "imagelist";
  const frame = document.createElement("div");
  frame.className = "canvas-frame";
  const corner = document.createElement("div");
  corner.className = "ruler-corner";
  const rulerH = document.createElement("canvas");
  rulerH.className = "ruler-h";
  const rulerV = document.createElement("canvas");
  rulerV.className = "ruler-v";
  const host = document.createElement("div");
  host.className = "canvas-host";
  host.dataset.testid = "canvas-host";
  host.setAttribute("data-testid", "canvas-host");
  const canvas = document.createElement("canvas");
  host.append(canvas);
  frame.append(corner, rulerH, rulerV, host);
  root.append(tabs, frame);

  const ctx = canvas.getContext("2d");
  let ants = 0;
  let pointerId: number | null = null;
  let spaceHeld = false;

  const paintTabs = () => {
    tabs.innerHTML = "";
    for (const s of app.sessions) {
      const t = document.createElement("div");
      t.className = "imagetab" + (s.id === app.activeSessionId ? " active" : "");
      t.title = s.document.name;
      const name = document.createElement("span");
      name.textContent = (s.document.dirty ? "*" : "") + s.document.name;
      const x = document.createElement("span");
      x.className = "x";
      x.textContent = "×";
      x.addEventListener("click", (e) => {
        e.stopPropagation();
        app.closeSession(s.id);
      });
      t.append(name, x);
      t.addEventListener("click", () => app.activateSession(s.id));
      tabs.append(t);
    }
  };

  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    if (app.viewport.showRulers) {
      rulerH.style.display = "";
      rulerV.style.display = "";
      corner.style.display = "";
      frame.style.gridTemplateColumns = "20px minmax(0, 1fr)";
      frame.style.gridTemplateRows = "20px minmax(0, 1fr)";
    } else {
      rulerH.style.display = "none";
      rulerV.style.display = "none";
      corner.style.display = "none";
      frame.style.gridTemplateColumns = "0 minmax(0, 1fr)";
      frame.style.gridTemplateRows = "0 minmax(0, 1fr)";
    }

    const r = host.getBoundingClientRect();
    const cssW = Math.max(1, Math.floor(r.width));
    const cssH = Math.max(1, Math.floor(r.height));
    canvas.width = Math.max(1, Math.floor(cssW * dpr));
    canvas.height = Math.max(1, Math.floor(cssH * dpr));
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    app.viewport.viewWidth = cssW;
    app.viewport.viewHeight = cssH;

    const hr = rulerH.getBoundingClientRect();
    const vr = rulerV.getBoundingClientRect();
    rulerH.width = Math.max(1, Math.floor(hr.width * dpr));
    rulerH.height = Math.max(1, Math.floor(20 * dpr));
    rulerH.style.width = "100%";
    rulerH.style.height = "20px";
    rulerV.width = Math.max(1, Math.floor(20 * dpr));
    rulerV.height = Math.max(1, Math.floor(vr.height * dpr));
    rulerV.style.width = "20px";
    rulerV.style.height = "100%";
    draw();
  };

  const drawRulers = () => {
    if (!app.viewport.showRulers) return;
    const dpr = window.devicePixelRatio || 1;
    const hc = rulerH.getContext("2d");
    const vc = rulerV.getContext("2d");
    if (!hc || !vc) return;
    hc.setTransform(dpr, 0, 0, dpr, 0, 0);
    vc.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = app.viewport.viewWidth;
    const h = app.viewport.viewHeight;
    hc.clearRect(0, 0, w, 20);
    vc.clearRect(0, 0, 20, h);
    const style = getComputedStyle(document.documentElement);
    hc.fillStyle = vc.fillStyle = style.getPropertyValue("--pdn-ruler").trim() || "#3f3f3f";
    hc.fillRect(0, 0, w, 20);
    vc.fillRect(0, 0, 20, h);
    hc.fillStyle = vc.fillStyle = style.getPropertyValue("--pdn-text-dim").trim() || "#bbb";
    hc.strokeStyle = vc.strokeStyle = style.getPropertyValue("--pdn-text-dim").trim() || "#bbb";
    hc.font = vc.font = "9px Segoe UI, sans-serif";
    const step = niceStep(50 / app.viewport.zoom);
    const x0 = Math.floor((0 - app.viewport.panX) / app.viewport.zoom / step) * step;
    const x1 = (w - app.viewport.panX) / app.viewport.zoom;
    for (let x = x0; x <= x1; x += step) {
      const sx = x * app.viewport.zoom + app.viewport.panX;
      hc.beginPath();
      hc.moveTo(sx + 0.5, 20);
      hc.lineTo(sx + 0.5, 8);
      hc.stroke();
      hc.fillText(String(Math.round(x)), sx + 2, 9);
    }
    const y0 = Math.floor((0 - app.viewport.panY) / app.viewport.zoom / step) * step;
    const y1 = (h - app.viewport.panY) / app.viewport.zoom;
    for (let y = y0; y <= y1; y += step) {
      const sy = y * app.viewport.zoom + app.viewport.panY;
      vc.beginPath();
      vc.moveTo(20, sy + 0.5);
      vc.lineTo(8, sy + 0.5);
      vc.stroke();
      vc.save();
      vc.translate(9, sy + 2);
      vc.rotate(-Math.PI / 2);
      vc.fillText(String(Math.round(y)), 0, 0);
      vc.restore();
    }
  };

  const draw = () => {
    if (!app.session || !ctx) return;
    renderWorkspace(ctx, app.document, app.compositor, app.viewport, app.selection, ants, (c, vp) => {
      const tool = getTool(app.currentTool);
      tool.drawOverlay?.(c, vp);
      if ((app.currentTool === "movePixels" || app.currentTool === "moveSelection") && app.selection.bounds) {
        drawSelectionHandles(c, app.selection.bounds, vp);
      }
    });
    drawRulers();
  };

  const loop = () => {
    if (!visualMode) ants = (ants + 0.25) % 16;
    draw();
    requestAnimationFrame(loop);
  };

  const toPointer = (e: PointerEvent): ToolPointer => {
    const r = host.getBoundingClientRect();
    const sx = e.clientX - r.left;
    const sy = e.clientY - r.top;
    const img = app.viewport.screenToImage(sx, sy);
    return {
      imageX: img.x,
      imageY: img.y,
      screenX: sx,
      screenY: sy,
      button: e.button,
      buttons: e.buttons,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey || e.metaKey,
      altKey: e.altKey,
      pressure: e.pressure || 1,
    };
  };

  host.addEventListener("pointerdown", (e) => {
    host.focus();
    host.setPointerCapture(e.pointerId);
    pointerId = e.pointerId;
    const p = toPointer(e);
    app.cursorImage = { x: p.imageX, y: p.imageY };
    if (e.button === 1 || spaceHeld) {
      app.spacePan = true;
      getTool("pan").pointerDown(p, app.toolContext());
      return;
    }
    getTool(app.currentTool).pointerDown(p, app.toolContext());
    app.notify("status");
  });

  host.addEventListener("pointermove", (e) => {
    const p = toPointer(e);
    app.cursorImage = { x: p.imageX, y: p.imageY };
    app.notify("status");
    if (app.spacePan) {
      getTool("pan").pointerMove(p, app.toolContext());
      return;
    }
    if (pointerId === e.pointerId || e.buttons) {
      getTool(app.currentTool).pointerMove(p, app.toolContext());
    }
  });

  host.addEventListener("pointerup", (e) => {
    const p = toPointer(e);
    if (app.spacePan) {
      getTool("pan").pointerUp(p, app.toolContext());
      app.spacePan = false;
      pointerId = null;
      return;
    }
    getTool(app.currentTool).pointerUp(p, app.toolContext());
    pointerId = null;
  });

  host.addEventListener("contextmenu", (e) => e.preventDefault());

  host.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = host.getBoundingClientRect();
    const around = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (e.ctrlKey || e.metaKey) {
      if (e.deltaY < 0) app.viewport.zoomIn(around);
      else app.viewport.zoomOut(around);
    } else if (e.shiftKey) {
      app.viewport.pan(-e.deltaY, 0);
    } else {
      app.viewport.pan(-e.deltaX, -e.deltaY);
    }
    app.notify("viewport");
  }, { passive: false });

  host.tabIndex = 0;

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !isTyping(e)) {
      spaceHeld = true;
      host.style.cursor = "grab";
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space") {
      spaceHeld = false;
      host.style.cursor = "";
    }
  });

  const ro = new ResizeObserver(resize);
  ro.observe(root);
  ro.observe(host);
  window.addEventListener("resize", resize);

  app.addEventListener("sessions", paintTabs);
  app.addEventListener("document", () => { draw(); paintTabs(); });
  app.addEventListener("viewport", () => { resize(); });
  app.addEventListener("selection", draw);
  app.addEventListener("overlay", draw);
  app.addEventListener("tool", draw);
  app.addEventListener("theme", draw);

  paintTabs();
  requestAnimationFrame(() => {
    resize();
    app.viewport.fitToWindow(app.document.width, app.document.height);
    app.notify("viewport");
    loop();
  });
}

function niceStep(raw: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 0.001))));
  const n = raw / pow;
  if (n < 2) return 2 * pow;
  if (n < 5) return 5 * pow;
  return 10 * pow;
}

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
}
