import { describe, expect, it } from "vitest";
import { HistoryStack } from "../src/core/history";
import { PdDocument } from "../src/core/document";
import { snapshotBytes, restoreBytes } from "../src/core/pixel-buffer";
import { rgb } from "../src/core/color";

describe("HistoryStack", () => {
  it("undoes and redoes in order", () => {
    const h = new HistoryStack();
    let n = 0;
    h.push({
      name: "A",
      icon: "a",
      undo: () => {
        n -= 1;
      },
      redo: () => {
        n += 1;
      },
    });
    n = 1;
    h.push({
      name: "B",
      icon: "b",
      undo: () => {
        n -= 10;
      },
      redo: () => {
        n += 10;
      },
    });
    n = 11;
    expect(h.canUndo).toBe(true);
    expect(h.undoName).toBe("B");
    h.undo();
    expect(n).toBe(1);
    h.undo();
    expect(n).toBe(0);
    expect(h.canUndo).toBe(false);
    h.redo();
    expect(n).toBe(1);
    expect(h.redoName).toBe("B");
    h.redo();
    expect(n).toBe(11);
  });

  it("clears redo after a new action", () => {
    const h = new HistoryStack();
    h.push({ name: "A", icon: "a", undo: () => undefined, redo: () => undefined });
    h.undo();
    expect(h.canRedo).toBe(true);
    h.push({ name: "C", icon: "c", undo: () => undefined, redo: () => undefined });
    expect(h.canRedo).toBe(false);
    expect(h.undoName).toBe("C");
  });

  it("jumps along the timeline", () => {
    const h = new HistoryStack();
    const log: string[] = [];
    const push = (name: string) =>
      h.push({
        name,
        icon: name,
        undo: () => log.push("u" + name),
        redo: () => log.push("r" + name),
      });
    push("A");
    push("B");
    push("C");
    h.jumpTo(1);
    expect(h.position).toBe(1);
    expect(log).toEqual(["uC", "uB"]);
    h.jumpTo(3);
    expect(h.position).toBe(3);
    expect(log.slice(-2)).toEqual(["rB", "rC"]);
  });

  it("restores layer pixels for a paint command", () => {
    const doc = new PdDocument(4, 4, { background: "White" });
    const layer = doc.activeLayer;
    const before = snapshotBytes(layer.buffer);
    layer.buffer.setPixel(1, 1, rgb(0, 0, 0));
    const after = snapshotBytes(layer.buffer);
    const h = new HistoryStack();
    h.push({
      name: "Pencil",
      icon: "pencil",
      undo: () => restoreBytes(layer.buffer, before),
      redo: () => restoreBytes(layer.buffer, after),
    });
    expect(layer.buffer.getPixel(1, 1).r).toBe(0);
    h.undo();
    expect(layer.buffer.getPixel(1, 1).r).toBe(255);
    h.redo();
    expect(layer.buffer.getPixel(1, 1).r).toBe(0);
  });
});
