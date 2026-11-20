import { isTauri } from "@tauri-apps/api/core";
import { useEffect, useRef, type ReactNode } from "react";
import { mountWindowControls } from "@/lib/window-controls";

/**
 * Barra de título propia (la ventana no tiene marco): zona de arrastre, navegación a la izquierda (`nav`; sus enlaces no
 * arrastran), acciones y, en la app, los botones de la ventana pegados a la derecha (src/lib/window-controls.ts, sin
 * React). En el navegador (Vite, tests e2e) no hay botones de ventana.
 * - Simetría: la barra mide 36 px y sus botones 28 px (icon-sm y sm), así que quedan 4 px arriba y abajo; los mismos 4 px
 *   a la izquierda y 8 px entre los botones de la barra. Entre el menú y los botones de la ventana, 16 px, para que el
 *   menú no se lea como uno de ellos.
 * - Cabe en la ventana mínima (480×360): la barra es un contenedor (@container/titlebar) y sus piezas acortan sus textos
 *   en anchos bajos, como el indicador de descarga. Una app con más secciones las recoge en un menú.
 * - Con un diálogo abierto, una franja invisible (z-60, por encima de los overlays) conserva el arrastre y el doble
 *   clic; los botones de la ventana quedan por encima (z-70) y siguen funcionando, como en una ventana nativa.
 */
export function TitleBar({
  nav,
  actions,
  inTauri = isTauri(),
}: {
  nav?: ReactNode;
  actions?: ReactNode;
  inTauri?: boolean;
}) {
  const windowControls = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = windowControls.current;
    if (!inTauri || !container) return;
    return mountWindowControls(container);
  }, [inTauri]);

  return (
    <header
      data-tauri-drag-region
      data-desktop={inTauri || undefined}
      className="@container/titlebar flex h-9 shrink-0 items-center gap-2 px-1 data-desktop:pr-0"
    >
      {nav}
      <div data-tauri-drag-region className="h-full min-w-0 flex-1" />
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
      {inTauri && <div ref={windowControls} className="relative z-70 ms-2 flex self-stretch" />}
      <div aria-hidden data-tauri-drag-region className="fixed inset-x-0 top-0 z-60 hidden h-9 modal-open:block" />
    </header>
  );
}
