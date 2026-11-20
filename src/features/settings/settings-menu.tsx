import { EllipsisIcon, SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SHORTCUT_ARIA, SHORTCUT_TEXT } from "./shortcut";
import { useSettings } from "./settings-context";

/** El menú de la barra de título: de momento, Settings con su atajo visible. */
export function SettingsMenu() {
  const { open } = useSettings();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Settings menu" />}>
        <EllipsisIcon />
      </DropdownMenuTrigger>
      {/* Ancho propio: por defecto mide lo que el botón (con un mínimo de 128 px), sin sitio para el atajo. */}
      <DropdownMenuContent align="end" className="w-42">
        <DropdownMenuItem aria-keyshortcuts={SHORTCUT_ARIA} onClick={open}>
          <SettingsIcon />
          Settings
          <DropdownMenuShortcut>{SHORTCUT_TEXT}</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
