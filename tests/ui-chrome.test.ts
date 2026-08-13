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

describe("UI chrome and menus", () => {
  let app: AppState;

  beforeEach(async () => {
    app = await mount();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders the Paint.NET chrome", () => {
    expect(document.querySelector('[data-testid="menubar"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="toolbar"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="window-tools"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="window-colors"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="window-layers"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="window-history"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="canvas-host"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="statusbar"]')).toBeTruthy();
    const titles = [...document.querySelectorAll(".menu-title")].map((el) => el.textContent);
    expect(titles).toEqual(["File", "Edit", "View", "Image", "Layers", "Adjustments", "Effects", "Window", "Help"]);
  });

  it("opens the File menu and keeps it open", () => {
    const file = document.querySelector('[data-testid="menu-file"]');
    const drop = document.querySelector('[data-testid="menu-dropdown-file"]') as HTMLElement;
    const item = file?.closest(".menu-item");
    expect(item?.classList.contains("open")).toBe(false);
    click(file);
    expect(item?.classList.contains("open")).toBe(true);
    expect(drop.querySelector('[data-label="New..."]')).toBeTruthy();
    expect(drop.querySelector('[data-label="Open..."]')).toBeTruthy();
    expect(drop.querySelector('[data-label="Save"]')).toBeTruthy();
    // second click on the title toggles closed
    click(file);
    expect(item?.classList.contains("open")).toBe(false);
  });

  it("runs File > New... and shows the New Image dialog", () => {
    click(document.querySelector('[data-testid="menu-file"]'));
    click(document.querySelector('[data-label="New..."]'));
    const dialog = document.querySelector('[data-testid="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.textContent).toContain("New Image");
    expect(document.querySelector('[data-testid="menu-file"]')?.closest(".menu-item")?.classList.contains("open")).toBe(
      false,
    );
  });

  it("switches menus on hover once one is open", () => {
    click(document.querySelector('[data-testid="menu-file"]'));
    expect(document.querySelector('[data-testid="menu-file"]')?.closest(".menu-item")?.classList.contains("open")).toBe(
      true,
    );
    document.querySelector('[data-testid="menu-help"]')?.closest(".menu-item")?.dispatchEvent(
      new MouseEvent("mouseenter", { bubbles: true }),
    );
    expect(document.querySelector('[data-testid="menu-file"]')?.closest(".menu-item")?.classList.contains("open")).toBe(
      false,
    );
    expect(document.querySelector('[data-testid="menu-help"]')?.closest(".menu-item")?.classList.contains("open")).toBe(
      true,
    );
    expect(document.querySelector('[data-label="About paint.web"]')).toBeTruthy();
  });

  it("opens About from Help", () => {
    click(document.querySelector('[data-testid="menu-help"]'));
    click(document.querySelector('[data-label="About paint.web"]'));
    expect(document.querySelector('[data-testid="dialog"]')?.textContent).toMatch(/unofficial/i);
  });

  it("selects tools from the Tools window", () => {
    click(document.querySelector('[data-testid="tool-pencil"]'));
    expect(app.currentTool).toBe("pencil");
    expect(document.querySelector('[data-testid="tool-pencil"]')?.classList.contains("active")).toBe(true);
    click(document.querySelector('[data-testid="tool-paintbrush"]'));
    expect(app.currentTool).toBe("paintbrush");
  });

  it("adds a layer from the Layers menu", () => {
    expect(app.document.layers).toHaveLength(1);
    click(document.querySelector('[data-testid="menu-layers"]'));
    click(document.querySelector('[data-label="Add New Layer"]'));
    expect(app.document.layers).toHaveLength(2);
    expect(document.querySelector('[data-testid="window-layers"]')?.textContent).toContain("Layer 1");
  });

  it("toggles the Tools window from the Window menu", () => {
    click(document.querySelector('[data-testid="menu-window"]'));
    click(document.querySelector('[data-label="Tools"]'));
    expect(app.windows.tools).toBe(false);
    expect(document.querySelector('[data-testid="window-tools"]')).toBeNull();
  });
});
