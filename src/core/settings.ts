import type { Color } from "./color";
import { DEFAULT_PALETTE, rgb } from "./color";
import type { ThemePref } from "./theme";

export type ThemeName = ThemePref;

export interface AppSettings {
  theme: ThemeName;
  defaultWidth: number;
  defaultHeight: number;
  defaultDpi: number;
  defaultBackground: "White" | "Black" | "Transparent";
  showRulers: boolean;
  showPixelGrid: boolean;
  showStatusBar: boolean;
  antialias: boolean;
  historyLimit: number;
  palette: Color[];
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  defaultWidth: 800,
  defaultHeight: 600,
  defaultDpi: 96,
  defaultBackground: "White",
  showRulers: true,
  showPixelGrid: true,
  showStatusBar: true,
  antialias: true,
  historyLimit: 80,
  palette: DEFAULT_PALETTE.map((c) => ({ ...c })),
};

export const PRIMARY_DEFAULT = rgb(0, 0, 0);
export const SECONDARY_DEFAULT = rgb(255, 255, 255);
