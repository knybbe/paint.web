import { useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal, flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { AppState } from "@/app-state";
import { BLEND_MODES, type BlendMode } from "@/core/blend";
import { cssRgba, fromHex, hsvToRgb, rgbToHsv, toHex } from "@/core/color";
import { drawColorWheel, pickColorWheel } from "@/ui/color-wheel";
import { UI_ICONS } from "@/ui/icons";
import { useAppEvents } from "@/ui/react/use-app";

let panelsRoot: Root | null = null;

function SvgIcon({ svg }: { svg: string }) {
  return <span className="icon" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function WindowFrame({
  title,
  testId,
  onClose,
  bodyClassName,
  children,
}: {
  title: string;
  testId: string;
  onClose: () => void;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className="pdn-win" data-testid={testId}>
      <div className="title">
        <span>{title}</span>
        <button type="button" title="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className={bodyClassName ? `body ${bodyClassName}` : "body"}>{children}</div>
    </section>
  );
}

function LayersPanel({ app }: { app: AppState }) {
  useAppEvents(app, ["layers", "windows", "history", "sessions"]);
  if (!app.windows.layers) return null;
  const active = app.document.activeLayer;
  return (
    <WindowFrame title="Layers" testId="window-layers" onClose={() => app.toggleWindow("layers")}>
      <div className="layers-list">
        {app.document.layers.map((layer, index) => {
          const thumb = layer.thumbnailDataUrl(40);
          return (
          <div
            key={layer.id}
            className={"layer-row" + (layer.id === app.document.activeLayerId ? " active" : "")}
            draggable
            onClick={() => {
              app.document.setActive(layer.id);
              app.notify("layers");
            }}
            onDoubleClick={() => app.openDialog({ type: "layerProps" })}
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", String(index));
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const from = Number(e.dataTransfer.getData("text/plain"));
              if (!Number.isNaN(from)) {
                app.document.moveLayer(from, index);
                app.compositor.invalidate();
                app.notify("document");
                app.notify("layers");
              }
            }}
          >
            <button
              type="button"
              className="icon-btn"
              title="Visibility"
              onClick={(e) => {
                e.stopPropagation();
                layer.visible = !layer.visible;
                app.compositor.invalidate();
                app.document.dirty = true;
                app.notify("document");
                app.notify("layers");
              }}
            >
              <SvgIcon svg={layer.visible ? UI_ICONS.eye : UI_ICONS.eyeOff} />
            </button>
            <div className="thumb">
              {thumb ? <img alt="" src={thumb} /> : null}
            </div>
            <span>
              {layer.name}
              {layer.locked ? " 🔒" : ""}
            </span>
          </div>
          );
        })}
      </div>
      <div className="layer-actions">
        <button type="button" className="icon-btn" title="Add" onClick={() => app.addLayer()}>
          <SvgIcon svg={UI_ICONS.addLayer} />
        </button>
        <button type="button" className="icon-btn" title="Delete" onClick={() => app.deleteLayer()}>
          <SvgIcon svg={UI_ICONS.deleteLayer} />
        </button>
        <button type="button" className="icon-btn" title="Duplicate" onClick={() => app.duplicateLayer()}>
          <SvgIcon svg={UI_ICONS.duplicateLayer} />
        </button>
        <button type="button" className="icon-btn" title="Merge Down" onClick={() => app.mergeDown()}>
          <SvgIcon svg={UI_ICONS.merge} />
        </button>
        <button type="button" className="icon-btn" title="Move Up" onClick={() => app.moveActiveLayer(1)}>
          <SvgIcon svg={UI_ICONS.arrowUp} />
        </button>
        <button type="button" className="icon-btn" title="Move Down" onClick={() => app.moveActiveLayer(-1)}>
          <SvgIcon svg={UI_ICONS.arrowDown} />
        </button>
      </div>
      <div className="opacity-row">
        Opacity
        <input
          type="range"
          min={0}
          max={255}
          value={active.opacity}
          onInput={(e) => {
            active.opacity = Number((e.target as HTMLInputElement).value);
            app.compositor.invalidate();
            app.notify("layers");
          }}
          onChange={() => {
            app.document.dirty = true;
            app.notify("layers");
          }}
        />
        <span>{Math.round((active.opacity / 255) * 100)}%</span>
      </div>
      <select
        value={active.blendMode}
        onChange={(e) => {
          active.blendMode = e.target.value as BlendMode;
          app.compositor.invalidate();
          app.notify("document");
        }}
      >
        {BLEND_MODES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </WindowFrame>
  );
}

function ColorsPanel({ app }: { app: AppState }) {
  useAppEvents(app, ["colors", "windows"]);
  const wheelRef = useRef<HTMLCanvasElement>(null);
  const active = app.activeColor === "primary" ? app.primary : app.secondary;
  const hsv = rgbToHsv(active);

  useLayoutEffect(() => {
    const canvas = wheelRef.current;
    if (canvas) drawColorWheel(canvas, hsv);
  }, [hsv.h, hsv.s, hsv.v, app.windows.colors]);

  if (!app.windows.colors) return null;

  const pick = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = wheelRef.current;
    if (canvas) pickColorWheel(e.nativeEvent, canvas, app);
  };

  const setHsv = (next: { h: number; s: number; v: number; a: number }) => {
    app.setActiveColorValue(hsvToRgb(next.h, next.s, next.v, next.a));
  };

  const sliders: { label: string; min: number; max: number; value: number; write: (v: number) => void }[] = [
    { label: "H", min: 0, max: 360, value: hsv.h, write: (v) => setHsv({ ...hsv, h: v, a: active.a }) },
    {
      label: "S",
      min: 0,
      max: 100,
      value: Math.round(hsv.s * 100),
      write: (v) => setHsv({ ...hsv, s: v / 100, a: active.a }),
    },
    {
      label: "V",
      min: 0,
      max: 100,
      value: Math.round(hsv.v * 100),
      write: (v) => setHsv({ ...hsv, v: v / 100, a: active.a }),
    },
    { label: "R", min: 0, max: 255, value: active.r, write: (v) => app.setActiveColorValue({ ...active, r: v }) },
    { label: "G", min: 0, max: 255, value: active.g, write: (v) => app.setActiveColorValue({ ...active, g: v }) },
    { label: "B", min: 0, max: 255, value: active.b, write: (v) => app.setActiveColorValue({ ...active, b: v }) },
    { label: "A", min: 0, max: 255, value: active.a, write: (v) => app.setActiveColorValue({ ...active, a: v }) },
  ];

  return (
    <WindowFrame title="Colors" testId="window-colors" bodyClassName="colors-body" onClose={() => app.toggleWindow("colors")}>
      <div className="swatches-row">
        <div className="primary-secondary">
          <div
            className={"swatch secondary" + (app.activeColor === "secondary" ? " active" : "")}
            style={{ background: cssRgba(app.secondary) }}
            onClick={() => {
              app.activeColor = "secondary";
              app.notify("colors");
            }}
          />
          <div
            className={"swatch primary" + (app.activeColor === "primary" ? " active" : "")}
            style={{ background: cssRgba(app.primary) }}
            onClick={() => {
              app.activeColor = "primary";
              app.notify("colors");
            }}
          />
        </div>
        <div className="swap-reset">
          <button type="button" className="icon-btn" title="Swap (X)" onClick={() => app.swapColors()}>
            <SvgIcon svg={UI_ICONS.swap} />
          </button>
        </div>
      </div>
      <div className="wheel-wrap">
        <canvas
          ref={wheelRef}
          width={168}
          height={168}
          onPointerDown={pick}
          onPointerMove={(e) => {
            if (e.buttons) pick(e);
          }}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
      <div className="sliders">
        {sliders.map((s) => (
          <span key={s.label} style={{ display: "contents" }}>
            <span>{s.label}</span>
            <input
              type="range"
              min={s.min}
              max={s.max}
              value={Math.round(s.value)}
              onInput={(e) => s.write(Number((e.target as HTMLInputElement).value))}
            />
            <input
              type="number"
              min={s.min}
              max={s.max}
              value={Math.round(s.value)}
              onChange={(e) => s.write(Number(e.target.value))}
            />
          </span>
        ))}
      </div>
      <div className="hex-row">
        Hex
        <input
          type="text"
          defaultValue={toHex(active, true)}
          key={toHex(active, true)}
          onBlur={(e) => {
            const parsed = fromHex(e.target.value);
            if (parsed) app.setActiveColorValue(parsed);
          }}
        />
      </div>
      <div className="palette-grid">
        {app.settings.palette.map((col, i) => (
          <div
            key={i}
            className="palette-cell"
            style={{ background: cssRgba(col) }}
            title={toHex(col, true)}
            onMouseDown={(e) => {
              e.preventDefault();
              if (e.button === 2) app.setSecondary(col);
              else app.setPrimary(col);
            }}
            onContextMenu={(e) => e.preventDefault()}
            onDoubleClick={() => {
              app.settings.palette[i] = { ...active };
              void app.persistSettings();
              app.notify("colors");
            }}
          />
        ))}
      </div>
    </WindowFrame>
  );
}

