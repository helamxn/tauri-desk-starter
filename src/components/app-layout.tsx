import { Outlet } from "@tanstack/react-router";
import { SettingsMenu } from "@/features/settings/settings-menu";
import { SettingsProvider } from "@/features/settings/settings-provider";
import { UpdateIndicator } from "@/features/updater/update-indicator";
import { TitleBar } from "./title-bar";

/** Diseño común: la barra arriba (con el indicador de actualización y el menú) y la sección debajo, con su propio scroll; Settings para toda la app. */
export function AppLayout() {
  return (
    <SettingsProvider>
      <div className="flex h-svh flex-col">
        <TitleBar
          actions={
            <>
              <UpdateIndicator />
              <SettingsMenu />
            </>
          }
        />
        <main className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </SettingsProvider>
  );
}
