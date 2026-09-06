import type { AppState } from "./app-state";
import { ALL_TOOLS } from "./tools/registry";
import { ALL_EFFECTS, getEffect } from "./effects/registry";
import { paramMap } from "./effects/base";
import { cycleThemePref } from "./core/theme";

export type CommandGroup = "file" | "edit" | "image" | "adjust" | "effects" | "view" | "window" | "tools" | "help";

export type Command = {
  id: string;
  label: string;
  shortcut?: string;
  group: CommandGroup;
  run: (app: AppState) => void;
  enabled?: (app: AppState) => boolean;
};

const GROUP_ORDER: CommandGroup[] = ["file", "edit", "image", "adjust", "effects", "view", "window", "tools", "help"];

const GROUP_LABELS: Record<CommandGroup, string> = {
  file: "File",
  edit: "Edit",
  image: "Image",
  adjust: "Adjustments",
  effects: "Effects",
  view: "View",
  window: "Window",
  tools: "Tools",
  help: "Help",
};

function runEffect(app: AppState, id: string): void {
  const e = getEffect(id);
  if (!e) return;
  if (e.params.length) app.openDialog({ type: "effect", effectId: id });
  else app.applyEffect(e, paramMap(e.params));
}

const FILE_EDIT_IMAGE: Command[] = [
  { id: "file.new", label: "New...", shortcut: "Ctrl+N", group: "file", run: (app) => app.openDialog({ type: "new" }) },
  { id: "file.open", label: "Open...", shortcut: "Ctrl+O", group: "file", run: (app) => void app.openFiles() },
  { id: "file.download", label: "Download Export...", shortcut: "Ctrl+Shift+S", group: "file", run: (app) => void app.download() },
  { id: "file.sync", label: "Folder Sync...", shortcut: "Ctrl+Shift+U", group: "file", run: (app) => app.openDialog({ type: "sync" }) },
  { id: "file.settings", label: "Settings...", shortcut: "Alt+X", group: "file", run: (app) => app.openDialog({ type: "settings" }) },

  { id: "edit.undo", label: "Undo", shortcut: "Ctrl+Z", group: "edit", run: (app) => app.undo(), enabled: (app) => app.history.canUndo },
  { id: "edit.redo", label: "Redo", shortcut: "Ctrl+Y", group: "edit", run: (app) => app.redo(), enabled: (app) => app.history.canRedo },
  { id: "edit.cut", label: "Cut", shortcut: "Ctrl+X", group: "edit", run: (app) => void app.cut() },
  { id: "edit.copy", label: "Copy", shortcut: "Ctrl+C", group: "edit", run: (app) => void app.copy(false) },
  { id: "edit.copyMerged", label: "Copy Merged", shortcut: "Ctrl+Shift+C", group: "edit", run: (app) => void app.copy(true) },
  { id: "edit.paste", label: "Paste", shortcut: "Ctrl+V", group: "edit", run: (app) => void app.paste("normal") },
  { id: "edit.selectAll", label: "Select All", shortcut: "Ctrl+A", group: "edit", run: (app) => app.selectAll() },
  { id: "edit.deselect", label: "Deselect", shortcut: "Ctrl+D", group: "edit", run: (app) => app.deselect() },
  { id: "edit.invertSelection", label: "Invert Selection", shortcut: "Ctrl+I", group: "edit", run: (app) => app.invertSelection() },
  {
    id: "edit.crop",
    label: "Crop to Selection",
    shortcut: "Ctrl+Shift+X",
    group: "edit",
    run: (app) => app.cropToSelection(),
    enabled: (app) => !app.selection.empty,
  },

  { id: "image.resize", label: "Resize...", shortcut: "Ctrl+R", group: "image", run: (app) => app.openDialog({ type: "resize" }) },
  { id: "image.canvasSize", label: "Canvas Size...", shortcut: "Ctrl+Shift+R", group: "image", run: (app) => app.openDialog({ type: "canvas" }) },
  { id: "image.flatten", label: "Flatten", shortcut: "Ctrl+Shift+F", group: "image", run: (app) => app.flatten() },
  { id: "image.rotate90cw", label: "Rotate 90° Clockwise", shortcut: "Ctrl+H", group: "image", run: (app) => app.transform("rotate90cw") },
  { id: "image.rotate90ccw", label: "Rotate 90° Counter-Clockwise", shortcut: "Ctrl+G", group: "image", run: (app) => app.transform("rotate90ccw") },
  { id: "image.rotate180", label: "Rotate 180°", group: "image", run: (app) => app.transform("rotate180") },
  { id: "image.flipH", label: "Flip Horizontal", group: "image", run: (app) => app.transform("flipH") },
  { id: "image.flipV", label: "Flip Vertical", group: "image", run: (app) => app.transform("flipV") },

  {
    id: "view.zoomIn",
    label: "Zoom In",
    shortcut: "Ctrl++",
    group: "view",
    run: (app) => {
      app.viewport.zoomIn();
      app.notify("viewport");
    },
  },
  {
    id: "view.zoomOut",
    label: "Zoom Out",
    shortcut: "Ctrl+-",
    group: "view",
    run: (app) => {
      app.viewport.zoomOut();
      app.notify("viewport");
    },
  },
  { id: "view.fit", label: "Fit to View", shortcut: "Ctrl+B", group: "view", run: (app) => app.fitToView() },
  {
    id: "view.actualSize",
    label: "Actual Size",
    shortcut: "Ctrl+0",
    group: "view",
    run: (app) => {
      app.viewport.actualSize(app.document.width, app.document.height);
      app.notify("viewport");
    },
  },
  {
    id: "view.rulers",
    label: "Rulers",
    group: "view",
    run: (app) => {
      app.viewport.showRulers = !app.viewport.showRulers;
      app.notify("viewport");
    },
  },
  {
    id: "view.pixelGrid",
    label: "Pixel Grid",
    group: "view",
    run: (app) => {
      app.viewport.showPixelGrid = !app.viewport.showPixelGrid;
      app.notify("viewport");
    },
  },
  {
    id: "view.theme",
    label: "Cycle Theme",
    group: "view",
    run: (app) => {
      app.settings.theme = cycleThemePref(app.settings.theme);
      app.applyTheme();
      void app.persistSettings();
    },
  },

  { id: "window.tools", label: "Tools", shortcut: "F5", group: "window", run: (app) => app.toggleWindow("tools") },
  { id: "window.history", label: "History", shortcut: "F6", group: "window", run: (app) => app.toggleWindow("history") },
  { id: "window.layers", label: "Layers", shortcut: "F7", group: "window", run: (app) => app.toggleWindow("layers") },
  { id: "window.colors", label: "Colors", shortcut: "F8", group: "window", run: (app) => app.toggleWindow("colors") },

  { id: "help.shortcuts", label: "Keyboard Shortcuts", shortcut: "F1", group: "help", run: (app) => app.openDialog({ type: "shortcuts" }) },
  { id: "help.about", label: "About paint.web", group: "help", run: (app) => app.openDialog({ type: "about" }) },
];

