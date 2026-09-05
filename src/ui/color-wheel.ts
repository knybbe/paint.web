import type { AppState } from "../app-state";
import { hsvToRgb, rgbToHsv } from "../core/color";

export function drawColorWheel(canvas: HTMLCanvasElement, hsv: { h: number; s: number; v: number }): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const outer = w / 2 - 2;
  const inner = outer - 16;
  const img = ctx.createImageData(w, h);
  const data = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const r = Math.hypot(dx, dy);
      const i = (y * w + x) * 4;
      if (r <= outer && r >= inner) {
        let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (ang < 0) ang += 360;
        const c = hsvToRgb(ang, 1, 1);
        data[i] = c.r;
        data[i + 1] = c.g;
        data[i + 2] = c.b;
        data[i + 3] = 255;
      } else if (r <= inner - 4) {
        const tri = inner - 4;
        const sat = Math.max(0, Math.min(1, (dx / tri + 1) / 2));
        const val = Math.max(0, Math.min(1, 1 - (dy / tri + 1) / 2));
        const c = hsvToRgb(hsv.h, sat, val);
        data[i] = c.r;
        data[i + 1] = c.g;
        data[i + 2] = c.b;
        data[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  const tri = inner - 4;
  const hx = cx + Math.cos((hsv.h * Math.PI) / 180) * ((inner + outer) / 2);
  const hy = cy + Math.sin((hsv.h * Math.PI) / 180) * ((inner + outer) / 2);
  ctx.strokeStyle = "#000";
  ctx.beginPath();
  ctx.arc(hx, hy, 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#fff";
  ctx.beginPath();
  ctx.arc(hx, hy, 5, 0, Math.PI * 2);
  ctx.stroke();
  const sx = cx + (hsv.s * 2 - 1) * tri;
  const sy = cy + (1 - hsv.v) * 2 * tri - tri;
  ctx.strokeStyle = "#000";
  ctx.strokeRect(sx - 3, sy - 3, 6, 6);
  ctx.strokeStyle = "#fff";
  ctx.strokeRect(sx - 4, sy - 4, 8, 8);
}

export function pickColorWheel(e: PointerEvent, canvas: HTMLCanvasElement, app: AppState): void {
  const r = canvas.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * canvas.width;
  const y = ((e.clientY - r.top) / r.height) * canvas.height;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const dx = x - cx;
  const dy = y - cy;
  const rad = Math.hypot(dx, dy);
  const outer = canvas.width / 2 - 2;
  const inner = outer - 16;
  const cur = rgbToHsv(app.activeColor === "primary" ? app.primary : app.secondary);
  if (rad >= inner && rad <= outer) {
    let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (ang < 0) ang += 360;
    if (e.shiftKey) ang = Math.round(ang / 15) * 15;
    const next = hsvToRgb(ang, cur.s, cur.v, cur.a);
    if (e.button === 2 || e.buttons & 2) app.setSecondary(next);
    else app.setActiveColorValue(next);
    return;
  }
  const tri = inner - 4;
  if (rad <= tri) {
    const sat = clamp01((dx / tri + 1) / 2);
    const val = clamp01(1 - (dy / tri + 1) / 2);
    const c = hsvToRgb(cur.h, sat, val, cur.a);
    if (e.button === 2 || e.buttons & 2) app.setSecondary(c);
    else app.setActiveColorValue(c);
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
