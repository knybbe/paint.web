import type { ToolId } from "../tools/base";

const S = `stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"`;

/** 24×24 Paint.NET-style tool glyphs: color fills + currentColor outlines for theme contrast. */
export const TOOL_SVG: Record<ToolId, string> = {
  rectangleSelect: icon(`
    <rect x="3.5" y="3.5" width="17" height="17" rx="1" ${S} stroke-dasharray="3 2"/>
    <rect x="3" y="3" width="3" height="3" fill="#f8fafc" stroke="#0f172a" stroke-width="0.8"/>
    <rect x="18" y="3" width="3" height="3" fill="#f8fafc" stroke="#0f172a" stroke-width="0.8"/>
    <rect x="3" y="18" width="3" height="3" fill="#f8fafc" stroke="#0f172a" stroke-width="0.8"/>
    <rect x="18" y="18" width="3" height="3" fill="#f8fafc" stroke="#0f172a" stroke-width="0.8"/>
  `),
  lassoSelect: icon(`
    <path d="M6 16c1.2-6.5 8.5-9 11-4.2 1.6 3.2-2.6 5.4-5.2 3.4 1.8 4.2 6.4 2.4 7.2-1" ${S} stroke-dasharray="3 2"/>
    <path d="M5.2 16.2c-.8 1.6.2 3.6 2.2 3.8 1.6.2 2.6-1 2.4-2.2" stroke="#c4a574" stroke-width="2" fill="none"/>
    <circle cx="6.2" cy="18.6" r="1.5" fill="#e8d5a3" stroke="#8a6a32" stroke-width="1"/>
  `),
  ellipseSelect: icon(`
    <ellipse cx="12" cy="12" rx="8.5" ry="7" ${S} stroke-dasharray="3 2"/>
    <rect x="10.5" y="4" width="3" height="3" fill="#f8fafc" stroke="#0f172a" stroke-width="0.8"/>
    <rect x="19.5" y="10.5" width="3" height="3" fill="#f8fafc" stroke="#0f172a" stroke-width="0.8"/>
    <rect x="10.5" y="17" width="3" height="3" fill="#f8fafc" stroke="#0f172a" stroke-width="0.8"/>
    <rect x="1.5" y="10.5" width="3" height="3" fill="#f8fafc" stroke="#0f172a" stroke-width="0.8"/>
  `),
  magicWand: icon(`
    <path d="M7 20.5 L14.2 9.2" stroke="#8b5a2b" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M7 20.5 L14.2 9.2" stroke="#d4a574" stroke-width="1.1" stroke-linecap="round"/>
    <path d="M15.2 3.2l1.15 3.15 3.3.35-2.55 2.15.8 3.25-2.9-1.7-2.9 1.7.8-3.25-2.55-2.15 3.3-.35z" fill="#ffe566" stroke="#c9a227" stroke-width="1.1" stroke-linejoin="round"/>
    <circle cx="18.6" cy="6.2" r="0.9" fill="#fff8c8"/>
  `),
  movePixels: icon(`
    <path d="M12 2.5v19M2.5 12h19" ${S} stroke-width="2"/>
    <path d="M12 2.2l-3.2 3.4h6.4zM12 21.8l-3.2-3.4h6.4zM2.2 12l3.4-3.2v6.4zM21.8 12l-3.4-3.2v6.4z" fill="currentColor"/>
  `),
  moveSelection: icon(`
    <rect x="4.5" y="4.5" width="15" height="15" ${S} stroke-dasharray="3 2"/>
    <path d="M12 7.2v9.6M7.2 12h9.6" stroke="#f59b22" stroke-width="2" stroke-linecap="round"/>
    <path d="M12 6.4l-2 2.2h4zM12 17.6l-2-2.2h4zM6.4 12l2.2-2v4zM17.6 12l-2.2-2v4z" fill="#f59b22"/>
  `),
  zoom: icon(`
    <circle cx="10" cy="10" r="6.2" fill="#93c5fd" fill-opacity=".35" stroke="currentColor" stroke-width="2"/>
    <circle cx="10" cy="10" r="3.4" fill="#bfdbfe" fill-opacity=".55"/>
    <path d="M14.8 14.8 L21 21" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
  `),
  pan: icon(`
    <path d="M9.2 11.2V6.2a1.4 1.4 0 012.8 0v5M12 11.2V5.6a1.4 1.4 0 012.8 0v6.4M14.8 11.6v-3a1.4 1.4 0 012.8 0V14a5.2 5.2 0 01-5.2 5.2h-1.4A5.4 5.4 0 016 13.8V9.4a1.4 1.4 0 012.8 0v1.8" fill="#fde68a" stroke="#b45309" stroke-width="1.5" stroke-linejoin="round"/>
  `),
  paintBucket: icon(`
    <path d="M4.5 9.2l6.4-6 7.2 7.2-6.6 9.2z" fill="#60a5fa" stroke="#1e3a8a" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M5.4 9.6h11.2" stroke="#1e3a8a" stroke-width="1.2"/>
    <path d="M10.8 3.6l6.8 6.8" stroke="#dbeafe" stroke-width="1.2"/>
    <path d="M13.6 19.6c1.6 2.4 4.6 2.2 4.8-.2" stroke="#3b82f6" stroke-width="2" fill="none" stroke-linecap="round"/>
    <circle cx="16.4" cy="21.2" r="1.15" fill="#2563eb"/>
  `),
  gradient: icon(`
    <defs>
      <linearGradient id="pdn-tool-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff"/>
        <stop offset="0.35" stop-color="#38bdf8"/>
        <stop offset="0.7" stop-color="#2563eb"/>
        <stop offset="1" stop-color="#1e3a8a"/>
      </linearGradient>
    </defs>
    <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" fill="url(#pdn-tool-grad)" stroke="currentColor" stroke-width="1.5"/>
  `),
  paintbrush: icon(`
    <path d="M4 20.2c2.4-1.2 3.6-3.4 4.8-5.2L18.6 5.2l2.2 2.2-9.6 9.6c-1.6 1.6-3.8 2.6-5.4 4.2z" fill="#ea580c" stroke="#7c2d12" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M17.8 4.4l3.8 3.8" stroke="#fed7aa" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M4.4 19.6c.8-.2 1.6.4 1.2 1.2-.8 1.4-2.6.6-2.2-.6.2-.4.6-.6 1-.6z" fill="#7c2d12"/>
  `),
  eraser: icon(`
    <path d="M4.2 13.6 12.4 5.4a2 2 0 012.8 0l3.4 3.4a2 2 0 010 2.8l-8.2 8.2H6.2z" fill="#fda4af" stroke="#9f1239" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M6.6 16.2h10.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M8.2 11.2l4.8-4.8 3.2 3.2-4.8 4.8z" fill="#fff1f2"/>
  `),
  pencil: icon(`
    <path d="M4 20.2l2.4-1.2 12-12 1.8 1.8-12 12z" fill="#facc15" stroke="#854d0e" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M16.6 5.2l2.2 2.2 1.5-1.5a1.2 1.2 0 000-1.7L19 3.4a1.2 1.2 0 00-1.7 0z" fill="#fb7185" stroke="#9f1239" stroke-width="1"/>
    <path d="M4 20.2l1.4-2.6 1.4 1.2z" fill="#44403c"/>
    <path d="M7.2 16.6l9.6-9.6" stroke="#fde68a" stroke-width="1.1"/>
  `),
  colorPicker: icon(`
    <path d="M5 19c3.6-6.6 9.4-9.2 11.2-4.6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M14.4 6.2l3.4 3.4 2-2a2.1 2.1 0 00-3-3z" fill="#e2e8f0" stroke="#334155" stroke-width="1.3"/>
    <circle cx="16.8" cy="6.6" r="2.4" fill="#ef4444" stroke="#7f1d1d" stroke-width="1.2"/>
    <circle cx="16.8" cy="6.6" r="0.9" fill="#fecaca"/>
  `),
  cloneStamp: icon(`
    <rect x="4" y="13" width="16" height="7.2" rx="1.4" fill="#94a3b8" stroke="#1e293b" stroke-width="1.4"/>
    <rect x="8.2" y="4.2" width="7.6" height="10" rx="1.2" fill="#cbd5e1" stroke="#1e293b" stroke-width="1.4"/>
    <rect x="9.4" y="5.4" width="5.2" height="3.2" rx=".6" fill="#64748b"/>
    <path d="M5.2 16.2h13.6" stroke="#e2e8f0" stroke-width="1.1"/>
  `),
  recolor: icon(`
    <circle cx="8.4" cy="12" r="6.2" fill="#3b82f6" stroke="#1e3a8a" stroke-width="1.3"/>
    <circle cx="15.6" cy="12" r="6.2" fill="#ef4444" stroke="#7f1d1d" stroke-width="1.3"/>
    <path d="M12 7.4a6.2 6.2 0 000 9.2" fill="#a855f7" fill-opacity=".9"/>
  `),
  text: icon(`
    <path d="M5 5.2h14M12 5.2v14.2M7.2 19.4h9.6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M5 5.2h14" stroke="#f59b22" stroke-width="2.2" stroke-linecap="round"/>
  `),
  lineCurve: icon(`
    <path d="M3.6 18.6C7.2 5.5 16.8 5.5 20.4 18.6" ${S} stroke-width="2.1"/>
    <circle cx="3.6" cy="18.6" r="1.7" fill="#f59b22" stroke="#7c2d12" stroke-width="1"/>
    <circle cx="8.6" cy="9.2" r="1.7" fill="#f8fafc" stroke="#0f172a" stroke-width="1"/>
    <circle cx="15.4" cy="9.2" r="1.7" fill="#f8fafc" stroke="#0f172a" stroke-width="1"/>
    <circle cx="20.4" cy="18.6" r="1.7" fill="#f59b22" stroke="#7c2d12" stroke-width="1"/>
  `),
  rectangle: icon(`
    <rect x="3.5" y="5.5" width="17" height="13" fill="#7dd3fc" stroke="#1d4ed8" stroke-width="1.7"/>
  `),
  roundedRectangle: icon(`
    <rect x="3.5" y="5.5" width="17" height="13" rx="4" fill="#7dd3fc" stroke="#1d4ed8" stroke-width="1.7"/>
  `),
  ellipse: icon(`
    <ellipse cx="12" cy="12" rx="8.6" ry="6.4" fill="#7dd3fc" stroke="#1d4ed8" stroke-width="1.7"/>
  `),
  freeform: icon(`
    <path d="M4.2 16.4c2.2-8 6.4-9.4 9-4.2 2.2 4.2 3.4-2.4 4.4-2.6.6 3.8 2 7.4 2 7.4H4.2z" fill="#7dd3fc" stroke="#1d4ed8" stroke-width="1.6" stroke-linejoin="round"/>
  `),
};

