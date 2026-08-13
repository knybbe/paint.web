import { afterEach, describe, expect, it } from "vitest";
import { mountAdaptiveDock } from "../src/ui/dock";

describe("adaptive dock", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("creates tabs and shows one pane when the dock overflows", async () => {
    const dock = document.createElement("aside");
    dock.className = "dock left";
    const a = document.createElement("div");
    const b = document.createElement("div");
    a.textContent = "A";
    b.textContent = "B";
    dock.append(a, b);
    document.body.append(dock);
    Object.defineProperty(dock, "clientHeight", { configurable: true, get: () => 120 });
    Object.defineProperty(dock, "scrollHeight", { configurable: true, get: () => 400 });

    mountAdaptiveDock(dock, [
      { id: "tools", label: "Tools", host: a },
      { id: "colors", label: "Colors", host: b },
    ]);

    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    expect(dock.classList.contains("tabbed")).toBe(true);
    expect(document.querySelector('[data-testid="dock-tab-tools"]')).toBeTruthy();
    expect(a.classList.contains("dock-pane-active")).toBe(true);
    expect(b.classList.contains("dock-pane-active")).toBe(false);

    (document.querySelector('[data-testid="dock-tab-colors"]') as HTMLButtonElement).click();
    expect(a.classList.contains("dock-pane-active")).toBe(false);
    expect(b.classList.contains("dock-pane-active")).toBe(true);
  });

  it("keeps both panes stacked when they fit", async () => {
    const dock = document.createElement("aside");
    dock.className = "dock right";
    const a = document.createElement("div");
    const b = document.createElement("div");
    dock.append(a, b);
    document.body.append(dock);
    Object.defineProperty(dock, "clientHeight", { configurable: true, get: () => 800 });
    Object.defineProperty(dock, "scrollHeight", { configurable: true, get: () => 400 });

    mountAdaptiveDock(dock, [
      { id: "layers", label: "Layers", host: a },
      { id: "history", label: "History", host: b },
    ]);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    expect(dock.classList.contains("tabbed")).toBe(false);
    expect(a.classList.contains("dock-pane-active")).toBe(true);
    expect(b.classList.contains("dock-pane-active")).toBe(true);
  });
});
