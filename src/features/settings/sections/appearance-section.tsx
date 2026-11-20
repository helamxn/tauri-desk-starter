import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setThemeChoice, parseTheme, useTheme, type Theme } from "@/lib/theme";
import { SettingsSection } from "../settings-section";

const OPTIONS: readonly { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

/** Appearance: el tema, en un desplegable; se aplica al elegirlo. */
export function AppearanceSection() {
  const theme = useTheme();

  return (
    <SettingsSection title="Appearance">
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor="settings-theme">Theme</FieldLabel>
          <FieldDescription>System follows the appearance of your operating system.</FieldDescription>
        </FieldContent>
        <Select
          items={OPTIONS}
          value={theme}
          onValueChange={(value) => {
            setThemeChoice(parseTheme(value));
          }}
        >
          <SelectTrigger id="settings-theme" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {OPTIONS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
    </SettingsSection>
  );
}