function icon(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">${inner}</svg>`;
}

export const UI_ICONS: Record<string, string> = {
  new: icon(
    `<rect x="5" y="2.8" width="13" height="18.4" rx="1.2" fill="#f8fafc" stroke="currentColor" stroke-width="1.5"/>
     <path d="M12 2.8v5.2h6" fill="none" stroke="currentColor" stroke-width="1.5"/>
     <path d="M8.4 14h7.2M12 10.4v7.2" stroke="#16a34a" stroke-width="1.7" stroke-linecap="round"/>`,
  ),
  open: icon(
    `<path d="M3 19.4V7.6h5.2l2-2.4H21v14.2z" fill="#fbbf24" stroke="#92400e" stroke-width="1.5" stroke-linejoin="round"/>
     <path d="M3 19.4l2.4-8h16.2l-1.6 8z" fill="#fde68a" stroke="#92400e" stroke-width="1.4"/>`,
  ),
  save: icon(
    `<rect x="3.6" y="2.8" width="16.8" height="18.4" rx="1.6" fill="#3b82f6" stroke="#1e3a8a" stroke-width="1.4"/>
     <rect x="7" y="13.2" width="10" height="7.2" fill="#dbeafe"/>
     <rect x="7.4" y="4.2" width="9.2" height="6.2" fill="#93c5fd"/>`,
  ),
  download: icon(
    `<path d="M12 3.5v10.5m0 0l-3.8-3.8m3.8 3.8l3.8-3.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
     <path d="M4.5 17.5v1.2a1.8 1.8 0 001.8 1.8h11.4a1.8 1.8 0 001.8-1.8v-1.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  ),
  sync: icon(
    `<path d="M4 12a8 8 0 0114.93-4M20 12a8 8 0 01-14.93 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
     <path d="M19 4v4h-4M5 20v-4h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  undo: icon(
    `<path d="M5.2 11.2h10.2a4 4 0 010 8H12" ${S} stroke-width="2"/>
     <path d="M5.2 11.2l4-4M5.2 11.2l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  ),
  redo: icon(
    `<path d="M18.8 11.2H8.6a4 4 0 000 8H12" ${S} stroke-width="2"/>
     <path d="M18.8 11.2l-4-4M18.8 11.2l-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  ),
  cut: icon(
    `<circle cx="7.2" cy="16.6" r="3.1" fill="none" stroke="currentColor" stroke-width="1.7"/>
     <circle cx="16.8" cy="16.6" r="3.1" fill="none" stroke="currentColor" stroke-width="1.7"/>
     <path d="M9.4 14.8 L18.4 4.4 M14.6 14.8 L5.6 4.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>`,
  ),
  copy: icon(
    `<rect x="3.6" y="7.2" width="11.2" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/>
     <rect x="8.4" y="3.8" width="11.2" height="13" rx="1" fill="#e2e8f0" stroke="currentColor" stroke-width="1.6"/>`,
  ),
  paste: icon(
    `<rect x="5.2" y="6" width="13.6" height="15.2" rx="1.2" fill="#f8fafc" stroke="currentColor" stroke-width="1.5"/>
     <rect x="8.4" y="3" width="7.2" height="4.4" rx="1" fill="#cbd5e1" stroke="currentColor" stroke-width="1.3"/>`,
  ),
  crop: icon(
    `<path d="M7.2 3v13.6H21M3 7.2h13.6V21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  ),
  addLayer: icon(
    `<rect x="3.6" y="5.6" width="16.8" height="13" rx="1" fill="#f8fafc" stroke="currentColor" stroke-width="1.4"/>
     <path d="M12 8.6v7.2M8.4 12.2h7.2" stroke="#22c55e" stroke-width="2" stroke-linecap="round"/>`,
  ),
  deleteLayer: icon(
    `<rect x="3.6" y="5.6" width="16.8" height="13" rx="1" fill="#f8fafc" stroke="currentColor" stroke-width="1.4"/>
     <path d="M8.2 12.2h7.6" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>`,
  ),
  duplicateLayer: icon(
    `<rect x="2.8" y="7.4" width="13.2" height="11.2" rx="1" fill="#f8fafc" stroke="currentColor" stroke-width="1.3"/>
     <rect x="8" y="4.4" width="13.2" height="11.2" rx="1" fill="#dbeafe" stroke="currentColor" stroke-width="1.3"/>`,
  ),
  merge: icon(
    `<rect x="4.2" y="3.8" width="15.6" height="6.4" rx=".8" fill="#f8fafc" stroke="currentColor" stroke-width="1.3"/>
     <rect x="4.2" y="13.8" width="15.6" height="6.4" rx=".8" fill="#f8fafc" stroke="currentColor" stroke-width="1.3"/>
     <path d="M12 10.2v3.6" stroke="currentColor" stroke-width="1.7"/>`,
  ),
  flatten: icon(
    `<path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  ),
  eye: icon(
    `<ellipse cx="12" cy="12" rx="9" ry="5.4" fill="#e2e8f0" stroke="currentColor" stroke-width="1.5"/>
     <circle cx="12" cy="12" r="2.5" fill="#0f172a"/>
     <circle cx="12.8" cy="11.2" r=".8" fill="#f8fafc"/>`,
  ),
  eyeOff: icon(
    `<ellipse cx="12" cy="12" rx="9" ry="5.4" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".55"/>
     <path d="M4 19.2 L20 4.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  ),
  lock: icon(
    `<rect x="5.4" y="10.4" width="13.2" height="9.2" rx="1.4" fill="#fbbf24" stroke="#92400e" stroke-width="1.4"/>
     <path d="M8.2 10.4V7.6a3.8 3.8 0 017.6 0v2.8" fill="none" stroke="#92400e" stroke-width="1.6"/>`,
  ),
  swap: icon(
    `<path d="M5 8.4h14l-3.2-3.2M19 15.6H5l3.2 3.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  close: icon(`<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`),
  check: icon(`<path d="M4.4 12.2l5 5 10.2-10.4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`),
  fit: icon(
    `<rect x="3.5" y="5.5" width="17" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/>
     <rect x="7" y="8" width="10" height="8" fill="#93c5fd" fill-opacity=".45" stroke="currentColor" stroke-width="1.4"/>
     <path d="M7 8l-2.2-2.2M17 8l2.2-2.2M7 16l-2.2 2.2M17 16l2.2 2.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
  ),
  zoomIn: icon(
    `<circle cx="10" cy="10" r="6.2" fill="none" stroke="currentColor" stroke-width="1.8"/>
     <path d="M10 7v6M7 10h6M14.8 14.8L21 21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  ),
  zoomOut: icon(
    `<circle cx="10" cy="10" r="6.2" fill="none" stroke="currentColor" stroke-width="1.8"/>
     <path d="M7 10h6M14.8 14.8L21 21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  ),
  rotate: icon(
    `<path d="M20 11a8 8 0 10-2.4 5.7M20 11V5M20 11h-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  flip: icon(
    `<path d="M12 3v18M18 17l-4-5 4-5M6 17l4-5-4-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  resize: icon(
    `<rect x="3.5" y="3.5" width="17" height="17" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2"/>
     <path d="M9 15l6-6M15 13.5V9h-4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  fx: icon(
    `<path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z" fill="#facc15" stroke="#ca8a04" stroke-width="1.2"/>
     <path d="M18 16l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="#60a5fa" stroke="#2563eb" stroke-width="0.8"/>`,
  ),
  palette: icon(
    `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/>
     <circle cx="8" cy="10" r="1.5" fill="#ef4444"/>
     <circle cx="12" cy="7.5" r="1.5" fill="#3b82f6"/>
     <circle cx="16" cy="10" r="1.5" fill="#22c55e"/>
     <circle cx="14" cy="15" r="1.5" fill="#eab308"/>`,
  ),
  layers: icon(
    `<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  more: icon(
    `<circle cx="6" cy="12" r="1.8" fill="currentColor"/>
     <circle cx="12" cy="12" r="1.8" fill="currentColor"/>
     <circle cx="18" cy="12" r="1.8" fill="currentColor"/>`,
  ),
  search: icon(
    `<circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/>
     <path d="M16 16l5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  ),
  settings: icon(
    `<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/>
     <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" fill="none" stroke="currentColor" stroke-width="1.6"/>`,
  ),
  sun: icon(
    `<circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/>
     <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
  ),
  moon: icon(
    `<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" fill="none" stroke="currentColor" stroke-width="1.8"/>`,
  ),
  monitor: icon(
    `<rect x="3" y="4" width="18" height="13" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/>
     <path d="M8 21h8M12 17v4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  ),
  deselect: icon(
    `<rect x="3.5" y="3.5" width="17" height="17" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2"/>
     <path d="M7 7l10 10" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>`,
  ),
  grid: icon(
    `<rect x="3" y="3" width="18" height="18" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/>
     <path d="M9 3v18M15 3v18M3 9h18M3 15h18" stroke="currentColor" stroke-width="1.2"/>`,
  ),
  ruler: icon(
    `<rect x="2" y="7" width="20" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/>
     <path d="M6 7v4M10 7v3M14 7v4M18 7v3" stroke="currentColor" stroke-width="1.4"/>`,
  ),
  history: icon(
    `<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/>
     <path d="M12 7v5l3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
     <path d="M4.5 9L3 5h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
  ),
  arrowUp: icon(`<path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`),
  arrowDown: icon(`<path d="M12 5v14M19 12l-7 7-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`),
};

export function svgEl(svg: string, className?: string): HTMLElement {
  const wrap = document.createElement("span");
  wrap.className = className ? `icon ${className}` : "icon";
  wrap.innerHTML = svg;
  return wrap;
}
