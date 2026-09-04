import type { AppState } from "../app-state";
import { mountRibbon } from "./ribbon";
import { mountMobileDeck } from "./mobile-deck";
import { mountCanvas } from "./canvas-view";
import { mountColorsWindow, mountHistoryWindow, mountLayersWindow, mountStatus, mountToolsWindow } from "./windows";
import { mountDialogHost } from "./dialogs";
import { mountAdaptiveDock } from "./dock";

export function mountShell(root: HTMLElement, app: AppState): void {
  root.className = "pdn-shell modern-shell";
  root.innerHTML = "";

  // 1. Desktop Ribbon Host
  const ribbonHost = document.createElement("header");
  ribbonHost.className = "desktop-ribbon-host";
  mountRibbon(ribbonHost, app);

  // 2. Mobile / Tablet Deck Elements
  const mobileDeck = mountMobileDeck(root, app);

  // 3. Main Workspace (Canvas + Side Docks)
  const workspace = document.createElement("div");
  workspace.className = "workspace";

  const left = document.createElement("aside");
  left.className = "dock left";
  const toolsHost = document.createElement("div");
  const colorsHost = document.createElement("div");
  left.append(toolsHost, colorsHost);

  const center = document.createElement("div");
  center.className = "canvas-col";

  const right = document.createElement("aside");
  right.className = "dock right";
  const layersHost = document.createElement("div");
  const historyHost = document.createElement("div");
  right.append(layersHost, historyHost);

  workspace.append(left, center, right);

  // 4. Status Bar & Dialogs
  const status = document.createElement("footer");
  const dialogs = document.createElement("div");

  // Assemble the DOM structure:
  // Desktop ribbon & mobile top bar at top
  root.append(
    ribbonHost,
    mobileDeck.topBar,
    workspace,
    mobileDeck.contextPill,
    mobileDeck.deckBar,
    mobileDeck.sheetHost,
    mobileDeck.backdrop,
    status,
    dialogs,
  );

  // Mount canvas and window views
  mountCanvas(center, app);
  mountToolsWindow(toolsHost, app);
  mountColorsWindow(colorsHost, app);
  mountLayersWindow(layersHost, app);
  mountHistoryWindow(historyHost, app);
  mountStatus(status, app);
  mountDialogHost(dialogs, app);

  // Mount adaptive docks
  mountAdaptiveDock(left, [
    { id: "tools", label: "Tools", host: toolsHost },
    { id: "colors", label: "Colors", host: colorsHost },
  ]);
  mountAdaptiveDock(right, [
    { id: "layers", label: "Layers", host: layersHost },
    { id: "history", label: "History", host: historyHost },
  ]);

  // Synchronize dock collapse when window panels are closed
  const updateDocks = () => {
    const leftVisible = app.windows.tools || app.windows.colors;
    const rightVisible = app.windows.layers || app.windows.history;
    left.classList.toggle("collapsed", !leftVisible);
    right.classList.toggle("collapsed", !rightVisible);
    workspace.classList.toggle("no-left-dock", !leftVisible);
    workspace.classList.toggle("no-right-dock", !rightVisible);
  };
  updateDocks();
  app.addEventListener("windows", updateDocks);
}
