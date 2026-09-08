import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const ART = join(process.cwd(), "e2e", "artifacts");

test.beforeAll(() => {
  mkdirSync(ART, { recursive: true });
});

test.describe("Responsive E2E: Desktop, Tablet, and Mobile Layers & Download UX", () => {
  test("desktop layers panel actions, disabled states, and Download dialog", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/?visual=1");
    await page.locator("#app[data-ready='1']").waitFor({ timeout: 15_000 });
    await page.waitForTimeout(200);

    const layers = page.getByTestId("window-layers");
    await expect(layers).toBeVisible();

    const addBtn = layers.locator('[data-testid="layer-add-btn"]');
    const deleteBtn = layers.locator('[data-testid="layer-delete-btn"]');
    const dupBtn = layers.locator('[data-testid="layer-dup-btn"]');
    const mergeBtn = layers.locator('[data-testid="layer-merge-btn"]');
    const upBtn = layers.locator('[data-testid="layer-up-btn"]');
    const downBtn = layers.locator('[data-testid="layer-down-btn"]');

    // Initial state: only 1 layer ("Background")
    await expect(layers).toContainText("Background");
    await expect(deleteBtn).toBeDisabled();
    await expect(mergeBtn).toBeDisabled();
    await expect(upBtn).toBeDisabled();
    await expect(downBtn).toBeDisabled();
    await expect(addBtn).toBeEnabled();
    await expect(dupBtn).toBeEnabled();

    // Check aria-labels on action buttons
    await expect(addBtn).toHaveAttribute("aria-label", "Add layer");
    await expect(deleteBtn).toHaveAttribute("aria-label", "Delete layer");
    await expect(dupBtn).toHaveAttribute("aria-label", "Duplicate layer");
    await expect(mergeBtn).toHaveAttribute("aria-label", "Merge layer down");
    await expect(upBtn).toHaveAttribute("aria-label", "Move layer up");
    await expect(downBtn).toHaveAttribute("aria-label", "Move layer down");

    // Add a new layer
    await addBtn.click();
    await expect(layers).toContainText("Layer 1");
    // With 2 layers and Layer 1 active (top of stack)
    await expect(deleteBtn).toBeEnabled();
    await expect(mergeBtn).toBeEnabled();
    await expect(downBtn).toBeEnabled();
    await expect(upBtn).toBeDisabled();

    // Duplicate active layer: creates "Layer 1 copy"
    await dupBtn.click();
    await expect(layers).toContainText("Layer 1 copy");

    // Check layer opacity slider and blend mode dropdown
    const opacitySlider = layers.locator('input[type="range"][aria-label="Layer opacity"]');
    await expect(opacitySlider).toBeVisible();
    const blendSelect = layers.locator('select[aria-label="Layer blend mode"]');
    await expect(blendSelect).toBeVisible();

    // Check Ribbon Download button title and aria-label
    const ribbonDl = page.getByTestId("ribbon-download");
    await expect(ribbonDl).toHaveAttribute("title", "Download (Ctrl+Shift+S)");
    await expect(ribbonDl).toHaveAttribute("aria-label", "Download (Ctrl+Shift+S)");

    // Check File menu label: "Download..." (not "Download Export...")
    await page.getByTestId("menu-file").click();
    const menuDl = page.getByRole("menuitem", { name: "Download..." });
    await expect(menuDl).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Download Export/ })).toHaveCount(0);

    // Open Download dialog from File menu
    await menuDl.click();
    const dialog = page.getByTestId("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Download", exact: true })).toBeVisible();
    await expect(dialog.getByText("Download Export")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Download", exact: true })).toBeVisible();

    // Close Download dialog
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("dialog")).toHaveCount(0);

    await page.screenshot({ path: join(ART, "responsive-desktop-layers.png") });
  });

  test("tablet chrome inspector and touch layers panel", async ({ browser }) => {
    const context = await browser.newContext({
      hasTouch: true,
      viewport: { width: 768, height: 1024 },
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      localStorage.clear();
    });
    await page.goto("/?visual=1");
    await page.locator("#app[data-ready='1']").waitFor({ timeout: 15_000 });
    await page.waitForTimeout(300);

    // Inspector bar should be visible on tablet
    const inspectorBar = page.getByTestId("tablet-inspector-bar");
    await expect(inspectorBar).toBeVisible();

    // Segmented tab buttons: Layers, Color, History
    const layersTab = page.getByTestId("tablet-pane-layers");
    const colorsTab = page.getByTestId("tablet-pane-colors");
    const historyTab = page.getByTestId("tablet-pane-history");

    await expect(layersTab).toHaveAttribute("role", "tab");
    await expect(layersTab).toHaveAttribute("aria-label", "Layers pane");
    await expect(colorsTab).toHaveAttribute("role", "tab");
    await expect(historyTab).toHaveAttribute("role", "tab");

    // Click Layers tab
    await layersTab.click();
    await expect(layersTab).toHaveClass(/active/);

    const layersWindow = page.getByTestId("window-layers");
    await expect(layersWindow).toBeVisible();

    // Touch-friendly action buttons (height >= 32px)
    const addBtn = layersWindow.locator('[data-testid="layer-add-btn"]');
    const box = await addBtn.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(32);

    // Add a layer on tablet
    await addBtn.click();
    await expect(layersWindow).toContainText("Layer 1");

    // Switch to Colors tab
    await colorsTab.click();
    await expect(colorsTab).toHaveClass(/active/);
    await expect(page.getByTestId("window-colors")).toBeVisible();

    // Switch to History tab
    await historyTab.click();
    await expect(historyTab).toHaveClass(/active/);
    await expect(page.getByTestId("window-history")).toBeVisible();

    // Close tablet inspector
    const closeBtn = page.getByTestId("tablet-inspector-close");
    await expect(closeBtn).toHaveAttribute("aria-label", "Hide inspector");
    await closeBtn.click();
    await expect(page.getByTestId("tablet-inspector-bar")).toHaveCount(0);

    await page.screenshot({ path: join(ART, "responsive-tablet-layers.png") });
    await context.close();
  });

  test("mobile phone command deck, layers sheet, and download dialog", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?visual=1");
    await page.locator("#app[data-ready='1']").waitFor({ timeout: 15_000 });
    await page.waitForTimeout(300);

    await expect(page.getByTestId("mobile-command-deck")).toBeVisible();
    await expect(page.getByTestId("mobile-top-bar")).toBeVisible();

    // Check top bar download button title and aria-label
    const topDl = page.getByTestId("mobile-top-download");
    await expect(topDl).toHaveAttribute("title", "Download");
    await expect(topDl).toHaveAttribute("aria-label", "Download");

    // 1. Open More sheet to verify Download... string
    await page.getByTestId("mobile-tab-more").click();
    const sheetContainer = page.getByTestId("mobile-sheet-container");
    await expect(sheetContainer).toBeVisible();

    // Verify More sheet contains Download... (not Download Export...)
    const moreDlBtn = sheetContainer.getByRole("button", { name: "Download..." });
    await expect(moreDlBtn).toBeVisible();
    await expect(sheetContainer.getByRole("button", { name: /Download Export/ })).toHaveCount(0);

    // Click Download... from More sheet
    await moreDlBtn.click();
    const dialog = page.getByTestId("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Download", exact: true })).toBeVisible();
    await expect(dialog.getByText("Download Export")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("dialog")).toHaveCount(0);

    // 2. Open Layers sheet from Command Deck
    await page.getByTestId("mobile-tab-layers").click();
    await expect(sheetContainer).toBeVisible();

    // Sheet title and close button
    await expect(page.getByText("Layer Manager")).toBeVisible();
    const sheetClose = page.getByTestId("mobile-sheet-close");
    await expect(sheetClose).toBeVisible();
    await expect(sheetClose).toHaveAttribute("title", "Close");
    await expect(sheetClose).toHaveAttribute("aria-label", "Close");

    // Check mobile action buttons
    const mAdd = page.getByTestId("mobile-layer-add");
    const mDel = page.getByTestId("mobile-layer-del");
    const mDup = page.getByTestId("mobile-layer-dup");
    const mMerge = page.getByTestId("mobile-layer-merge");
    const mUp = page.getByTestId("mobile-layer-up");
    const mDown = page.getByTestId("mobile-layer-down");

    // Verify aria-labels and titles
    await expect(mAdd).toHaveAttribute("aria-label", "Add layer");
    await expect(mDel).toHaveAttribute("aria-label", "Delete layer");
    await expect(mDup).toHaveAttribute("aria-label", "Duplicate layer");
    await expect(mMerge).toHaveAttribute("aria-label", "Merge layer down");
    await expect(mUp).toHaveAttribute("aria-label", "Move layer up");
    await expect(mDown).toHaveAttribute("aria-label", "Move layer down");

    // Disabled states with 1 layer
    await expect(mDel).toBeDisabled();
    await expect(mMerge).toBeDisabled();
    await expect(mUp).toBeDisabled();
    await expect(mDown).toBeDisabled();
    await expect(mAdd).toBeEnabled();
    await expect(mDup).toBeEnabled();

    // Add layer in mobile
    await mAdd.click();
    await expect(sheetContainer).toContainText("Layer 1");

    // Disabled states with 2 layers
    await expect(mDel).toBeEnabled();
    await expect(mMerge).toBeEnabled();

    // Check opacity slider and blend mode
    const opacitySlider = sheetContainer.locator('input[type="range"][aria-label="Opacity"]');
    await expect(opacitySlider).toBeVisible();
    const blendSelect = sheetContainer.locator('select[aria-label="Blend Mode"]');
    await expect(blendSelect).toBeVisible();

    // Close sheet via close button
    await sheetClose.click();
    await expect(page.getByTestId("mobile-sheet-container")).toHaveCount(0);

    await page.screenshot({ path: join(ART, "responsive-mobile-layers.png") });
  });
});
