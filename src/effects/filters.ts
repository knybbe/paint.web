import { hsvToRgb } from "../core/color";
import { clamp } from "../core/geometry";
import { PixelBuffer } from "../core/pixel-buffer";
import { type EffectDef, mapSelected, num, sample } from "./base";

function gaussianKernel(radius: number): number[] {
  const sigma = Math.max(0.4, radius / 2);
  const size = Math.max(1, Math.ceil(radius) * 2 + 1);
  const half = (size - 1) / 2;
  const k: number[] = [];
  let sum = 0;
  for (let i = 0; i < size; i++) {
    const x = i - half;
    const v = Math.exp(-(x * x) / (2 * sigma * sigma));
    k.push(v);
    sum += v;
  }
  return k.map((v) => v / sum);
}

function convolveSep(src: PixelBuffer, kernel: number[]): PixelBuffer {
  const half = (kernel.length - 1) / 2;
  const tmp = src.clone();
  const w = src.width;
  const h = src.height;
  // horizontal
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let k = 0; k < kernel.length; k++) {
        const [sr, sg, sb, sa] = sample(src, x + k - half, y);
        const wt = kernel[k];
        r += sr * wt;
        g += sg * wt;
        b += sb * wt;
        a += sa * wt;
      }
      tmp.setPixel(x, y, { r, g, b, a });
    }
  }
  const dest = src.clone();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let k = 0; k < kernel.length; k++) {
        const [sr, sg, sb, sa] = sample(tmp, x, y + k - half);
        const wt = kernel[k];
        r += sr * wt;
        g += sg * wt;
        b += sb * wt;
        a += sa * wt;
      }
      dest.setPixel(x, y, { r, g, b, a });
    }
  }
  return dest;
}

export const gaussianBlur: EffectDef = {
  id: "gaussianBlur",
  name: "Gaussian Blur",
  menu: "Blurs",
  params: [{ key: "radius", label: "Radius", type: "range", min: 1, max: 50, step: 1, value: 2 }],
  apply(src, p) {
    return convolveSep(src, gaussianKernel(num(p, "radius", 2)));
  },
};

export const motionBlur: EffectDef = {
  id: "motionBlur",
  name: "Motion Blur",
  menu: "Blurs",
  params: [
    { key: "angle", label: "Angle", type: "range", min: 0, max: 180, step: 1, value: 0 },
    { key: "distance", label: "Distance", type: "range", min: 1, max: 100, step: 1, value: 10 },
  ],
  apply(src, p) {
    const ang = (num(p, "angle") * Math.PI) / 180;
    const dist = num(p, "distance", 10);
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const dest = src.clone();
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        let r = 0,
          g = 0,
          b = 0,
          a = 0,
          n = 0;
        for (let i = -dist; i <= dist; i++) {
          const [sr, sg, sb, sa] = sample(src, Math.round(x + dx * i), Math.round(y + dy * i));
          r += sr;
          g += sg;
          b += sb;
          a += sa;
          n++;
        }
        dest.setPixel(x, y, { r: r / n, g: g / n, b: b / n, a: a / n });
      }
    }
    return dest;
  },
};

export const radialBlur: EffectDef = {
  id: "radialBlur",
  name: "Radial Blur",
  menu: "Blurs",
  params: [{ key: "amount", label: "Angle", type: "range", min: 1, max: 45, step: 1, value: 8 }],
  apply(src, p) {
    const amount = (num(p, "amount", 8) * Math.PI) / 180;
    const cx = src.width / 2;
    const cy = src.height / 2;
    const dest = src.clone();
    const steps = 12;
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        let r = 0,
          g = 0,
          b = 0,
          a = 0;
        for (let i = 0; i < steps; i++) {
          const t = (i / (steps - 1) - 0.5) * amount;
          const dx = x - cx;
          const dy = y - cy;
          const sx = Math.round(cx + dx * Math.cos(t) - dy * Math.sin(t));
          const sy = Math.round(cy + dx * Math.sin(t) + dy * Math.cos(t));
          const [sr, sg, sb, sa] = sample(src, sx, sy);
          r += sr;
          g += sg;
          b += sb;
          a += sa;
        }
        dest.setPixel(x, y, { r: r / steps, g: g / steps, b: b / steps, a: a / steps });
      }
    }
    return dest;
  },
};

