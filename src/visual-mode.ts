/** `?visual=1` freezes marching ants and exposes the app for Playwright. */
export const visualMode =
  typeof location !== "undefined" && new URLSearchParams(location.search).has("visual");