const TOOL_COMMANDS: Command[] = ALL_TOOLS.map((t) => ({
  id: `tool.${t.id}`,
  label: t.name,
  shortcut: t.shortcut || undefined,
  group: "tools" as const,
  run: (app: AppState) => app.setTool(t.id),
}));

const EFFECT_COMMANDS: Command[] = ALL_EFFECTS.map((e) => ({
  id: e.menu === "Adjustments" ? `adj.${e.id}` : `effect.${e.id}`,
  label: e.name + (e.params.length ? "..." : ""),
  shortcut: e.shortcut,
  group: (e.menu === "Adjustments" ? "adjust" : "effects") as CommandGroup,
  run: (app: AppState) => runEffect(app, e.id),
}));

export const ALL_COMMANDS: Command[] = [...FILE_EDIT_IMAGE, ...TOOL_COMMANDS, ...EFFECT_COMMANDS];

const byId = new Map(ALL_COMMANDS.map((c) => [c.id, c]));

export function getCommand(id: string): Command | undefined {
  return byId.get(id);
}

export function runCommand(app: AppState, id: string): boolean {
  const cmd = byId.get(id);
  if (!cmd) return false;
  if (cmd.enabled && !cmd.enabled(app)) return false;
  cmd.run(app);
  return true;
}

export function commandsByGroup(): { group: CommandGroup; label: string; commands: Command[] }[] {
  return GROUP_ORDER.map((group) => ({
    group,
    label: GROUP_LABELS[group],
    commands: ALL_COMMANDS.filter((c) => c.group === group),
  })).filter((g) => g.commands.length);
}
