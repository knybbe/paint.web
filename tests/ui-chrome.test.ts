import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppState } from "../src/app-state";
import { mountShell } from "../src/ui/shell";
import { bindShortcuts } from "../src/shortcuts";
import "../src/styles/app.css";

async function mount(): Promise<AppState> {
  document.body.innerHTML = '<div id="app"></div>';
  const app = new AppState();
  await app.init();
  mountShell(document.getElementById("app")!, app);
  bindShortcuts(app);
  return app;
}

function click(el: Element | null): void {
  if (!el) throw new Error("missing element");
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

describe("Modern UI Chrome: Office-Style Ribbon & Mobile Deck", () => {
  let app: AppState;

  beforeEach(async () => {
    app = await mount();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders the modern desktop ribbon and mobile command deck", () => {
    expect(document.querySelector('[data-testid="ribbon-bar"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="ribbon-context-strip"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="mobile-command-deck"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="mobile-context-pill"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="canvas-host"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="statusbar"]')).toBeTruthy();

    const tabLabels = [...document.querySelectorAll(".ribbon-tab-btn")].map((el) => el.textContent?.trim());
    expect(tabLabels).toEqual(["Home", "Tools", "Image", "Adjust & FX", "Layers", "View"]);
  });

  it("switches ribbon tabs seamlessly", () => {
    const homeTab = document.querySelector('[data-testid="ribbon-tab-home"]');
    const toolsTab = document.querySelector('[data-testid="ribbon-tab-tools"]');
    expect(homeTab?.classList.contains("active")).toBe(true);
    expect(document.querySelector('[data-testid="ribbon-file-new"]')).toBeTruthy();

    click(toolsTab);
    expect(document.querySelector('[data-testid="ribbon-tab-tools"]')?.classList.contains("active")).toBe(true);
    expect(document.querySelector('[data-testid="tool-paintbrush"]')).toBeTruthy();
  });

  it("runs File > New from Home ribbon tab and shows New Image dialog", () => {
    click(document.querySelector('[data-testid="ribbon-tab-home"]'));
    click(document.querySelector('[data-testid="ribbon-file-new"]'));
    const dialog = document.querySelector('[data-testid="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.textContent).toContain("New Image");
  });

  it("selects tools from the Ribbon Tools tab", () => {
    click(document.querySelector('[data-testid="ribbon-tab-tools"]'));
    click(document.querySelector('[data-testid="tool-pencil"]'));
    expect(app.currentTool).toBe("pencil");
    expect(document.querySelector('[data-testid="tool-pencil"]')?.classList.contains("active")).toBe(true);

    click(document.querySelector('[data-testid="tool-paintbrush"]'));
    expect(app.currentTool).toBe("paintbrush");
    expect(document.querySelector('[data-testid="tool-paintbrush"]')?.classList.contains("active")).toBe(true);
  });

  it("updates contextual tool options strip when switching tools", () => {
    click(document.querySelector('[data-testid="ribbon-tab-tools"]'));
    click(document.querySelector('[data-testid="tool-paintbrush"]'));
    const strip = document.querySelector('[data-testid="ribbon-context-strip"]');
    expect(strip?.textContent).toContain("Paintbrush");
    expect(strip?.textContent).toContain("Size");

    click(document.querySelector('[data-testid="tool-magicWand"]'));
    const updatedStrip = document.querySelector('[data-testid="ribbon-context-strip"]');
    expect(updatedStrip?.textContent).toContain("Magic Wand");
    expect(updatedStrip?.textContent).toContain("Tolerance");
  });

  it("adds a layer from the Layers ribbon tab", () => {
    expect(app.document.layers).toHaveLength(1);
    click(document.querySelector('[data-testid="ribbon-tab-layers"]'));
    click(document.querySelector('[data-testid="ribbon-layer-add"]'));
    expect(app.document.layers).toHaveLength(2);
    expect(document.querySelector('[data-testid="window-layers"]')?.textContent).toContain("Layer 1");
  });

  it("exposes Fit to View in the ribbon bar, view tab, and status bar", () => {
    expect(document.querySelector('[data-testid="ribbon-fit"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="zoom-fit"]')).toBeTruthy();

    click(document.querySelector('[data-testid="ribbon-tab-view"]'));
    expect(document.querySelector('[data-testid="ribbon-zoom-fit"]')).toBeTruthy();

    app.viewport.viewWidth = 400;
    app.viewport.viewHeight = 300;
    app.viewport.zoom = 0.1;
    click(document.querySelector('[data-testid="ribbon-fit"]'));
    expect(app.viewport.zoom).toBeGreaterThan(0.2);
  });

  it("opens adjustment from Adjust & FX ribbon tab", () => {
    click(document.querySelector('[data-testid="ribbon-tab-adjustFx"]'));
    click(document.querySelector('[data-testid="adj-brightnessContrast"]'));
    const dialog = document.querySelector('[data-testid="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.textContent).toContain("Brightness / Contrast");
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
