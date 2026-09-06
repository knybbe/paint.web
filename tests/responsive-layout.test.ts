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

  it("renders custom chrome-styled tab dropdown at 390px with open tabs only, supporting switching, rename, and soft-close", async () => {
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

    const trigger = mobileBar.querySelector('[data-testid="mobile-doc-dropdown-trigger"]') as HTMLButtonElement;
    expect(trigger).toBeTruthy();
    expect(trigger.textContent).toContain(app.document.name);

    const newBtn = mobileBar.querySelector('[data-testid="mobile-new-tab-button"]') as HTMLButtonElement;
    expect(newBtn).toBeTruthy();
    expect(newBtn.textContent).toBe("+");

    // Add a second session
    await act(async () => {
      app.newDocument({ width: 300, height: 300, name: "Second.png" });
    });

    expect(app.sessions.length).toBe(2);
    expect(imagelist.classList.contains("has-many")).toBe(true);

    // Re-query trigger after re-render
    const curTrigger = imagelist.querySelector('[data-testid="mobile-doc-dropdown-trigger"]') as HTMLButtonElement;
    expect(curTrigger.textContent).toContain("Second.png");

    // Click trigger to open custom dropdown
    curTrigger.click();
    const menu = imagelist.querySelector('[data-testid="mobile-doc-dropdown-menu"]') as HTMLElement;
    expect(menu).toBeTruthy();
    expect(menu.classList.contains("open")).toBe(true);

    // Custom dropdown lists open tabs only (no action items!)
    const rows = menu.querySelectorAll('[data-testid="mobile-tab-row"]');
    expect(rows.length).toBe(2);

    // Mark active session dirty: dirty * prefix appears
    app.document.dirty = true;
    app.notify("document");
    const updatedTrigger = imagelist.querySelector('[data-testid="mobile-doc-dropdown-trigger"]') as HTMLButtonElement;
    expect(updatedTrigger.textContent).toContain("*");
    expect(updatedTrigger.textContent).toContain("Second.png");

    // Switch active session via dropdown item
    const firstSession = app.sessions[0];
    const firstTabBtn = imagelist.querySelector(`[data-testid="mobile-tab-btn"][data-session-id="${firstSession.id}"]`) as HTMLButtonElement;
    expect(firstTabBtn).toBeTruthy();
    firstTabBtn.click();
    expect(app.activeSessionId).toBe(firstSession.id);

    // Per-row rename: click rename button for first session
    const renameBtn = imagelist.querySelector(`[data-testid="mobile-tab-rename"][data-session-id="${firstSession.id}"]`) as HTMLButtonElement;
    expect(renameBtn).toBeTruthy();
    renameBtn.click();

    // Inline rename input appears
    const renameInput = imagelist.querySelector('[data-testid="mobile-tab-rename-input"]') as HTMLInputElement;
    expect(renameInput).toBeTruthy();
    expect(renameInput.value).toBe(firstSession.document.name);

    renameInput.value = "RenamedDoc.png";
    renameInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(firstSession.document.name).toBe("RenamedDoc.png");
    expect(app.document.name).toBe("RenamedDoc.png");

    // Clicking New Tab button beside dropdown opens new dialog
    const curNewBtn = imagelist.querySelector('[data-testid="mobile-new-tab-button"]') as HTMLButtonElement;
    curNewBtn.click();
    expect(app.dialog).toEqual({ type: "new" });
    app.closeDialog();

    // Soft-close: per-row close closes the tab without save prompts
    const secondSession = app.sessions.find((s) => s.id !== firstSession.id)!;
    const closeBtn = imagelist.querySelector(`[data-testid="mobile-tab-close"][data-session-id="${secondSession.id}"]`) as HTMLButtonElement;
    expect(closeBtn).toBeTruthy();
    await act(async () => {
      closeBtn.click();
    });
    expect(app.sessions.length).toBe(1);
    expect(app.sessions[0].id).toBe(firstSession.id);
  });

  it("supports soft-close keeping cache without save prompts even when document is dirty", async () => {
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

    // Mark all documents dirty
    for (const s of app.sessions) {
      s.document.dirty = true;
    }

    // Open dropdown
    const trigger = document.querySelector('[data-testid="mobile-doc-dropdown-trigger"]') as HTMLButtonElement;
    expect(trigger).toBeTruthy();
    trigger.click();

    // Soft-close a tab: should immediately close without prompting confirmClose
    const targetSession = app.sessions[1];
    const targetId = targetSession.id;
    const closeBtn = document.querySelector(`[data-testid="mobile-tab-close"][data-session-id="${targetId}"]`) as HTMLButtonElement;
    expect(closeBtn).toBeTruthy();

    await act(async () => {
      closeBtn.click();
    });

    expect(app.dialog).toBeNull(); // No confirmClose dialog!
    expect(app.sessions.some((s) => s.id === targetId)).toBe(false);
    expect(app.sessions.length).toBe(2);
  });
});
