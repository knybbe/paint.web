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

  test("mobile phone command deck, sheets above deck, single-tab bar, theme, and customization", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?visual=1");
    await page.locator("#app[data-ready='1']").waitFor({ timeout: 15_000 });
    await page.waitForTimeout(300);

    const deck = page.getByTestId("mobile-command-deck");
    const topBar = page.getByTestId("mobile-top-bar");
    await expect(deck).toBeVisible();
    await expect(topBar).toBeVisible();

    // 1. Single-tab top row works with 1 file open (dropdown + New tab button)
    const docBar = page.getByTestId("mobile-doc-bar");
    await expect(docBar).toBeVisible();
    const dropdownTrigger = page.getByTestId("mobile-doc-dropdown-trigger");
    await expect(dropdownTrigger).toBeVisible();
    const newTabBtn = page.getByTestId("mobile-new-tab-button");
    await expect(newTabBtn).toBeVisible();

    // Open tab dropdown with 1 session
    await dropdownTrigger.click();
    const docMenu = page.getByTestId("mobile-doc-dropdown-menu");
    await expect(docMenu).toBeVisible();
    await expect(docMenu.getByTestId("mobile-tab-row")).toHaveCount(1);
    await dropdownTrigger.click(); // close dropdown

    // Test New button on single-tab row
    await newTabBtn.click();
    const newDialog = page.getByTestId("dialog");
    await expect(newDialog).toBeVisible();
    await newDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("dialog")).toHaveCount(0);

    // 2. Top bar Download button (deduplicated, Download only, no Download Export)
    const topDl = page.getByTestId("mobile-top-download");
    await expect(topDl).toHaveAttribute("title", "Download");
    await expect(topDl).toHaveAttribute("aria-label", "Download");

    // Theme toggle NOT on mobile top bar
    await expect(topBar.getByTestId("ribbon-theme")).toHaveCount(0);
    await expect(topBar.getByTestId("more-theme")).toHaveCount(0);

    // Click Download from top bar
    await topDl.click();
    const dlDialog = page.getByTestId("dialog");
    await expect(dlDialog).toBeVisible();
    await expect(dlDialog.getByRole("heading", { name: "Download", exact: true })).toBeVisible();
    await expect(dlDialog.getByText("Download Export")).toHaveCount(0);
    await dlDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("dialog")).toHaveCount(0);

    // 3. Command deck: 6 customizable slots + More (7 buttons total), icon-only
    const deckBtns = deck.locator(".deck-tab-btn");
    await expect(deckBtns).toHaveCount(7);
    await expect(page.getByTestId("mobile-tab-tools")).toBeVisible();
    await expect(page.getByTestId("mobile-tab-toolopts")).toBeVisible();
    await expect(page.getByTestId("mobile-tab-color")).toBeVisible();
    await expect(page.getByTestId("mobile-tab-layers")).toBeVisible();
    await expect(page.getByTestId("mobile-tab-history")).toBeVisible();
    await expect(page.getByTestId("mobile-tab-fx")).toBeVisible();
    await expect(page.getByTestId("mobile-tab-more")).toBeVisible();

    // Verify icon-only: no visible deck labels
    await expect(page.locator(".mobile-command-deck .deck-tab-label:not(.sr-only)")).toHaveCount(0);

    // 4. Sheets sit ABOVE the deck (sheet bottom > 0 / deck still visible and interactive)
    await page.getByTestId("mobile-tab-layers").click();
    const sheetContainer = page.getByTestId("mobile-sheet-container");
    await expect(sheetContainer).toBeVisible();

    const deckBox = await deck.boundingBox();
    const sheetBox = await sheetContainer.boundingBox();
    expect(deckBox).not.toBeNull();
    expect(sheetBox).not.toBeNull();
    // Sheet bottom should sit right on/above deck
    expect(sheetBox!.y + sheetBox!.height).toBeLessThanOrEqual(deckBox!.y + 2);
    await expect(deck).toBeVisible();

    // 5. No visible sheet titles / X close buttons; sr-only title present for a11y
    await expect(page.locator(".sheet-close-btn, [data-testid='mobile-sheet-close']")).toHaveCount(0);
    await expect(sheetContainer.locator('[data-slot="sheet-title"]')).toHaveClass(/sr-only/);

    // Mobile layer actions work
    const mAdd = page.getByTestId("mobile-layer-add");
    const mDel = page.getByTestId("mobile-layer-del");
    const mDup = page.getByTestId("mobile-layer-dup");
    const mMerge = page.getByTestId("mobile-layer-merge");
    const mUp = page.getByTestId("mobile-layer-up");
    const mDown = page.getByTestId("mobile-layer-down");

    await expect(mAdd).toHaveAttribute("aria-label", "Add layer");
    await expect(mDel).toBeDisabled();
    await expect(mMerge).toBeDisabled();
    await expect(mAdd).toBeEnabled();
    await expect(mDup).toBeEnabled();

    // Add layer
    await mAdd.click();
    await expect(sheetContainer).toContainText("Layer 1");
    await expect(mDel).toBeEnabled();
    await expect(mMerge).toBeEnabled();

    // Check opacity and blend mode controls
    await expect(sheetContainer.locator('input[type="range"][aria-label="Opacity"]')).toBeVisible();
    await expect(sheetContainer.locator('select[aria-label="Blend Mode"]')).toBeVisible();

    // Close sheet by tapping active bottom button again
    await page.getByTestId("mobile-tab-layers").click();
    await expect(page.getByTestId("mobile-sheet-container")).toHaveCount(0);

    // 6. History sheet opens from deck and closes via toggle
    await page.getByTestId("mobile-tab-history").click();
    await expect(sheetContainer).toBeVisible();
    await expect(sheetContainer.getByTestId("mobile-history-undo")).toBeVisible();
    await expect(sheetContainer.getByTestId("mobile-history-redo")).toBeVisible();
    await expect(sheetContainer.getByTestId("mobile-history-del")).toBeVisible();
    await expect(sheetContainer.getByTestId("mobile-history-list")).toBeVisible();
    await page.getByTestId("mobile-tab-history").click();
    await expect(page.getByTestId("mobile-sheet-container")).toHaveCount(0);

    // 7. More sheet: no duplicate Download, has ThemeToggle, cycles theme
    await page.getByTestId("mobile-tab-more").click();
    await expect(sheetContainer).toBeVisible();
    // No duplicate Download in More sheet
    await expect(sheetContainer.getByRole("button", { name: /^Download/ })).toHaveCount(0);

    // Theme toggle in top-right of More sheet
    const moreTheme = sheetContainer.getByTestId("more-theme");
    await expect(moreTheme).toBeVisible();
    const initialTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    await moreTheme.click();
    const nextTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    expect(nextTheme).not.toBe(initialTheme);

    // 8. End-user customization UI & localStorage persistence
    const customizeBtn = sheetContainer.getByTestId("mobile-customize-bar-btn");
    await expect(customizeBtn).toBeVisible();
    await customizeBtn.click();

    const customizeSheet = page.getByTestId("mobile-customize-sheet");
    await expect(customizeSheet).toBeVisible();

    // Pick Undo to add to deck
    const undoOpt = page.getByTestId("mobile-customize-opt-undo");
    await undoOpt.click();

    // Check localStorage persistence
    const stored = await page.evaluate(() => localStorage.getItem("paint.web:mobile-deck-slots"));
    expect(stored).toContain("undo");

    // Reset defaults
    await page.getByTestId("mobile-customize-reset").click();
    const resetStored = await page.evaluate(() => localStorage.getItem("paint.web:mobile-deck-slots"));
    expect(resetStored).toContain("tools");

    // Done
    await page.getByTestId("mobile-customize-done").click();
    await expect(page.getByTestId("mobile-sheet-container")).toHaveCount(0);

    // 9. Color Studio sheet (canvas wheel has no white square bug)
    await page.getByTestId("mobile-tab-color").click();
    await expect(sheetContainer).toBeVisible();
    const wheelCanvas = sheetContainer.locator(".mobile-wheel-wrap canvas");
    await expect(wheelCanvas).toBeVisible();
    await page.getByTestId("mobile-tab-color").click();
    await expect(page.getByTestId("mobile-sheet-container")).toHaveCount(0);

    await page.screenshot({ path: join(ART, "responsive-mobile-layers.png") });
  });
});
