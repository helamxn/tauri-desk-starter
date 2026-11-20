import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Settings en el navegador (Vite), en la ventana mínima y en una amplia: abrirlo con el menú y con Ctrl+,, cambiar el
// tema y lo que solo existe en la app de escritorio; axe (WCAG 2.1 A y AA, sin violaciones serias ni críticas) y sin
// scroll horizontal.

async function checkPage(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflows).toBe(false);
}

const settings = (page: Page) => page.getByRole("dialog", { name: "Settings" });

async function openFromMenu(page: Page) {
  await page.getByRole("button", { name: "Settings menu" }).click();
  const option = page.getByRole("menuitem", { name: /Settings/ });
  await expect(option).toHaveAttribute("aria-keyshortcuts", "Control+,");
  await expect(option).toContainText("Ctrl+,");
  await option.click();
  await expect(settings(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("main")).toContainText("Home");
});

test("opens General from the menu with accessible content and no horizontal overflow", async ({ page }) => {
  await openFromMenu(page);
  await expect(page.getByRole("tab", { name: "General" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Available in the desktop app.", { exact: true })).toBeVisible();
  await checkPage(page);

  await page.getByRole("tab", { name: "Appearance" }).click();
  await expect(page.getByRole("combobox", { name: "Theme" })).toContainText("System");
  await checkPage(page);
  await page.getByRole("combobox", { name: "Theme" }).click();
  await expect(page.getByRole("option", { name: "System" })).toBeVisible();
  await checkPage(page);
  await page.keyboard.press("Escape");

  await page.keyboard.press("Escape");
  await expect(settings(page)).toBeHidden();
});

test("toggles Settings with Ctrl+Comma", async ({ page }) => {
  await page.keyboard.press("Control+Comma");
  await expect(settings(page)).toBeVisible();
  await page.keyboard.press("Control+Comma");
  await expect(settings(page)).toBeHidden();
});

test("persists the selected theme across reloads", async ({ page }) => {
  const html = page.locator("html");
  await openFromMenu(page);
  await page.getByRole("tab", { name: "Appearance" }).click();

  const theme = page.getByRole("combobox", { name: "Theme" });
  await theme.click();
  await page.getByRole("option", { name: "Dark" }).click();
  await expect(html).toHaveClass(/\bdark\b/);
  await theme.click();
  await page.getByRole("option", { name: "Light" }).click();
  await expect(html).toHaveClass(/\blight\b/);
  await expect(html).not.toHaveClass(/\bdark\b/);

  await page.reload();
  await expect(html).toHaveClass(/\blight\b/);
});

test("explains desktop-only settings in the browser", async ({ page }) => {
  await openFromMenu(page);
  await expect(page.getByRole("button", { name: "Save" })).toHaveCount(0);
  await expect(page.getByRole("switch", { name: "Keep the app running when closed" })).toBeDisabled();
  await expect(page.getByRole("switch", { name: "Automatic updates" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Check for updates" })).toBeDisabled();
  await expect(page.getByText("Available in the desktop app.", { exact: true })).toBeVisible();
  await expect(page.getByText(/Updates are available in the desktop app\./)).toBeVisible();
  await checkPage(page);

  // Cerrar no pregunta: no hay nada sin guardar.
  await page.keyboard.press("Control+Comma");
  await expect(settings(page)).toBeHidden();
});
