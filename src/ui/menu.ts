import type { AppState } from "../app-state";
import { effectsByMenu, getEffect } from "../effects/registry";
import type { EffectDef } from "../effects/base";

interface Item {
  label?: string;
  acc?: string;
  action?: () => void;
  check?: () => boolean;
  disabled?: () => boolean;
  children?: Item[];
  sep?: boolean;
}

export function mountMenu(root: HTMLElement, app: AppState): void {
  const menus: { label: string; hot: string; items: () => Item[] }[] = [
    { label: "File", hot: "F", items: () => fileMenu(app) },
    { label: "Edit", hot: "E", items: () => editMenu(app) },
    { label: "View", hot: "V", items: () => viewMenu(app) },
    { label: "Image", hot: "I", items: () => imageMenu(app) },
    { label: "Layers", hot: "L", items: () => layersMenu(app) },
    { label: "Adjustments", hot: "A", items: () => adjMenu(app) },
    { label: "Effects", hot: "C", items: () => effectsMenu(app) },
    { label: "Window", hot: "W", items: () => windowMenu(app) },
    { label: "Help", hot: "H", items: () => helpMenu(app) },
  ];

  root.className = "menubar";
  root.setAttribute("role", "menubar");
  root.dataset.testid = "menubar";
  root.replaceChildren();

  let openIndex = -1;
  const nodes: { item: HTMLElement; drop: HTMLElement }[] = [];

  const closeAll = (): void => {
    openIndex = -1;
    for (const n of nodes) n.item.classList.remove("open");
  };

  const openAt = (i: number): void => {
    openIndex = i;
    nodes.forEach((n, j) => {
      const on = j === i;
      n.item.classList.toggle("open", on);
      if (on) fillItems(n.drop, menus[j].items(), closeAll);
    });
  };

  menus.forEach((m, i) => {
    const item = document.createElement("div");
    item.className = "menu-item";
    item.dataset.menu = m.label;
    item.setAttribute("role", "none");

    const title = document.createElement("button");
    title.type = "button";
    title.className = "menu-title";
    title.setAttribute("role", "menuitem");
    title.setAttribute("aria-haspopup", "true");
    title.dataset.testid = `menu-${m.label.toLowerCase()}`;
    title.innerHTML = hotLabel(m.label, m.hot);

    const drop = document.createElement("div");
    drop.className = "menu-dropdown";
    drop.setAttribute("role", "menu");
    drop.dataset.testid = `menu-dropdown-${m.label.toLowerCase()}`;

    title.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (openIndex === i) closeAll();
      else openAt(i);
    });
    item.addEventListener("mouseenter", () => {
      if (openIndex >= 0 && openIndex !== i) openAt(i);
    });
    drop.addEventListener("pointerdown", (e) => e.stopPropagation());
    drop.addEventListener("mousedown", (e) => e.stopPropagation());

    item.append(title, drop);
    root.append(item);
    nodes.push({ item, drop });
  });

  document.addEventListener("mousedown", (e) => {
    if (openIndex < 0) return;
    const t = e.target;
    if (t instanceof Node && root.contains(t)) return;
    closeAll();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && openIndex >= 0) {
      closeAll();
      e.stopPropagation();
    }
  });

  const refreshOpen = (): void => {
    if (openIndex >= 0) openAt(openIndex);
  };
  app.addEventListener("history", refreshOpen);
  app.addEventListener("windows", refreshOpen);
  app.addEventListener("theme", refreshOpen);
  app.addEventListener("selection", refreshOpen);
}

