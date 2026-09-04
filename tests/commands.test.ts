import { afterEach, describe, expect, it } from "vitest";
import { AppState } from "../src/app-state";
import { getCommand, runCommand } from "../src/commands";
import { mountShell } from "../src/ui/shell";

describe("command registry", () => {
  afterEach(() => {
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

    expect(runCommand(app, "file.new")).toBe(true);
    expect(app.dialog?.type).toBe("new");
    const dialog = document.querySelector('[data-testid="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.textContent).toContain("New Image");
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
});
