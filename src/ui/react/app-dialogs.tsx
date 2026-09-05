import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { XIcon } from "lucide-react";
import { version as APP_VERSION } from "../../../package.json";
import type { AppState } from "@/app-state";
import { BLEND_MODES, type BlendMode } from "@/core/blend";
import type { SaveFormat } from "@/core/file-io";
import type { PixelBuffer } from "@/core/pixel-buffer";
import { getEffect } from "@/effects/registry";
import { paramMap } from "@/effects/base";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/ui/react/components/ui/alert-dialog";
import { Button } from "@/ui/react/components/ui/button";
import { Checkbox } from "@/ui/react/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/react/components/ui/dialog";
import { Input } from "@/ui/react/components/ui/input";
import { Label } from "@/ui/react/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/react/components/ui/select";
import { Slider } from "@/ui/react/components/ui/slider";
import { useAppEvent } from "@/ui/react/use-app";

const DIALOG_BOX =
  "pdn-dialog flex flex-col gap-0 p-0 rounded-[4px] sm:max-w-[380px] bg-[var(--pdn-window)] shadow-[var(--pdn-shadow)] overflow-hidden";
const BTN = "h-7 min-w-[74px] rounded-[4px] px-3 text-[12px]";
const INP = "h-7 rounded-[4px] px-2 text-[12px] shadow-none";
const SELECT_CONTENT = "desktop-menu-content z-[4100]";

function isSelectEventTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest("[data-slot=select-content], [data-slot=select-item]");
}

function dismissUnlessSelect(e: { target: EventTarget | null; preventDefault: () => void }): void {
  if (isSelectEventTarget(e.target)) e.preventDefault();
}

function focusFirstField(e: Event): void {
  const box = e.currentTarget as HTMLElement;
  const first = box.querySelector<HTMLElement>(
    "input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea, select, [data-slot=select-trigger]",
  );
  if (!first) return;
  e.preventDefault();
  first.focus();
  if (first instanceof HTMLInputElement && (first.type === "number" || first.type === "text")) first.select();
}

function submitOnEnter(e: KeyboardEvent<HTMLElement>): void {
  if (e.key !== "Enter") return;
  const target = e.target as HTMLElement | null;
  if (target && (target.tagName === "TEXTAREA" || target.closest("[data-slot=select-content]"))) return;
  const primary = e.currentTarget.querySelector<HTMLButtonElement>("[data-dialog-primary]");
  if (primary && !primary.disabled) {
    e.preventDefault();
    primary.click();
  }
}

function FormGrid({ children }: { children: ReactNode }) {
  return <div className="form-grid grid grid-cols-[120px_1fr] items-center gap-x-2.5 gap-y-2">{children}</div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <Label className="text-[12px] font-normal text-foreground">{label}</Label>
      {children}
    </>
  );
}