function hotLabel(label: string, hot: string): string {
  const i = label.toLowerCase().indexOf(hot.toLowerCase());
  if (i < 0) return label;
  return `${escapeHtml(label.slice(0, i))}<span class="hot">${escapeHtml(label[i])}</span>${escapeHtml(label.slice(i + 1))}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fillItems(host: HTMLElement, items: Item[], close: () => void): void {
  host.replaceChildren();
  for (const item of items) {
    if (item.sep) {
      const s = document.createElement("div");
      s.className = "menu-sep";
      s.setAttribute("role", "separator");
      host.append(s);
      continue;
    }
    const row = document.createElement("button");
    row.type = "button";
    row.className = "menu-row" + (item.children ? " submenu" : "");
    row.setAttribute("role", "menuitem");
    row.dataset.label = item.label ?? "";
    if (item.disabled?.()) {
      row.dataset.disabled = "1";
      row.disabled = true;
    }
    const check = document.createElement("span");
    check.className = "menu-check";
    check.textContent = item.check?.() ? "✓" : "";
    const lab = document.createElement("span");
    lab.className = "menu-label";
    lab.textContent = item.label ?? "";
    row.append(check, lab);
    if (item.acc) {
      const acc = document.createElement("span");
      acc.className = "acc";
      acc.textContent = item.acc;
      row.append(acc);
    } else if (item.children) {
      const acc = document.createElement("span");
      acc.className = "acc";
      acc.textContent = "▶";
      row.append(acc);
    }
    if (item.children) {
      const sub = document.createElement("div");
      sub.className = "menu-dropdown";
      sub.setAttribute("role", "menu");
      fillItems(sub, item.children, close);
      row.append(sub);
    }
    row.addEventListener("click", (e) => {
      if (item.children) {
        e.stopPropagation();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      close();
      item.action?.();
    });
    host.append(row);
  }
}

function fileMenu(app: AppState): Item[] {
  return [
    { label: "New...", acc: "Ctrl+N", action: () => app.openDialog({ type: "new" }) },
    { label: "Open...", acc: "Ctrl+O", action: () => void app.openFiles() },
    {
      label: "Open Recent",
      children: app.recent.length
        ? app.recent.map((r) => ({ label: r.name, action: () => undefined }))
        : [{ label: "(empty)", disabled: () => true }],
    },
    { sep: true },
    { label: "Close", acc: "Ctrl+W", action: () => app.closeSession() },
    { label: "Save", acc: "Ctrl+S", action: () => void app.save(false) },
    { label: "Save As...", acc: "Ctrl+Shift+S", action: () => void app.save(true) },
    { sep: true },
    { label: "Print...", acc: "Ctrl+P", action: () => app.print() },
    { sep: true },
    { label: "Exit", acc: "Alt+F4", action: () => app.closeSession() },
  ];
}

function editMenu(app: AppState): Item[] {
  return [
    { label: "Undo" + (app.history.undoName ? ` ${app.history.undoName}` : ""), acc: "Ctrl+Z", disabled: () => !app.history.canUndo, action: () => app.undo() },
    { label: "Redo" + (app.history.redoName ? ` ${app.history.redoName}` : ""), acc: "Ctrl+Y", disabled: () => !app.history.canRedo, action: () => app.redo() },
    { sep: true },
    { label: "Cut", acc: "Ctrl+X", action: () => void app.cut() },
    { label: "Copy", acc: "Ctrl+C", action: () => void app.copy(false) },
    { label: "Copy Merged", acc: "Ctrl+Shift+C", action: () => void app.copy(true) },
    { label: "Paste", acc: "Ctrl+V", action: () => void app.paste("normal") },
    { label: "Paste into New Layer", acc: "Ctrl+Shift+V", action: () => void app.paste("newLayer") },
    { label: "Paste into New Image", acc: "Ctrl+Alt+V", action: () => void app.paste("newImage") },
    { sep: true },
    { label: "Erase Selection", acc: "Delete", action: () => app.eraseSelection() },
    { label: "Fill Selection", acc: "Backspace", action: () => app.fillSelection() },
    { label: "Invert Selection", acc: "Ctrl+I", action: () => app.invertSelection() },
    { label: "Select All", acc: "Ctrl+A", action: () => app.selectAll() },
    { label: "Deselect", acc: "Ctrl+D", action: () => app.deselect() },
  ];
}

function viewMenu(app: AppState): Item[] {
  return [
    { label: "Zoom In", acc: "Ctrl++", action: () => { app.viewport.zoomIn(); app.notify("viewport"); } },
    { label: "Zoom Out", acc: "Ctrl+-", action: () => { app.viewport.zoomOut(); app.notify("viewport"); } },
    {
      label: "Zoom to Window",
      acc: "Ctrl+B",
      action: () => {
        if (app.session.zoomBeforeFit == null) {
          app.session.zoomBeforeFit = app.viewport.zoom;
          app.viewport.fitToWindow(app.document.width, app.document.height);
        } else {
          app.viewport.setZoom(app.session.zoomBeforeFit);
          app.viewport.center(app.document.width, app.document.height);
          app.session.zoomBeforeFit = null;
        }
        app.notify("viewport");
      },
    },
    {
      label: "Zoom to Selection",
      acc: "Ctrl+Shift+B",
      disabled: () => app.selection.empty,
      action: () => {
        const b = app.selection.bounds;
        if (b) app.viewport.fitSelection(b);
        app.notify("viewport");
      },
    },
    { label: "Actual Size", acc: "Ctrl+0", action: () => { app.viewport.actualSize(app.document.width, app.document.height); app.notify("viewport"); } },
    { sep: true },
    {
      label: "Rulers",
      check: () => app.viewport.showRulers,
      action: () => {
        app.viewport.showRulers = !app.viewport.showRulers;
        app.notify("viewport");
      },
    },
    {
      label: "Pixel Grid",
      check: () => app.viewport.showPixelGrid,
      action: () => {
        app.viewport.showPixelGrid = !app.viewport.showPixelGrid;
        app.notify("viewport");
      },
    },
    { sep: true },
    {
      label: "Dark Theme",
      check: () => app.settings.theme === "dark",
      action: () => {
        app.settings.theme = app.settings.theme === "dark" ? "light" : "dark";
        app.applyTheme();
        void app.persistSettings();
      },
    },
  ];
}

function imageMenu(app: AppState): Item[] {
  return [
    { label: "Crop to Selection", acc: "Ctrl+Shift+X", disabled: () => app.selection.empty, action: () => app.cropToSelection() },
    { label: "Resize...", acc: "Ctrl+R", action: () => app.openDialog({ type: "resize" }) },
    { label: "Canvas Size...", acc: "Ctrl+Shift+R", action: () => app.openDialog({ type: "canvas" }) },
    { sep: true },
    { label: "Rotate 90° Clockwise", acc: "Ctrl+H", action: () => app.transform("rotate90cw") },
    { label: "Rotate 90° Counter-Clockwise", acc: "Ctrl+G", action: () => app.transform("rotate90ccw") },
    { label: "Rotate 180°", action: () => app.transform("rotate180") },
    { label: "Flip Horizontal", action: () => app.transform("flipH") },
    { label: "Flip Vertical", action: () => app.transform("flipV") },
    { sep: true },
    { label: "Flatten", acc: "Ctrl+Shift+F", action: () => app.flatten() },
  ];
}

function layersMenu(app: AppState): Item[] {
  return [
    { label: "Add New Layer", acc: "Ctrl+Shift+N", action: () => app.addLayer() },
    { label: "Delete Layer", acc: "Ctrl+Shift+Del", disabled: () => app.document.layers.length <= 1, action: () => app.deleteLayer() },
    { label: "Duplicate Layer", acc: "Ctrl+Shift+D", action: () => app.duplicateLayer() },
    { label: "Merge Layer Down", acc: "Ctrl+M", disabled: () => app.document.activeIndex <= 0, action: () => app.mergeDown() },
    { sep: true },
    {
      label: "Layer Visible",
      acc: "Ctrl+,",
      check: () => app.document.activeLayer.visible,
      action: () => app.setLayerProps(app.document.activeLayer.id, { visible: !app.document.activeLayer.visible }),
    },
    { label: "Rotate / Zoom...", acc: "Ctrl+Shift+Z", action: () => app.openDialog({ type: "rotateZoom" }) },
    { sep: true },
    { label: "Go to Layer Above", acc: "Alt+PgUp", action: () => cycleLayer(app, 1) },
    { label: "Go to Layer Below", acc: "Alt+PgDn", action: () => cycleLayer(app, -1) },
    { sep: true },
    { label: "Layer Properties...", acc: "F4", action: () => app.openDialog({ type: "layerProps" }) },
  ];
}

function cycleLayer(app: AppState, dir: 1 | -1): void {
  const i = app.document.activeIndex + dir;
  if (i < 0 || i >= app.document.layers.length) return;
  app.document.setActive(app.document.layers[i].id);
  app.notify("layers");
}

function adjMenu(app: AppState): Item[] {
  return effectsByMenu("Adjustments").map((e) => effectItem(app, e));
}

function effectsMenu(app: AppState): Item[] {
  const groups: EffectDef["menu"][] = ["Blurs", "Distort", "Noise", "Photo", "Render", "Stylize"];
  const items: Item[] = [
    {
      label: "Repeat last effect",
      acc: "Ctrl+F",
      disabled: () => !app.lastEffect,
      action: () => {
        if (!app.lastEffect) return;
        const e = getEffect(app.lastEffect.id);
        if (e) app.applyEffect(e, app.lastEffect.params);
      },
    },
    { sep: true },
  ];
  for (const g of groups) {
    items.push({
      label: g,
      children: effectsByMenu(g).map((e) => effectItem(app, e)),
    });
  }
  return items;
}

function effectItem(app: AppState, e: EffectDef): Item {
  return {
    label: e.name + (e.params.length ? "..." : ""),
    acc: e.shortcut,
    action: () => {
      if (e.params.length) app.openDialog({ type: "effect", effectId: e.id });
      else app.applyEffect(e, paramEmpty(e));
    },
  };
}

function paramEmpty(e: EffectDef): Record<string, number | boolean | string> {
  const o: Record<string, number | boolean | string> = {};
  for (const p of e.params) o[p.key] = p.value;
  return o;
}

function windowMenu(app: AppState): Item[] {
  return [
    { label: "Tools", acc: "F5", check: () => app.windows.tools, action: () => app.toggleWindow("tools") },
    { label: "History", acc: "F6", check: () => app.windows.history, action: () => app.toggleWindow("history") },
    { label: "Layers", acc: "F7", check: () => app.windows.layers, action: () => app.toggleWindow("layers") },
    { label: "Colors", acc: "F8", check: () => app.windows.colors, action: () => app.toggleWindow("colors") },
    { sep: true },
    { label: "Next Image", acc: "Ctrl+Tab", action: () => app.nextSession(1) },
    { label: "Previous Image", acc: "Ctrl+Shift+Tab", action: () => app.nextSession(-1) },
    { sep: true },
    { label: "Settings...", acc: "Alt+X", action: () => app.openDialog({ type: "settings" }) },
  ];
}

function helpMenu(app: AppState): Item[] {
  return [
    { label: "Keyboard Shortcuts", acc: "F1", action: () => app.openDialog({ type: "shortcuts" }) },
    { label: "About paint.web", action: () => app.openDialog({ type: "about" }) },
  ];
}