export const sharpen: EffectDef = {
  id: "sharpen",
  name: "Sharpen",
  menu: "Photo",
  params: [{ key: "amount", label: "Amount", type: "range", min: 1, max: 20, step: 1, value: 2 }],
  apply(src, p) {
    const blurred = convolveSep(src, gaussianKernel(num(p, "amount", 2)));
    const amt = 1.4;
    return mapSelected(src, undefined, (r, g, b, a, x, y) => {
      const i = (y * src.width + x) * 4;
      return [
        clamp(r + (r - blurred.data[i]) * amt, 0, 255),
        clamp(g + (g - blurred.data[i + 1]) * amt, 0, 255),
        clamp(b + (b - blurred.data[i + 2]) * amt, 0, 255),
        a,
      ];
    });
  },
};

export const addNoise: EffectDef = {
  id: "addNoise",
  name: "Add Noise",
  menu: "Noise",
  params: [
    { key: "intensity", label: "Intensity", type: "range", min: 0, max: 100, step: 1, value: 50 },
    { key: "color", label: "Color Saturation", type: "range", min: 0, max: 100, step: 1, value: 100 },
    { key: "coverage", label: "Coverage", type: "range", min: 1, max: 100, step: 1, value: 100 },
  ],
  apply(src, p, sel) {
    const intensity = num(p, "intensity", 50);
    const sat = num(p, "color", 100) / 100;
    const cov = num(p, "coverage", 100) / 100;
    return mapSelected(src, sel, (r, g, b, a) => {
      if (Math.random() > cov) return [r, g, b, a];
      const n = (Math.random() * 2 - 1) * intensity;
      const nr = n * sat + n * (1 - sat);
      const ng = (Math.random() * 2 - 1) * intensity * sat + n * (1 - sat);
      const nb = (Math.random() * 2 - 1) * intensity * sat + n * (1 - sat);
      return [r + nr, g + ng, b + nb, a];
    });
  },
};

export const reduceNoise: EffectDef = {
  id: "reduceNoise",
  name: "Reduce Noise",
  menu: "Noise",
  params: [
    { key: "radius", label: "Radius", type: "range", min: 1, max: 8, step: 1, value: 2 },
    { key: "strength", label: "Strength", type: "range", min: 0, max: 100, step: 1, value: 50 },
  ],
  apply(src, p) {
    const radius = num(p, "radius", 2) | 0;
    const strength = num(p, "strength", 50) / 100;
    const dest = src.clone();
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        let r = 0,
          g = 0,
          b = 0,
          a = 0,
          n = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const [sr, sg, sb, sa] = sample(src, x + dx, y + dy);
            r += sr;
            g += sg;
            b += sb;
            a += sa;
            n++;
          }
        }
        const cur = src.getPixel(x, y);
        dest.setPixel(x, y, {
          r: cur.r + (r / n - cur.r) * strength,
          g: cur.g + (g / n - cur.g) * strength,
          b: cur.b + (b / n - cur.b) * strength,
          a: cur.a,
        });
      }
    }
    return dest;
  },
};

export const medianNoise: EffectDef = {
  id: "median",
  name: "Median",
  menu: "Noise",
  params: [{ key: "radius", label: "Radius", type: "range", min: 1, max: 5, step: 1, value: 1 }],
  apply(src, p) {
    const radius = num(p, "radius", 1) | 0;
    const dest = src.clone();
    const rs: number[] = [];
    const gs: number[] = [];
    const bs: number[] = [];
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        rs.length = gs.length = bs.length = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const [sr, sg, sb] = sample(src, x + dx, y + dy);
            rs.push(sr);
            gs.push(sg);
            bs.push(sb);
          }
        }
        rs.sort((a, b) => a - b);
        gs.sort((a, b) => a - b);
        bs.sort((a, b) => a - b);
        const mid = rs.length >> 1;
        dest.setPixel(x, y, { r: rs[mid], g: gs[mid], b: bs[mid], a: src.getPixel(x, y).a });
      }
    }
    return dest;
  },
};

