import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { AppState } from "../src/app-state";
import { getCommand, runCommand } from "../src/commands";
import { bindShortcuts } from "../src/shortcuts";
import { mountShell } from "../src/ui/shell";
import { closeCommandPalette, mountCommandPalette, openCommandPalette, unmountCommandPalette } from "../src/ui/react/command-palette";
import { unmountDesktopChrome } from "../src/ui/react/desktop-shell";
import { unmountDockPanels } from "../src/ui/react/dock-panels";
import { unmountPhoneChrome } from "../src/ui/react/phone-chrome";
import { unmountTabletInspector } from "../src/ui/react/tablet-inspector";

describe("command registry", () => {
  afterEach(() => {
    unmountCommandPalette();
    unmountDockPanels();
    unmountDesktopChrome();
    unmountPhoneChrome();
    unmountTabletInspector();
    document.body.innerHTML = "";
  });

  it("contains file.new, a tool, and an effect", () => {
    expect(getCommand("file.new")?.label).toBe("New...");
    expect(getCommand("tool.paintbrush")).toBeTruthy();
    expect(getCommand("effect.gaussianBlur")).toBeTruthy();
    expect(getCommand("adj.brightnessContrast")).toBeTruthy();
  });

  it("file.new opens the new-image dialog", async () => {
    document.body.innerHTML = '<div id="app"></div>';
    const app = new AppState();
    await app.init();
    mountShell(document.getElementById("app")!, app);

    await act(async () => {
      expect(runCommand(app, "file.new")).toBe(true);
    });
    expect(app.dialog?.type).toBe("new");
    const dialog = document.querySelector('[data-testid="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.textContent).toContain("New Image");
  });

  it("file.explorer opens the explorer dialog", async () => {
    document.body.innerHTML = '<div id="app"></div>';
    const app = new AppState();
    await app.init();
    mountShell(document.getElementById("app")!, app);

    await act(async () => {
      expect(runCommand(app, "file.explorer")).toBe(true);
    });
    expect(app.dialog?.type).toBe("explorer");
    const dialog = document.querySelector('[data-testid="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.textContent).toContain("Explorer");
  });

  it("disables crop when selection is empty", async () => {
    const app = new AppState();
    await app.init();
    const crop = getCommand("edit.crop");
    expect(crop).toBeTruthy();
    expect(app.selection.empty).toBe(true);
    expect(crop!.enabled?.(app)).toBe(false);
    expect(runCommand(app, "edit.crop")).toBe(false);

    app.selectAll();
    expect(app.selection.empty).toBe(false);
    expect(crop!.enabled?.(app)).toBe(true);
  });

  it("Escape closing the palette does not deselect or close app dialogs", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = '<div id="app"></div>';
    const app = new AppState();
    await app.init();
    mountShell(document.getElementById("app")!, app);
    await act(async () => {
      mountCommandPalette(app);
    });
    bindShortcuts(app);
    app.selectAll();
    app.openDialog({ type: "new" });

    await act(async () => {
      openCommandPalette();
    });

    // Match Radix Dialog: dismiss on document capture with preventDefault, no stopPropagation.
    const dismiss = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      closeCommandPalette();
    };
    document.addEventListener("keydown", dismiss, true);

    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    document.removeEventListener("keydown", dismiss, true);

    expect(app.selection.empty).toBe(false);
    expect(app.dialog?.type).toBe("new");
  });

  it("replaces Save and Save As with Download Export command", async () => {
    expect(getCommand("file.save")).toBeUndefined();
    expect(getCommand("file.saveAs")).toBeUndefined();

    const dl = getCommand("file.download");
    expect(dl).toBeTruthy();
    expect(dl?.label).toBe("Download Export...");

    document.body.innerHTML = '<div id="app"></div>';
    const app = new AppState();
    await app.init();
    mountShell(document.getElementById("app")!, app);

    await act(async () => {
      expect(runCommand(app, "file.download")).toBe(true);
    });

    expect(app.dialog?.type).toBe("download");
    const dialog = document.querySelector('[data-testid="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.textContent).toContain("Download Export");
  });
});
