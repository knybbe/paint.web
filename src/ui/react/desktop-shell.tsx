import { Fragment } from "react";
import { createPortal, flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { AppState } from "@/app-state";
import { commandsByGroup, getCommand, runCommand, type Command, type CommandGroup } from "@/commands";
import { effectsByMenu } from "@/effects/registry";
import { getTool } from "@/tools/registry";
import type { ToolId } from "@/tools/base";
import { TOOL_SVG, UI_ICONS } from "@/ui/icons";
import { useChromePhase } from "@/ui/chrome-phase";
import { openCommandPalette } from "@/ui/react/command-palette";
import { useAppEvents } from "@/ui/react/use-app";
import { Button } from "@/ui/react/components/ui/button";
import { Checkbox } from "@/ui/react/components/ui/checkbox";
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/ui/react/components/ui/menubar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/react/components/ui/select";
import { Separator } from "@/ui/react/components/ui/separator";
import { Slider } from "@/ui/react/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/ui/react/components/ui/tooltip";
import { ThemeToggle } from "@/ui/react/theme-toggle";

const MENU_GROUPS: CommandGroup[] = ["file", "edit", "image", "adjust", "effects", "view", "window", "help"];
const MENU_LABELS: Record<CommandGroup, string> = {
  file: "File",
  edit: "Edit",
  image: "Image",
  adjust: "Adjust",
  effects: "Effects",
  view: "View",
  window: "Window",
  tools: "Tools",
  help: "Help",
};

const EFFECT_CATS = ["Blurs", "Distort", "Noise", "Photo", "Render", "Stylize"] as const;

const RAIL_GROUPS: { title: string; tools: ToolId[] }[] = [
  { title: "Select", tools: ["rectangleSelect", "lassoSelect", "ellipseSelect", "magicWand"] },
  { title: "Move", tools: ["movePixels", "moveSelection"] },
  { title: "Paint", tools: ["paintbrush", "pencil", "eraser", "lineCurve", "cloneStamp", "recolor", "text"] },
  { title: "Fill", tools: ["paintBucket", "gradient", "colorPicker"] },
  { title: "Shapes", tools: ["rectangle", "roundedRectangle", "ellipse", "freeform"] },
  { title: "View", tools: ["zoom", "pan"] },
];

const WINDOW_KEYS: Record<string, keyof AppState["windows"]> = {
  "window.tools": "tools",
  "window.history": "history",
  "window.layers": "layers",
  "window.colors": "colors",
};

const VIEW_CHECKS: Record<string, (app: AppState) => boolean> = {
  "view.rulers": (app) => app.viewport.showRulers,
  "view.pixelGrid": (app) => app.viewport.showPixelGrid,
};

let chromeRoot: Root | null = null;

function SvgIcon({ svg }: { svg: string }) {
  return <span className="icon" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function cmdTestId(cmd: Command): string {
  if (cmd.id === "file.new") return "ribbon-file-new";
  if (cmd.id.startsWith("adj.")) return `adj-${cmd.id.slice(4)}`;
  return `cmd-${cmd.id.replace(/\./g, "-")}`;
}

function CommandRow({ app, cmd }: { app: AppState; cmd: Command }) {
  const disabled = cmd.enabled ? !cmd.enabled(app) : false;
  const winKey = WINDOW_KEYS[cmd.id];
  if (winKey) {
    return (
      <MenubarCheckboxItem
        data-testid={cmdTestId(cmd)}
        checked={app.windows[winKey]}
        disabled={disabled}
        onCheckedChange={() => runCommand(app, cmd.id)}
      >
        {cmd.label}
        {cmd.shortcut ? <MenubarShortcut>{cmd.shortcut}</MenubarShortcut> : null}
      </MenubarCheckboxItem>
    );
  }
  const viewCheck = VIEW_CHECKS[cmd.id];
  if (viewCheck) {
    return (
      <MenubarCheckboxItem
        data-testid={cmdTestId(cmd)}
        checked={viewCheck(app)}
        disabled={disabled}
        onCheckedChange={() => runCommand(app, cmd.id)}
      >
        {cmd.label}
        {cmd.shortcut ? <MenubarShortcut>{cmd.shortcut}</MenubarShortcut> : null}
      </MenubarCheckboxItem>
    );
  }
  return (
    <MenubarItem
      data-testid={cmdTestId(cmd)}
      disabled={disabled}
      onSelect={() => {
        if (!disabled) runCommand(app, cmd.id);
      }}
    >
      {cmd.label}
      {cmd.shortcut ? <MenubarShortcut>{cmd.shortcut}</MenubarShortcut> : null}
    </MenubarItem>
  );
}

function EffectsMenu({ app }: { app: AppState }) {
  return (
    <MenubarMenu>
      <MenubarTrigger className="desktop-menu-trigger shadow-none outline-none focus-visible:ring-0" data-testid="menu-effects">
        Effects
      </MenubarTrigger>
      <MenubarContent className="desktop-menu-content effects-panel" align="start" sideOffset={4}>
        <div className="effects-panel-grid">
          {EFFECT_CATS.map((cat) => (
            <div key={cat} className="effects-panel-col">
              <div className="effects-panel-heading">{cat}</div>
              {effectsByMenu(cat).map((e) => {
                const cmd = getCommand(`effect.${e.id}`);
                if (!cmd) return null;
                return <CommandRow key={cmd.id} app={app} cmd={cmd} />;
              })}
            </div>
          ))}
        </div>
      </MenubarContent>
    </MenubarMenu>
  );
}

function AppMenubar({ app }: { app: AppState }) {
  useAppEvents(app, ["history", "selection", "layers", "windows", "viewport", "theme"]);
  const groups = commandsByGroup();
  return (
    <Menubar className="desktop-menubar border-0 shadow-none rounded-none" data-testid="menubar">
      {MENU_GROUPS.map((group) => {
        if (group === "effects") return <EffectsMenu key="effects" app={app} />;
        const g = groups.find((x) => x.group === group);
        if (!g) return null;
        return (
          <MenubarMenu key={group}>
            <MenubarTrigger className="desktop-menu-trigger shadow-none outline-none focus-visible:ring-0" data-testid={`menu-${group}`}>
              {MENU_LABELS[group]}
            </MenubarTrigger>
            <MenubarContent className="desktop-menu-content" align="start" sideOffset={0}>
              {g.commands.map((cmd) => {
                const sep =
                  (group === "edit" && (cmd.id === "edit.cut" || cmd.id === "edit.selectAll")) ||
                  (group === "image" && cmd.id === "image.rotate90cw") ||
                  (group === "view" && (cmd.id === "view.rulers" || cmd.id === "view.theme"));
                return (
                  <Fragment key={cmd.id}>
                    {sep ? <MenubarSeparator /> : null}
                    <CommandRow app={app} cmd={cmd} />
                  </Fragment>
                );
              })}
            </MenubarContent>
          </MenubarMenu>
        );
      })}
    </Menubar>
  );
}

function TitleRow({ app }: { app: AppState }) {
  useAppEvents(app, ["history", "document", "theme", "sessions", "tool"]);
  const phase = useChromePhase();
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const iconSearch = phase !== "desktop";
  const fingerPan = app.options.touchFingerMode === "pan";
  return (
    <div className="desktop-title-row" data-testid="title-row">
      <div className="desktop-title-actions">
        <button
          type="button"
          className="chrome-icon-btn"
          title={app.history.canUndo ? `Undo ${app.history.undoName} (Ctrl+Z)` : "Undo (Ctrl+Z)"}
          disabled={!app.history.canUndo}
          data-testid="ribbon-undo"
          onClick={() => app.undo()}
        >
          <SvgIcon svg={UI_ICONS.undo} />
        </button>
        <button
          type="button"
          className="chrome-icon-btn"
          title={app.history.canRedo ? `Redo ${app.history.redoName} (Ctrl+Y)` : "Redo (Ctrl+Y)"}
          disabled={!app.history.canRedo}
          data-testid="ribbon-redo"
          onClick={() => app.redo()}
        >
          <SvgIcon svg={UI_ICONS.redo} />
        </button>
        <button
          type="button"
          className="chrome-icon-btn"
          title="Download Export (Ctrl+Shift+S)"
          data-testid="ribbon-download"
          onClick={() => void app.download()}
        >
          <SvgIcon svg={UI_ICONS.download} />
        </button>
        <button
          type="button"
          className="chrome-icon-btn"
          title="Folder Sync (Ctrl+Shift+U)"
          data-testid="ribbon-sync"
          onClick={() => app.openDialog({ type: "sync" })}
        >
          <SvgIcon svg={UI_ICONS.sync} />
        </button>
      </div>
      <Separator orientation="vertical" className="h-5" />
      <div className="desktop-session-name" title={app.document.name}>
        {app.document.name}
        {app.document.dirty ? "*" : ""}
      </div>
      <button
        type="button"
        className={iconSearch ? "chrome-icon-btn" : "desktop-search-btn"}
        data-testid="command-palette-btn"
        title="Command palette (Ctrl+K)"
        onClick={() => openCommandPalette()}
      >
        {iconSearch ? <SvgIcon svg={UI_ICONS.search} /> : <>Search <kbd>{mac ? "⌘K" : "Ctrl+K"}</kbd></>}
      </button>
      <button
        type="button"
        className="chrome-icon-btn"
        title="Fit to View (Ctrl+B)"
        data-testid="ribbon-fit"
        onClick={() => app.fitToView()}
      >
        <SvgIcon svg={UI_ICONS.fit} />
      </button>
      {phase === "tablet" ? (
        <button
          type="button"
          className={`chrome-icon-btn${fingerPan ? " active" : ""}`}
          title={fingerPan ? "Finger pans (tap to draw)" : "Finger draws (tap to pan)"}
          data-testid="tablet-finger-mode"
          onClick={() => {
            app.options.touchFingerMode = fingerPan ? "draw" : "pan";
            app.notify("tool");
          }}
        >
          <SvgIcon svg={fingerPan ? TOOL_SVG.pan : TOOL_SVG.paintbrush} />
        </button>
      ) : null}
      <ThemeToggle app={app} />
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function SliderField({
  app,
  label,
  value,
  min,
  max,
  onChange,
}: {
  app: AppState;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="context-field">
      <span>{label}:</span>
      <Slider
        min={min}
        max={max}
        step={1}
        value={[value]}
        onValueChange={(v) => {
          onChange(v[0] ?? value);
          app.notify("tool");
        }}
        className="w-20"
      />
      <span className="field-val">{value}</span>
    </label>
  );
}

function CheckField({
  app,
  label,
  value,
  onChange,
}: {
  app: AppState;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="context-check">
      <Checkbox
        checked={value}
        onCheckedChange={(v) => {
          onChange(v === true);
          app.notify("tool");
        }}
      />
      {label}
    </label>
  );
}

function SelectField({
  app,
  label,
  value,
  choices,
  onChange,
}: {
  app: AppState;
  label: string;
  value: string;
  choices: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="context-field">
      <span>{label}:</span>
      <Select
        value={value}
        onValueChange={(v) => {
          onChange(v);
          app.notify("tool");
        }}
      >
        <SelectTrigger size="sm" className="h-6 min-h-6 w-auto gap-1 rounded-[4px] px-2 py-0 text-[11px] shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="desktop-menu-content">
          {choices.map((c) => (
            <SelectItem key={c} value={c} className="text-[12px]">
              {cap(c)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function ToolOptionsStrip({ app }: { app: AppState }) {
  useAppEvents(app, ["tool", "selection", "sessions"]);
  const id = app.currentTool;
  const cur = getTool(id);
  const needsBrush = [
    "paintbrush",
    "eraser",
    "cloneStamp",
    "recolor",
    "lineCurve",
    "rectangle",
    "roundedRectangle",
    "ellipse",
    "freeform",
    "pencil",
  ].includes(id);
  const fonts = [
    "Segoe UI, system-ui, sans-serif",
    "Georgia, serif",
    "Courier New, monospace",
    "Impact, sans-serif",
    "Arial, sans-serif",
  ];

  return (
    <div className="tool-options-strip ribbon-context-strip" data-testid="ribbon-context-strip">
      <div className="context-tool-indicator">
        <SvgIcon svg={TOOL_SVG[id]} />
        <span className="context-tool-name">{cur.name}</span>
      </div>
      <div className="context-options-row">
        {needsBrush ? (
          <SliderField
            app={app}
            label="Size"
            value={app.options.brushWidth}
            min={1}
            max={200}
            onChange={(v) => {
              app.options.brushWidth = v;
            }}
          />
        ) : null}
        {["paintbrush", "eraser", "cloneStamp", "recolor"].includes(id) ? (
          <>
            <SliderField
              app={app}
              label="Hardness"
              value={Math.round(app.options.hardness * 100)}
              min={0}
              max={100}
              onChange={(v) => {
                app.options.hardness = v / 100;
              }}
            />
            <CheckField
              app={app}
              label="Anti-alias"
              value={app.options.antialias}
              onChange={(v) => {
                app.options.antialias = v;
              }}
            />
            <CheckField
              app={app}
              label="Pressure"
              value={app.options.pressure}
              onChange={(v) => {
                app.options.pressure = v;
              }}
            />
          </>
        ) : null}
        {["magicWand", "paintBucket", "recolor"].includes(id) ? (
          <>
            <SliderField
              app={app}
              label="Tolerance"
              value={app.options.tolerance}
              min={0}
              max={100}
              onChange={(v) => {
                app.options.tolerance = v;
              }}
            />
            <SelectField
              app={app}
              label="Flood"
              value={app.options.floodMode}
              choices={["contiguous", "global"]}
              onChange={(v) => {
                app.options.floodMode = v as "contiguous" | "global";
              }}
            />
            <SelectField
              app={app}
              label="Sampling"
              value={app.options.sampleMode}
              choices={["layer", "image"]}
              onChange={(v) => {
                app.options.sampleMode = v as "layer" | "image";
              }}
            />
          </>
        ) : null}
        {["rectangle", "roundedRectangle", "ellipse", "freeform"].includes(id) ? (
          <SelectField
            app={app}
            label="Draw"
            value={app.options.shapeMode}
            choices={["outline", "filled", "both"]}
            onChange={(v) => {
              app.options.shapeMode = v as "outline" | "filled" | "both";
            }}
          />
        ) : null}
        {id === "roundedRectangle" ? (
          <SliderField
            app={app}
            label="Radius"
            value={app.options.cornerRadius}
            min={0}
            max={100}
            onChange={(v) => {
              app.options.cornerRadius = v;
            }}
          />
        ) : null}
        {id === "gradient" ? (
          <>
            <SelectField
              app={app}
              label="Type"
              value={app.options.gradientType}
              choices={["linear", "radial", "diamond", "conical"]}
              onChange={(v) => {
                app.options.gradientType = v as typeof app.options.gradientType;
              }}
            />
            <CheckField
              app={app}
              label="Alpha only"
              value={app.options.gradientAlphaOnly}
              onChange={(v) => {
                app.options.gradientAlphaOnly = v;
              }}
            />
            <Button type="button" className="context-btn primary h-6 rounded-[4px] px-2.5 text-[11px]" onClick={() => app.commitActiveTool()}>
              Finish
            </Button>
          </>
        ) : null}
        {id === "text" || id === "lineCurve" ? (
          <Button type="button" className="context-btn primary h-6 rounded-[4px] px-2.5 text-[11px]" onClick={() => app.commitActiveTool()}>
            Finish
          </Button>
        ) : null}
        {app.session.floating ? (
          <>
            <Button type="button" className="context-btn primary h-6 rounded-[4px] px-2.5 text-[11px]" onClick={() => app.commitFloating()}>
              Apply paste
            </Button>
            <Button type="button" className="context-btn h-6 rounded-[4px] px-2.5 text-[11px]" variant="outline" onClick={() => app.cancelFloating()}>
              Cancel
            </Button>
          </>
        ) : null}
        {id === "text" ? (
          <>
            <SelectField
              app={app}
              label="Font"
              value={app.options.fontFamily}
              choices={fonts}
              onChange={(v) => {
                app.options.fontFamily = v;
              }}
            />
            <SliderField
              app={app}
              label="Size"
              value={app.options.fontSize}
              min={8}
              max={120}
              onChange={(v) => {
                app.options.fontSize = v;
              }}
            />
            <CheckField
              app={app}
              label="Bold"
              value={app.options.fontBold}
              onChange={(v) => {
                app.options.fontBold = v;
              }}
            />
            <CheckField
              app={app}
              label="Italic"
              value={app.options.fontItalic}
              onChange={(v) => {
                app.options.fontItalic = v;
              }}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

function ToolRail({ app }: { app: AppState }) {
  useAppEvents(app, ["tool"]);
  return (
    <div className="tool-rail" data-testid="tool-rail">
      {RAIL_GROUPS.map((g) => (
        <div key={g.title} className="tool-rail-group" title={g.title}>
          {g.tools.map((toolId) => {
            const t = getTool(toolId);
            const active = app.currentTool === toolId;
            return (
              <Tooltip key={toolId}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={`tool-rail-btn${active ? " active" : ""}`}
                    data-tool={toolId}
                    data-testid={`tool-${toolId}`}
                    aria-label={`${t.name} (${t.shortcut})`}
                    onClick={() => app.setTool(toolId)}
                  >
                    <SvgIcon svg={TOOL_SVG[toolId]} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="rounded-[4px] px-2 py-1 text-[11px]">
                  {t.name}
                  {t.shortcut ? ` (${t.shortcut})` : ""}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function DesktopChrome({
  app,
  railHost,
  thumbHost,
}: {
  app: AppState;
  railHost: HTMLElement;
  thumbHost: HTMLElement;
}) {
  const phase = useChromePhase();
  const strip = <ToolOptionsStrip app={app} />;
  return (
    <TooltipProvider delayDuration={phase === "desktop" ? 400 : 10000}>
      <div className="desktop-chrome">
        <AppMenubar app={app} />
        <TitleRow app={app} />
        {phase !== "tablet" ? strip : null}
      </div>
      {createPortal(<ToolRail app={app} />, railHost)}
      {phase === "tablet"
        ? createPortal(
            <div className="tablet-thumb-strip" data-testid="tablet-thumb-strip">
              {strip}
            </div>,
            thumbHost,
          )
        : null}
    </TooltipProvider>
  );
}

export function unmountDesktopChrome(): void {
  if (chromeRoot) {
    const root = chromeRoot;
    chromeRoot = null;
    flushSync(() => root.unmount());
  }
}

export function mountDesktopChrome(
  host: HTMLElement,
  app: AppState,
  railHost: HTMLElement,
  thumbHost: HTMLElement,
): void {
  unmountDesktopChrome();
  chromeRoot = createRoot(host);
  flushSync(() => {
    chromeRoot!.render(<DesktopChrome app={app} railHost={railHost} thumbHost={thumbHost} />);
  });
}
