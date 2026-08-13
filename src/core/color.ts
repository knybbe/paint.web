export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface Hsv {
  h: number;
  s: number;
  v: number;
  a: number;
}

export function rgba(r: number, g: number, b: number, a = 255): Color {
  return {
    r: r < 0 ? 0 : r > 255 ? 255 : r,
    g: g < 0 ? 0 : g > 255 ? 255 : g,
    b: b < 0 ? 0 : b > 255 ? 255 : b,
    a: a < 0 ? 0 : a > 255 ? 255 : a,
  };
}

export function rgb(r: number, g: number, b: number): Color {
  return rgba(r, g, b, 255);
}

export const Colors = {
  transparent: rgba(0, 0, 0, 0),
  black: rgb(0, 0, 0),
  white: rgb(255, 255, 255),
  red: rgb(255, 0, 0),
  green: rgb(0, 255, 0),
  blue: rgb(0, 0, 255),
} as const;

export function cloneColor(c: Color): Color {
  return { r: c.r, g: c.g, b: c.b, a: c.a };
}

export function colorsEqual(a: Color, b: Color): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}

export function colorDistance(a: Color, b: Color): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  const da = a.a - b.a;
  return Math.sqrt(dr * dr + dg * dg + db * db + da * da);
}

/** Paint.NET-style tolerance: 0–100 mapped to Euclidean RGBA distance. */
export function withinTolerance(a: Color, b: Color, tolerance: number): boolean {
  const max = Math.sqrt(255 * 255 * 4);
  const t = (Math.max(0, Math.min(100, tolerance)) / 100) * max;
  return colorDistance(a, b) <= t + 1e-6;
}

export function rgbToHsv(c: Color): Hsv {
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max, a: c.a };
}

export function hsvToRgb(h: number, s: number, v: number, a = 255): Color {
  const hh = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = v - c;
  let rp = 0,
    gp = 0,
    bp = 0;
  if (hh < 60) [rp, gp, bp] = [c, x, 0];
  else if (hh < 120) [rp, gp, bp] = [x, c, 0];
  else if (hh < 180) [rp, gp, bp] = [0, c, x];
  else if (hh < 240) [rp, gp, bp] = [0, x, c];
  else if (hh < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return rgba(Math.round((rp + m) * 255), Math.round((gp + m) * 255), Math.round((bp + m) * 255), a);
}

export function toHex(c: Color, withAlpha = false): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return withAlpha ? `#${h(c.r)}${h(c.g)}${h(c.b)}${h(c.a)}` : `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

export function fromHex(hex: string): Color | null {
  const s = hex.trim().replace(/^#/, "");
  if (s.length === 3) {
    const r = parseInt(s[0] + s[0], 16);
    const g = parseInt(s[1] + s[1], 16);
    const b = parseInt(s[2] + s[2], 16);
    if (Number.isNaN(r + g + b)) return null;
    return rgb(r, g, b);
  }
  if (s.length === 6 || s.length === 8) {
    const r = parseInt(s.slice(0, 2), 16);
    const g = parseInt(s.slice(2, 4), 16);
    const b = parseInt(s.slice(4, 6), 16);
    const a = s.length === 8 ? parseInt(s.slice(6, 8), 16) : 255;
    if (Number.isNaN(r + g + b + a)) return null;
    return rgba(r, g, b, a);
  }
  return null;
}

export function cssRgba(c: Color): string {
  return `rgba(${c.r | 0},${c.g | 0},${c.b | 0},${c.a / 255})`;
}

export function lerpColor(a: Color, b: Color, t: number): Color {
  return rgba(
    Math.round(a.r + (b.r - a.r) * t),
    Math.round(a.g + (b.g - a.g) * t),
    Math.round(a.b + (b.b - a.b) * t),
    Math.round(a.a + (b.a - a.a) * t),
  );
}

export function luminance(c: Color): number {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

export function invertColor(c: Color): Color {
  return rgba(255 - c.r, 255 - c.g, 255 - c.b, c.a);
}

/** Classic Paint.NET default palette (32 slots). */
export const DEFAULT_PALETTE: Color[] = [
  rgb(0, 0, 0),
  rgb(64, 64, 64),
  rgb(127, 127, 127),
  rgb(191, 191, 191),
  rgb(255, 255, 255),
  rgb(255, 0, 0),
  rgb(255, 127, 0),
  rgb(255, 255, 0),
  rgb(127, 255, 0),
  rgb(0, 255, 0),
  rgb(0, 255, 127),
  rgb(0, 255, 255),
  rgb(0, 127, 255),
  rgb(0, 0, 255),
  rgb(127, 0, 255),
  rgb(255, 0, 255),
  rgb(128, 0, 0),
  rgb(128, 64, 0),
  rgb(128, 128, 0),
  rgb(64, 128, 0),
  rgb(0, 128, 0),
  rgb(0, 128, 64),
  rgb(0, 128, 128),
  rgb(0, 64, 128),
  rgb(0, 0, 128),
  rgb(64, 0, 128),
  rgb(128, 0, 128),
  rgb(128, 0, 64),
  rgb(255, 128, 128),
  rgb(255, 192, 128),
  rgb(255, 255, 128),
  rgb(128, 255, 255),
];
