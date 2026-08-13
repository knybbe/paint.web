export interface HistoryEntry {
  name: string;
  icon: string;
  undo: () => void;
  redo: () => void;
}

export class HistoryStack {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  /** Index into combined timeline: 0 = original, length = latest. */
  limit: number;

  constructor(limit = 80) {
    this.limit = limit;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get undoName(): string | null {
    return this.undoStack.at(-1)?.name ?? null;
  }

  get redoName(): string | null {
    return this.redoStack.at(-1)?.name ?? null;
  }

  get entries(): { name: string; icon: string; current: boolean }[] {
    const items = this.undoStack.map((e) => ({ name: e.name, icon: e.icon, current: false }));
    if (items.length) items[items.length - 1].current = this.redoStack.length === 0;
    for (const e of this.redoStack.slice().reverse()) {
      items.push({ name: e.name, icon: e.icon, current: false });
    }
    return items;
  }

  /** Full list for the History window: original + each action. */
  get timeline(): { name: string; icon: string; index: number }[] {
    const list = [{ name: "New Image", icon: "new", index: 0 }];
    this.undoStack.forEach((e, i) => list.push({ name: e.name, icon: e.icon, index: i + 1 }));
    this.redoStack
      .slice()
      .reverse()
      .forEach((e, i) => list.push({ name: e.name, icon: e.icon, index: this.undoStack.length + 1 + i }));
    return list;
  }

  get position(): number {
    return this.undoStack.length;
  }

  push(entry: HistoryEntry): void {
    this.undoStack.push(entry);
    this.redoStack.length = 0;
    while (this.undoStack.length > this.limit) this.undoStack.shift();
  }

  undo(): HistoryEntry | null {
    const e = this.undoStack.pop();
    if (!e) return null;
    e.undo();
    this.redoStack.push(e);
    return e;
  }

  redo(): HistoryEntry | null {
    const e = this.redoStack.pop();
    if (!e) return null;
    e.redo();
    this.undoStack.push(e);
    return e;
  }

  /** Jump to a timeline index (0 = empty new image). */
  jumpTo(index: number): void {
    while (this.undoStack.length > index) this.undo();
    while (this.undoStack.length < index && this.redoStack.length) this.redo();
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
