import type { AppState } from "../app-state";
import { mountMenu } from "./menu";
import { mountToolbar } from "./toolbar";
import { mountCanvas } from "./canvas-view";
import { mountColorsWindow, mountHistoryWindow, mountLayersWindow, mountStatus, mountToolsWindow } from "./windows";
import { mountDialogHost } from "./dialogs";

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
  const status = document.createElement("footer");
  const dialogs = document.createElement("div");
  root.append(menu, toolbar, workspace, status, dialogs);

  mountMenu(menu, app);
  mountToolbar(toolbar, app);
  mountCanvas(center, app);
  mountToolsWindow(toolsHost, app);
  mountColorsWindow(colorsHost, app);
  mountLayersWindow(layersHost, app);
  mountHistoryWindow(historyHost, app);
  mountStatus(status, app);
  mountDialogHost(dialogs, app);
}