function NumInput({
  value,
  min = 1,
  max = 32000,
  onChange,
  autoFocus,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  autoFocus?: boolean;
}) {
  return (
    <Input
      type="number"
      className={`${INP} w-16`}
      min={min}
      max={max}
      value={Number.isFinite(value) ? value : ""}
      autoFocus={autoFocus}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

function AppDialogShell({
  title,
  children,
  primary = "OK",
  onPrimary,
  onClose,
  hideCancel,
  extra,
}: {
  title: string;
  children: ReactNode;
  primary?: string;
  onPrimary: () => void;
  onClose: () => void;
  hideCancel?: boolean;
  extra?: ReactNode;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        data-testid="dialog"
        className={DIALOG_BOX}
        onOpenAutoFocus={focusFirstField}
        onKeyDown={submitOnEnter}
        onPointerDownOutside={dismissUnlessSelect}
        onInteractOutside={dismissUnlessSelect}
        onFocusOutside={dismissUnlessSelect}
      >
        <DialogHeader className="dialog-head m-0 flex-row items-center justify-between rounded-t-[4px] px-3 py-0 pr-8">
          <DialogTitle className="text-[13px] font-semibold">{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>
        <div className="body px-3 py-3 text-[12px]">{children}</div>
        <DialogFooter className="flex-row items-center justify-end gap-2 px-3 pb-3 sm:justify-end">
          {extra}
          {hideCancel ? null : (
            <Button type="button" variant="outline" className={BTN} onClick={onClose}>
              Cancel
            </Button>
          )}
          <Button type="button" data-dialog-primary className={BTN} onClick={onPrimary}>
            {primary}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewDialog({ app }: { app: AppState }) {
  const [width, setWidth] = useState(app.settings.defaultWidth);
  const [height, setHeight] = useState(app.settings.defaultHeight);
  const [dpi, setDpi] = useState(app.settings.defaultDpi);
  const [bg, setBg] = useState(app.settings.defaultBackground);
  return (
    <AppDialogShell
      title="New Image"
      onClose={() => app.closeDialog()}
      onPrimary={() => {
        app.newDocument({
          width: width || 800,
          height: height || 600,
          dpi: dpi || 96,
          background: bg,
        });
        app.fitToView();
        app.closeDialog();
      }}
    >
      <FormGrid>
        <Field label="Width">
          <NumInput value={width} onChange={setWidth} autoFocus />
        </Field>
        <Field label="Height">
          <NumInput value={height} onChange={setHeight} />
        </Field>
        <Field label="Resolution (DPI)">
          <NumInput value={dpi} min={1} max={2400} onChange={setDpi} />
        </Field>
        <Field label="Background">
          <Select value={bg} onValueChange={(v) => setBg(v as typeof bg)}>
            <SelectTrigger size="sm" className="h-7 min-h-7 rounded-[4px] px-2 text-[12px] shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={SELECT_CONTENT}>
              {(["White", "Black", "Transparent"] as const).map((b) => (
                <SelectItem key={b} value={b} className="text-[12px]">
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FormGrid>
    </AppDialogShell>
  );
}

function ResizeDialog({ app }: { app: AppState }) {
  const ratio = app.document.width / app.document.height;
  const [width, setWidth] = useState(app.document.width);
  const [height, setHeight] = useState(app.document.height);
  const [keep, setKeep] = useState(true);
  const [resampling, setResampling] = useState<"bilinear" | "nearest">("bilinear");
  return (
    <AppDialogShell
      title="Resize"
      onClose={() => app.closeDialog()}
      onPrimary={() => {
        app.resizeImage(width || 1, height || 1, resampling);
        app.closeDialog();
      }}
    >
      <FormGrid>
        <Field label="Width">
          <NumInput
            value={width}
            onChange={(v) => {
              setWidth(v);
              if (keep && !Number.isNaN(v) && v > 0) setHeight(Math.max(1, Math.round(v / ratio)));
            }}
          />
        </Field>
        <Field label="Height">
          <NumInput
            value={height}
            onChange={(v) => {
              setHeight(v);
              if (keep && !Number.isNaN(v) && v > 0) setWidth(Math.max(1, Math.round(v * ratio)));
            }}
          />
        </Field>
        <Field label="Maintain aspect">
          <Checkbox checked={keep} onCheckedChange={(v) => setKeep(v === true)} />
        </Field>
        <Field label="Resampling">
          <Select value={resampling} onValueChange={(v) => setResampling(v as typeof resampling)}>
            <SelectTrigger size="sm" className="h-7 min-h-7 rounded-[4px] px-2 text-[12px] shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={SELECT_CONTENT}>
              <SelectItem value="bilinear" className="text-[12px]">
                Bilinear (Best Quality)
              </SelectItem>
              <SelectItem value="nearest" className="text-[12px]">
                Nearest Neighbor
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </FormGrid>
    </AppDialogShell>
  );
}

const ANCHORS = ["nw", "n", "ne", "w", "center", "e", "sw", "s", "se"] as const;
const ANCHOR_ICONS: Record<(typeof ANCHORS)[number], string> = {
  nw: "↖",
  n: "⬆",
  ne: "↗",
  w: "⬅",
  center: "⏺",
  e: "➡",
  sw: "↙",
  s: "⬇",
  se: "↘",
};

function CanvasDialog({ app }: { app: AppState }) {
  const [width, setWidth] = useState(app.document.width);
  const [height, setHeight] = useState(app.document.height);
  const [anchor, setAnchor] = useState<(typeof ANCHORS)[number]>("center");
  return (
    <AppDialogShell
      title="Canvas Size"
      onClose={() => app.closeDialog()}
      onPrimary={() => {
        const nw = width || 1;
        const nh = height || 1;
        const dw = nw - app.document.width;
        const dh = nh - app.document.height;
        const ox = anchor.includes("e") ? 0 : anchor.includes("w") ? dw : Math.round(dw / 2);
        const oy = anchor.includes("s") ? 0 : anchor.includes("n") ? dh : Math.round(dh / 2);
        app.resizeCanvas(nw, nh, ox, oy);
        app.closeDialog();
      }}
    >
      <FormGrid>
        <Field label="Width">
          <NumInput value={width} onChange={setWidth} />
        </Field>
        <Field label="Height">
          <NumInput value={height} onChange={setHeight} />
        </Field>
        <Field label="Anchor">
          <div className="anchor-grid">
            {ANCHORS.map((id) => (
              <button
                key={id}
                type="button"
                className={`anchor-btn${id === anchor ? " active" : ""}`}
                title={id}
                onClick={() => setAnchor(id)}
              >
                {ANCHOR_ICONS[id]}
              </button>
            ))}
          </div>
        </Field>
      </FormGrid>
    </AppDialogShell>
  );
}

function LayerPropsDialog({ app }: { app: AppState }) {
  const layer = app.document.activeLayer;
  const [name, setName] = useState(layer.name);
  const [opacity, setOpacity] = useState(layer.opacity);
  const [blend, setBlend] = useState<BlendMode>(layer.blendMode);
  const [visible, setVisible] = useState(layer.visible);
  const [locked, setLocked] = useState(layer.locked);
  return (
    <AppDialogShell
      title="Layer Properties"
      onClose={() => app.closeDialog()}
      onPrimary={() => {
        app.setLayerProps(layer.id, {
          name: name || layer.name,
          opacity,
          blendMode: blend,
          visible,
          locked,
        });
        app.closeDialog();
      }}
    >
      <FormGrid>
        <Field label="Name">
          <Input type="text" className={INP} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Opacity (0–255)">
          <NumInput value={opacity} min={0} max={255} onChange={setOpacity} />
        </Field>
        <Field label="Blend mode">
          <Select value={blend} onValueChange={(v) => setBlend(v as BlendMode)}>
            <SelectTrigger size="sm" className="h-7 min-h-7 rounded-[4px] px-2 text-[12px] shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={SELECT_CONTENT}>
              {BLEND_MODES.map((m) => (
                <SelectItem key={m} value={m} className="text-[12px]">
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Visible">
          <Checkbox checked={visible} onCheckedChange={(v) => setVisible(v === true)} />
        </Field>
        <Field label="Locked">
          <Checkbox checked={locked} onCheckedChange={(v) => setLocked(v === true)} />
        </Field>
      </FormGrid>
    </AppDialogShell>
  );
}

function drawPreview(canvas: HTMLCanvasElement, buf: PixelBuffer): void {
  const max = 220;
  const scale = Math.min(1, max / buf.width, 140 / buf.height);
  canvas.width = Math.max(1, Math.round(buf.width * scale));
  canvas.height = Math.max(1, Math.round(buf.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const tmp = document.createElement("canvas");
  tmp.width = buf.width;
  tmp.height = buf.height;
  tmp.getContext("2d")?.putImageData(buf.asImageData(), 0, 0);
  ctx.imageSmoothingEnabled = scale < 1;
  ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
}

function EffectDialog({ app, effectId }: { app: AppState; effectId: string }) {
  const effect = getEffect(effectId);
  const layer = app.document.activeLayer;
  const originalRef = useRef(layer.buffer.clone());
  const committedRef = useRef(false);
  const beforeRef = useRef<HTMLCanvasElement>(null);
  const afterRef = useRef<HTMLCanvasElement>(null);
  const [params, setParams] = useState(() => (effect ? effect.params.map((p) => ({ ...p })) : []));

  useEffect(() => {
    if (!effect) {
      app.closeDialog();
      return;
    }
    const original = originalRef.current;
    const run = () => {
      const result = effect.apply(original, paramMap(params), app.selection.empty ? undefined : app.selection);
      if (beforeRef.current) drawPreview(beforeRef.current, original);
      if (afterRef.current) drawPreview(afterRef.current, result);
      layer.buffer = result;
      app.compositor.invalidate();
      app.notify("document");
    };
    run();
  }, [app, effect, layer, params]);

  useEffect(() => {
    return () => {
      if (!committedRef.current) {
        layer.buffer = originalRef.current;
        app.compositor.invalidate();
        app.notify("document");
      }
    };
  }, [app, layer]);

  if (!effect) return null;

  const updateParam = (key: string, value: number) => {
    setParams((prev) => prev.map((p) => (p.key === key ? { ...p, value } : p)));
  };

  return (
    <AppDialogShell
      title={effect.name}
      onClose={() => app.closeDialog()}
      onPrimary={() => {
        committedRef.current = true;
        layer.buffer = originalRef.current;
        app.applyEffect(effect, paramMap(params));
        app.closeDialog();
      }}
    >
      <div className="preview-row">
        <canvas ref={beforeRef} />
        <canvas ref={afterRef} />
      </div>
      <FormGrid>
        {params.map((p) =>
          p.type === "range" ? (
            <Field key={p.key} label={p.label}>
              <div className="flex items-center gap-2">
                <Slider
                  min={p.min ?? 0}
                  max={p.max ?? 100}
                  step={p.step ?? 1}
                  value={[Number(p.value)]}
                  onValueChange={(v) => updateParam(p.key, v[0] ?? Number(p.value))}
                  className="flex-1"
                />
                <Input
                  type="number"
                  className={`${INP} w-14`}
                  value={Number(p.value)}
                  onChange={(e) => updateParam(p.key, Number(e.target.value))}
                />
              </div>
            </Field>
          ) : null,
        )}
      </FormGrid>
    </AppDialogShell>
  );
}

function AboutDialog({ app }: { app: AppState }) {
  return (
    <AppDialogShell title="About paint.web" hideCancel onClose={() => app.closeDialog()} onPrimary={() => app.closeDialog()}>
      <p>
        <strong>paint.web</strong> is an unofficial, independent Progressive Web App inspired by Paint.NET (Rick Brewster
        / dotPDN LLC). It is not affiliated with or endorsed by the Paint.NET authors.
      </p>
      <p className="mt-2">
        Runs entirely in your browser. After the first visit the app is cached and works offline. Install it from the
        browser address bar for a standalone window.
      </p>
      <p className="mt-2">
        Version {APP_VERSION} · MIT License
      </p>
    </AppDialogShell>
  );
}

function SettingsDialog({ app }: { app: AppState }) {
  const [theme, setTheme] = useState(app.settings.theme);
  const [width, setWidth] = useState(app.settings.defaultWidth);
  const [height, setHeight] = useState(app.settings.defaultHeight);
  const [dpi, setDpi] = useState(app.settings.defaultDpi);
  const [rulers, setRulers] = useState(app.settings.showRulers);
  const [grid, setGrid] = useState(app.settings.showPixelGrid);
  return (
    <AppDialogShell
      title="Settings"
      onClose={() => app.closeDialog()}
      onPrimary={() => {
        app.settings.theme = theme;
        app.settings.defaultWidth = width;
        app.settings.defaultHeight = height;
        app.settings.defaultDpi = dpi;
        app.settings.showRulers = rulers;
        app.settings.showPixelGrid = grid;
        app.viewport.showRulers = rulers;
        app.viewport.showPixelGrid = grid;
        app.applyTheme();
        void app.persistSettings();
        app.notify("viewport");
        app.closeDialog();
      }}
    >
      <FormGrid>
        <Field label="Theme">
          <Select value={theme} onValueChange={(v) => setTheme(v as typeof theme)}>
            <SelectTrigger size="sm" className="h-7 min-h-7 rounded-[4px] px-2 text-[12px] shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={SELECT_CONTENT}>
              <SelectItem value="dark" className="text-[12px]">
                Dark
              </SelectItem>
              <SelectItem value="light" className="text-[12px]">
                Light
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Default width">
          <NumInput value={width} onChange={setWidth} />
        </Field>
        <Field label="Default height">
          <NumInput value={height} onChange={setHeight} />
        </Field>
        <Field label="Default DPI">
          <NumInput value={dpi} min={1} max={2400} onChange={setDpi} />
        </Field>
        <Field label="Show rulers">
          <Checkbox checked={rulers} onCheckedChange={(v) => setRulers(v === true)} />
        </Field>
        <Field label="Show pixel grid">
          <Checkbox checked={grid} onCheckedChange={(v) => setGrid(v === true)} />
        </Field>
      </FormGrid>
    </AppDialogShell>
  );
}

function ShortcutsDialog({ app }: { app: AppState }) {
  return (
    <AppDialogShell title="Keyboard Shortcuts" hideCancel onClose={() => app.closeDialog()} onPrimary={() => app.closeDialog()}>
      <p>Shortcuts match Paint.NET as closely as possible.</p>
      <ul className="mt-2 list-disc space-y-1 pl-4">
        <li>
          <b>S</b> cycle selection tools · <b>M</b> move · <b>B</b> brush · <b>P</b> pencil · <b>E</b> eraser
        </li>
        <li>
          <b>F</b> bucket · <b>G</b> gradient · <b>K</b> picker · <b>T</b> text · <b>O</b> shapes · <b>H</b> pan ·{" "}
          <b>Z</b> zoom
        </li>
        <li>
          <b>X</b> swap colors · <b>C</b> switch active color · <b>[ ]</b> brush size
        </li>
        <li>
          <b>Ctrl+Z/Y</b> undo/redo · <b>Ctrl+C/X/V</b> copy/cut/paste · <b>Delete</b> erase · <b>Backspace</b> fill
        </li>
        <li>
          <b>Ctrl+N/O/S</b> new/open/save · <b>F5–F8</b> tool windows · <b>F4</b> layer properties
        </li>
        <li>
          <b>Space+drag</b> pan · <b>Ctrl+wheel / pinch</b> zoom · <b>Ctrl+0</b> actual size · <b>Ctrl+B</b> fit to view
        </li>
      </ul>
    </AppDialogShell>
  );
}

function SaveAsDialog({ app, format }: { app: AppState; format: SaveFormat }) {
  const [name, setName] = useState(app.document.name.replace(/\.[^.]+$/, ""));
  const [fmt, setFmt] = useState<SaveFormat>(format);
  return (
    <AppDialogShell
      title="Save As"
      primary="Save"
      onClose={() => app.closeDialog()}
      onPrimary={() => {
        const ext = fmt === "jpeg" ? ".jpg" : fmt === "pdnweb" ? ".pdnweb" : `.${fmt}`;
        void app.saveWithFormat(fmt, name + ext);
        app.closeDialog();
      }}
    >
      <FormGrid>
        <Field label="File name">
          <Input type="text" className={INP} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Format">
          <Select value={fmt} onValueChange={(v) => setFmt(v as SaveFormat)}>
            <SelectTrigger size="sm" className="h-7 min-h-7 rounded-[4px] px-2 text-[12px] shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={SELECT_CONTENT}>
              {(["png", "jpeg", "bmp", "gif", "webp", "pdnweb"] as SaveFormat[]).map((f) => (
                <SelectItem key={f} value={f} className="text-[12px]">
                  {f === "pdnweb" ? "paint.web layered (.pdnweb)" : f.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FormGrid>
    </AppDialogShell>
  );
}

function RotateZoomDialog({ app }: { app: AppState }) {
  const [ang, setAng] = useState(0);
  const [zoom, setZoom] = useState(100);
  return (
    <AppDialogShell
      title="Rotate / Zoom Layer"
      onClose={() => app.closeDialog()}
      onPrimary={() => {
        const layer = app.document.activeLayer;
        const a = (ang * Math.PI) / 180;
        const z = zoom / 100;
        app.mutateLayerPixels("Rotate / Zoom", "rotateZoom", () => {
          const src = layer.buffer;
          const dest = src.clone();
          dest.clear();
          const cx = src.width / 2;
          const cy = src.height / 2;
          for (let y = 0; y < dest.height; y++) {
            for (let x = 0; x < dest.width; x++) {
              const dx = (x - cx) / z;
              const dy = (y - cy) / z;
              const sx = Math.round(cx + dx * Math.cos(-a) - dy * Math.sin(-a));
              const sy = Math.round(cy + dx * Math.sin(-a) + dy * Math.cos(-a));
              if (src.inBounds(sx, sy)) dest.setPixel(x, y, src.getPixel(sx, sy));
            }
          }
          layer.buffer = dest;
        });
        app.closeDialog();
      }}
    >
      <FormGrid>
        <Field label="Angle (°)">
          <NumInput value={ang} min={-180} max={180} onChange={setAng} />
        </Field>
        <Field label="Zoom (%)">
          <NumInput value={zoom} min={1} max={800} onChange={setZoom} />
        </Field>
      </FormGrid>
    </AppDialogShell>
  );
}

function ConfirmCloseDialog({ app, sessionId }: { app: AppState; sessionId: string }) {
  const session = app.sessions.find((s) => s.id === sessionId);
  const name = session ? session.document.name : "Document";
  const close = () => app.closeDialog();
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <AlertDialogContent
        data-testid="dialog"
        className={DIALOG_BOX}
        onKeyDown={submitOnEnter}
      >
        <AlertDialogHeader className="dialog-head m-0 flex-row items-center justify-between rounded-t-[4px] px-3 py-0 pr-8">
          <AlertDialogTitle className="text-[13px] font-semibold">Save Changes?</AlertDialogTitle>
          <button
            type="button"
            className="absolute top-2 right-2 rounded-[4px] opacity-70 hover:opacity-100"
            aria-label="Close"
            title="Close (Esc)"
            onClick={close}
          >
            <XIcon className="size-4" />
          </button>
        </AlertDialogHeader>
        <div className="body px-3 py-3 text-[12px]">
          <AlertDialogDescription className="mb-2 text-[12px] text-foreground">
            Do you want to save changes to &quot;{name}&quot; before closing?
          </AlertDialogDescription>
          <p className="text-[11.5px] text-muted-foreground">
            If you don&apos;t save, your unsaved changes will be permanently discarded.
          </p>
        </div>
        <AlertDialogFooter className="flex-row justify-end gap-2 px-3 pb-3 sm:justify-end">
          <AlertDialogCancel className={BTN} onClick={close}>
            Cancel
          </AlertDialogCancel>
          <Button
            type="button"
            variant="outline"
            className={`${BTN} text-destructive`}
            onClick={() => app.closeSessionFinal(sessionId)}
          >
            Don&apos;t Save
          </Button>
          <Button
            type="button"
            data-dialog-primary
            className={BTN}
            onClick={() => {
              void app.save().then(() => app.closeSessionFinal(sessionId));
            }}
          >
            Save
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function AppDialogs({ app }: { app: AppState }) {
  useAppEvent(app, "dialog");
  const d = app.dialog;
  if (!d) return null;
  if (d.type === "new") return <NewDialog app={app} />;
  if (d.type === "resize") return <ResizeDialog app={app} />;
  if (d.type === "canvas") return <CanvasDialog app={app} />;
  if (d.type === "layerProps") return <LayerPropsDialog app={app} />;
  if (d.type === "effect") return <EffectDialog app={app} effectId={d.effectId} />;
  if (d.type === "about") return <AboutDialog app={app} />;
  if (d.type === "settings") return <SettingsDialog app={app} />;
  if (d.type === "shortcuts") return <ShortcutsDialog app={app} />;
  if (d.type === "saveAs") return <SaveAsDialog app={app} format={d.format} />;
  if (d.type === "rotateZoom") return <RotateZoomDialog app={app} />;
  if (d.type === "confirmClose") return <ConfirmCloseDialog app={app} sessionId={d.sessionId} />;
  return null;
}
