import { afterEach, describe, expect, it } from "vitest";
import {
  applyDomTheme,
  cycleThemePref,
  parseThemePref,
  resolveTheme,
  THEME_META,
} from "../src/core/theme";

describe("theme", () => {
  afterEach(() => {
    document.documentElement.classList.remove("dark");
    delete document.documentElement.dataset.theme;
  });

  it("parses stored prefs and falls back to system", () => {
    expect(parseThemePref("light")).toBe("light");
    expect(parseThemePref("dark")).toBe("dark");
    expect(parseThemePref("system")).toBe("system");
    expect(parseThemePref("nope")).toBe("system");
  });

  it("cycles System → Light → Dark → System", () => {
    expect(cycleThemePref("system")).toBe("light");
    expect(cycleThemePref("light")).toBe("dark");
    expect(cycleThemePref("dark")).toBe("system");
  });

  it("resolves system from prefers-color-scheme", () => {
    const orig = window.matchMedia;
    window.matchMedia = ((query: string) =>
      ({
        matches: query.includes("prefers-color-scheme: dark"),
        media: query,
        onchange: null,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        dispatchEvent() {
          return false;
        },
      })) as typeof window.matchMedia;
    expect(resolveTheme("system")).toBe("dark");
    expect(resolveTheme("light")).toBe("light");
    window.matchMedia = orig;
  });

  it("writes html.dark and theme-color", () => {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.append(meta);
    applyDomTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(meta.getAttribute("content")).toBe(THEME_META.dark);
    applyDomTheme("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(meta.getAttribute("content")).toBe(THEME_META.light);
    meta.remove();
  });
});
