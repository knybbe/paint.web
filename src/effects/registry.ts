import type { EffectDef } from "./base";
import {
  autoLevel,
  blackAndWhite,
  brightnessContrast,
  curves,
  hueSaturation,
  invertAlpha,
  invertColors,
  levels,
  posterize,
  sepia,
} from "./adjustments";
import {
  addNoise,
  bulge,
  clouds,
  edgeDetect,
  emboss,
  gaussianBlur,
  juliaFractal,
  medianNoise,
  motionBlur,
  oilPainting,
  outline,
  pixelate,
  polarInversion,
  radialBlur,
  reduceNoise,
  sharpen,
  tileReflection,
  twist,
} from "./filters";

export const ALL_EFFECTS: EffectDef[] = [
  autoLevel,
  blackAndWhite,
  brightnessContrast,
  curves,
  hueSaturation,
  invertColors,
  invertAlpha,
  levels,
  posterize,
  sepia,
  gaussianBlur,
  motionBlur,
  radialBlur,
  sharpen,
  addNoise,
  reduceNoise,
  medianNoise,
  oilPainting,
  emboss,
  edgeDetect,
  outline,
  polarInversion,
  twist,
  tileReflection,
  pixelate,
  bulge,
  clouds,
  juliaFractal,
];

const byId = new Map(ALL_EFFECTS.map((e) => [e.id, e]));

export function getEffect(id: string): EffectDef | undefined {
  return byId.get(id);
}

export function effectsByMenu(menu: EffectDef["menu"]): EffectDef[] {
  return ALL_EFFECTS.filter((e) => e.menu === menu);
}
