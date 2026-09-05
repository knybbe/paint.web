import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppState } from "../src/app-state";
import { mountShell } from "../src/ui/shell";
import { bindShortcuts } from "../src/shortcuts";
import { runCommand } from "../src/commands";
import { unmountDesktopChrome } from "../src/ui/react/desktop-shell";
import { unmountDockPanels } from "../src/ui/react/dock-panels";
import { unmountPhoneChrome } from "../src/ui/react/phone-chrome";
import { unmountTabletInspector } from "../src/ui/react/tablet-inspector";
import { unmountCommandPalette } from "../src/ui/react/command-palette";
import "../src/styles/app.css";

describe("Canvas pointer mapping, new tab control, and folder sync integration", () => {
  let app: AppState;

  beforeEach(async () => {
    document.body.innerHTML = '<div id="app"></div>';
    app = new AppState();
    await app.init();
    await act(async () => {
      mountShell(document.getElementById("app")!, app);
      bindShortcuts(app);
    });
  });

  afterEach(() => {
    unmountCommandPalette();
    unmountDockPanels();
    unmountDesktopChrome();
    unmountPhoneChrome();
    unmountTabletInspector();
    document.body.innerHTML = "";
  });

  it("renders the New tab button directly next to the rightmost image tab", () => {
    const imagelist = document.querySelector(".imagelist");
    expect(imagelist).toBeTruthy();

    const tabs = imagelist!.querySelectorAll(".imagetab");
    expect(tabs.length).toBe(1);

    const newBtn = imagelist!.querySelector('[data-testid="new-tab-button"]') as HTMLButtonElement;
    expect(newBtn).toBeTruthy();
    expect(newBtn.textContent).toBe("+");
    expect(newBtn.previousElementSibling).toBe(tabs[tabs.length - 1]);

    // Clicking New Tab button opens the new document dialog
    newBtn.click();
    expect(app.dialog).toEqual({ type: "new" });
  });

  it("dynamically updates the host cursor on tool change and space panning", () => {
    const host = document.querySelector('[data-testid="canvas-host"]') as HTMLElement;
    expect(host).toBeTruthy();

    // Default paintbrush cursor is crosshair
    expect(host.style.cursor).toBe("crosshair");

    // Switching to move tool sets cursor to move
    app.setTool("movePixels");
    expect(host.style.cursor).toBe("move");

    // Space held sets cursor to grab
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true }));
    expect(host.style.cursor).toBe("grab");

    // Space release restores tool cursor
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space", bubbles: true }));
    expect(host.style.cursor).toBe("move");
  });

  it("maps pointer events accurately from screen to image coordinates under canvas scaling", () => {
    const host = document.querySelector('[data-testid="canvas-host"]') as HTMLElement;
    const canvas = host.querySelector("canvas") as HTMLCanvasElement;
    expect(canvas).toBeTruthy();

    // Mock bounding rects
    canvas.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 50,
        width: 800,
        height: 600,
        right: 900,
        bottom: 650,
        x: 100,
        y: 50,
        toJSON: () => {},
      } as DOMRect);

    app.viewport.viewWidth = 800;
    app.viewport.viewHeight = 600;
    app.viewport.zoom = 1;
    app.viewport.panX = 0;
    app.viewport.panY = 0;

    // Moving pointer over (200, 150) in client space -> (100, 100) in image space
    host.dispatchEvent(
      new PointerEvent("pointermove", {
        clientX: 200,
        clientY: 150,
        bubbles: true,
      })
    );

    expect(app.cursorImage).toEqual({ x: 100, y: 100 });
  });

  it("integrates folder sync into title ribbon, command palette, shortcuts, and dialogs", () => {
    // Ribbon sync button exists in desktop title row
    const syncBtn = document.querySelector('[data-testid="ribbon-sync"]') as HTMLButtonElement;
    expect(syncBtn).toBeTruthy();

    // Clicking ribbon sync opens the sync dialog
    syncBtn.click();
    expect(app.dialog).toEqual({ type: "sync" });
    app.closeDialog();

    // Running file.sync command opens sync dialog
    runCommand(app, "file.sync");
    expect(app.dialog).toEqual({ type: "sync" });
    app.closeDialog();

    // Pressing Ctrl+Shift+U shortcut opens sync dialog
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "u", ctrlKey: true, shiftKey: true, bubbles: true }));
    expect(app.dialog).toEqual({ type: "sync" });
  });
});
