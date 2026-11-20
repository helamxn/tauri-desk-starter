import { ToggleTabsTrigger } from "@/components/toggle-tabs-trigger";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TabsContent, TabsList } from "@/components/ui/tabs";
import { VerticalTabs } from "@/components/vertical-tabs";
import { SETTINGS_SECTIONS } from "./sections";

/**
 * El diálogo de Settings (se carga al abrirlo por primera vez): el título arriba, las pestañas en vertical a la
 * izquierda y la sección a la derecha, con su cabecera fija y su propio scroll.
 */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  return (
    // Un clic fuera no cierra: una sección puede tener un formulario a medias.
    <Dialog
      open
      disablePointerDismissal
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {/* Un alto fijo, con el tope de todos los modales en index.css; el panel de la pestaña hace scroll. */}
      {/* Un contenedor (@container): en un diálogo estrecho las pestañas se quedan en su icono, con el nombre para
          lectores de pantalla, y la sección conserva su ancho. */}
      <DialogContent className="@container h-[38rem] grid-rows-[auto_minmax(0,1fr)] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <VerticalTabs defaultValue={SETTINGS_SECTIONS[0].value} className="min-h-0 gap-4 @lg:gap-6">
          {/* Hace scroll por su cuenta en una ventana baja; alineado arriba para que la primera pestaña siga al alcance. */}
          <TabsList variant="line" className="max-h-full shrink-0 justify-start overflow-y-auto @lg:w-40">
            {SETTINGS_SECTIONS.map(({ value, label, icon: Icon }) => (
              <ToggleTabsTrigger key={value} value={value}>
                <Icon data-icon="inline-start" />
                <span className="sr-only @lg:not-sr-only">{label}</span>
              </ToggleTabsTrigger>
            ))}
          </TabsList>
          {/* Cada sección (SettingsSection) fija su cabecera y hace scroll de su contenido. */}
          {SETTINGS_SECTIONS.map(({ value, content: Content }) => (
            <TabsContent key={value} value={value} className="flex min-h-0 min-w-0 flex-col">
              <Content />
            </TabsContent>
          ))}
        </VerticalTabs>
      </DialogContent>
    </Dialog>
  );
}