export const oilPainting: EffectDef = {
  id: "oilPainting",
  name: "Oil Painting",
  menu: "Stylize",
  params: [
    { key: "brush", label: "Brush Size", type: "range", min: 1, max: 8, step: 1, value: 3 },
    { key: "coarseness", label: "Coarseness", type: "range", min: 3, max: 20, step: 1, value: 8 },
  ],
  apply(src, p) {
    const radius = num(p, "brush", 3) | 0;
    const levels = num(p, "coarseness", 8) | 0;
    const dest = src.clone();
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const counts = new Array(levels).fill(0);
        const rs = new Array(levels).fill(0);
        const gs = new Array(levels).fill(0);
        const bs = new Array(levels).fill(0);
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const [sr, sg, sb] = sample(src, x + dx, y + dy);
            const inten = Math.min(levels - 1, (((sr + sg + sb) / 3) * levels) / 256);
            const bin = inten | 0;
            counts[bin]++;
            rs[bin] += sr;
            gs[bin] += sg;
            bs[bin] += sb;
          }
        }
        let best = 0;
        for (let i = 1; i < levels; i++) if (counts[i] > counts[best]) best = i;
        const n = Math.max(1, counts[best]);
        dest.setPixel(x, y, { r: rs[best] / n, g: gs[best] / n, b: bs[best] / n, a: src.getPixel(x, y).a });
      }
    }
    return dest;
  },
};

export const emboss: EffectDef = {
  id: "emboss",
  name: "Emboss",
  menu: "Stylize",
  params: [{ key: "angle", label: "Angle", type: "range", min: 0, max: 360, step: 1, value: 45 }],
  apply(src, p) {
    const ang = (num(p, "angle", 45) * Math.PI) / 180;
    const dx = Math.round(Math.cos(ang));
    const dy = Math.round(Math.sin(ang));
    return mapSelected(src, undefined, (_r, _g, _b, a, x, y) => {
      const [r1, g1, b1] = sample(src, x - dx, y - dy);
      const [r2, g2, b2] = sample(src, x + dx, y + dy);
      const v = clamp(128 + (r1 + g1 + b1 - r2 - g2 - b2) / 3, 0, 255);
      return [v, v, v, a];
    });
  },
};

export const edgeDetect: EffectDef = {
  id: "edgeDetect",
  name: "Edge Detect",
  menu: "Stylize",
  params: [],
  apply(src) {
    return mapSelected(src, undefined, (_r, _g, _b, a, x, y) => {
      const gx =
        -sample(src, x - 1, y - 1)[0] +
        sample(src, x + 1, y - 1)[0] +
        -2 * sample(src, x - 1, y)[0] +
        2 * sample(src, x + 1, y)[0] +
        -sample(src, x - 1, y + 1)[0] +
        sample(src, x + 1, y + 1)[0];
      const gy =
        -sample(src, x - 1, y - 1)[0] -
        2 * sample(src, x, y - 1)[0] -
        sample(src, x + 1, y - 1)[0] +
        sample(src, x - 1, y + 1)[0] +
        2 * sample(src, x, y + 1)[0] +
        sample(src, x + 1, y + 1)[0];
      const v = clamp(Math.hypot(gx, gy), 0, 255);
      return [v, v, v, a];
    });
  },
};

export const outline: EffectDef = {
  id: "outline",
  name: "Outline",
  menu: "Stylize",
  params: [
    { key: "thickness", label: "Thickness", type: "range", min: 1, max: 10, step: 1, value: 3 },
    { key: "intensity", label: "Intensity", type: "range", min: 0, max: 100, step: 1, value: 50 },
  ],
  apply(src, p) {
    const t = num(p, "thickness", 3);
    const intensity = num(p, "intensity", 50) / 50;
    return mapSelected(src, undefined, (r, g, b, a, x, y) => {
      const [nr, ng, nb] = sample(src, x + t, y + t);
      const d = Math.abs(r - nr) + Math.abs(g - ng) + Math.abs(b - nb);
      const v = clamp(d * intensity, 0, 255);
      return [v, v, v, a];
    });
  },
};

