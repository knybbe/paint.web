import { useSyncExternalStore } from "react";
import type { AppState } from "../app-state";

export type ChromePhase = "phone" | "tablet" | "desktop";
export type ChromeOrient = "portrait" | "landscape";
export type PointerKind = "coarse" | "fine";

type ChromeSnap = {
  phase: ChromePhase;
  pointer: PointerKind;
  orient: ChromeOrient;
  short: boolean;
  version: number;
};

let snap: ChromeSnap = {
  phase: "desktop",
  pointer: "fine",
  orient: "landscape",
  short: false,
  version: 0,
};

const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
  window.dispatchEvent(new Event("pdn-chrome"));
}

function mediaMatches(query: string, win: Window): boolean {
  return typeof win.matchMedia === "function" && win.matchMedia(query).matches;
}

export function chromePhase(win: Window = window): ChromePhase {
  const coarse = mediaMatches("(pointer: coarse)", win);
  const w = win.innerWidth;
  const h = win.innerHeight;
  const short = Math.min(w, h);
  const long = Math.max(w, h);
  if (short < 600) return "phone";
  if (coarse && long < 1400) return "tablet";
  if (!coarse && w < 860) return "phone";
  return "desktop";
}

export function getChromePhase(): ChromePhase {
  return snap.phase;
}

export function getChromeSnapshot(): ChromeSnap {
  return snap;
}

export function subscribeChrome(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function useChromePhase(): ChromePhase {
  const current = useSyncExternalStore(subscribeChrome, getChromeSnapshot, getChromeSnapshot);
  return current.phase;
}

export function useChromeSnapshot(): ChromeSnap {
  return useSyncExternalStore(subscribeChrome, getChromeSnapshot, getChromeSnapshot);
}

export const TABLET_INSPECTOR_PANES = ["layers", "colors", "history"] as const;
export type TabletInspectorPane = (typeof TABLET_INSPECTOR_PANES)[number];

export function tabletInspectorPane(app: AppState): TabletInspectorPane | null {
  for (const k of TABLET_INSPECTOR_PANES) {
    if (app.windows[k]) return k;
  }
  return null;
}

/** Show one Layers/Color/History pane, or none. Used on tablet so the drawer never stacks. */
export function setTabletInspectorPane(app: AppState, pane: TabletInspectorPane | null): void {
  let changed = false;
  for (const k of TABLET_INSPECTOR_PANES) {
    const next = k === pane;
    if (app.windows[k] !== next) {
      app.windows[k] = next;
      changed = true;
    }
  }
  if (changed) app.notify("windows");
}

function syncTabletWindows(app: AppState): void {
  setTabletInspectorPane(app, tabletInspectorPane(app));
}

function syncFingerMode(app: AppState, phase: ChromePhase): void {
  const next = phase === "tablet" ? "pan" : "draw";
  if (app.options.touchFingerMode !== next) {
    app.options.touchFingerMode = next;
    app.notify("tool");
  }
}

export function applyChromePhase(win: Window = window, app?: AppState): ChromePhase {
  const coarse = mediaMatches("(pointer: coarse)", win);
  const w = win.innerWidth;
  const h = win.innerHeight;
  const phase = chromePhase(win);
  const pointer: PointerKind = coarse ? "coarse" : "fine";
  const orient: ChromeOrient = w > h ? "landscape" : "portrait";
  const short = h <= 520;
  const root = win.document.documentElement;
  const prev = snap.phase;
  root.dataset.chrome = phase;
  root.dataset.pointer = pointer;
  root.dataset.chromeOrient = orient;
  if (short) root.dataset.chromeShort = "";
  else delete root.dataset.chromeShort;

  const changed =
    snap.phase !== phase || snap.pointer !== pointer || snap.orient !== orient || snap.short !== short;
  if (changed) {
    snap = { phase, pointer, orient, short, version: snap.version + 1 };
    emit();
  }

  if (app && prev !== phase) {
    if (phase === "tablet") syncTabletWindows(app);
    syncFingerMode(app, phase);
  }
  return phase;
}

let unbindChrome: (() => void) | null = null;

export function bindChromePhase(app?: AppState, win: Window = window): () => void {
  unbindChrome?.();
  const apply = () => applyChromePhase(win, app);
  apply();
  win.addEventListener("resize", apply);
  const mq = typeof win.matchMedia === "function" ? win.matchMedia("(pointer: coarse)") : null;
  mq?.addEventListener("change", apply);
  unbindChrome = () => {
    win.removeEventListener("resize", apply);
    mq?.removeEventListener("change", apply);
    unbindChrome = null;
  };
  return unbindChrome;
}
