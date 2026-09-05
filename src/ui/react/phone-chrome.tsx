import { useCallback, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { AppState } from "@/app-state";
import { TOOL_SVG, UI_ICONS } from "@/ui/icons";
import { contextChipLabel, mobileSheetTitle, renderMobileSheetBody, type MobileSheet } from "@/ui/mobile-deck";
import { useChromeSnapshot } from "@/ui/chrome-phase";
import { useAppEvents } from "@/ui/react/use-app";
import { Sheet, SheetContent, SheetTitle } from "@/ui/react/components/ui/sheet";
import { ThemeToggle } from "@/ui/react/theme-toggle";

let phoneRoot: Root | null = null;

function SvgIcon({ svg }: { svg: string }) {
  return <span className="icon" dangerouslySetInnerHTML={{ __html: svg }} />;
}

const DECK: { id: Exclude<MobileSheet, "none" | "toolOpts">; label: string; testid: string }[] = [
  { id: "tools", label: "Tools", testid: "mobile-tab-tools" },
  { id: "color", label: "Color", testid: "mobile-tab-color" },
  { id: "layers", label: "Layers", testid: "mobile-tab-layers" },
  { id: "fx", label: "FX", testid: "mobile-tab-fx" },
  { id: "more", label: "More", testid: "mobile-tab-more" },
];

function SheetBody({ sheet, app, onDone }: { sheet: MobileSheet; app: AppState; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const rev = useAppEvents(app, ["tool", "history", "selection", "layers", "colors", "document"]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || sheet === "none") return;
    el.replaceChildren(renderMobileSheetBody(sheet, app, onDone));
  }, [sheet, app, onDone, rev]);
  return <div className="sheet-body" ref={ref} />;
}

function PhoneChrome({ app }: { app: AppState }) {
  useAppEvents(app, ["tool", "history", "document", "selection"]);
  const chrome = useChromeSnapshot();
  const [sheet, setSheet] = useState<MobileSheet>("none");
  const close = useCallback(() => setSheet("none"), []);
  const toggle = (id: MobileSheet) => setSheet((cur) => (cur === id ? "none" : id));
  const side = chrome.orient === "landscape" || chrome.short ? "right" : "bottom";
  const drag = useRef<{ x: number; y: number } | null>(null);

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

  const deckIcon = (id: (typeof DECK)[number]["id"]) => {
    if (id === "tools") return TOOL_SVG[app.currentTool];
    if (id === "color") return UI_ICONS.palette;
    if (id === "layers") return UI_ICONS.layers;
    if (id === "fx") return UI_ICONS.fx;
    return UI_ICONS.more;
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
            disabled={!app.history.canRedo}
            data-testid="mobile-top-redo"
            onClick={() => app.redo()}
          >
            <SvgIcon svg={UI_ICONS.redo} />
          </button>
          <button type="button" className="mobile-action-btn" title="Fit" data-testid="mobile-top-fit" onClick={() => app.fitToView()}>
            <SvgIcon svg={UI_ICONS.fit} />
          </button>
          <ThemeToggle app={app} className="mobile-action-btn" />
          <button type="button" className="mobile-action-btn" title="Save" data-testid="mobile-top-save" onClick={() => void app.save(false)}>
            <SvgIcon svg={UI_ICONS.save} />
          </button>
        </div>
      </header>
      <div className="mobile-context-pill" data-testid="mobile-context-pill">
        <button type="button" className="context-pill-inner" data-testid="context-pill-btn" onClick={() => toggle("toolOpts")}>
          <SvgIcon svg={TOOL_SVG[app.currentTool]} />
          <span className="pill-label">{contextChipLabel(app)}</span>
        </button>
      </div>
      <nav className="mobile-command-deck" data-testid="mobile-command-deck">
        {DECK.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`deck-tab-btn${sheet === item.id ? " active" : ""}`}
            data-testid={item.testid}
            onClick={() => toggle(item.id)}
          >
            <SvgIcon svg={deckIcon(item.id)} />
            <span className="deck-tab-label">{item.label}</span>
          </button>
        ))}
      </nav>
      <Sheet open={sheet !== "none"} onOpenChange={(open) => { if (!open) close(); }}>
        <SheetContent
          side={side}
          data-testid="mobile-sheet-container"
          className={`mobile-sheet-container open${side === "right" ? " sheet-right" : ""}`}
          overlayClassName="mobile-sheet-backdrop open"
          overlayTestId="mobile-sheet-backdrop"
        >
          <div className="sheet-drag-handle" onPointerDown={onHandleDown} onPointerUp={onHandleUp} />
          <div className="sheet-header">
            <SheetTitle className="sheet-title">{mobileSheetTitle(sheet, app)}</SheetTitle>
            <button type="button" className="sheet-close-btn" onClick={close}>
              ✕
            </button>
          </div>
          <SheetBody sheet={sheet} app={app} onDone={close} />
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
