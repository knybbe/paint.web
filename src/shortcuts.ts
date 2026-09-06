import type { AppState } from "./app-state";
import { getTool } from "./tools/registry";
import { getEffect } from "./effects/registry";
import { runCommand } from "./commands";
import { isCommandPaletteOpen, toggleCommandPalette } from "./ui/react/command-palette";

export function bindShortcuts(app: AppState): void {
  window.addEventListener("keydown", (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    const alt = e.altKey;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

    if (ctrl && !alt && !shift && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      toggleCommandPalette();
      return;
    }
    // Radix dismisses the palette on document capture (preventDefault, no stopPropagation).
    if (e.defaultPrevented) return;
    if (isCommandPaletteOpen()) return;

    const t = e.target as HTMLElement | null;
    const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
    if (typing && e.key !== "Escape") {
      if (app.currentTool === "text" && t === document.body) {
        /* fall through */
      } else return;
    }

    if (getTool(app.currentTool).keyDown?.(e, app.toolContext())) {
      e.preventDefault();
      return;
    }

    const go = (fn: () => void) => {
      e.preventDefault();
      fn();
    };
    const run = (id: string) => go(() => { runCommand(app, id); });

    if (e.key === "F1") return run("help.shortcuts");
    if (e.key === "F4") return go(() => app.openDialog({ type: "layerProps" }));
    if (e.key === "F5") return run("window.tools");
    if (e.key === "F6") return run("window.history");
    if (e.key === "F7") return run("window.layers");
    if (e.key === "F8") return run("window.colors");

    if (ctrl && key === "n") return run("file.new");
    if (ctrl && key === "o") return run("file.open");
    if (ctrl && shift && key === "s") return run("file.download");
    if (ctrl && shift && key === "u") return run("file.sync");
    if (ctrl && shift && key === "e") return run("file.explorer");
    if (ctrl && key === "s") return run("file.download");
    if (ctrl && (key === "w" || e.key === "F4")) return go(() => app.closeSession());
    if (ctrl && key === "p") return go(() => app.print());

    if (ctrl && key === "z") return run("edit.undo");
    if (ctrl && key === "y") return run("edit.redo");
    if (ctrl && shift && key === "c") return run("edit.copyMerged");
    if (ctrl && key === "c") return run("edit.copy");
    if (ctrl && key === "x") return run("edit.cut");
    if (ctrl && alt && key === "v") return go(() => void app.paste("newImage"));
    if (ctrl && shift && key === "v") return go(() => void app.paste("newLayer"));
    if (ctrl && key === "v") return run("edit.paste");
    if (e.key === "Delete") return go(() => app.eraseSelection());
    if (e.key === "Backspace" && !typing) return go(() => app.fillSelection(shift ? app.secondary : app.primary));
    if (ctrl && key === "a") return run("edit.selectAll");
    if (ctrl && key === "d") return run("edit.deselect");
    if (ctrl && key === "i" && !shift && !alt) return run("edit.invertSelection");
    if (e.key === "Enter" && !typing) return go(() => app.deselect());

    if (ctrl && (e.key === "=" || e.key === "+")) return run("view.zoomIn");
    if (ctrl && e.key === "-") return run("view.zoomOut");
    if (ctrl && e.key === "0") return run("view.actualSize");
    if (ctrl && shift && key === "b") {
      return go(() => {
        const b = app.selection.bounds;
        if (b) app.viewport.fitSelection(b);
        app.notify("viewport");
      });
    }
    if (ctrl && key === "b") return run("view.fit");

    if (ctrl && shift && key === "x") return run("edit.crop");
    if (ctrl && shift && key === "r") return run("image.canvasSize");
    if (ctrl && key === "r") return run("image.resize");
    if (ctrl && key === "h") return run("image.rotate90cw");
    if (ctrl && key === "g" && !shift) return run("image.rotate90ccw");
    if (ctrl && shift && key === "f") return run("image.flatten");

    if (ctrl && shift && key === "n") return go(() => app.addLayer());
    if (ctrl && shift && e.key === "Delete") return go(() => app.deleteLayer());
    if (ctrl && shift && key === "d") return go(() => app.duplicateLayer());
    if (ctrl && key === "m") return go(() => app.mergeDown());
    if (ctrl && e.key === ",") return go(() => app.setLayerProps(app.document.activeLayer.id, { visible: !app.document.activeLayer.visible }));
    if (ctrl && shift && key === "z") return go(() => app.openDialog({ type: "rotateZoom" }));
    if (alt && e.key === "PageUp") return go(() => stepLayer(app, 1));
    if (alt && e.key === "PageDown") return go(() => stepLayer(app, -1));

    if (ctrl && shift && key === "l") return run("adj.autoLevel");
    if (ctrl && shift && key === "g") return run("adj.blackAndWhite");
    if (ctrl && shift && key === "t") return run("adj.brightnessContrast");
    if (ctrl && shift && key === "m") return run("adj.curves");
    if (ctrl && shift && key === "u") return run("adj.hueSaturation");
    if (ctrl && alt && key === "i") return run("adj.invertAlpha");
    if (ctrl && shift && key === "i") return run("adj.invertColors");
    if (ctrl && key === "l") return run("adj.levels");
    if (ctrl && shift && key === "p") return run("adj.posterize");
    if (ctrl && shift && key === "e") return run("adj.sepia");
    if (ctrl && key === "f") {
      return go(() => {
        if (!app.lastEffect) return;
        const ef = getEffect(app.lastEffect.id);
        if (ef) app.applyEffect(ef, app.lastEffect.params);
      });
    }

    if (ctrl && key === "tab") return go(() => app.nextSession(shift ? -1 : 1));
    if (alt && key === "x") return run("file.settings");

    if (e.key === "[" || e.key === "]") {
      const delta = (e.key === "]" ? 1 : -1) * (ctrl ? 5 : 1);
      return go(() => {
        app.options.brushWidth = Math.max(1, Math.min(2000, app.options.brushWidth + delta));
        app.notify("tool");
      });
    }

    if (!ctrl && !alt) {
      if (key === "s") return go(() => app.cycleTool("select", shift));
      if (key === "m") return go(() => app.cycleTool("move", shift));
      if (key === "o") return go(() => app.cycleTool("shape", shift));
      if (key === "b") return run("tool.paintbrush");
      if (key === "p") return run("tool.pencil");
      if (key === "e") return run("tool.eraser");
      if (key === "f") return run("tool.paintBucket");
      if (key === "g") return run("tool.gradient");
      if (key === "k") return run("tool.colorPicker");
      if (key === "l") return run("tool.cloneStamp");
      if (key === "r") return run("tool.recolor");
      if (key === "t") return run("tool.text");
      if (key === "h") return run("tool.pan");
      if (key === "z") return run("tool.zoom");
      if (key === "x") return go(() => app.swapColors());
      if (key === "c") return go(() => app.switchActiveColor());
    }

    if (e.key === "Escape") {
      if (app.dialog) return go(() => app.closeDialog());
      if (app.session.floating) return go(() => app.cancelFloating());
      app.cancelActiveTool();
      app.deselect();
    }
  });
}

function stepLayer(app: AppState, dir: 1 | -1): void {
  const i = app.document.activeIndex + dir;
  if (i < 0 || i >= app.document.layers.length) return;
  app.document.setActive(app.document.layers[i].id);
  app.notify("layers");
}
