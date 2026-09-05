import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppState } from "../src/app-state";
import { mountShell } from "../src/ui/shell";
import { bindShortcuts } from "../src/shortcuts";
import { mountCommandPalette, unmountCommandPalette } from "../src/ui/react/command-palette";
import { unmountDesktopChrome } from "../src/ui/react/desktop-shell";
import "../src/styles/app.css";

async function mount(): Promise<AppState> {
  document.body.innerHTML = '<div id="app"></div>';
  const app = new AppState();
  await app.init();
  await act(async () => {
    mountShell(document.getElementById("app")!, app);
    bindShortcuts(app);
  });
  return app;
}

function click(el: Element | null): void {
  if (!el) throw new Error("missing element");
  el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
  el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true }));
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

describe("Desktop editor shell & mobile deck", () => {
  let app: AppState;

  beforeEach(async () => {
    app = await mount();
  });

  afterEach(() => {
    unmountCommandPalette();
    unmountDesktopChrome();
    document.body.innerHTML = "";
  });

  it("renders the desktop shell and mobile command deck", () => {
    expect(document.querySelector('[data-testid="menubar"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="ribbon-context-strip"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="tool-rail"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="mobile-command-deck"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="mobile-context-pill"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="canvas-host"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="statusbar"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="window-tools"]')).toBeFalsy();

    const menus = [...document.querySelectorAll('[data-slot="menubar-trigger"]')].map((el) => el.textContent?.trim());
    expect(menus).toEqual(["File", "Edit", "Image", "Adjust", "Effects", "View", "Window", "Help"]);
  });

  it("runs File > New from the menubar and shows New Image dialog", async () => {
    await act(async () => {
      click(document.querySelector('[data-testid="menu-file"]'));
    });
    await act(async () => {
      click(document.querySelector('[data-testid="ribbon-file-new"]'));
    });
    const dialog = document.querySelector('[data-testid="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.textContent).toContain("New Image");
  });

  it("hides the tool rail when Window > Tools is toggled", () => {
    const rail = document.querySelector(".tool-rail-host");
    expect(rail?.classList.contains("collapsed")).toBe(false);
    expect(document.querySelector(".workspace")?.classList.contains("no-left-dock")).toBe(false);
    app.toggleWindow("tools");
    expect(rail?.classList.contains("collapsed")).toBe(true);
    expect(document.querySelector(".workspace")?.classList.contains("no-left-dock")).toBe(true);
    app.toggleWindow("tools");
    expect(rail?.classList.contains("collapsed")).toBe(false);
  });

  it("selects tools from the left tool rail", async () => {
    await act(async () => {
      click(document.querySelector('[data-testid="tool-pencil"]'));
    });
    expect(app.currentTool).toBe("pencil");
    expect(document.querySelector('[data-testid="tool-pencil"]')?.classList.contains("active")).toBe(true);

    await act(async () => {
      click(document.querySelector('[data-testid="tool-paintbrush"]'));
    });
    expect(app.currentTool).toBe("paintbrush");
    expect(document.querySelector('[data-testid="tool-paintbrush"]')?.classList.contains("active")).toBe(true);
  });

  it("updates contextual tool options strip when switching tools", async () => {
    await act(async () => {
      click(document.querySelector('[data-testid="tool-paintbrush"]'));
    });
    const strip = document.querySelector('[data-testid="ribbon-context-strip"]');
    expect(strip?.textContent).toContain("Paintbrush");
    expect(strip?.textContent).toContain("Size");

    await act(async () => {
      click(document.querySelector('[data-testid="tool-magicWand"]'));
    });
    const updatedStrip = document.querySelector('[data-testid="ribbon-context-strip"]');
    expect(updatedStrip?.textContent).toContain("Magic Wand");
    expect(updatedStrip?.textContent).toContain("Tolerance");
  });

  it("adds a layer from the Layers inspector", () => {
    expect(app.document.layers).toHaveLength(1);
    const addBtn = document.querySelector('[data-testid="window-layers"] button[title="Add"]');
    click(addBtn);
    expect(app.document.layers).toHaveLength(2);
    expect(document.querySelector('[data-testid="window-layers"]')?.textContent).toContain("Layer 1");
  });

  it("exposes Fit to View in the title row and status bar", () => {
    expect(document.querySelector('[data-testid="ribbon-fit"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="zoom-fit"]')).toBeTruthy();

    app.viewport.viewWidth = 400;
    app.viewport.viewHeight = 300;
    app.viewport.zoom = 0.1;
    click(document.querySelector('[data-testid="ribbon-fit"]'));
    expect(app.viewport.zoom).toBeGreaterThan(0.2);
  });

  it("opens adjustment from the Adjust menu", async () => {
    await act(async () => {
      click(document.querySelector('[data-testid="menu-adjust"]'));
    });
    await act(async () => {
      click(document.querySelector('[data-testid="adj-brightnessContrast"]'));
    });
    const dialog = document.querySelector('[data-testid="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.textContent).toContain("Brightness / Contrast");
  });

  it("opens the command palette from the title row", async () => {
    await act(async () => {
      mountCommandPalette(app);
    });
    await act(async () => {
      click(document.querySelector('[data-testid="command-palette-btn"]'));
    });
    expect(document.querySelector('[data-testid="command-palette"]')).toBeTruthy();
  });

  it("opens mobile tools sheet from command deck and selects a tool", () => {
    const deckTools = document.querySelector('[data-testid="mobile-tab-tools"]');
    click(deckTools);

    const sheet = document.querySelector('[data-testid="mobile-sheet-container"]');
    expect(sheet?.classList.contains("open")).toBe(true);
    expect(sheet?.textContent).toContain("Select Tool");

    const mobileLasso = document.querySelector('[data-testid="mobile-tool-lassoSelect"]');
    expect(mobileLasso).toBeTruthy();
    click(mobileLasso);

    expect(app.currentTool).toBe("lassoSelect");
    expect(sheet?.classList.contains("open")).toBe(false);
  });

  it("opens mobile layers sheet and adds a layer", () => {
    expect(app.document.layers).toHaveLength(1);
    const deckLayers = document.querySelector('[data-testid="mobile-tab-layers"]');
    click(deckLayers);

    const sheet = document.querySelector('[data-testid="mobile-sheet-container"]');
    expect(sheet?.classList.contains("open")).toBe(true);

    const addBtn = document.querySelector('[data-testid="mobile-layer-add"]');
    expect(addBtn).toBeTruthy();
    click(addBtn);

    expect(app.document.layers).toHaveLength(2);
  });

  it("opens mobile color studio sheet and dismisses via backdrop", () => {
    const deckColor = document.querySelector('[data-testid="mobile-tab-color"]');
    click(deckColor);

    const sheet = document.querySelector('[data-testid="mobile-sheet-container"]');
    const backdrop = document.querySelector('[data-testid="mobile-sheet-backdrop"]');
    expect(sheet?.classList.contains("open")).toBe(true);
    expect(backdrop?.classList.contains("open")).toBe(true);

    click(backdrop);
    expect(sheet?.classList.contains("open")).toBe(false);
    expect(backdrop?.classList.contains("open")).toBe(false);
  });
});
