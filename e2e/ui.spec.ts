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
  await expect(page.getByTestId("window-colors")).toBeVisible();
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
