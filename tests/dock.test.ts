import { afterEach, describe, expect, it } from "vitest";
import { mountAdaptiveDock } from "../src/ui/dock";

function fakeWindow(label: string, bodyHeight: number): HTMLElement {
  const host = document.createElement("div");
  const win = document.createElement("section");
  win.className = "pdn-win";
  const title = document.createElement("div");
  title.className = "title";
  title.textContent = label;
  Object.defineProperty(title, "offsetHeight", { configurable: true, get: () => 20 });
  const body = document.createElement("div");
  body.className = "body";
  const inner = document.createElement("div");
  inner.textContent = label;
  Object.defineProperty(inner, "offsetHeight", { configurable: true, get: () => bodyHeight });
  body.append(inner);
  win.append(title, body);
  host.append(win);
  return host;
}

describe("adaptive dock", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("creates tabs and shows one pane when the dock overflows", async () => {
    const dock = document.createElement("aside");
    dock.className = "dock left";
    const a = fakeWindow("A", 300);
    const b = fakeWindow("B", 300);
    dock.append(a, b);
    document.body.append(dock);
    Object.defineProperty(dock, "clientHeight", { configurable: true, get: () => 120 });

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
    const a = fakeWindow("A", 80);
    const b = fakeWindow("B", 80);
    dock.append(a, b);
    document.body.append(dock);
    Object.defineProperty(dock, "clientHeight", { configurable: true, get: () => 800 });

    mountAdaptiveDock(dock, [
      { id: "layers", label: "Layers", host: a },
      { id: "history", label: "History", host: b },
    ]);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    expect(dock.classList.contains("tabbed")).toBe(false);
    expect(a.classList.contains("dock-pane-active")).toBe(true);
    expect(b.classList.contains("dock-pane-active")).toBe(true);
  });

  it("leaves tabbed mode when the dock grows enough for both panes", async () => {
    const dock = document.createElement("aside");
    dock.className = "dock left";
    const a = fakeWindow("A", 300);
    const b = fakeWindow("B", 300);
    dock.append(a, b);
    document.body.append(dock);
    let height = 120;
    Object.defineProperty(dock, "clientHeight", { configurable: true, get: () => height });

    mountAdaptiveDock(dock, [
      { id: "tools", label: "Tools", host: a },
      { id: "colors", label: "Colors", host: b },
    ]);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    expect(dock.classList.contains("tabbed")).toBe(true);

    height = 900;
    window.dispatchEvent(new Event("resize"));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    expect(dock.classList.contains("tabbed")).toBe(false);
    expect(a.classList.contains("dock-pane-active")).toBe(true);
    expect(b.classList.contains("dock-pane-active")).toBe(true);
  });
});
