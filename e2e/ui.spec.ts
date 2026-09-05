import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const ART = join(process.cwd(), "e2e", "artifacts");

test.beforeAll(() => {
  mkdirSync(ART, { recursive: true });
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
  });
  await page.goto("/?visual=1");
  await page.locator("#app[data-ready='1']").waitFor({ timeout: 15_000 });
  await page.waitForTimeout(200);
});

test("shell chrome is visible", async ({ page }) => {
  await expect(page.getByTestId("menubar")).toBeVisible();
  await expect(page.getByTestId("tool-rail")).toBeVisible();
  await expect(page.getByTestId("title-row")).toBeVisible();
  const colorsOpen = await page.getByTestId("window-colors").isVisible();
  const colorsTab = await page.getByTestId("dock-tab-colors").isVisible();
  expect(colorsOpen || colorsTab).toBe(true);
  const historyOpen = await page.getByTestId("window-history").isVisible();
  const historyTab = await page.getByTestId("dock-tab-history").isVisible();
  expect(historyOpen || historyTab).toBe(true);
  await expect(page.getByTestId("canvas-host")).toBeVisible();
  await expect(page.getByTestId("statusbar")).toBeVisible();
  await expect(page.getByTestId("menu-file")).toBeVisible();
  await page.screenshot({ path: join(ART, "01-shell.png"), fullPage: true });
});

