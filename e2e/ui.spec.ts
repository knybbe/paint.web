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
  await expect(page.getByTestId("toolbar")).toBeVisible();
  await expect(page.getByTestId("window-tools")).toBeVisible();
  const colorsOpen = await page.getByTestId("window-colors").isVisible();
  const colorsTab = await page.getByTestId("dock-tab-colors").isVisible();
  expect(colorsOpen || colorsTab).toBe(true);
  await expect(page.getByTestId("window-layers")).toBeVisible();
  await expect(page.getByTestId("window-history")).toBeVisible();
  await expect(page.getByTestId("canvas-host")).toBeVisible();
  await expect(page.getByTestId("statusbar")).toBeVisible();
  await expect(page.getByTestId("menu-file")).toBeVisible();
  await page.screenshot({ path: join(ART, "01-shell.png"), fullPage: true });
});

test("File menu opens and New... shows a dialog", async ({ page }) => {
  const file = page.getByTestId("menu-file");
  const drop = page.getByTestId("menu-dropdown-file");
  await expect(drop).toBeHidden();
  await file.click();
  await expect(drop).toBeVisible();
  await expect(drop.getByRole("menuitem", { name: "New..." })).toBeVisible();
  await page.screenshot({ path: join(ART, "02-file-menu.png") });

  await drop.getByRole("menuitem", { name: "New..." }).click();
  await expect(drop).toBeHidden();
  const dialog = page.getByTestId("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "New Image" })).toBeVisible();
  await page.screenshot({ path: join(ART, "03-new-dialog.png") });

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
});

test("menus stay open when switching along the bar", async ({ page }) => {
  await page.getByTestId("menu-file").click();
  await expect(page.getByTestId("menu-dropdown-file")).toBeVisible();
  await page.getByTestId("menu-edit").hover();
  await expect(page.getByTestId("menu-dropdown-file")).toBeHidden();
  await expect(page.getByTestId("menu-dropdown-edit")).toBeVisible();
  await page.screenshot({ path: join(ART, "04-edit-menu.png") });
});

test("Help > About opens a modal", async ({ page }) => {
  await page.getByTestId("menu-help").click();
  await expect(page.getByTestId("menu-dropdown-help")).toBeVisible();
  await page.getByTestId("menu-dropdown-help").getByRole("menuitem", { name: "About paint.web" }).click();
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

test("Layers > Add New Layer updates the layers window", async ({ page }) => {
  await page.getByTestId("menu-layers").click();
  await page.getByTestId("menu-dropdown-layers").getByRole("menuitem", { name: "Add New Layer" }).click();
  const layers = page.getByTestId("window-layers");
  await expect(layers).toContainText("Background");
  await expect(layers).toContainText("Layer 1");
  await page.screenshot({ path: join(ART, "07-layers.png") });
});

test("Window menu can hide the Tools window", async ({ page }) => {
  await expect(page.getByTestId("window-tools")).toBeVisible();
  await page.getByTestId("menu-window").click();
  await page.getByTestId("menu-dropdown-window").getByRole("menuitem", { name: "Tools" }).click();
  await expect(page.getByTestId("window-tools")).toHaveCount(0);
  await page.screenshot({ path: join(ART, "08-tools-hidden.png") });
});

test("Fit to View zooms the document to fill the canvas", async ({ page }) => {
  await page.getByTestId("tb-fit").click();
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
  await page.getByTestId("tb-fit").click();
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

test.describe("HiDPI workspace", () => {
  test.use({ deviceScaleFactor: 2 });

  test("document pixels line up with CSS pointer coordinates", async ({ page }) => {
    await page.getByTestId("tb-fit").click();
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

test("mobile chrome uses a bottom bar and keeps the canvas", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  await expect(page.getByTestId("mobile-bar")).toBeVisible();
  await expect(page.getByTestId("canvas-host")).toBeVisible();
  await page.getByTestId("mobile-layers").click();
  await expect(page.getByTestId("window-layers")).toBeVisible();
  await page.getByTestId("sheet-backdrop").click();
  await expect(page.locator(".pdn-shell")).not.toHaveAttribute("data-sheet");
  await page.getByTestId("mobile-fit").click();
  const zoom = await page.evaluate(() => (window as unknown as { __PAINT_APP__: { viewport: { zoom: number } } }).__PAINT_APP__.viewport.zoom);
  expect(zoom).toBeGreaterThan(0);
  await page.screenshot({ path: join(ART, "10-mobile.png") });
});
