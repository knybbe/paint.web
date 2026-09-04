import type { AppState } from "../app-state";
import { effectsByMenu, getEffect } from "../effects/registry";
import type { EffectDef } from "../effects/base";
import { runCommand } from "../commands";

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
    { label: "New...", acc: "Ctrl+N", action: () => runCommand(app, "file.new") },
    { label: "Open...", acc: "Ctrl+O", action: () => runCommand(app, "file.open") },
    {
      label: "Open Recent",
      children: app.recent.length
        ? app.recent.map((r) => ({ label: r.name, action: () => void app.openRecent(r.id) }))
        : [{ label: "(empty)", disabled: () => true }],
    },
    { sep: true },
    { label: "Close", acc: "Ctrl+W", action: () => app.closeSession() },
    { label: "Save", acc: "Ctrl+S", action: () => runCommand(app, "file.save") },
    { label: "Save As...", acc: "Ctrl+Shift+S", action: () => runCommand(app, "file.saveAs") },
    { sep: true },
    { label: "Print...", acc: "Ctrl+P", action: () => app.print() },
    { sep: true },
    { label: "Exit", acc: "Alt+F4", action: () => app.closeSession() },
  ];
}

function editMenu(app: AppState): Item[] {
  return [
    { label: "Undo" + (app.history.undoName ? ` ${app.history.undoName}` : ""), acc: "Ctrl+Z", disabled: () => !app.history.canUndo, action: () => runCommand(app, "edit.undo") },
    { label: "Redo" + (app.history.redoName ? ` ${app.history.redoName}` : ""), acc: "Ctrl+Y", disabled: () => !app.history.canRedo, action: () => runCommand(app, "edit.redo") },
    { sep: true },
    { label: "Cut", acc: "Ctrl+X", action: () => runCommand(app, "edit.cut") },
    { label: "Copy", acc: "Ctrl+C", action: () => runCommand(app, "edit.copy") },
    { label: "Copy Merged", acc: "Ctrl+Shift+C", action: () => runCommand(app, "edit.copyMerged") },
    { label: "Paste", acc: "Ctrl+V", action: () => runCommand(app, "edit.paste") },
    { label: "Paste into New Layer", acc: "Ctrl+Shift+V", action: () => void app.paste("newLayer") },
    { label: "Paste into New Image", acc: "Ctrl+Alt+V", action: () => void app.paste("newImage") },
    { sep: true },
    { label: "Erase Selection", acc: "Delete", action: () => app.eraseSelection() },
    { label: "Fill Selection", acc: "Backspace", action: () => app.fillSelection() },
    { label: "Invert Selection", acc: "Ctrl+I", action: () => runCommand(app, "edit.invertSelection") },
    { label: "Select All", acc: "Ctrl+A", action: () => runCommand(app, "edit.selectAll") },
    { label: "Deselect", acc: "Ctrl+D", action: () => runCommand(app, "edit.deselect") },
  ];
}

function viewMenu(app: AppState): Item[] {
  return [
    { label: "Zoom In", acc: "Ctrl++", action: () => runCommand(app, "view.zoomIn") },
    { label: "Zoom Out", acc: "Ctrl+-", action: () => runCommand(app, "view.zoomOut") },
    {
      label: "Fit to View",
      acc: "Ctrl+B",
      action: () => runCommand(app, "view.fit"),
    },
    {
      label: "Zoom to Window",
      action: () => app.fitToView(),
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
    { label: "Actual Size", acc: "Ctrl+0", action: () => runCommand(app, "view.actualSize") },
    { sep: true },
    {
      label: "Rulers",
      check: () => app.viewport.showRulers,
      action: () => runCommand(app, "view.rulers"),
    },
    {
      label: "Pixel Grid",
      check: () => app.viewport.showPixelGrid,
      action: () => runCommand(app, "view.pixelGrid"),
    },
    { sep: true },
    {
      label: "Dark Theme",
      check: () => app.settings.theme === "dark",
      action: () => runCommand(app, "view.theme"),
    },
  ];
}

function imageMenu(app: AppState): Item[] {
  return [
    { label: "Crop to Selection", acc: "Ctrl+Shift+X", disabled: () => app.selection.empty, action: () => runCommand(app, "edit.crop") },
    { label: "Resize...", acc: "Ctrl+R", action: () => runCommand(app, "image.resize") },
    { label: "Canvas Size...", acc: "Ctrl+Shift+R", action: () => runCommand(app, "image.canvasSize") },
    { sep: true },
    { label: "Rotate 90° Clockwise", acc: "Ctrl+H", action: () => runCommand(app, "image.rotate90cw") },
    { label: "Rotate 90° Counter-Clockwise", acc: "Ctrl+G", action: () => runCommand(app, "image.rotate90ccw") },
    { label: "Rotate 180°", action: () => runCommand(app, "image.rotate180") },
    { label: "Flip Horizontal", action: () => runCommand(app, "image.flipH") },
    { label: "Flip Vertical", action: () => runCommand(app, "image.flipV") },
    { sep: true },
    { label: "Flatten", acc: "Ctrl+Shift+F", action: () => runCommand(app, "image.flatten") },
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
  const id = e.menu === "Adjustments" ? `adj.${e.id}` : `effect.${e.id}`;
  return {
    label: e.name + (e.params.length ? "..." : ""),
    acc: e.shortcut,
    action: () => {
      runCommand(app, id);
    },
  };
}

function windowMenu(app: AppState): Item[] {
  return [
    { label: "Tools", acc: "F5", check: () => app.windows.tools, action: () => runCommand(app, "window.tools") },
    { label: "History", acc: "F6", check: () => app.windows.history, action: () => runCommand(app, "window.history") },
    { label: "Layers", acc: "F7", check: () => app.windows.layers, action: () => runCommand(app, "window.layers") },
    { label: "Colors", acc: "F8", check: () => app.windows.colors, action: () => runCommand(app, "window.colors") },
    { sep: true },
    { label: "Next Image", acc: "Ctrl+Tab", action: () => app.nextSession(1) },
    { label: "Previous Image", acc: "Ctrl+Shift+Tab", action: () => app.nextSession(-1) },
    { sep: true },
    { label: "Settings...", acc: "Alt+X", action: () => runCommand(app, "file.settings") },
  ];
}

function helpMenu(app: AppState): Item[] {
  return [
    { label: "Keyboard Shortcuts", acc: "F1", action: () => runCommand(app, "help.shortcuts") },
    { label: "About paint.web", action: () => runCommand(app, "help.about") },
  ];
}
