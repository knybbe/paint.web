import { afterEach, describe, expect, it } from "vitest";
import { AppState } from "../src/app-state";
import { applyChromePhase, chromePhase } from "../src/ui/chrome-phase";

type MediaQueryListStub = {
  matches: boolean;
  media: string;
  onchange: null;
  addEventListener: () => void;
  removeEventListener: () => void;
  addListener: () => void;
  removeListener: () => void;
  dispatchEvent: () => boolean;
};

function stubViewport(width: number, height: number, coarse: boolean): void {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
  window.matchMedia = ((query: string) => {
    const matches = query.includes("pointer: coarse") ? coarse : false;
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false;
      },
    } satisfies MediaQueryListStub;
  }) as typeof window.matchMedia;
}

const origWidth = window.innerWidth;
const origHeight = window.innerHeight;
const origMatch = window.matchMedia;

afterEach(() => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: origWidth });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: origHeight });
  window.matchMedia = origMatch;
  applyChromePhase();
});

describe("chromePhase", () => {
  it("returns phone when the short side is under 600", () => {
    stubViewport(390, 844, true);
    expect(chromePhase()).toBe("phone");
  });

  it("returns tablet when pointer is coarse and the long side is under 1400", () => {
    stubViewport(768, 1024, true);
    expect(chromePhase()).toBe("tablet");
  });

  it("returns phone for a fine pointer under 860px wide", () => {
    stubViewport(800, 900, false);
    expect(chromePhase()).toBe("phone");
  });

  it("returns desktop for a wide fine-pointer screen", () => {
    stubViewport(1440, 900, false);
    expect(chromePhase()).toBe("desktop");
  });

  it("returns desktop for a coarse pointer on a wide screen", () => {
    stubViewport(1600, 1000, true);
    expect(chromePhase()).toBe("desktop");
  });

  it("writes dataset.chrome on the document element", () => {
    stubViewport(390, 844, true);
    expect(applyChromePhase()).toBe("phone");
    expect(document.documentElement.dataset.chrome).toBe("phone");
    expect(document.documentElement.dataset.pointer).toBe("coarse");
  });

  it("keeps a single tablet inspector pane when Window shortcuts toggle panels", () => {
    stubViewport(768, 1024, true);
    const app = new AppState();
    app.windows = { tools: true, history: true, layers: true, colors: true };
    applyChromePhase(window, app);
    expect(chromePhase()).toBe("tablet");
    expect(app.windows).toMatchObject({ layers: true, colors: false, history: false });

    app.toggleWindow("colors");
    expect(app.windows).toMatchObject({ layers: false, colors: true, history: false });

    app.toggleWindow("history");
    expect(app.windows).toMatchObject({ layers: false, colors: false, history: true });

    app.toggleWindow("history");
    expect(app.windows).toMatchObject({ layers: false, colors: false, history: false });
  });
});
