import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

// Tests del frontend: jsdom, solo los archivos *.test.ts(x) de src/, y cada test restaura sus mocks.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      globals: true,
      include: ["src/**/*.test.{ts,tsx}"],
      setupFiles: ["./src/test/setup.ts"],
      restoreMocks: true,
    },
  }),
);
