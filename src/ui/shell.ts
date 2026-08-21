import type { AppState } from "../app-state";
import { mountMenu } from "./menu";
import { mountToolbar } from "./toolbar";
import { mountCanvas } from "./canvas-view";
import { mountColorsWindow, mountHistoryWindow, mountLayersWindow, mountStatus, mountToolsWindow } from "./windows";
import { mountDialogHost } from "./dialogs";
import { mountAdaptiveDock } from "./dock";

export function mountShell(root: HTMLElement, app: AppState): void {
  root.className = "pdn-shell";
  root.innerHTML = "";
  const menu = document.createElement("nav");
  const toolbar = document.createElement("div");
  const workspace = document.createElement("div");
  workspace.className = "workspace";
  const left = document.createElement("aside");
  left.className = "dock left";
  const toolsHost = document.createElement("div");
  const colorsHost = document.createElement("div");
  left.append(toolsHost, colorsHost);
  const center = document.createElement("div");
  const right = document.createElement("aside");
  right.className = "dock right";
  const layersHost = document.createElement("div");
  const historyHost = document.createElement("div");
  right.append(layersHost, historyHost);
  workspace.append(left, center, right);
  const mobileBar = document.createElement("div");
  mobileBar.className = "mobile-bar";
  mobileBar.dataset.testid = "mobile-bar";
  const status = document.createElement("footer");
  const dialogs = document.createElement("div");
  const backdrop = document.createElement("div");
  backdrop.className = "sheet-backdrop";
  backdrop.dataset.testid = "sheet-backdrop";
  root.append(menu, toolbar, workspace, mobileBar, status, dialogs, backdrop);

  mountMenu(menu, app);
  mountToolbar(toolbar, app);
  mountCanvas(center, app);
  mountToolsWindow(toolsHost, app);
  mountColorsWindow(colorsHost, app);
  mountLayersWindow(layersHost, app);
  mountHistoryWindow(historyHost, app);
  mountStatus(status, app);
  mountDialogHost(dialogs, app);

  mountAdaptiveDock(left, [
    { id: "tools", label: "Tools", host: toolsHost },
    { id: "colors", label: "Colors", host: colorsHost },
  ]);
  mountAdaptiveDock(right, [
    { id: "layers", label: "Layers", host: layersHost },
    { id: "history", label: "History", host: historyHost },
  ]);

  const closeSheet = (): void => {
    root.removeAttribute("data-sheet");
    root.removeAttribute("data-panel");
  };

  const openSheet = (sheet: "colors" | "panels", panel?: "layers" | "history"): void => {
    if (root.dataset.sheet === sheet && (!panel || root.dataset.panel === panel)) {
      closeSheet();
      return;
    }
    root.dataset.sheet = sheet;
    if (panel) {
      root.dataset.panel = panel;
      for (const pane of right.querySelectorAll(".dock-pane")) {
        pane.classList.toggle("dock-pane-active", (pane as HTMLElement).dataset.pane === panel);
      }
      for (const tab of right.querySelectorAll(".dock-tab")) {
        tab.classList.toggle("active", (tab as HTMLElement).dataset.pane === panel);
      }
    } else {
      root.removeAttribute("data-panel");
    }
  };

  const barBtn = (label: string, on: () => void, testid?: string): HTMLButtonElement => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "mobile-bar-btn";
    b.textContent = label;
    if (testid) b.dataset.testid = testid;
    b.addEventListener("click", on);
    return b;
  };

  mobileBar.append(
    barBtn("Colors", () => openSheet("colors"), "mobile-colors"),
    barBtn("Layers", () => openSheet("panels", "layers"), "mobile-layers"),
    barBtn("History", () => openSheet("panels", "history"), "mobile-history"),
    barBtn("Fit", () => app.fitToView(), "mobile-fit"),
  );
  backdrop.addEventListener("click", closeSheet);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && root.dataset.sheet) {
      closeSheet();
      e.stopPropagation();
    }
  });
}