function HistoryPanel({ app }: { app: AppState }) {
  useAppEvents(app, ["history", "windows"]);
  if (!app.windows.history) return null;
  const tl = app.history.timeline;
  const pos = app.history.position;
  return (
    <WindowFrame title="History" testId="window-history" onClose={() => app.toggleWindow("history")}>
      <div className="history-list">
        {tl.map((item) => (
          <div
            key={item.index}
            className={"hist-row" + (item.index === pos ? " current" : item.index > pos ? " future" : "")}
            onClick={() => {
              app.history.jumpTo(item.index);
              app.compositor.invalidate();
              app.notify("history");
              app.notify("document");
              app.notify("layers");
            }}
          >
            {item.name}
          </div>
        ))}
      </div>
    </WindowFrame>
  );
}

function DockPanels({
  app,
  colorsHost,
  historyHost,
}: {
  app: AppState;
  colorsHost: HTMLElement;
  historyHost: HTMLElement;
}) {
  return (
    <>
      <LayersPanel app={app} />
      {createPortal(<ColorsPanel app={app} />, colorsHost)}
      {createPortal(<HistoryPanel app={app} />, historyHost)}
    </>
  );
}

export function unmountDockPanels(): void {
  if (panelsRoot) {
    const root = panelsRoot;
    panelsRoot = null;
    flushSync(() => root.unmount());
  }
}

export function mountDockPanels(
  layersHost: HTMLElement,
  colorsHost: HTMLElement,
  historyHost: HTMLElement,
  app: AppState,
): void {
  unmountDockPanels();
  panelsRoot = createRoot(layersHost);
  flushSync(() => {
    panelsRoot!.render(
      <DockPanels app={app} colorsHost={colorsHost} historyHost={historyHost} />,
    );
  });
}
