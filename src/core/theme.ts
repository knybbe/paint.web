export const THEME_PREFS = ["system", "light", "dark"] as const;
export type ThemePref = (typeof THEME_PREFS)[number];
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "paint.web:theme";
export const THEME_META: Record<ResolvedTheme, string> = {
  dark: "#0a0a0f",
  light: "#ffffff",
};

export function parseThemePref(raw: unknown): ThemePref {
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return "system";
}

export function resolveTheme(pref: ThemePref, win: Window = window): ResolvedTheme {
  if (pref === "light" || pref === "dark") return pref;
  return win.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function cycleThemePref(current: ThemePref): ThemePref {
  const i = THEME_PREFS.indexOf(current);
  return THEME_PREFS[(i + 1) % THEME_PREFS.length];
}

export function applyDomTheme(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.classList.toggle("dark", resolved === "dark");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_META[resolved]);
}

export function persistThemePref(pref: ThemePref): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    /* private mode */
  }
}

let systemUnsub: (() => void) | null = null;

export function bindSystemTheme(onChange: () => void, win: Window = window): void {
  systemUnsub?.();
  const mq = win.matchMedia?.("(prefers-color-scheme: dark)");
  if (!mq) {
    systemUnsub = null;
    return;
  }
  const handler = () => onChange();
  mq.addEventListener("change", handler);
  systemUnsub = () => mq.removeEventListener("change", handler);
}

export function unbindSystemTheme(): void {
  systemUnsub?.();
  systemUnsub = null;
}
