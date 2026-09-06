export interface HistoryEntry {
  id?: string;
  name: string;
  icon: string;
  undo: () => void;
  redo: () => void;
  after?: unknown;
}

export interface HistoryTimelineItem {
  name: string;
  icon: string;
  index: number;
  id?: string;
}

/**
 * Pure helper function to compute non-destructive history push.
 * When branching from a previous state (historyIndex < history.length - 1):
 * Appends the branch root history[historyIndex] followed by newState,
 * preserving all prior states (e.g. [A, B, C] -> undo to B -> push D => [A, B, C, B, D]).
 */
export function computeNonDestructivePush<T>(
  history: T[],
  historyIndex: number,
  newState: T,
): { nextHistory: T[]; nextIndex: number } {
  if (historyIndex >= history.length - 1) {
    const nextHistory = [...history, newState];
    return { nextHistory, nextIndex: nextHistory.length - 1 };
  }
  const branchRoot = history[historyIndex];
  const nextHistory = branchRoot !== undefined ? [...history, branchRoot, newState] : [...history, newState];
  return { nextHistory, nextIndex: nextHistory.length - 1 };
}

export class HistoryStack {
  private timelineEntries: HistoryEntry[] = [];
  private currentIndex = 0;
  /** Snapshot of the document before any history entries. */
  baseline: unknown = null;
  afterPush: (() => void) | null = null;
  applySnapshot?: ((snapshot: unknown) => void) | null = null;
  /** Index into combined timeline: 0 = original, length = latest. */
  limit: number;

  constructor(limit = 80) {
    this.limit = limit;
  }

  get undoEntries(): HistoryEntry[] {
    return this.timelineEntries.slice(0, this.currentIndex);
  }

  get redoEntries(): HistoryEntry[] {
    return this.timelineEntries.slice(this.currentIndex).reverse();
  }

  get canUndo(): boolean {
    return this.currentIndex > 0;
  }

  get canRedo(): boolean {
    return this.currentIndex < this.timelineEntries.length;
  }

  get undoName(): string | null {
    return this.currentIndex > 0 ? this.timelineEntries[this.currentIndex - 1].name : null;
  }

  get redoName(): string | null {
    return this.currentIndex < this.timelineEntries.length
      ? this.timelineEntries[this.currentIndex].name
      : null;
  }

  get entries(): { name: string; icon: string; current: boolean }[] {
    return this.timelineEntries.map((e, i) => ({
      name: e.name,
      icon: e.icon,
      current: i + 1 === this.currentIndex,
    }));
  }

  /** Full list for the History window: original + each action. */
  get timeline(): HistoryTimelineItem[] {
    const list: HistoryTimelineItem[] = [{ name: "New Image", icon: "new", index: 0, id: "root" }];
    this.timelineEntries.forEach((e, i) =>
      list.push({ name: e.name, icon: e.icon, index: i + 1, id: e.id }),
    );
    return list;
  }

  get position(): number {
    return this.currentIndex;
  }

  push(entry: HistoryEntry): void {
    const historyIndex = this.currentIndex - 1;
    const { nextHistory, nextIndex } = computeNonDestructivePush(
      this.timelineEntries,
      historyIndex,
      entry,
    );
    this.timelineEntries = nextHistory;
    this.currentIndex = nextIndex + 1;

    while (this.timelineEntries.length > this.limit) {
      this.timelineEntries.shift();
      this.currentIndex = Math.max(0, this.currentIndex - 1);
    }
    this.afterPush?.();
  }

  undo(): HistoryEntry | null {
    if (this.currentIndex <= 0) return null;
    const entry = this.timelineEntries[this.currentIndex - 1];
    this.currentIndex--;
    if (this.applySnapshot) {
      const targetSnap =
        this.currentIndex === 0
          ? this.baseline
          : this.timelineEntries[this.currentIndex - 1]?.after;
      if (targetSnap) {
        this.applySnapshot(targetSnap);
      } else {
        entry.undo();
      }
    } else {
      entry.undo();
    }
    return entry;
  }

  redo(): HistoryEntry | null {
    if (this.currentIndex >= this.timelineEntries.length) return null;
    const entry = this.timelineEntries[this.currentIndex];
    this.currentIndex++;
    if (this.applySnapshot) {
      const targetSnap = entry.after;
      if (targetSnap) {
        this.applySnapshot(targetSnap);
      } else {
        entry.redo();
      }
    } else {
      entry.redo();
    }
    return entry;
  }

  /** Jump to a timeline index (0 = empty new image). */
  jumpTo(index: number): void {
    if (index < 0 || index > this.timelineEntries.length) return;
    if (index === this.currentIndex) return;

    if (this.applySnapshot) {
      const targetSnap = index === 0 ? this.baseline : this.timelineEntries[index - 1]?.after;
      if (targetSnap) {
        this.currentIndex = index;
        this.applySnapshot(targetSnap);
        return;
      }
    }

    while (this.currentIndex > index) {
      this.undo();
    }
    while (this.currentIndex < index && this.currentIndex < this.timelineEntries.length) {
      this.redo();
    }
  }

  /**
   * Safely delete a history entry.
   * Safe rules:
   * 1. Cannot delete index 0 (baseline "New Image").
   * 2. Index must be within 1..timelineEntries.length.
   * 3. If deleting current active entry, document safely falls back to previous entry (or baseline).
   * 4. If deleting past entry, currentIndex decrements to match.
   * 5. If deleting future entry, currentIndex is unaffected.
   */
  delete(index: number): boolean {
    if (index <= 0 || index > this.timelineEntries.length) {
      return false;
    }
    const entryIdx = index - 1;
    const isCurrent = index === this.currentIndex;

    if (isCurrent) {
      const prevIndex = index - 1;
      if (this.applySnapshot) {
        const targetSnap =
          prevIndex === 0 ? this.baseline : this.timelineEntries[prevIndex - 1]?.after;
        if (targetSnap) {
          this.applySnapshot(targetSnap);
        }
      } else {
        this.timelineEntries[entryIdx].undo();
      }
      this.timelineEntries.splice(entryIdx, 1);
      this.currentIndex = prevIndex;
    } else if (index < this.currentIndex) {
      this.timelineEntries.splice(entryIdx, 1);
      this.currentIndex--;
    } else {
      this.timelineEntries.splice(entryIdx, 1);
    }

    return true;
  }

  deleteEntry(index: number): boolean {
    return this.delete(index);
  }

  canDelete(index: number): boolean {
    return index > 0 && index <= this.timelineEntries.length;
  }

  addRedoEntry(entry: HistoryEntry): void {
    this.timelineEntries.push(entry);
  }

  clear(): void {
    this.timelineEntries = [];
    this.currentIndex = 0;
  }
}