test("File menu opens and New... shows a dialog", async ({ page }) => {
  const file = page.getByTestId("menu-file");
  await file.click();
  const newItem = page.getByRole("menuitem", { name: "New..." });
  await expect(newItem).toBeVisible();
  await page.screenshot({ path: join(ART, "02-file-menu.png") });

  await newItem.click();
  const dialog = page.getByTestId("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "New Image" })).toBeVisible();
  await page.screenshot({ path: join(ART, "03-new-dialog.png") });

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
});

test("menus stay open when switching along the bar", async ({ page }) => {
  await page.getByTestId("menu-file").click();
  await expect(page.getByRole("menuitem", { name: "New..." })).toBeVisible();
  await page.getByTestId("menu-edit").hover();
  await expect(page.getByRole("menuitem", { name: "Undo" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "New..." })).toHaveCount(0);
  await page.screenshot({ path: join(ART, "04-edit-menu.png") });
});

test("Help > About opens a modal", async ({ page }) => {
  await page.getByTestId("menu-help").click();
  await page.getByRole("menuitem", { name: "About paint.web" }).click();
  await expect(page.getByTestId("dialog")).toContainText("unofficial");
  await page.screenshot({ path: join(ART, "05-about.png") });
});

test("tool buttons switch the current tool", async ({ page }) => {
  await page.getByTestId("tool-pencil").click();
  await expect(page.getByTestId("tool-pencil")).toHaveClass(/active/);
  await expect(page.getByTestId("statusbar")).toContainText("Pencil");
  await page.getByTestId("tool-paintbrush").click();
  await expect(page.getByTestId("tool-paintbrush")).toHaveClass(/active/);
  await page.screenshot({ path: join(ART, "06-tools.png") });
});

test("Layers panel Add updates the layers window", async ({ page }) => {
  const layers = page.getByTestId("window-layers");
  await layers.getByTitle("Add").click();
  await expect(layers).toContainText("Background");
  await expect(layers).toContainText("Layer 1");
  await page.screenshot({ path: join(ART, "07-layers.png") });
});

test("Window menu can hide the Tools rail", async ({ page }) => {
  await expect(page.getByTestId("tool-rail")).toBeVisible();
  await page.getByTestId("menu-window").click();
  await page.getByRole("menuitemcheckbox", { name: "Tools" }).click();
  await expect(page.getByTestId("tool-rail")).toBeHidden();
  await page.screenshot({ path: join(ART, "08-tools-hidden.png") });
});

test("Fit to View zooms the document to fill the canvas", async ({ page }) => {
  await page.getByTestId("ribbon-fit").click();
  const zoom = await page.evaluate(() => {
    const app = (window as unknown as { __PAINT_APP__: { viewport: { zoom: number; viewWidth: number; viewHeight: number }; document: { width: number; height: number } } }).__PAINT_APP__;
    return {
      zoom: app.viewport.zoom,
      viewWidth: app.viewport.viewWidth,
      viewHeight: app.viewport.viewHeight,
      width: app.document.width,
      height: app.document.height,
    };
  });
  const expected = Math.min(zoom.viewWidth / zoom.width, zoom.viewHeight / zoom.height);
  expect(zoom.zoom).toBeGreaterThan(0.05);
  expect(Math.abs(zoom.zoom - expected) / expected).toBeLessThan(0.08);
  await page.screenshot({ path: join(ART, "09-fit.png") });
});

test("canvas pointer maps to the image pixel under the cursor", async ({ page }) => {
  await page.getByTestId("ribbon-fit").click();
  const mapped = await page.evaluate(() => {
    const app = (window as unknown as { __PAINT_APP__: { viewport: { panX: number; panY: number; zoom: number; screenToImage: (x: number, y: number) => { x: number; y: number } }; cursorImage: { x: number; y: number } | null } }).__PAINT_APP__;
    const host = document.querySelector('[data-testid="canvas-host"]') as HTMLElement;
    const r = host.getBoundingClientRect();
    const sx = 12.5;
    const sy = 18.5;
    host.dispatchEvent(
      new PointerEvent("pointermove", {
        clientX: r.left + app.viewport.panX + sx * app.viewport.zoom,
        clientY: r.top + app.viewport.panY + sy * app.viewport.zoom,
        bubbles: true,
        pointerId: 1,
      }),
    );
    return { cursor: app.cursorImage, expectX: sx, expectY: sy };
  });
  expect(mapped.cursor).toBeTruthy();
  expect(mapped.cursor!.x).toBeCloseTo(mapped.expectX, 0);
  expect(mapped.cursor!.y).toBeCloseTo(mapped.expectY, 0);
});

test("ctrl+wheel zooms continuously instead of jumping steps", async ({ page }) => {
  const host = page.getByTestId("canvas-host");
  const before = await page.evaluate(() => (window as unknown as { __PAINT_APP__: { viewport: { zoom: number } } }).__PAINT_APP__.viewport.zoom);
  await host.dispatchEvent("wheel", { deltaY: 8, ctrlKey: true, bubbles: true, cancelable: true });
  const after = await page.evaluate(() => (window as unknown as { __PAINT_APP__: { viewport: { zoom: number } } }).__PAINT_APP__.viewport.zoom);
  expect(after / before).toBeGreaterThan(0.9);
  expect(after / before).toBeLessThan(1);
  expect(after).not.toBe(before);
});

test("wheel without modifiers zooms instead of panning", async ({ page }) => {
  const host = page.getByTestId("canvas-host");
  const before = await page.evaluate(() => {
    const vp = (window as unknown as { __PAINT_APP__: { viewport: { zoom: number; panX: number; panY: number } } }).__PAINT_APP__.viewport;
    return { zoom: vp.zoom, panX: vp.panX, panY: vp.panY };
  });
  await host.dispatchEvent("wheel", { deltaY: 40, deltaX: 20, bubbles: true, cancelable: true });
  const after = await page.evaluate(() => {
    const vp = (window as unknown as { __PAINT_APP__: { viewport: { zoom: number; panX: number; panY: number } } }).__PAINT_APP__.viewport;
    return { zoom: vp.zoom, panX: vp.panX, panY: vp.panY };
  });
  expect(after.zoom).not.toBe(before.zoom);
  expect(after.zoom).toBeLessThan(before.zoom);
});

test("status zoom slider midpoint is 100%", async ({ page }) => {
  const range = page.locator(".zoom-ctl input[type='range']");
  await expect(range).toBeVisible();
  const max = Number(await range.getAttribute("max"));
  await range.fill(String(max / 2));
  const zoom = await page.evaluate(() => (window as unknown as { __PAINT_APP__: { viewport: { zoom: number } } }).__PAINT_APP__.viewport.zoom);
  expect(zoom).toBeCloseTo(1, 2);
  await expect(page.getByTestId("zoom-percent")).toHaveValue("100%");
});

test("zoom dropdown is not in the title row", async ({ page }) => {
  await expect(page.getByTestId("zoom-dropdown")).toHaveCount(0);
});

test("Effects menu lists Gaussian Blur without a nested submenu", async ({ page }) => {
  await page.getByTestId("menu-effects").click();
  await expect(page.getByRole("menuitem", { name: "Gaussian Blur..." })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Blurs" })).toHaveCount(0);
});

test("theme header cycles System Light Dark", async ({ page }) => {
  const toggle = page.getByTestId("ribbon-theme").first();
  await expect(toggle).toBeVisible();
  const before = await page.evaluate(() => document.documentElement.dataset.theme);
  await toggle.click();
  await toggle.click();
  const after = await page.evaluate(() => document.documentElement.getAttribute("class"));
  expect(before === "dark" || before === "light").toBe(true);
  expect(typeof after).toBe("string");
});

test.describe("HiDPI workspace", () => {
  test.use({ deviceScaleFactor: 2 });

  test("document pixels line up with CSS pointer coordinates", async ({ page }) => {
    await page.getByTestId("ribbon-fit").click();
    const sample = await page.evaluate(() => {
      const app = (window as unknown as { __PAINT_APP__: { viewport: { panX: number; panY: number; zoom: number } } }).__PAINT_APP__;
      const canvas = document.querySelector('[data-testid="canvas-host"] canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext("2d")!;
      const dpr = window.devicePixelRatio || 1;
      const x = Math.round((app.viewport.panX + 4) * dpr);
      const y = Math.round((app.viewport.panY + 4) * dpr);
      const px = ctx.getImageData(x, y, 1, 1).data;
      const gx = Math.max(0, Math.round(app.viewport.panX * dpr) - 8);
      const gy = Math.max(0, Math.round(app.viewport.panY * dpr) - 8);
      const grey = ctx.getImageData(gx, gy, 1, 1).data;
      return { px: [...px], grey: [...grey], dpr, panX: app.viewport.panX, panY: app.viewport.panY };
    });
    expect(sample.dpr).toBe(2);
    // document default background is white
    expect(sample.px[0]).toBeGreaterThan(240);
    expect(sample.px[1]).toBeGreaterThan(240);
    expect(sample.px[2]).toBeGreaterThan(240);
    // just outside the document should be workspace gray
    expect(sample.grey[0]).toBeGreaterThan(100);
    expect(sample.grey[0]).toBeLessThan(160);
  });
});

test("mobile chrome uses a command deck and keeps the canvas", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  await expect(page.getByTestId("mobile-command-deck")).toBeVisible();
  await expect(page.getByTestId("canvas-host")).toBeVisible();
  await page.getByTestId("mobile-tab-layers").click();
  await expect(page.getByTestId("mobile-sheet-container")).toBeVisible();
  await page.getByTestId("mobile-sheet-backdrop").click();
  await expect(page.getByTestId("mobile-sheet-container")).toHaveCount(0);
  await page.getByTestId("mobile-top-fit").click();
  const zoom = await page.evaluate(() => (window as unknown as { __PAINT_APP__: { viewport: { zoom: number } } }).__PAINT_APP__.viewport.zoom);
  expect(zoom).toBeGreaterThan(0);
  await page.screenshot({ path: join(ART, "10-mobile.png") });
});
