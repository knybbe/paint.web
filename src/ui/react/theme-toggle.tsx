import type { AppState } from "@/app-state";
import { cycleThemePref, resolveTheme } from "@/core/theme";
import { UI_ICONS } from "@/ui/icons";
import { useAppEvents } from "@/ui/react/use-app";
import { cn } from "@/ui/react/lib/utils";

function SvgIcon({ svg }: { svg: string }) {
  return <span className="icon" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function ThemeToggle({ app, className }: { app: AppState; className?: string }) {
  useAppEvents(app, ["theme"]);
  const pref = app.settings.theme;
  const resolved = resolveTheme(pref);
  const icon = pref === "system" ? UI_ICONS.monitor : pref === "dark" ? UI_ICONS.moon : UI_ICONS.sun;
  const label = pref === "system" ? `System (${resolved})` : pref === "dark" ? "Dark" : "Light";
  return (
    <button
      type="button"
      className={cn("chrome-icon-btn", className)}
      title={`Theme: ${label} — click for System / Light / Dark`}
      data-testid="ribbon-theme"
      aria-label={`Theme ${label}`}
      onClick={() => {
        app.settings.theme = cycleThemePref(pref);
        app.applyTheme();
        void app.persistSettings();
      }}
    >
      <SvgIcon svg={icon} />
    </button>
  );
}
