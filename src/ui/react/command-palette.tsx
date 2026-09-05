import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { AppState } from "@/app-state";
import { commandsByGroup, runCommand } from "@/commands";
import { AppDialogs } from "@/ui/react/app-dialogs";
import { useAppEvents } from "@/ui/react/use-app";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/ui/react/components/ui/command";

let paletteOpen = false;
/** Stays true through the rest of the keydown that dismissed the palette (Radix capture vs window bubble). */
let suppressAppShortcuts = false;
let setPaletteOpen: Dispatch<SetStateAction<boolean>> | null = null;
let reactRoot: Root | null = null;

function notePaletteOpen(next: boolean): void {
  if (paletteOpen && !next) {
    suppressAppShortcuts = true;
    queueMicrotask(() => {
      suppressAppShortcuts = false;
    });
  }
  paletteOpen = next;
}

export function isCommandPaletteOpen(): boolean {
  return paletteOpen || suppressAppShortcuts;
}

export function openCommandPalette(): void {
  setPaletteOpen?.(true);
}

export function closeCommandPalette(): void {
  setPaletteOpen?.(false);
}

export function toggleCommandPalette(): void {
  setPaletteOpen?.((open) => !open);
}

function CommandPalette({
  app,
  open,
  onOpenChange,
}: {
  app: AppState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  useAppEvents(app, ["selection", "history", "windows", "theme", "viewport", "tool", "layers"]);
  const groups = commandsByGroup();

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} showCloseButton={false}>
      <CommandInput placeholder="Type a command..." />
      <CommandList>
        <CommandEmpty>No matching commands.</CommandEmpty>
        {groups.map((g) => (
          <CommandGroup key={g.group} heading={g.label}>
            {g.commands.map((cmd) => {
              const disabled = cmd.enabled ? !cmd.enabled(app) : false;
              return (
                <CommandItem
                  key={cmd.id}
                  value={`${cmd.label} ${cmd.id}`}
                  keywords={[cmd.label]}
                  disabled={disabled}
                  onSelect={() => {
                    if (disabled) return;
                    onOpenChange(false);
                    queueMicrotask(() => {
                      runCommand(app, cmd.id);
                    });
                  }}
                >
                  <span className="min-w-0 truncate">{cmd.label}</span>
                  {cmd.shortcut ? <CommandShortcut>{cmd.shortcut}</CommandShortcut> : null}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

function PaletteRoot({ app }: { app: AppState }) {
  const [open, setOpen] = useState(false);
  notePaletteOpen(open);

  useEffect(() => {
    const apply: Dispatch<SetStateAction<boolean>> = (action) => {
      setOpen((prev) => {
        const next = typeof action === "function" ? action(prev) : action;
        notePaletteOpen(next);
        return next;
      });
    };
    setPaletteOpen = apply;
    return () => {
      if (setPaletteOpen === apply) setPaletteOpen = null;
      paletteOpen = false;
      suppressAppShortcuts = false;
    };
  }, []);

  return (
    <>
      <CommandPalette
        app={app}
        open={open}
        onOpenChange={(next) => {
          notePaletteOpen(next);
          setOpen(next);
        }}
      />
      <AppDialogs app={app} />
    </>
  );
}

export function unmountCommandPalette(): void {
  reactRoot?.unmount();
  reactRoot = null;
  setPaletteOpen = null;
  paletteOpen = false;
  suppressAppShortcuts = false;
  document.getElementById("react-overlay")?.remove();
}

export function mountCommandPalette(app: AppState): void {
  let host = document.getElementById("react-overlay");
  if (!host) {
    host = document.createElement("div");
    host.id = "react-overlay";
    document.body.append(host);
  }
  if (!reactRoot) reactRoot = createRoot(host);
  flushSync(() => {
    reactRoot!.render(<PaletteRoot app={app} />);
  });
}
