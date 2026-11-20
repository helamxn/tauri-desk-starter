// Registro de las secciones de Settings: añadir una sección es añadir una entrada (docs/settings.md).
import type { ComponentType } from "react";
import { PaletteIcon, SlidersHorizontalIcon, type LucideIcon } from "lucide-react";
import { AppearanceSection } from "./sections/appearance-section";
import { GeneralSection } from "./sections/general-section";

export interface SettingsSectionEntry {
  value: string;
  label: string;
  icon: LucideIcon;
  content: ComponentType;
}

export const SETTINGS_SECTIONS: readonly [SettingsSectionEntry, ...SettingsSectionEntry[]] = [
  { value: "general", label: "General", icon: SlidersHorizontalIcon, content: GeneralSection },
  { value: "appearance", label: "Appearance", icon: PaletteIcon, content: AppearanceSection },
];
