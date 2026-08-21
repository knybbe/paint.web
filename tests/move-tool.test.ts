import { describe, expect, it } from "vitest";
import { PdDocument } from "../src/core/document";
import { HistoryStack } from "../src/core/history";
import { Selection } from "../src/core/selection";
import { Viewport } from "../src/core/viewport";
import { Compositor } from "../src/core/renderer";
import { rgb } from "../src/core/color";
import { DEFAULT_TOOL_OPTIONS, type ToolContext, type ToolPointer } from "../src/tools/base";
import { moveSelection } from "../src/tools/move";

function pointer(x: number, y: number): ToolPointer {
  return {
    imageX: x,
    imageY: y,
    screenX: x,
    screenY: y,
    button: 0,
    buttons: 1,
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    pressure: 1,
  };
}

function ctxFor(doc: PdDocument, selection: Selection): ToolContext {
  return {
    document: doc,
    selection,
    viewport: new Viewport(),
    primary: rgb(0, 0, 0),
    secondary: rgb(255, 255, 255),
    options: { ...DEFAULT_TOOL_OPTIONS },
    compositor: new Compositor(),
    history: new HistoryStack(8),
    status: () => {},
    notify: () => {},
    setPrimary: () => {},
    setSecondary: () => {},
    setZoom: () => {},
    commitPixels: () => {},
    floating: null,
    placeFloating: () => {},
  };
}

describe("Move Selection", () => {
  it("translates from the original mask, not the last frame", () => {
    const doc = new PdDocument(32, 32);
    const selection = new Selection(32, 32);
    selection.applyRect({ x: 4, y: 4, w: 20, h: 20 }, "replace");
    const ctx = ctxFor(doc, selection);

    moveSelection.pointerDown(pointer(14, 14), ctx);
    moveSelection.pointerMove(pointer(18, 14), ctx);
    moveSelection.pointerMove(pointer(22, 16), ctx);
    moveSelection.pointerUp(pointer(22, 16), ctx);

    expect(selection.contains(4, 4)).toBe(false);
    expect(selection.contains(12, 6)).toBe(true);
    expect(selection.bounds).toEqual({ x: 12, y: 6, w: 20, h: 20 });
  });
});
