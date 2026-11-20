import config from "../src-tauri/tauri.conf.json" with { type: "json" };
import { expect, test, type Page } from "@playwright/test";

// La CSP de producción (la de tauri.conf.json, que `vite preview` envía igual que Tauri a la app empaquetada): la app
// funciona sin ninguna violación y lo que no está permitido, como pedir algo a un host externo, se bloquea.

interface Violation {
  directive: string;
  blocked: string;
}

/** Registra las violaciones de CSP desde antes de cargar la página. */
async function recordViolations(page: Page) {
  await page.addInitScript(() => {
    const target = window as unknown as { __violations: { directive: string; blocked: string }[] };
    target.__violations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      target.__violations.push({ directive: event.effectiveDirective, blocked: event.blockedURI });
    });
  });
}

const violations = (page: Page) =>
  page.evaluate(() => (window as unknown as { __violations: Violation[] }).__violations);

test("serves the production CSP", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.headers()["content-security-policy"]).toBe(config.app.security.csp);
});

test("runs the app without CSP violations", async ({ page }) => {
  await recordViolations(page);
  await page.goto("/");
  await expect(page.getByRole("main")).toContainText("Home");
  await page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: "Example" }).click();
  await expect(page.getByRole("main")).toContainText("Example");
  await page.keyboard.press("Control+Comma");
  const settings = page.getByRole("dialog", { name: "Settings" });
  await expect(settings).toBeVisible();
  await settings.getByRole("tab", { name: "Appearance" }).click();
  await expect(settings.getByRole("combobox", { name: "Theme" })).toBeVisible();
  // Las fuentes y los estilos también cuentan: la página tiene que haber terminado de cargar.
  await page.evaluate(() => document.fonts.ready);
  expect(await violations(page)).toEqual([]);
});

test("blocks requests to external hosts", async ({ page }) => {
  await recordViolations(page);
  await page.goto("/");
  const failed = await page.evaluate(() =>
    fetch("https://example.com/").then(
      () => false,
      () => true,
    ),
  );
  expect(failed).toBe(true);
  await expect.poll(() => violations(page)).toContainEqual({ directive: "connect-src", blocked: "https://example.com/" });
});
