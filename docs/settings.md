# Ajustes

El menú de la barra y Ctrl+, abren Settings. El mismo atajo o Escape lo cierran; un clic fuera no (`disablePointerDismissal`). General controla la bandeja y las actualizaciones. Appearance elige System, Light o Dark. Los cambios se aplican inmediatamente.

El proveedor carga el diálogo al abrirlo. Estructura: alto fijo (38rem, con el tope de todos los modales en `src/index.css`), pestañas verticales a la izquierda (`VerticalTabs`, que se recorren con las flechas arriba y abajo, y `ToggleTabsTrigger`, con el aspecto de un Toggle; en un diálogo estrecho se quedan en su icono) y cada sección con su cabecera fija y su propio scroll (`SettingsSection`).

## Añadir una sección

1. Crea el componente en `src/features/settings/sections/`, envuelto en `SettingsSection`. Usa filas `Field` en horizontal, como General y Appearance:

   ```tsx
   import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
   import { Switch } from "@/components/ui/switch";
   import { SettingsSection } from "../settings-section";

   export function NotificationsSection() {
     return (
       <SettingsSection title="Notifications">
         <Field orientation="horizontal">
           <FieldContent>
             <FieldLabel htmlFor="settings-sounds">Sounds</FieldLabel>
             <FieldDescription>Play a sound for new messages.</FieldDescription>
           </FieldContent>
           <Switch id="settings-sounds" />
         </Field>
       </SettingsSection>
     );
   }
   ```

2. Regístralo en `src/features/settings/sections.ts` con su `value`, etiqueta e icono de lucide:

   ```ts
   { value: "notifications", label: "Notifications", icon: BellIcon, content: NotificationsSection },
   ```

`SettingsSection` acepta además `description` (debajo del título) y `action` (la acción principal de la sección junto al título, como "Invite").
