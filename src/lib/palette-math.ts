// Color math + colorscheme wheel utilities, ported from the demo prototype.
// See: palette_layout_demo_app_v8_bg_chip_minimal.html

import wheelData from "@/data/palette/wheel.json";

export interface Color {
  label: string;
  h: number;
  s: number;
  l: number;
  r: number;
  g: number;
  b: number;
  hex: string;
  angle?: number;
}

export const WHEEL = wheelData as Array<{ angle: number; hex: string }>;

const clamp = (v: number, mn: number, mx: number) => Math.min(mx, Math.max(mn, v));

const toHex = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();
export const rgbToHex = (r: number, g: number, b: number) => `#${toHex(r)}${toHex(g)}${toHex(b)}`;

export function hexToRgb(hex: string) {
  const c = hex.replace("#", "");
  return {
    r: parseInt(c.substring(0, 2), 16),
    g: parseInt(c.substring(2, 4), 16),
    b: parseInt(c.substring(4, 6), 16),
  };
}

export function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360) % 360, s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hueToRgb(p: number, q: number, t: number) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

export function hslToRgb(h: number, s: number, l: number) {
  h = ((h % 360) + 360) % 360 / 360;
  s /= 100; l /= 100;
  let r: number, g: number, b: number;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hueToRgb(p, q, h + 1 / 3);
    g = hueToRgb(p, q, h);
    b = hueToRgb(p, q, h - 1 / 3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

export function colorFromHsl(label: string, h: number, s: number, l: number): Color {
  const H = ((Math.round(h) % 360) + 360) % 360;
  const S = Math.round(clamp(s, 0, 100));
  const L = Math.round(clamp(l, 0, 100));
  const rgb = hslToRgb(H, S, L);
  return { label, h: H, s: S, l: L, ...rgb, hex: rgbToHex(rgb.r, rgb.g, rgb.b) };
}

export function colorFromHex(label: string, hex: string, angle?: number): Color {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  return { label, angle, h: hsl.h, s: hsl.s, l: hsl.l, ...rgb, hex: hex.toUpperCase() };
}

const wrapAngle = (a: number) => ((Math.round(a) % 360) + 360) % 360;

export function wheelColorAt(angle: number, label: string): Color {
  const item = WHEEL[wrapAngle(angle)];
  return colorFromHex(label, item.hex, item.angle);
}

function mixChannel(a: number, b: number, k: number) {
  return Math.round(a * k + b * (1 - k));
}

export function mixColors(label: string, color: { r: number; g: number; b: number }, bg: { r: number; g: number; b: number }, amount: number): Color {
  const r = mixChannel(color.r, bg.r, amount);
  const g = mixChannel(color.g, bg.g, amount);
  const b = mixChannel(color.b, bg.b, amount);
  const hsl = rgbToHsl(r, g, b);
  return { label, h: hsl.h, s: hsl.s, l: hsl.l, r, g, b, hex: rgbToHex(r, g, b) };
}

export function getInfographicBackground(base: Color): Color {
  return colorFromHsl("background", base.h, 10, 98);
}

export function getCleanBackground(base: Color): Color {
  const h = base.h + 8;
  const s = clamp(8 + base.s * 0.1, 8, 16);
  return colorFromHsl("page", h, s, 97.5);
}

/** Pastel amounts for given density (0..100). Returns 3 amounts: [dense, mid, light]. */
export function getPastelAmounts(density: number): [number, number, number] {
  const k = density / 100;
  return [
    0.18 + (0.42 - 0.18) * k,
    0.11 + (0.30 - 0.11) * k,
    0.06 + (0.20 - 0.06) * k,
  ];
}

export function getPastels(base: Color, bg: Color, density: number): [Color, Color, Color] {
  const [a1, a2, a3] = getPastelAmounts(density);
  return [
    mixColors("pastel-1", base, bg, a1),
    mixColors("pastel-2", base, bg, a2),
    mixColors("pastel-3", base, bg, a3),
  ];
}

export function getDensestPastel(color: Color, bg: Color, density: number, label = "pastel"): Color {
  return mixColors(label, color, bg, getPastelAmounts(density)[0]);
}

/** 5 accent colors per user spec:
 * starting at base+210, going CCW: +210, +180, +150, +120, +90. */
export function getAccentColors(base: Color): Color[] {
  const angle = base.angle ?? base.h;
  return [210, 180, 150, 120, 90].map((off, i) =>
    wheelColorAt(angle + off, `accent-${i + 1}`),
  );
}

export function readableTextColor(color: { r: number; g: number; b: number }): string {
  const lum = (0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b) / 255;
  return lum > 0.58 ? "#101828" : "#FFFFFF";
}

/** Luminance helper for arbitrary hex. */
export function readableTextColorForHex(hex: string): string {
  return readableTextColor(hexToRgb(hex));
}
