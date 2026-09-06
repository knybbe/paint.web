import { describe, expect, it } from "vitest";
import { computeNonDestructivePush, HistoryStack } from "../src/core/history";
import { PdDocument } from "../src/core/document";
import { snapshotBytes, restoreBytes } from "../src/core/pixel-buffer";
import { rgb } from "../src/core/color";

describe("computeNonDestructivePush", () => {
  it("appends state when at the latest history index", () => {
    const history = ["A", "B"];
    const res = computeNonDestructivePush(history, 1, "C");
    expect(res.nextHistory).toEqual(["A", "B", "C"]);
    expect(res.nextIndex).toBe(2);
  });

  it("branches non-destructively by appending branch root and newState", () => {
    // e.g. [A, B, C] -> undo to B (index 1) -> push D => [A, B, C, B, D]
    const history = ["A", "B", "C"];
    const res = computeNonDestructivePush(history, 1, "D");
    expect(res.nextHistory).toEqual(["A", "B", "C", "B", "D"]);
    expect(res.nextIndex).toBe(4);
  });

  it("branches non-destructively from index 0", () => {
    const history = ["A", "B", "C"];
    const res = computeNonDestructivePush(history, 0, "D");
    expect(res.nextHistory).toEqual(["A", "B", "C", "A", "D"]);
    expect(res.nextIndex).toBe(4);
  });
});

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

  it("branches non-destructively on edit after undo", () => {
    const h = new HistoryStack();
    h.push({ name: "A", icon: "a", undo: () => undefined, redo: () => undefined });
    h.push({ name: "B", icon: "b", undo: () => undefined, redo: () => undefined });
    h.push({ name: "C", icon: "c", undo: () => undefined, redo: () => undefined });
    expect(h.timeline.map((t) => t.name)).toEqual(["New Image", "A", "B", "C"]);
    expect(h.position).toBe(3);

    // Undo to B (position 2)
    h.undo();
    expect(h.position).toBe(2);
    expect(h.canRedo).toBe(true);

    // Push new edit D: branches non-destructively by appending branch root B and then D
    h.push({ name: "D", icon: "d", undo: () => undefined, redo: () => undefined });
    expect(h.timeline.map((t) => t.name)).toEqual(["New Image", "A", "B", "C", "B", "D"]);
    expect(h.position).toBe(5);
    expect(h.canRedo).toBe(false);
    expect(h.undoName).toBe("D");

    // All previous states including branch C are preserved
    h.jumpTo(3);
    expect(h.position).toBe(3);
    expect(h.timeline[h.position].name).toBe("C");
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

  it("enforces safe deletion rules", () => {
    const h = new HistoryStack();
    const log: string[] = [];
    h.push({ name: "A", icon: "a", undo: () => log.push("uA"), redo: () => log.push("rA") });
    h.push({ name: "B", icon: "b", undo: () => log.push("uB"), redo: () => log.push("rB") });
    h.push({ name: "C", icon: "c", undo: () => log.push("uC"), redo: () => log.push("rC") });
    // Timeline: [New Image (0), A (1), B (2), C (3)] - pos: 3

    // Rule 1: Cannot delete index 0 (baseline)
    expect(h.canDelete(0)).toBe(false);
    expect(h.delete(0)).toBe(false);

    // Out of bounds checks
    expect(h.canDelete(-1)).toBe(false);
    expect(h.delete(-1)).toBe(false);
    expect(h.canDelete(99)).toBe(false);
    expect(h.delete(99)).toBe(false);

    // Rule 2: Delete past entry (index 1: A) while pos is 3 (C)
    expect(h.canDelete(1)).toBe(true);
    expect(h.delete(1)).toBe(true);
    // Remaining: [New Image, B, C], pos shifts from 3 to 2
    expect(h.timeline.map((t) => t.name)).toEqual(["New Image", "B", "C"]);
    expect(h.position).toBe(2);
    expect(h.timeline[h.position].name).toBe("C");

    // Rule 3: Delete future entry
    h.undo(); // now pos is 1 (B), future has C (index 2)
    expect(h.position).toBe(1);
    expect(h.delete(2)).toBe(true); // delete future C
    expect(h.timeline.map((t) => t.name)).toEqual(["New Image", "B"]);
    expect(h.position).toBe(1); // pos stays 1

    // Rule 4: Delete current active entry (index 1: B)
    expect(h.delete(1)).toBe(true);
    // Falls back to previous entry: 0 ("New Image")
    expect(h.timeline.map((t) => t.name)).toEqual(["New Image"]);
    expect(h.position).toBe(0);
    expect(h.canUndo).toBe(false);
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
