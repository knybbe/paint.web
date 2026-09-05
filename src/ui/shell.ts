import type { AppState } from "../app-state";
import { mountMobileDeck } from "./mobile-deck";
import { mountCanvas } from "./canvas-view";
import { mountColorsWindow, mountHistoryWindow, mountLayersWindow, mountStatus } from "./windows";
import { mountDialogHost } from "./dialogs";
import { mountAdaptiveDock } from "./dock";
import { mountDesktopChrome } from "./react/desktop-shell";

export function mountShell(root: HTMLElement, app: AppState): void {
  root.className = "pdn-shell modern-shell";
  root.innerHTML = "";

  const chromeHost = document.createElement("div");
  chromeHost.className = "desktop-chrome-host";

  const mobileDeck = mountMobileDeck(root, app);

  const workspace = document.createElement("div");
  workspace.className = "workspace";

  const railHost = document.createElement("aside");
  railHost.className = "tool-rail-host";

  const center = document.createElement("div");
  center.className = "canvas-col";

  const right = document.createElement("aside");
  right.className = "dock right";
  const layersHost = document.createElement("div");
  const colorsHost = document.createElement("div");
  const historyHost = document.createElement("div");
  right.append(layersHost, colorsHost, historyHost);

  workspace.append(railHost, center, right);

  const status = document.createElement("footer");
  const dialogs = document.createElement("div");

  root.append(
    chromeHost,
    mobileDeck.topBar,
    workspace,
    mobileDeck.contextPill,
    mobileDeck.deckBar,
    mobileDeck.sheetHost,
    mobileDeck.backdrop,
    status,
    dialogs,
  );

  mountDesktopChrome(chromeHost, app, railHost);
  mountCanvas(center, app);
  mountLayersWindow(layersHost, app);
  mountColorsWindow(colorsHost, app);
  mountHistoryWindow(historyHost, app);
  mountStatus(status, app);
  mountDialogHost(dialogs, app);

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
  };
  updateDocks();
  app.addEventListener("windows", updateDocks);
}
