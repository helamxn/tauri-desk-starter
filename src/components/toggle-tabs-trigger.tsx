import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "cn";
import { toggleVariants } from "@/components/ui/toggle";

/**
 * Una pestaña con aspecto de Toggle de shadcn: transparente, con el hover ghost de un botón, y la
 * seleccionada se queda pulsada. `data-active:bg-muted` repite el estado pulsado del propio Toggle (`aria-pressed:bg-muted`)
 * con el atributo que pone Base UI a la pestaña activa: no añade colores. Para navegar entre secciones en vertical,
 * como en Settings; conserva la semántica de pestaña y el teclado de Tabs de Base UI. Va dentro de un TabsList
 * transparente (`variant="line"`). Las pestañas conservan su alto, así una lista más alta que su espacio hace scroll en
 * vez de aplastarlas.
 */
export function ToggleTabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        toggleVariants(),
        "w-full shrink-0 justify-start data-active:bg-muted data-active:text-foreground",
        className,
      )}
      {...props}
    />
  );
}
