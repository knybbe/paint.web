import { test, expect } from "@playwright/test";

/**
 * Pixel snapshots. First run: `npm run test:visual` (updates baselines).
 * Later runs fail if chrome, menus, or dialogs regress visually.
 */
test.describe("visual snapshots", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/?visual=1");
    await page.locator("#app[data-ready='1']").waitFor();
    await page.waitForTimeout(300);
  });

  test("desktop chrome", async ({ page }) => {
    await expect(page).toHaveScreenshot("desktop-chrome.png", { fullPage: true });
  });

  test("file menu", async ({ page }) => {
    await page.getByTestId("menu-file").click();
    await expect(page.getByTestId("menu-dropdown-file")).toBeVisible();
    await expect(page).toHaveScreenshot("file-menu-open.png");
  });

  test("new image dialog", async ({ page }) => {
    await page.getByTestId("menu-file").click();
    await page.getByRole("menuitem", { name: "New..." }).click();
    await expect(page.getByTestId("dialog")).toBeVisible();
    await expect(page).toHaveScreenshot("dialog-new.png");
  });

  test("effects submenu", async ({ page }) => {
    await page.getByTestId("menu-effects").click();
    await page.getByRole("menuitem", { name: "Blurs" }).hover();
    await expect(page.getByRole("menuitem", { name: "Gaussian Blur..." })).toBeVisible();
    await expect(page).toHaveScreenshot("effects-blurs.png");
  });
});
