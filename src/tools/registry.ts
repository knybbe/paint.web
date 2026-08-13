import type { Tool, ToolId } from "./base";
import { ellipseSelect, lassoSelect, magicWand, rectangleSelect } from "./select";
import { movePixels, moveSelection, panTool, zoomTool } from "./move";
import { cloneStampTool, colorPicker, eraser, paintbrush, pencil, recolorTool } from "./draw";
import { gradientTool, paintBucket } from "./fill";
import {
  ellipseShape,
  freeformShape,
  lineCurve,
  rectangleShape,
  roundedRectangleShape,
  textTool,
} from "./shapes";

export const ALL_TOOLS: Tool[] = [
  rectangleSelect,
  lassoSelect,
  ellipseSelect,
  magicWand,
  movePixels,
  moveSelection,
  zoomTool,
  panTool,
  paintBucket,
  gradientTool,
  paintbrush,
  eraser,
  pencil,
  colorPicker,
  cloneStampTool,
  recolorTool,
  textTool,
  lineCurve,
  rectangleShape,
  roundedRectangleShape,
  ellipseShape,
  freeformShape,
];

const byId = new Map(ALL_TOOLS.map((t) => [t.id, t]));

export function getTool(id: ToolId): Tool {
  return byId.get(id) ?? paintbrush;
}

export const TOOL_LAYOUT: ToolId[][] = [
  ["rectangleSelect", "lassoSelect"],
  ["ellipseSelect", "magicWand"],
  ["movePixels", "moveSelection"],
  ["zoom", "pan"],
  ["paintBucket", "gradient"],
  ["paintbrush", "eraser"],
  ["pencil", "colorPicker"],
  ["cloneStamp", "recolor"],
  ["text", "lineCurve"],
  ["rectangle", "roundedRectangle"],
  ["ellipse", "freeform"],
];