export const polarInversion: EffectDef = {
  id: "polarInversion",
  name: "Polar Inversion",
  menu: "Distort",
  params: [
    { key: "amount", label: "Amount", type: "range", min: -4, max: 4, step: 0.1, value: 1 },
    { key: "offset", label: "Offset", type: "range", min: 0, max: 100, step: 1, value: 0 },
  ],
  apply(src, p) {
    const amount = num(p, "amount", 1);
    const offset = num(p, "offset", 0) / 100;
    const cx = src.width / 2;
    const cy = src.height / 2;
    const maxR = Math.hypot(cx, cy);
    const dest = src.clone();
    dest.clear();
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const r = Math.hypot(dx, dy) / maxR + 1e-6;
        const inv = Math.pow(r, amount) + offset;
        const sx = Math.round(cx + (dx / r) * inv * maxR);
        const sy = Math.round(cy + (dy / r) * inv * maxR);
        dest.setPixel(x, y, src.inBounds(sx, sy) ? src.getPixel(sx, sy) : { r: 0, g: 0, b: 0, a: 0 });
      }
    }
    return dest;
  },
};

export const twist: EffectDef = {
  id: "twist",
  name: "Twist",
  menu: "Distort",
  params: [
    { key: "amount", label: "Amount", type: "range", min: -100, max: 100, step: 1, value: 30 },
    { key: "size", label: "Size", type: "range", min: 1, max: 100, step: 1, value: 50 },
  ],
  apply(src, p) {
    const amount = (num(p, "amount", 30) * Math.PI) / 180;
    const size = (num(p, "size", 50) / 100) * Math.hypot(src.width, src.height) * 0.5;
    const cx = src.width / 2;
    const cy = src.height / 2;
    const dest = src.clone();
    dest.clear();
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const r = Math.hypot(dx, dy);
        const t = r < size ? amount * (1 - r / size) : 0;
        const sx = Math.round(cx + dx * Math.cos(t) + dy * Math.sin(t));
        const sy = Math.round(cy - dx * Math.sin(t) + dy * Math.cos(t));
        dest.setPixel(x, y, src.inBounds(sx, sy) ? src.getPixel(sx, sy) : { r: 0, g: 0, b: 0, a: 0 });
      }
    }
    return dest;
  },
};

export const tileReflection: EffectDef = {
  id: "tileReflection",
  name: "Tile Reflection",
  menu: "Distort",
  params: [
    { key: "angle", label: "Angle", type: "range", min: 0, max: 90, step: 1, value: 30 },
    { key: "size", label: "Tile Size", type: "range", min: 2, max: 200, step: 1, value: 40 },
    { key: "curvature", label: "Curvature", type: "range", min: -100, max: 100, step: 1, value: 8 },
  ],
  apply(src, p) {
    const size = Math.max(2, num(p, "size", 40));
    const curve = num(p, "curvature", 8) / 100;
    const dest = src.clone();
    dest.clear();
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const tx = Math.floor(x / size);
        const ty = Math.floor(y / size);
        let lx = x - tx * size;
        let ly = y - ty * size;
        if (tx % 2) lx = size - 1 - lx;
        if (ty % 2) ly = size - 1 - ly;
        lx += Math.sin((ly / size) * Math.PI) * curve * size;
        ly += Math.sin((lx / size) * Math.PI) * curve * size;
        const sx = clamp(Math.round(tx * size + lx), 0, src.width - 1);
        const sy = clamp(Math.round(ty * size + ly), 0, src.height - 1);
        dest.setPixel(x, y, src.getPixel(sx, sy));
      }
    }
    return dest;
  },
};

