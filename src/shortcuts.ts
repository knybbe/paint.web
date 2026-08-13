import type { AppState } from "./app-state";
import { getTool } from "./tools/registry";
import { getEffect } from "./effects/registry";
import { paramMap } from "./effects/base";

export function bindShortcuts(app: AppState): void {
  window.addEventListener("keydown", (e) => {
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

    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    const alt = e.altKey;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

    const go = (fn: () => void) => {
      e.preventDefault();
      fn();
    };

    if (e.key === "F1") return go(() => app.openDialog({ type: "shortcuts" }));
    if (e.key === "F4") return go(() => app.openDialog({ type: "layerProps" }));
    if (e.key === "F5") return go(() => app.toggleWindow("tools"));
    if (e.key === "F6") return go(() => app.toggleWindow("history"));
    if (e.key === "F7") return go(() => app.toggleWindow("layers"));
    if (e.key === "F8") return go(() => app.toggleWindow("colors"));

    if (ctrl && key === "n") return go(() => app.openDialog({ type: "new" }));
    if (ctrl && key === "o") return go(() => void app.openFiles());
    if (ctrl && shift && key === "s") return go(() => void app.save(true));
    if (ctrl && key === "s") return go(() => void app.save(false));
    if (ctrl && (key === "w" || e.key === "F4")) return go(() => app.closeSession());
    if (ctrl && key === "p") return go(() => app.print());

    if (ctrl && key === "z") return go(() => app.undo());
    if (ctrl && key === "y") return go(() => app.redo());
    if (ctrl && shift && key === "c") return go(() => void app.copy(true));
    if (ctrl && key === "c") return go(() => void app.copy(false));
    if (ctrl && key === "x") return go(() => void app.cut());
    if (ctrl && alt && key === "v") return go(() => void app.paste("newImage"));
    if (ctrl && shift && key === "v") return go(() => void app.paste("newLayer"));
    if (ctrl && key === "v") return go(() => void app.paste("normal"));
    if (e.key === "Delete") return go(() => app.eraseSelection());
    if (e.key === "Backspace" && !typing) return go(() => app.fillSelection(shift ? app.secondary : app.primary));
    if (ctrl && key === "a") return go(() => app.selectAll());
    if (ctrl && key === "d") return go(() => app.deselect());
    if (ctrl && key === "i" && !shift && !alt) return go(() => app.invertSelection());
    if (e.key === "Enter" && !typing) return go(() => app.deselect());

    if (ctrl && (e.key === "=" || e.key === "+")) return go(() => { app.viewport.zoomIn(); app.notify("viewport"); });
    if (ctrl && e.key === "-") return go(() => { app.viewport.zoomOut(); app.notify("viewport"); });
    if (ctrl && e.key === "0") return go(() => { app.viewport.actualSize(app.document.width, app.document.height); app.notify("viewport"); });
    if (ctrl && shift && key === "b") {
      return go(() => {
        const b = app.selection.bounds;
        if (b) app.viewport.fitSelection(b);
        app.notify("viewport");
      });
    }
    if (ctrl && key === "b") {
      return go(() => {
        app.viewport.fitToWindow(app.document.width, app.document.height);
        app.notify("viewport");
      });
    }

    if (ctrl && shift && key === "x") return go(() => app.cropToSelection());
    if (ctrl && shift && key === "r") return go(() => app.openDialog({ type: "canvas" }));
    if (ctrl && key === "r") return go(() => app.openDialog({ type: "resize" }));
    if (ctrl && key === "h") return go(() => app.transform("rotate90cw"));
    if (ctrl && key === "g" && !shift) return go(() => app.transform("rotate90ccw"));
    if (ctrl && shift && key === "f") return go(() => app.flatten());

    if (ctrl && shift && key === "n") return go(() => app.addLayer());
    if (ctrl && shift && e.key === "Delete") return go(() => app.deleteLayer());
    if (ctrl && shift && key === "d") return go(() => app.duplicateLayer());
    if (ctrl && key === "m") return go(() => app.mergeDown());
    if (ctrl && e.key === ",") return go(() => app.setLayerProps(app.document.activeLayer.id, { visible: !app.document.activeLayer.visible }));
    if (ctrl && shift && key === "z") return go(() => app.openDialog({ type: "rotateZoom" }));
    if (alt && e.key === "PageUp") return go(() => stepLayer(app, 1));
    if (alt && e.key === "PageDown") return go(() => stepLayer(app, -1));

    if (ctrl && shift && key === "l") return go(() => applyId(app, "autoLevel"));
    if (ctrl && shift && key === "g") return go(() => applyId(app, "blackAndWhite"));
    if (ctrl && shift && key === "t") return go(() => app.openDialog({ type: "effect", effectId: "brightnessContrast" }));
    if (ctrl && shift && key === "m") return go(() => app.openDialog({ type: "effect", effectId: "curves" }));
    if (ctrl && shift && key === "u") return go(() => app.openDialog({ type: "effect", effectId: "hueSaturation" }));
    if (ctrl && alt && key === "i") return go(() => applyId(app, "invertAlpha"));
    if (ctrl && shift && key === "i") return go(() => applyId(app, "invertColors"));
    if (ctrl && key === "l") return go(() => app.openDialog({ type: "effect", effectId: "levels" }));
    if (ctrl && shift && key === "p") return go(() => app.openDialog({ type: "effect", effectId: "posterize" }));
    if (ctrl && shift && key === "e") return go(() => applyId(app, "sepia"));
    if (ctrl && key === "f") {
      return go(() => {
        if (!app.lastEffect) return;
        const ef = getEffect(app.lastEffect.id);
        if (ef) app.applyEffect(ef, app.lastEffect.params);
      });
    }

    if (ctrl && key === "tab") return go(() => app.nextSession(shift ? -1 : 1));
    if (alt && key === "x") return go(() => app.openDialog({ type: "settings" }));

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
      if (key === "b") return go(() => app.setTool("paintbrush"));
      if (key === "p") return go(() => app.setTool("pencil"));
      if (key === "e") return go(() => app.setTool("eraser"));
      if (key === "f") return go(() => app.setTool("paintBucket"));
      if (key === "g") return go(() => app.setTool("gradient"));
      if (key === "k") return go(() => app.setTool("colorPicker"));
      if (key === "l") return go(() => app.setTool("cloneStamp"));
      if (key === "r") return go(() => app.setTool("recolor"));
      if (key === "t") return go(() => app.setTool("text"));
      if (key === "h") return go(() => app.setTool("pan"));
      if (key === "z") return go(() => app.setTool("zoom"));
      if (key === "x") return go(() => app.swapColors());
      if (key === "c") return go(() => app.switchActiveColor());
    }

    if (e.key === "Escape") {
      if (app.dialog) return go(() => app.closeDialog());
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

function applyId(app: AppState, id: string): void {
  const e = getEffect(id);
  if (!e) return;
  if (e.params.length) app.openDialog({ type: "effect", effectId: id });
  else app.applyEffect(e, paramMap(e.params));
}
