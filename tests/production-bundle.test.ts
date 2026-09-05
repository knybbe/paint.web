import { afterEach, describe, expect, it } from "vitest";
import { AppState } from "../src/app-state";
import { mountShell } from "../src/ui/shell";
import { unmountDesktopChrome } from "../src/ui/react/desktop-shell";

describe("Production bundle smoke test", () => {
  afterEach(() => {
    unmountDesktopChrome();
    document.body.innerHTML = "";
  });

  it("mounts shell without any exceptions", async () => {
    document.body.innerHTML = '<div id="app"></div>';
    const app = new AppState();
    await app.init();
    const root = document.getElementById("app")!;
    mountShell(root, app);
    expect(root.children.length).toBeGreaterThan(0);
  });
});
