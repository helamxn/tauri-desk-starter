import { useEffect, useLayoutEffect, type ReactNode } from "react";
import { logError } from "@/lib/log";
import { applyTheme, applyWindowTheme, appliedTheme, useSystemDark, useTheme } from "@/lib/theme";

/**
 * Aplica el tema a <html> en useLayoutEffect, antes de pintar: el primer fotograma ya sale con el tema correcto. Con
 * System, sigue al sistema también si cambia con la app abierta. En la app de escritorio, también la ventana nativa.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const systemDark = useSystemDark();

  useLayoutEffect(() => {
    applyTheme(document.documentElement, appliedTheme(theme, systemDark));
  }, [theme, systemDark]);

  useEffect(() => {
    applyWindowTheme(theme).catch(() => {
      logError("No se pudo aplicar el tema a la ventana");
    });
  }, [theme]);

  return children;
}
