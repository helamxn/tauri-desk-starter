import config from "./src-tauri/tauri.conf.json" with { type: "json" };
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";


// La versión de la app: la de package.json, que también lee tauri.conf.json (la de Cargo.toml no se usa).
const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Tauri muestra sus propios errores de Rust: Vite no limpia la consola.
  clearScreen: false,
  server: {
    port: Number(new URL(config.build.devUrl).port),
    strictPort: true,
    host: new URL(config.build.devUrl).hostname,
    watch: {
      // Los cambios de Rust los vigila Tauri, no Vite.
      ignored: ["**/src-tauri/**"],
    },
  },
  // La build de producción en el navegador (puerto por defecto de Vite), con la misma CSP que Tauri envía a la app
  // empaquetada. Es donde se prueba la CSP: en `tauri dev` la webview carga el servidor de Vite directamente y Tauri no
  // le aplica ninguna (solo la pone en los archivos que sirve él).
  preview: {
    strictPort: true,
    headers: { "Content-Security-Policy": config.app.security.csp },
  },
});
