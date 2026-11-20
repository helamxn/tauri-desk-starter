import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "cn";

/**
 * El `Tabs` de shadcn en vertical, con la orientación también para Base UI. El de `src/components/ui/tabs.tsx`
 * (base-nova) solo la usa para `data-orientation`: no se la pasa a `TabsPrimitive.Root`, así que Base UI trata la
 * lista como horizontal (se recorre con izquierda y derecha y no anuncia `aria-orientation="vertical"`). Fallo de
 * shadcn: https://github.com/shadcn-ui/ui/issues/10592. Mismo `data-slot` y clases que el de shadcn, así TabsList,
 * TabsContent y sus variantes `group-data-vertical/tabs` funcionan igual. Cuando shadcn lo corrija, se vuelve a su
 * `Tabs` con `orientation="vertical"` y se borra este archivo.
 */
export function VerticalTabs({ className, ...props }: Omit<TabsPrimitive.Root.Props, "orientation">) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      orientation="vertical"
      className={cn("group/tabs flex gap-2", className)}
      {...props}
    />
  );
}
