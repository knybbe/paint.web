import { afterEach, describe, expect, it } from "vitest";
import { AppState } from "../src/app-state";
import { mountShell } from "../src/ui/shell";
import { unmountCommandPalette } from "../src/ui/react/command-palette";
import { unmountDesktopChrome } from "../src/ui/react/desktop-shell";
import { unmountDockPanels } from "../src/ui/react/dock-panels";
import { unmountPhoneChrome } from "../src/ui/react/phone-chrome";
import { unmountTabletInspector } from "../src/ui/react/tablet-inspector";

describe("Production bundle smoke test", () => {
  afterEach(() => {
    unmountCommandPalette();
    unmountDockPanels();
    unmountDesktopChrome();
    unmountPhoneChrome();
    unmountTabletInspector();
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
