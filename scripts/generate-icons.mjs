/**
 * Generate PWA PNG icons without extra dependencies.
 * Draws a paint.web mark into a raw RGBA buffer and writes PNG via zlib.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dir, "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcBuf));
  return Buffer.concat([len, t, data, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function setPx(buf, size, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * 4;
  buf[i] = r;
  buf[i + 1] = g;
  buf[i + 2] = b;
  buf[i + 3] = a;
}

function fillCircle(buf, size, cx, cy, rad, r, g, b, a = 255) {
  const r2 = rad * rad;
  const x0 = Math.max(0, Math.floor(cx - rad));
  const y0 = Math.max(0, Math.floor(cy - rad));
  const x1 = Math.min(size - 1, Math.ceil(cx + rad));
  const y1 = Math.min(size - 1, Math.ceil(cy + rad));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2;
      if (d <= r2) setPx(buf, size, x, y, r, g, b, a);
    }
  }
}

function strokeCircle(buf, size, cx, cy, rad, thickness, r, g, b) {
  const outer = (rad + thickness / 2) ** 2;
  const inner = (rad - thickness / 2) ** 2;
  const x0 = Math.max(0, Math.floor(cx - rad - thickness));
  const y0 = Math.max(0, Math.floor(cy - rad - thickness));
  const x1 = Math.min(size - 1, Math.ceil(cx + rad + thickness));
  const y1 = Math.min(size - 1, Math.ceil(cy + rad + thickness));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2;
      if (d <= outer && d >= inner) setPx(buf, size, x, y, r, g, b);
    }
  }
}

function strokeLine(buf, size, x0, y0, x1, y1, thickness, r, g, b) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const steps = Math.ceil(len * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    fillCircle(buf, size, x0 + dx * t, y0 + dy * t, thickness / 2, r, g, b);
  }
}

function roundedRect(buf, size, pad, radius, r, g, b) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const rx = Math.min(x - pad, size - 1 - pad - x);
      const ry = Math.min(y - pad, size - 1 - pad - y);
      if (rx < 0 || ry < 0) continue;
      if (rx < radius && ry < radius) {
        const dx = radius - rx;
        const dy = radius - ry;
        if (dx * dx + dy * dy > radius * radius) continue;
      }
      setPx(buf, size, x, y, r, g, b);
    }
  }
}

function drawIcon(size, maskable) {
  const buf = Buffer.alloc(size * size * 4);
  const pad = maskable ? Math.round(size * 0.12) : 0;
  const inner = size - pad * 2;
  roundedRect(buf, size, pad, Math.round(inner * 0.18), 43, 43, 43);
  const cx = pad + inner * 0.44;
  const cy = pad + inner * 0.44;
  const ringR = inner * 0.26;
  strokeCircle(buf, size, cx, cy, ringR, inner * 0.07, 245, 155, 34);
  fillCircle(buf, size, cx, cy, inner * 0.11, 59, 130, 246);
  const x0 = pad + inner * 0.58;
  const y0 = pad + inner * 0.58;
  const x1 = pad + inner * 0.86;
  const y1 = pad + inner * 0.86;
  strokeLine(buf, size, x0, y0, x1, y1, inner * 0.09, 232, 232, 232);
  strokeLine(buf, size, x1 - inner * 0.04, y1 - inner * 0.04, x1 + inner * 0.02, y1 + inner * 0.02, inner * 0.09, 196, 90, 0);
  return buf;
}

function write(name, size, maskable) {
  const png = encodePng(size, size, drawIcon(size, maskable));
  writeFileSync(join(outDir, name), png);
  console.log("wrote", name, png.length, "bytes");
}

write("icon-192.png", 192, false);
write("icon-512.png", 512, false);
write("icon-maskable-192.png", 192, true);
write("icon-maskable-512.png", 512, true);
write("apple-touch-icon.png", 180, false);