export const pixelate: EffectDef = {
  id: "pixelate",
  name: "Pixelate",
  menu: "Distort",
  params: [{ key: "size", label: "Cell Size", type: "range", min: 2, max: 50, step: 1, value: 6 }],
  apply(src, p) {
    const cell = Math.max(2, num(p, "size", 6) | 0);
    const dest = src.clone();
    for (let y = 0; y < src.height; y += cell) {
      for (let x = 0; x < src.width; x += cell) {
        let r = 0,
          g = 0,
          b = 0,
          a = 0,
          n = 0;
        for (let dy = 0; dy < cell && y + dy < src.height; dy++) {
          for (let dx = 0; dx < cell && x + dx < src.width; dx++) {
            const c = src.getPixel(x + dx, y + dy);
            r += c.r;
            g += c.g;
            b += c.b;
            a += c.a;
            n++;
          }
        }
        const col = { r: r / n, g: g / n, b: b / n, a: a / n };
        for (let dy = 0; dy < cell && y + dy < src.height; dy++) {
          for (let dx = 0; dx < cell && x + dx < src.width; dx++) dest.setPixel(x + dx, y + dy, col);
        }
      }
    }
    return dest;
  },
};

export const bulge: EffectDef = {
  id: "bulge",
  name: "Bulge",
  menu: "Distort",
  params: [{ key: "amount", label: "Amount", type: "range", min: -200, max: 200, step: 1, value: 45 }],
  apply(src, p) {
    const amount = num(p, "amount", 45) / 100;
    const cx = src.width / 2;
    const cy = src.height / 2;
    const maxR = Math.min(cx, cy);
    const dest = src.clone();
    dest.clear();
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const r = Math.hypot(dx, dy) / maxR;
        const f = r === 0 ? 1 : Math.pow(r, 1 + amount) / r;
        const sx = Math.round(cx + dx * f);
        const sy = Math.round(cy + dy * f);
        dest.setPixel(x, y, src.inBounds(sx, sy) ? src.getPixel(sx, sy) : { r: 0, g: 0, b: 0, a: 0 });
      }
    }
    return dest;
  },
};

export const clouds: EffectDef = {
  id: "clouds",
  name: "Clouds",
  menu: "Render",
  params: [
    { key: "scale", label: "Scale", type: "range", min: 2, max: 100, step: 1, value: 20 },
    { key: "power", label: "Roughness", type: "range", min: 0, max: 100, step: 1, value: 50 },
  ],
  apply(src, p) {
    const scale = num(p, "scale", 20);
    const roughness = num(p, "power", 50) / 100;
    const dest = src.clone();
    const seed = Math.random() * 1000;
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        let v = 0,
          amp = 1,
          freq = 1 / scale,
          norm = 0;
        for (let o = 0; o < 5; o++) {
          v += amp * noise2(x * freq + seed, y * freq + seed);
          norm += amp;
          amp *= roughness;
          freq *= 2;
        }
        const n = clamp(((v / norm + 1) / 2) * 255, 0, 255);
        dest.setPixel(x, y, { r: n, g: n, b: n, a: 255 });
      }
    }
    return dest;
  },
};

export const juliaFractal: EffectDef = {
  id: "julia",
  name: "Julia Fractal",
  menu: "Render",
  params: [
    { key: "factor", label: "Factor", type: "range", min: 1, max: 10, step: 0.1, value: 4 },
    { key: "zoom", label: "Zoom", type: "range", min: 1, max: 50, step: 1, value: 1 },
    { key: "angle", label: "Angle", type: "range", min: 0, max: 360, step: 1, value: 0 },
  ],
  apply(src, p) {
    const factor = num(p, "factor", 4);
    const zoom = num(p, "zoom", 1);
    const ang = (num(p, "angle") * Math.PI) / 180;
    const dest = src.clone();
    const cx = src.width / 2;
    const cy = src.height / 2;
    const ca = 0.355;
    const cb = 0.355;
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        let zr = ((x - cx) / src.width) * factor / zoom;
        let zi = ((y - cy) / src.height) * factor / zoom;
        const r = zr;
        zr = r * Math.cos(ang) - zi * Math.sin(ang);
        zi = r * Math.sin(ang) + zi * Math.cos(ang);
        let i = 0;
        for (; i < 64; i++) {
          const zr2 = zr * zr - zi * zi + ca;
          zi = 2 * zr * zi + cb;
          zr = zr2;
          if (zr * zr + zi * zi > 4) break;
        }
        const c = hsvToRgb((i * 8) % 360, 0.8, i === 64 ? 0 : 1, 255);
        dest.setPixel(x, y, c);
      }
    }
    return dest;
  },
};

function noise2(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1;
}
