import { isTauri } from "@tauri-apps/api/core";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useUpdater } from "@/features/updater/updater-context";
import { downloadPercent, type UpdaterState } from "@/features/updater/updater-state";
import { savePreferences, usePreferences } from "@/lib/preferences";
import { SettingsSection } from "../settings-section";

/** El estado de las actualizaciones, junto a la versión («0.1.0 · Up to date»). */
function statusText(state: UpdaterState): string | null {
  switch (state.status) {
    case "checking":
      return "Checking for updates…";
    case "up-to-date":
      return "Up to date";
    case "downloading": {
      const percent = downloadPercent(state);
      return percent === null
        ? `Downloading ${state.update.version}…`
        : `Downloading ${state.update.version} (${String(percent)}%)…`;
    }
    case "ready":
      return `Version ${state.update.version} is ready to install`;
    case "installing":
      return "Installing the update…";
    case "error":
      return state.stage === "install" ? "Couldn't install the update" : "Couldn't check for updates";
    default:
      return null;
  }
}

/** Updates: la preferencia, la versión con su estado y buscar (o instalar, si hay una lista). */
function UpdateSettings() {
  const { autoUpdate } = usePreferences();
  const { state, supported, checkForUpdates, setDialogOpen } = useUpdater();
  const busy = state.status === "checking" || state.status === "downloading" || state.status === "installing";
  const status = statusText(state);

  return (
    <FieldSet>
      <FieldLegend>Updates</FieldLegend>
      <FieldGroup>
        <Field orientation="horizontal" data-disabled={!supported || undefined}>
          <FieldContent>
            <FieldLabel htmlFor="settings-auto-update">Automatic updates</FieldLabel>
            <FieldDescription>Download new versions in the background and install them when you choose.</FieldDescription>
          </FieldContent>
          <Switch
            id="settings-auto-update"
            checked={autoUpdate}
            disabled={!supported}
            onCheckedChange={(value) => {
              savePreferences({ autoUpdate: value });
            }}
          />
        </Field>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldTitle>Version</FieldTitle>
            <FieldDescription>
              {supported
                ? [__APP_VERSION__, status].filter(Boolean).join(" · ")
                : `${__APP_VERSION__} · Updates are available in the desktop app.`}
            </FieldDescription>
          </FieldContent>
          {state.status === "ready" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDialogOpen(true);
              }}
            >
              Install update
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={!supported || busy}
              onClick={() => void checkForUpdates({ manual: true })}
            >
              {busy && <Spinner data-icon="inline-start" />}
              Check for updates
            </Button>
          )}
        </Field>
      </FieldGroup>
    </FieldSet>
  );
}

/** General: Application (Keep running) y Updates. Cada cambio se guarda al momento. */
export function GeneralSection({ inTauri = isTauri() }: { inTauri?: boolean }) {
  const { keepRunning } = usePreferences();

  return (
    <SettingsSection title="General">
      <FieldGroup>
        <FieldSet>
          <FieldLegend>Application</FieldLegend>
          <Field orientation="horizontal" data-disabled={!inTauri || undefined}>
            <FieldContent>
              <FieldLabel htmlFor="settings-keep-running">Keep the app running when closed</FieldLabel>
              <FieldDescription>
                {inTauri
                  ? "Closing the window keeps the app in the system tray; quit from the tray menu."
                  : "Available in the desktop app."}
              </FieldDescription>
            </FieldContent>
            <Switch
              id="settings-keep-running"
              checked={keepRunning}
              disabled={!inTauri}
              onCheckedChange={(value) => {
                savePreferences({ keepRunning: value });
              }}
            />
          </Field>
        </FieldSet>
        <FieldSeparator />
        <UpdateSettings />
      </FieldGroup>
    </SettingsSection>
  );
}
