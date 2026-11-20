import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// La app en el navegador (Vite), en los dos tamaños de Playwright (la ventana mínima y uno amplio): navegación entre
// secciones, accesibilidad (axe, WCAG 2.1 A y AA, sin violaciones serias ni críticas) y sin scroll horizontal.

async function checkPage(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflows).toBe(false);
}

test("navigates between Home and Example with accessible pages and no horizontal overflow", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Sections" });
  await expect(nav.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("main")).toContainText("Home");
  await checkPage(page);

  await nav.getByRole("link", { name: "Example" }).click();
  await expect(page).toHaveURL(/#\/example$/);
  await expect(page.getByRole("main")).toContainText("Example");
  await expect(nav.getByRole("link", { name: "Example" })).toHaveAttribute("aria-current", "page");
  await checkPage(page);

  await nav.getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL(/#\/$/);
});

test("restores a hash route on reload", async ({ page }) => {
  await page.goto("/#/example");
  await page.reload();
  await expect(page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: "Example" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("main")).toContainText("Example");
});
