import { defineConfig, devices } from "@playwright/test";

// Tests end-to-end de la build de producción en el navegador (`vite preview`, con la CSP de tauri.conf.json), solo con
// Chromium: en Windows la app usa WebView2, que es Chromium. Dos proyectos: el contenido de la ventana mínima y uno
// amplio. La mínima es de 480×360 (tauri.conf.json), pero en una ventana sin marco el contenido queda 16×9 px por debajo
// (tauri-apps/tauri#13375): se prueba lo que de verdad se ve, 464×351. No se reutiliza un servidor ya abierto: podría
// servir una build antigua.
const baseURL = "http://localhost:4173";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "off",
  },
  projects: [
    { name: "minimum", use: { ...devices["Desktop Chrome"], viewport: { width: 464, height: 351 } } },
    { name: "wide", use: { ...devices["Desktop Chrome"], viewport: { width: 1600, height: 900 } } },
  ],
  webServer: {
    command: "pnpm build && pnpm preview",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
