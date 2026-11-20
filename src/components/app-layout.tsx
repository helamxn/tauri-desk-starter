import { Outlet } from "@tanstack/react-router";
import { SettingsMenu } from "@/features/settings/settings-menu";
import { SettingsProvider } from "@/features/settings/settings-provider";
import { UpdateIndicator } from "@/features/updater/update-indicator";
import { AppNav } from "./app-nav";
import { AppShell } from "./app-shell";

/** Diseño común: la barra arriba (navegación, indicador de actualización y menú) y la sección debajo; Settings para toda la app. */
export function AppLayout() {
  return (
    <SettingsProvider>
      <AppShell
        nav={<AppNav />}
        actions={
          <>
            <UpdateIndicator />
            <SettingsMenu />
          </>
        }
      >
        <Outlet />
      </AppShell>
    </SettingsProvider>
  );
}
