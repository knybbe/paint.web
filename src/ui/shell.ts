import type { AppState } from "../app-state";
import { bindChromePhase, tabletInspectorPane } from "./chrome-phase";
import { mountCanvas } from "./canvas-view";
import { mountStatus } from "./windows";
import { mountAdaptiveDock } from "./dock";
import { mountCommandPalette } from "./react/command-palette";
import { mountDesktopChrome } from "./react/desktop-shell";
import { mountDockPanels } from "./react/dock-panels";
import { mountPhoneChrome } from "./react/phone-chrome";
import { mountTabletInspector } from "./react/tablet-inspector";

export function mountShell(root: HTMLElement, app: AppState): void {
  bindChromePhase(app);
  root.className = "pdn-shell modern-shell";
  root.innerHTML = "";

  const chromeHost = document.createElement("div");
  chromeHost.className = "desktop-chrome-host";

  const phoneHost = document.createElement("div");
  phoneHost.className = "phone-chrome-host";

  const workspace = document.createElement("div");
  workspace.className = "workspace";

  const railHost = document.createElement("aside");
  railHost.className = "tool-rail-host";

  const center = document.createElement("div");
  center.className = "canvas-col";

  const right = document.createElement("aside");
  right.className = "dock right";
  const inspectorBar = document.createElement("div");
  inspectorBar.className = "tablet-inspector-host";
  const layersHost = document.createElement("div");
  const colorsHost = document.createElement("div");
  const historyHost = document.createElement("div");
  right.append(inspectorBar, layersHost, colorsHost, historyHost);

  workspace.append(railHost, center, right);

  const thumbHost = document.createElement("div");
  thumbHost.className = "tablet-thumb-host";

  const status = document.createElement("footer");

  root.append(chromeHost, phoneHost, workspace, thumbHost, status);

  mountDesktopChrome(chromeHost, app, railHost, thumbHost);
  mountPhoneChrome(phoneHost, app);
  mountCanvas(center, app);
  mountDockPanels(layersHost, colorsHost, historyHost, app);
  mountTabletInspector(inspectorBar, app);
  mountStatus(status, app);
  mountCommandPalette(app);

  mountAdaptiveDock(right, [
    { id: "layers", label: "Layers", host: layersHost },
    { id: "colors", label: "Colors", host: colorsHost },
    { id: "history", label: "History", host: historyHost },
  ]);

  const updateDocks = () => {
    const leftVisible = app.windows.tools;
    const rightVisible = app.windows.layers || app.windows.colors || app.windows.history;
    railHost.classList.toggle("collapsed", !leftVisible);
    workspace.classList.toggle("no-left-dock", !leftVisible);
    right.classList.toggle("collapsed", !rightVisible);
    workspace.classList.toggle("no-right-dock", !rightVisible);
    const pane = tabletInspectorPane(app);
    layersHost.classList.toggle("tablet-active", pane === "layers");
    colorsHost.classList.toggle("tablet-active", pane === "colors");
    historyHost.classList.toggle("tablet-active", pane === "history");
  };
  updateDocks();
  app.addEventListener("windows", updateDocks);
}
