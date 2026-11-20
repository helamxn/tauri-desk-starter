import { cn } from "cn";
import { useId, type ComponentProps, type ReactNode } from "react";
import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field";

/**
 * La parte de una sección de Settings que hace scroll, con los márgenes del diálogo: a la derecha llega hasta el borde
 * del modal y recupera su margen (1rem) por dentro, así la barra va en el borde y el contenido deja el mismo margen que
 * en los formularios. Arriba y a la izquierda se sale 4 px y los recupera con relleno: un contenedor con scroll recorta
 * lo que sale de sus bordes, y así caben los anillos de foco (3 px por fuera de cada control) sin mover el contenido.
 */
function SettingsScroll({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "-mt-1 -mr-4 -ml-1 min-h-0 flex-1 overflow-x-hidden overflow-y-auto pt-1 pr-4 pb-1 pl-1",
        className,
      )}
      {...props}
    />
  );
}

interface SettingsSectionProps {
  title: string;
  description?: ReactNode;
  /** La acción principal de la sección, como "Invite", junto al título. */
  action?: ReactNode;
  children: ReactNode;
}

/**
 * Una sección de Settings: el título, la descripción y la acción quedan fijos y solo hace scroll el
 * contenido. El título no es el primer hijo del fieldset (va junto a la acción), así que el grupo toma su nombre con
 * aria-labelledby.
 */
export function SettingsSection({ title, description, action, children }: SettingsSectionProps) {
  const titleId = useId();
  return (
    <FieldSet className="min-h-0 min-w-0 flex-1" aria-labelledby={titleId}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <FieldLegend id={titleId}>{title}</FieldLegend>
          {description && <FieldDescription>{description}</FieldDescription>}
        </div>
        {action}
      </div>
      <SettingsScroll className="flex flex-col gap-4">{children}</SettingsScroll>
    </FieldSet>
  );
}
