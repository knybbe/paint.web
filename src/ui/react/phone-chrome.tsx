import { useCallback, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { AppState } from "@/app-state";
import { TOOL_SVG, UI_ICONS } from "@/ui/icons";
import {
  ALL_DECK_SLOTS,
  DEFAULT_DECK_SLOTS,
  contextChipLabel,
  loadDeckSlots,
  mobileSheetTitle,
  renderMobileSheetBody,
  saveDeckSlots,
  type DeckSlotId,
  type MobileSheet,
} from "@/ui/mobile-deck";
import { useChromeSnapshot } from "@/ui/chrome-phase";
import { useAppEvents } from "@/ui/react/use-app";
import { Sheet, SheetContent, SheetTitle } from "@/ui/react/components/ui/sheet";
import { ThemeToggle } from "@/ui/react/theme-toggle";

let phoneRoot: Root | null = null;

function SvgIcon({ svg }: { svg: string }) {
  return <span className="icon" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function SheetBody({
  sheet,
  app,
  onDone,
  onOpenCustomize,
}: {
  sheet: MobileSheet;
  app: AppState;
  onDone: () => void;
  onOpenCustomize: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rev = useAppEvents(app, ["tool", "history", "selection", "layers", "colors", "document", "theme"]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || sheet === "none" || sheet === "customize") return;
    el.replaceChildren(renderMobileSheetBody(sheet, app, onDone, { onOpenCustomize }));
  }, [sheet, app, onDone, rev, onOpenCustomize]);
  return <div className="sheet-body" ref={ref} />;
}

function CustomizeSheet({
  slots,
  onChange,
  onDone,
  app,
}: {
  slots: DeckSlotId[];
  onChange: (slots: DeckSlotId[]) => void;
  onDone: () => void;
  app: AppState;
}) {
  const [activeSlots, setActiveSlots] = useState<DeckSlotId[]>(slots);

  const update = (newSlots: DeckSlotId[]) => {
    setActiveSlots(newSlots);
    onChange(newSlots);
  };

  const handleToggle = (id: DeckSlotId) => {
    if (activeSlots.includes(id)) {
      if (activeSlots.length <= 1) return;
      update(activeSlots.filter((s) => s !== id));
    } else {
      if (activeSlots.length >= 6) {
        update([...activeSlots.slice(0, 5), id]);
      } else {
        update([...activeSlots, id]);
      }
    }
  };

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= activeSlots.length) return;
    const next = [...activeSlots];
    const temp = next[idx];
    next[idx] = next[target];
    next[target] = temp;
    update(next);
  };

  const reset = () => {
    update([...DEFAULT_DECK_SLOTS]);
  };

  return (
    <div className="mobile-customize-sheet" data-testid="mobile-customize-sheet">
      <div className="mobile-customize-desc">
        Select 6 buttons for the bottom bar. The &quot;More&quot; button is fixed.
      </div>
      <div className="mobile-customize-sec">
        <div className="mobile-customize-sec-title">Active Bottom Bar ({activeSlots.length}/6)</div>
        <div className="mobile-customize-slots-list">
          {activeSlots.map((slotId, idx) => {
            const cfg = ALL_DECK_SLOTS[slotId];
            return (
              <div key={slotId} className="mobile-customize-slot-row" data-testid={`mobile-customize-slot-${slotId}`}>
                <span className="mobile-customize-slot-num">{idx + 1}</span>
                <SvgIcon svg={cfg.getIcon(app)} />
                <span className="mobile-customize-slot-name">{cfg.label}</span>
                <div className="mobile-customize-slot-btns">
                  <button
                    type="button"
                    className="mobile-customize-arrow-btn"
                    disabled={idx === 0}
                    title="Move left"
                    aria-label="Move left"
                    onClick={() => move(idx, -1)}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    className="mobile-customize-arrow-btn"
                    disabled={idx === activeSlots.length - 1}
                    title="Move right"
                    aria-label="Move right"
                    onClick={() => move(idx, 1)}
                  >
                    →
                  </button>
                  <button
                    type="button"
                    className="mobile-customize-remove-btn"
                    title="Remove"
                    aria-label={`Remove ${cfg.label}`}
                    onClick={() => update(activeSlots.filter((s) => s !== slotId))}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mobile-customize-sec">
        <div className="mobile-customize-sec-title">Available Buttons</div>
        <div className="mobile-customize-available-grid">
          {(Object.keys(ALL_DECK_SLOTS) as DeckSlotId[]).map((id) => {
            const cfg = ALL_DECK_SLOTS[id];
            const isSelected = activeSlots.includes(id);
            return (
              <button
                key={id}
                type="button"
                className={`mobile-customize-opt-btn${isSelected ? " selected" : ""}`}
                data-testid={`mobile-customize-opt-${id}`}
                onClick={() => handleToggle(id)}
              >
                <SvgIcon svg={cfg.getIcon(app)} />
                <span>{cfg.label}</span>
                {isSelected ? <span className="opt-status">✓</span> : <span className="opt-status">+</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mobile-customize-actions">
        <button
          type="button"
          className="touch-btn"
          data-testid="mobile-customize-reset"
          onClick={reset}
        >
          Reset Defaults
        </button>
        <button
          type="button"
          className="touch-btn primary"
          data-testid="mobile-customize-done"
          onClick={onDone}
        >
          Done
        </button>
      </div>
    </div>
  );
}

function PhoneChrome({ app }: { app: AppState }) {
  useAppEvents(app, ["tool", "history", "document", "selection"]);
  const chrome = useChromeSnapshot();
  const [sheet, setSheet] = useState<MobileSheet>("none");
  const [deckSlots, setDeckSlots] = useState<DeckSlotId[]>(() => loadDeckSlots());
  const close = useCallback(() => setSheet("none"), []);
  const toggle = (id: MobileSheet) => setSheet((cur) => (cur === id ? "none" : id));
  const side = chrome.orient === "landscape" || chrome.short ? "right" : "bottom";
  const drag = useRef<{ x: number; y: number } | null>(null);

  const longPressTimeoutRef = useRef<number | null>(null);
  const longPressedRef = useRef(false);

  const handlePointerDown = () => {
    longPressedRef.current = false;
    if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
    longPressTimeoutRef.current = window.setTimeout(() => {
      longPressedRef.current = true;
      setSheet("customize");
    }, 500);
  };

  const handlePointerUp = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  const handleDeckClick = (slotId: DeckSlotId) => {
    if (longPressedRef.current) {
      longPressedRef.current = false;
      return;
    }
    const item = ALL_DECK_SLOTS[slotId];
    if (item.sheet) {
      toggle(item.sheet);
    } else if (item.run) {
      item.run(app);
    }
  };

  const updateDeckSlots = (newSlots: DeckSlotId[]) => {
    setDeckSlots(newSlots);
    saveDeckSlots(newSlots);
  };

  const onHandleDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onHandleUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    drag.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (side === "bottom" && dy > 72) close();
    if (side === "right" && dx > 72) close();
  };

  return (
    <>
      <header className="mobile-top-bar" data-testid="mobile-top-bar">
        <div className="mobile-top-title">{app.document.name}</div>
        <div className="mobile-top-actions">
          <button
            type="button"
            className="mobile-action-btn"
            title="Undo"
            aria-label="Undo"
            disabled={!app.history.canUndo}
            data-testid="mobile-top-undo"
            onClick={() => app.undo()}
          >
            <SvgIcon svg={UI_ICONS.undo} />
          </button>
          <button
            type="button"
            className="mobile-action-btn"
            title="Redo"
            aria-label="Redo"
            disabled={!app.history.canRedo}
            data-testid="mobile-top-redo"
            onClick={() => app.redo()}
          >
            <SvgIcon svg={UI_ICONS.redo} />
          </button>
          <button
            type="button"
            className="mobile-action-btn"
            title="Fit to View"
            aria-label="Fit to View"
            data-testid="mobile-top-fit"
            onClick={() => app.fitToView()}
          >
            <SvgIcon svg={UI_ICONS.fit} />
          </button>
          <button
            type="button"
            className="mobile-action-btn"
            title="Download"
            aria-label="Download"
            data-testid="mobile-top-download"
            onClick={() => void app.download()}
          >
            <SvgIcon svg={UI_ICONS.download} />
          </button>
        </div>
      </header>
      <div className="mobile-context-pill" data-testid="mobile-context-pill">
        <button
          type="button"
          className="context-pill-inner"
          title="Tool Options"
          aria-label="Tool Options"
          data-testid="context-pill-btn"
          onClick={() => toggle("toolOpts")}
        >
          <SvgIcon svg={TOOL_SVG[app.currentTool]} />
          <span className="pill-label">{contextChipLabel(app)}</span>
        </button>
      </div>
      <nav className="mobile-command-deck" data-testid="mobile-command-deck">
        {deckSlots.map((slotId) => {
          const item = ALL_DECK_SLOTS[slotId];
          const isActive = sheet === slotId;
          return (
            <button
              key={slotId}
              type="button"
              className={`deck-tab-btn${isActive ? " active" : ""}`}
              data-testid={item.testid}
              title={item.label}
              aria-label={item.label}
              aria-expanded={isActive}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onClick={() => handleDeckClick(slotId)}
            >
              <SvgIcon svg={item.getIcon(app)} />
              <span className="deck-tab-label sr-only">{item.label}</span>
            </button>
          );
        })}
        <button
          key="more"
          type="button"
          className={`deck-tab-btn${sheet === "more" ? " active" : ""}`}
          data-testid="mobile-tab-more"
          title="More"
          aria-label="More"
          aria-expanded={sheet === "more"}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onClick={() => {
            if (longPressedRef.current) {
              longPressedRef.current = false;
              return;
            }
            toggle("more");
          }}
        >
          <SvgIcon svg={UI_ICONS.more} />
          <span className="deck-tab-label sr-only">More</span>
        </button>
      </nav>
      <Sheet modal={false} open={sheet !== "none"} onOpenChange={(open) => { if (!open) close(); }}>
        <SheetContent
          side={side}
          data-testid="mobile-sheet-container"
          className={`mobile-sheet-container open${side === "right" ? " sheet-right" : ""}`}
          overlayClassName="mobile-sheet-backdrop open"
          overlayTestId="mobile-sheet-backdrop"
          onOverlayClick={close}
          aria-describedby={undefined}
        >
          <div className="sheet-drag-handle" role="presentation" aria-hidden="true" onPointerDown={onHandleDown} onPointerUp={onHandleUp} />
          <SheetTitle className="sr-only">{mobileSheetTitle(sheet, app)}</SheetTitle>
          {sheet === "more" && (
            <div className="mobile-more-top-row">
              <div className="mobile-more-top-actions">
                <button
                  type="button"
                  className="chrome-icon-btn mobile-action-btn"
                  title="Customize bottom bar"
                  aria-label="Customize bottom bar"
                  data-testid="mobile-customize-bar-btn"
                  onClick={() => setSheet("customize")}
                >
                  <SvgIcon svg={UI_ICONS.settings} />
                </button>
                <ThemeToggle
                  app={app}
                  className="mobile-action-btn"
                  testId="more-theme"
                />
              </div>
            </div>
          )}
          {sheet === "customize" ? (
            <CustomizeSheet
              slots={deckSlots}
              onChange={updateDeckSlots}
              onDone={close}
              app={app}
            />
          ) : (
            <SheetBody
              sheet={sheet}
              app={app}
              onDone={close}
              onOpenCustomize={() => setSheet("customize")}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

export function unmountPhoneChrome(): void {
  if (phoneRoot) {
    const root = phoneRoot;
    phoneRoot = null;
    flushSync(() => root.unmount());
  }
}

export function mountPhoneChrome(host: HTMLElement, app: AppState): void {
  unmountPhoneChrome();
  phoneRoot = createRoot(host);
  flushSync(() => {
    phoneRoot!.render(<PhoneChrome app={app} />);
  });
}
