import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
  FolderPlusIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import type { AppState } from "@/app-state";
import {
  explorer,
  type ExplorerFileNode,
  type ExplorerFolderNode,
  type ExplorerNode,
} from "@/core/sync";
import { Button } from "@/ui/react/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/react/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/react/components/ui/dropdown-menu";
import { Input } from "@/ui/react/components/ui/input";

const DIALOG_BOX =
  "pdn-dialog flex flex-col gap-0 p-0 rounded-xl sm:max-w-[560px] bg-card shadow-[var(--pdn-shadow)] overflow-hidden";
const BTN = "h-8 min-w-[74px] rounded-md px-3 text-sm font-semibold";
const INP = "h-8 min-h-8 rounded-md px-3 text-sm shadow-none";

type Crumb = { id: string | null; name: string };

function nodeKey(node: ExplorerNode): string {
  return `${node.kind}:${node.id}`;
}

export function ExplorerDialog({ app }: { app: AppState }) {
  const [parentId, setParentId] = useState<string | null>(null);
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ id: null, name: "Root" }]);
  const [nodes, setNodes] = useState<ExplorerNode[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<null | { mode: "new-folder" | "rename"; value: string }>(null);
  const [confirmPermanent, setConfirmPermanent] = useState<ExplorerNode | null>(null);
  const [moveTarget, setMoveTarget] = useState<ExplorerNode | null>(null);
  const [folderChoices, setFolderChoices] = useState<ExplorerFolderNode[]>([]);

  const selected = useMemo(
    () => nodes.find((n) => nodeKey(n) === selectedKey) ?? null,
    [nodes, selectedKey],
  );

  const refresh = useCallback(async () => {
    try {
      const kids = await explorer.listChildren(parentId);
      setNodes(kids);
      setSelectedKey((prev) => (prev && kids.some((n) => nodeKey(n) === prev) ? prev : null));
      setError(null);
    } catch (err) {
      const e = err as Error;
      setError(e?.message || "Failed to load explorer");
    }
  }, [parentId]);

  useEffect(() => {
    void refresh();
    return explorer.subscribe(() => {
      void refresh();
    });
  }, [refresh]);

  const navigateTo = (id: string | null, name: string, crumbIndex?: number) => {
    if (typeof crumbIndex === "number") {
      setCrumbs((prev) => prev.slice(0, crumbIndex + 1));
    } else {
      setCrumbs((prev) => [...prev, { id, name }]);
    }
    setParentId(id);
    setSelectedKey(null);
    setPrompt(null);
  };

  const openFolder = (node: ExplorerFolderNode) => {
    navigateTo(node.id, node.name);
  };

  const openFile = async (node: ExplorerFileNode) => {
    setBusy(true);
    setError(null);
    try {
      const ok = await app.openSyncedDocument(node.id);
      if (!ok) {
        setError("Could not open document from cache.");
        return;
      }
      app.closeDialog();
    } finally {
      setBusy(false);
    }
  };

  const runNewFolder = async () => {
    if (!prompt || prompt.mode !== "new-folder") return;
    setBusy(true);
    setError(null);
    try {
      await explorer.createFolder(prompt.value, parentId);
      setPrompt(null);
      await refresh();
    } catch (err) {
      const e = err as Error;
      setError(e?.message || "Could not create folder");
    } finally {
      setBusy(false);
    }
  };

  const runRename = async () => {
    if (!prompt || prompt.mode !== "rename" || !selected) return;
    setBusy(true);
    setError(null);
    try {
      await explorer.rename(selected, prompt.value);
      setPrompt(null);
      await refresh();
    } catch (err) {
      const e = err as Error;
      setError(e?.message || "Could not rename");
    } finally {
      setBusy(false);
    }
  };

  const runSoftDelete = async (node: ExplorerNode) => {
    setBusy(true);
    setError(null);
    try {
      await explorer.delete(node, { recursive: node.kind === "folder" });
      if (node.kind === "file" && app.sessions.some((s) => s.id === node.id)) {
        app.closeSessionFinal(node.id);
      }
      await refresh();
    } catch (err) {
      const e = err as Error;
      setError(e?.message || "Could not delete");
    } finally {
      setBusy(false);
    }
  };

  const runPermanentDelete = async (node: ExplorerNode) => {
    setBusy(true);
    setError(null);
    try {
      await explorer.permanentDelete(node, { recursive: node.kind === "folder" });
      if (node.kind === "file" && app.sessions.some((s) => s.id === node.id)) {
        app.closeSessionFinal(node.id);
      }
      setConfirmPermanent(null);
      await refresh();
    } catch (err) {
      const e = err as Error;
      setError(e?.message || "Could not permanently delete");
    } finally {
      setBusy(false);
    }
  };

  const beginMove = async (node: ExplorerNode) => {
    setMoveTarget(node);
    try {
      const tree = await explorer.getTree();
      const folders = tree.filter((n): n is ExplorerFolderNode => n.kind === "folder");
      const blocked = new Set<string>();
      if (node.kind === "folder") {
        blocked.add(node.id);
        for (const f of folders) {
          if (f.path === node.path || f.path.startsWith(`${node.path}/`)) blocked.add(f.id);
        }
      }
      setFolderChoices(folders.filter((f) => !blocked.has(f.id)));
    } catch (err) {
      const e = err as Error;
      setError(e?.message || "Could not load folders");
      setMoveTarget(null);
    }
  };

  const runMove = async (newParentId: string | null) => {
    if (!moveTarget) return;
    setBusy(true);
    setError(null);
    try {
      await explorer.move(moveTarget, newParentId);
      setMoveTarget(null);
      await refresh();
    } catch (err) {
      const e = err as Error;
      setError(e?.message || "Could not move");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) app.closeDialog();
      }}
    >
      <DialogContent data-testid="dialog" className={DIALOG_BOX}>
        <DialogHeader className="dialog-head m-0 flex-row items-center justify-between rounded-t-[4px] px-3 py-0 pr-8">
          <DialogTitle className="text-[13px] font-semibold">Explorer</DialogTitle>
          <DialogDescription className="sr-only">Browse and organize cached documents</DialogDescription>
        </DialogHeader>

        <div className="body flex flex-col gap-2 px-3 py-3 text-[12px]">
          <p className="text-muted-foreground leading-snug">
            Soft-closed tabs stay in cache. Use Explorer to reorganize folders or permanently remove cached documents.
          </p>

          <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1.5">
            {crumbs.map((c, i) => (
              <button
                key={`${c.id ?? "root"}-${i}`}
                type="button"
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium hover:bg-muted"
                onClick={() => navigateTo(c.id, c.name, i)}
              >
                {i > 0 ? <ChevronRightIcon className="size-3 opacity-50" /> : null}
                <span className={i === crumbs.length - 1 ? "text-foreground" : "text-muted-foreground"}>{c.name}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className={BTN}
              disabled={busy}
              onClick={() => setPrompt({ mode: "new-folder", value: "New Folder" })}
            >
              <FolderPlusIcon className="size-3.5" />
              New Folder
            </Button>
            <Button
              type="button"
              variant="outline"
              className={BTN}
              disabled={busy || !selected}
              onClick={() => selected && setPrompt({ mode: "rename", value: selected.name })}
            >
              <PencilIcon className="size-3.5" />
              Rename
            </Button>
            <Button
              type="button"
              variant="outline"
              className={BTN}
              disabled={busy || !selected}
              onClick={() => selected && void beginMove(selected)}
            >
              Move...
            </Button>
          </div>

          {prompt ? (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 p-2">
              <Input
                className={INP}
                value={prompt.value}
                autoFocus
                onChange={(e) => setPrompt({ ...prompt, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void (prompt.mode === "new-folder" ? runNewFolder() : runRename());
                  }
                }}
              />
              <Button
                type="button"
                className={BTN}
                disabled={busy || !prompt.value.trim()}
                onClick={() => void (prompt.mode === "new-folder" ? runNewFolder() : runRename())}
              >
                OK
              </Button>
              <Button type="button" variant="outline" className={BTN} onClick={() => setPrompt(null)}>
                Cancel
              </Button>
            </div>
          ) : null}

          {moveTarget ? (
            <div className="rounded-md border border-border bg-muted/20 p-2 space-y-2">
              <div className="font-medium">Move &ldquo;{moveTarget.name}&rdquo; to...</div>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                <Button type="button" variant="outline" size="sm" className="h-7 text-[11px]" disabled={busy} onClick={() => void runMove(null)}>
                  Root
                </Button>
                {folderChoices.map((f) => (
                  <Button
                    key={f.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px]"
                    disabled={busy}
                    onClick={() => void runMove(f.id)}
                  >
                    {f.path}
                  </Button>
                ))}
              </div>
              <Button type="button" variant="ghost" className={BTN} onClick={() => setMoveTarget(null)}>
                Cancel move
              </Button>
            </div>
          ) : null}

          {confirmPermanent ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 space-y-2">
              <div className="font-medium text-destructive">Permanently delete &ldquo;{confirmPermanent.name}&rdquo;?</div>
              <p className="text-[11px] text-muted-foreground">
                Removes the item from local cache. Soft delete keeps a sync-friendly tombstone.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  className={`${BTN} bg-destructive text-destructive-foreground hover:bg-destructive/90`}
                  disabled={busy}
                  onClick={() => void runPermanentDelete(confirmPermanent)}
                >
                  Delete permanently
                </Button>
                <Button type="button" variant="outline" className={BTN} onClick={() => setConfirmPermanent(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          <div className="min-h-[220px] max-h-[320px] overflow-y-auto rounded-md border border-border">
            {nodes.length === 0 ? (
              <div className="flex h-[220px] items-center justify-center px-4 text-center text-muted-foreground italic">
                No items here yet. Soft-closed documents and new folders will appear in this virtual tree.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {nodes.map((node) => {
                  const key = nodeKey(node);
                  const active = key === selectedKey;
                  return (
                    <li key={key}>
                      <div
                        className={`flex items-center gap-2 px-2 py-1.5 ${active ? "bg-primary/10" : "hover:bg-muted/40"}`}
                        onClick={() => setSelectedKey(key)}
                        onDoubleClick={() => {
                          if (node.kind === "folder") openFolder(node);
                          else void openFile(node);
                        }}
                      >
                        {node.kind === "folder" ? (
                          <FolderIcon className="size-4 text-amber-600 shrink-0" />
                        ) : (
                          <FileIcon className="size-4 text-sky-600 shrink-0" />
                        )}
                        <button
                          type="button"
                          className="flex-1 truncate text-left text-[12px] font-medium"
                          onClick={() => setSelectedKey(key)}
                        >
                          {node.name}
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <MoreHorizontalIcon className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="desktop-menu-content min-w-[160px]">
                            {node.kind === "folder" ? (
                              <DropdownMenuItem onClick={() => openFolder(node)}>Open</DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => void openFile(node)}>Open</DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedKey(key);
                                setPrompt({ mode: "rename", value: node.name });
                              }}
                            >
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void beginMove(node)}>Move...</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => void runSoftDelete(node)}>Soft delete</DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setConfirmPermanent(node)}
                            >
                              <Trash2Icon className="size-3.5" />
                              Delete permanently...
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {error ? <div className="text-destructive text-[11px]">{error}</div> : null}
        </div>

        <DialogFooter className="flex-row items-center justify-end gap-2 px-3 pb-3 sm:justify-end">
          <Button type="button" data-dialog-primary className={BTN} onClick={() => app.closeDialog()}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
