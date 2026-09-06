import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppState } from "../src/app-state";
import { mountShell } from "../src/ui/shell";
import { applyChromePhase } from "../src/ui/chrome-phase";
import { unmountDesktopChrome } from "../src/ui/react/desktop-shell";
import { unmountDockPanels } from "../src/ui/react/dock-panels";
import { unmountPhoneChrome } from "../src/ui/react/phone-chrome";
import { unmountTabletInspector } from "../src/ui/react/tablet-inspector";
import { unmountCommandPalette } from "../src/ui/react/command-palette";
import "../src/styles/app.css";

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

describe("Responsive layouts at 390px (phone), 768px (tablet), and 1280px (desktop)", () => {
  let app: AppState;

  beforeEach(async () => {
    document.body.innerHTML = '<div id="app"></div>';
    app = new AppState();
    await app.init();
  });

  afterEach(() => {
    unmountCommandPalette();
    unmountDockPanels();
    unmountDesktopChrome();
    unmountPhoneChrome();
    unmountTabletInspector();
    document.body.innerHTML = "";
    Object.defineProperty(window, "innerWidth", { configurable: true, value: origWidth });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: origHeight });
    window.matchMedia = origMatch;
    applyChromePhase();
  });

  it("renders mobile top bar and command deck cleanly at 390px without overflow", async () => {
    stubViewport(390, 844, true);
    applyChromePhase();

    await act(async () => {
      mountShell(document.getElementById("app")!, app);
    });

    const topBar = document.querySelector('[data-testid="mobile-top-bar"]') as HTMLElement;
    expect(topBar).toBeTruthy();

    const actions = topBar.querySelector(".mobile-top-actions");
    expect(actions).toBeTruthy();
    const actionBtns = actions!.querySelectorAll(".mobile-action-btn");
    expect(actionBtns.length).toBe(5); // undo, redo, fit, theme, save

    const title = topBar.querySelector(".mobile-top-title");
    expect(title).toBeTruthy();
    expect(title!.textContent).toBe(app.document.name);

    const deck = document.querySelector('[data-testid="mobile-command-deck"]');
    expect(deck).toBeTruthy();
    const deckBtns = deck!.querySelectorAll(".deck-tab-btn");
    expect(deckBtns.length).toBe(5); // tools, color, layers, fx, more

    const pill = document.querySelector('[data-testid="mobile-context-pill"]');
    expect(pill).toBeTruthy();
  });

  it("renders tablet chrome cleanly at 768px", async () => {
    stubViewport(768, 1024, true);
    applyChromePhase();

    await act(async () => {
      mountShell(document.getElementById("app")!, app);
    });

    const titleRow = document.querySelector('[data-testid="title-row"]');
    expect(titleRow).toBeTruthy();

    const fingerMode = document.querySelector('[data-testid="tablet-finger-mode"]');
    expect(fingerMode).toBeTruthy();

    const menubar = document.querySelector('[data-testid="menubar"]');
    expect(menubar).toBeTruthy();
  });

  it("renders desktop ribbon, tools, docks, and statusbar cleanly at 1280px", async () => {
    stubViewport(1280, 800, false);
    applyChromePhase();

    await act(async () => {
      mountShell(document.getElementById("app")!, app);
    });

    const titleRow = document.querySelector('[data-testid="title-row"]');
    expect(titleRow).toBeTruthy();

    const ribbonSync = document.querySelector('[data-testid="ribbon-sync"]');
    expect(ribbonSync).toBeTruthy();

    const toolRail = document.querySelector('[data-testid="tool-rail"]');
    expect(toolRail).toBeTruthy();

    const statusbar = document.querySelector('[data-testid="statusbar"]');
    expect(statusbar).toBeTruthy();
  });

  it("renders mobile document switcher dropdown at 390px with open sessions and supports switching, new tab, and close", async () => {
    stubViewport(390, 844, true);
    applyChromePhase();

    await act(async () => {
      mountShell(document.getElementById("app")!, app);
    });

    // Initially with 1 session, mobile bar is created in DOM
    const imagelist = document.querySelector(".imagelist") as HTMLElement;
    expect(imagelist).toBeTruthy();
    const mobileBar = imagelist.querySelector('[data-testid="mobile-doc-bar"]') as HTMLElement;
    expect(mobileBar).toBeTruthy();

    const select = mobileBar.querySelector('[data-testid="mobile-doc-select"]') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.options.length).toBeGreaterThanOrEqual(1);

    const newBtn = mobileBar.querySelector('[data-testid="mobile-new-tab-button"]') as HTMLButtonElement;
    expect(newBtn).toBeTruthy();
    expect(newBtn.textContent).toBe("+");

    const closeBtn = mobileBar.querySelector('[data-testid="mobile-close-tab-button"]') as HTMLButtonElement;
    expect(closeBtn).toBeTruthy();
    expect(closeBtn.textContent).toBe("×");

    // Add a second session
    await act(async () => {
      app.newDocument({ width: 300, height: 300, name: "Second.png" });
    });

    expect(app.sessions.length).toBe(2);
    expect(imagelist.classList.contains("has-many")).toBe(true);

    // Re-query current elements after re-render
    const curSelect = imagelist.querySelector('[data-testid="mobile-doc-select"]') as HTMLSelectElement;
    const curNewBtn = imagelist.querySelector('[data-testid="mobile-new-tab-button"]') as HTMLButtonElement;
    const curCloseBtn = imagelist.querySelector('[data-testid="mobile-close-tab-button"]') as HTMLButtonElement;

    // Dropdown now lists both sessions
    const sessionOpts = [...curSelect.options].filter((o) => !o.value.startsWith("__"));
    expect(sessionOpts.length).toBe(2);
    expect(curSelect.value).toBe(app.activeSessionId);

    // Mark active session dirty: dirty * prefix appears
    app.document.dirty = true;
    app.notify("document");
    const updatedSelect = imagelist.querySelector('[data-testid="mobile-doc-select"]') as HTMLSelectElement;
    const activeOpt = [...updatedSelect.options].find((o) => o.value === app.activeSessionId);
    expect(activeOpt?.textContent).toContain("*");
    expect(activeOpt?.textContent).toContain("Second.png");

    // Switch active session via dropdown
    const firstSession = app.sessions[0];
    updatedSelect.value = firstSession.id;
    updatedSelect.dispatchEvent(new Event("change"));
    expect(app.activeSessionId).toBe(firstSession.id);

    // Clicking New Tab button opens new dialog
    curNewBtn.click();
    expect(app.dialog).toEqual({ type: "new" });
    app.closeDialog();

    // Clicking Close Tab button closes active session
    expect(app.sessions.length).toBe(2);
    curCloseBtn.click();
    expect(app.sessions.length).toBe(1);
    expect(app.activeSessionId).not.toBe(firstSession.id);
  });

  it("supports close actions inside the mobile dropdown", async () => {
    stubViewport(390, 844, true);
    applyChromePhase();

    await act(async () => {
      mountShell(document.getElementById("app")!, app);
    });

    await act(async () => {
      app.newDocument({ width: 200, height: 200, name: "DocB.png" });
      app.newDocument({ width: 200, height: 200, name: "DocC.png" });
    });
    expect(app.sessions.length).toBe(3);

    const select = document.querySelector('[data-testid="mobile-doc-select"]') as HTMLSelectElement;
    expect(select).toBeTruthy();

    // Close active document via dropdown action
    const activeId = app.activeSessionId;
    select.value = "__close_active__";
    select.dispatchEvent(new Event("change"));
    expect(app.sessions.some((s) => s.id === activeId)).toBe(false);
    expect(app.sessions.length).toBe(2);

    // Close per-item via dropdown action
    const targetSession = app.sessions.find((s) => s.id !== app.activeSessionId)!;
    select.value = `__close__:${targetSession.id}`;
    select.dispatchEvent(new Event("change"));
    expect(app.sessions.some((s) => s.id === targetSession.id)).toBe(false);
    expect(app.sessions.length).toBe(1);
  });
});
