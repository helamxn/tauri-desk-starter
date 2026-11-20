// ESLint con typescript-eslint (reglas con tipos), React Hooks y React Refresh.
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist", "src-tauri/target", "src-tauri/gen", "playwright-report", "test-results", ".agents"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // zod, siempre desde src/lib/zod.ts: así se configura sin `eval`, que la CSP de la app bloquea.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/zod.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "zod", message: "Importa z de \"@/lib/zod\" (configurado sin eval para la CSP)." }] },
      ],
    },
  },
  {
    // Configuración, scripts y tests e2e: se ejecutan en Node.
    files: ["*.config.ts", "e2e/**/*.ts", "scripts/**/*.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    // node:test: describe e it devuelven promesas que gestiona el propio ejecutor de tests.
    files: ["scripts/**/*.test.ts"],
    rules: { "@typescript-eslint/no-floating-promises": "off" },
  },
  {
    // Los componentes de shadcn (src/components/ui/) no se modifican: no se les aplican las reglas con tipos ni de
    // estilo propias, ni React Refresh.
    files: ["src/components/ui/**/*.tsx"],
    extends: [tseslint.configs.disableTypeChecked],
    rules: { "react-refresh/only-export-components": "off", "@typescript-eslint/array-type": "off" },
  },
  {
    files: ["**/*.js"],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
]);
