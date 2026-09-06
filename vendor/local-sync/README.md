# @yearlylabs/local-sync

Generic **browser** library so any PWA can map a user-picked local folder (often inside OneDrive / Google Drive / Dropbox / iCloud), persist the directory handle in IndexedDB, and sync **granular documents** across machines with last-write-wins or explicit conflict handling.

Inspired by Pidro folder sync, but **app-agnostic** — no game types.

## Install

Private package for now. Use a local path or GitHub Packages until published.

## Browser support

Chromium desktop and recent desktop Safari support folder sync via the File System Access API. Firefox and iOS Safari typically do not: status becomes unsupported and the library still uses IndexedDB only.

## On-disk layout

    mapped-folder/
      <appRootName>/
        meta.json
        collections/collection/docId.json
        blobs/collection/docId/blobKey

The mapped directory contains the app root directory directly (e.g. `Paint/`), with no `localsync/` intermediate nesting. Directory resolution is idempotent and case-insensitive (e.g. reuses existing `Paint/` even if requested as `paint/`), preventing duplicate folders across filesystems.

Document fields: version, id, collection, updatedAt, createdAt, deletedAt, deviceId, rev, baseUpdatedAt, payload.

Prefs tip: store one key per setting (prefs/theme.json, prefs/brushSize.json) so whole-settings-blob conflicts stay rare.

## Quick start

    import { createLocalSync } from '@yearlylabs/local-sync'

    const sync = createLocalSync({ appRootName: 'Paint', conflictPolicy: 'detect' })
    await sync.init()
    await sync.mapFolder()
    await sync.put('documents', 'sketch-1', { strokes: [], name: 'Untitled' })
    await sync.put('prefs', 'theme', 'dark')
    await sync.sync()

    sync.onConflict(async ({ local, remote }) => 'local')
    for (const c of sync.listConflicts()) {
      await sync.resolveConflict(c.collection, c.id, 'remote')
    }

## API summary

- `createLocalSync({ appRootName, appId?, conflictPolicy?, dbName?, deviceIdKey? })` — factory (`appRootName` required; `appId` accepted as alias)
- `isSupported()` / `getState()` / `subscribe(fn)` — capability + status
- `init()` — restore directory handle from IndexedDB; validates handle accessibility
- `mapFolder()` / `unmapFolder()` / `requestPermission()` — folder binding
- `clearError()` — clear error state and reset status
- `put(collection, id, payload)` — upsert (clears tombstone)
- `get` / `list` — read non-deleted docs from IndexedDB
- `delete(collection, id)` — tombstone (sync-friendly delete)
- `hardDelete(collection, id)` — tombstone on disk + wipe local IndexedDB row
- `sync()` — folder to IDB merge cycle (sequenced to prevent write races)
- `onConflict` / `listConflicts` / `resolveConflict` — conflict UX

Also exported: `createExplorer`, `sortExplorerNodes`, `validateName`, `getAppDir`, `getDir`, `isNotFoundError`, `isFolderSyncSupported`, `mergeDocuments`, `mergeOne`, `compareUpdatedAt`.

## Explorer (Virtual File Tree)

The Explorer module provides a headless, sync-friendly virtual file tree for browsing, organizing, and managing application documents and subfolders.

- **Sync-friendly metadata**: Folders (`_folders`) and file placements (`_placements`) are stored as standard `SyncDocument` envelopes. They sync automatically via the folder sync engine and work fully offline in IndexedDB.
- **Host-agnostic**: The host app configures which collections appear as files (e.g. `['documents', 'images']`). Host documents without explicit placements appear at the virtual root (`/`).
- **Headless & zero UI dependencies**: Pure TypeScript core with optional helpers like `sortExplorerNodes`. UI hosts (React, Svelte, Vue, vanilla DOM) consume the explorer via its subscription and async methods.
- *Note: `paint.web` will consume this API in Phase C‒.*

### Creating an explorer

```ts
import { createLocalSync, createExplorer, sortExplorerNodes } from '@yearlylabs/local-sync'

const sync = createLocalSync({ appRootName: 'Paint' })
await sync.init()

const explorer = createExplorer(sync, {
  collections: ['documents', 'images'],
  foldersCollection: '_folders', // default '_folders'
  placementsCollection: '_placements', // default '_placements'
  getDisplayName: (doc) => (doc.payload as any)?.name ?? doc.id,
})
```

### Operations

- `listChildren(parentId?: string | null)`: Lists immediate child folders and files under `parentId` (pass `null` or omit for root). Returns sorted nodes (folders first, alphabetical).
- `getTree()`: Returns a flat array of all folders and files with resolved absolute paths (e.g. `/Drawings/Sketches/logo.json`) in pre-order traversal order.
- `createFolder(name, parentId?)`: Creates a new folder. Validates that names are trimmed, non-empty, contain no slashes (`/` or `\`), and are not `.` or `..`.
- `rename(node, newName)`: Renames a folder or file. For files, stores the custom display name in its placement record.
- `move(node, newParentId)`: Moves a file or folder into another folder (or `null` for virtual root). Guards against moving a folder into itself or any of its descendants.
- `delete(node, { recursive?: boolean })`: Soft delete. Tombstones documents via `sync.delete()`, syncing deletion to connected devices. Folders with children reject unless `recursive: true`.
- `permanentDelete(node, { recursive?: boolean })`: Permanent delete. Best-effort write-through of tombstone when mapped to notify peers, then completely removes the local IndexedDB cache row (`hardDelete`).
- `ensurePlacement(collection, docId, parentId?, name?)`: Links or updates a host document's location and display name in the virtual tree.
- `subscribe(listener)`: Subscribes to changes in the explorer tree (reacts to sync cycles, folder creations, renames, moves, and deletions).

### Soft vs Permanent Delete

| Operation | Remote peers & mapped folder | Local IndexedDB | Use case |
| :--- | :--- | :--- | :--- |
| **`delete()`** (Soft) | Tombstone written to disk & synced | Document retained with `deletedAt` | Standard user deletions with sync history |
| **`permanentDelete()`** | Tombstone written to disk & synced | Row wiped via `deleteDocKey` | Freeing local disk space while syncing removal |

### React Host Example

The Explorer core has no React dependencies. Here is an example of wiring it in a React component:

```tsx
import { useEffect, useState } from 'react'
import { createExplorer, sortExplorerNodes, type Explorer, type ExplorerNode } from '@yearlylabs/local-sync'

export function FileTree({ explorer }: { explorer: Explorer }) {
  const [nodes, setNodes] = useState<ExplorerNode[]>([])

  useEffect(() => {
    async function refresh() {
      const tree = await explorer.getTree()
      setNodes(tree)
    }
    refresh()
    return explorer.subscribe(refresh)
  }, [explorer])

  return (
    <ul className="file-tree">
      {nodes.map((node) => (
        <li key={`${node.kind}:${node.id}`} style={{ paddingLeft: `${node.path.split('/').length * 12}px` }}>
          {node.kind === 'folder' ? '📁' : '📄'} {node.name}
        </li>
      ))}
    </ul>
  )
}
```

## Robust directory resolution & stale handle recovery

- **Idempotent directory resolution**: `getDir` and `getAppDir` inspect existing entries case-insensitively and reuse existing handles. In-flight requests are deduplicated so rapid concurrent calls never create duplicate folders.
- **Atomic file writes**: `writeJsonFile` and `writeBlob` abort streams and clean up files if writes fail, never leaving half-created corrupted trees.
- **Stale handle & NotFound hardening**: If a mapped folder is moved, deleted, or unmounted, operations surface clear remount guidance (`"Sync folder not found or moved. Please reconnect or change folder."`) instead of cryptic DOMExceptions. Reconnecting via `mapFolder()`, unmapping via `unmapFolder()`, or calling `clearError()` clears the error state.

## Merge and conflict rules

1. Different ids — keep both (granularity wins).
2. Same id, one side changed (baseUpdatedAt matches the other side updatedAt) — take the child.
3. Same id, both changed since a common base —
   - lww: newer updatedAt wins (tie-break deviceId, then rev).
   - detect: surface conflict; do not silently clobber.
4. Tombstones: delete wins if tombstone newer than live update; otherwise live resurrects.
5. Unresolved conflicts keep the local copy in IDB until resolveConflict.

## Paint-app sketch

    const sync = createLocalSync({ appRootName: 'Paint', conflictPolicy: 'detect' })
    await sync.init()

    async function saveDocument(id, data) {
      await sync.put('documents', id, data)
    }
    async function saveUndoStack(docId, stack) {
      await sync.put('undo', docId, stack)
    }
    async function setPref(key, value) {
      await sync.put('prefs', key, value)
    }
    window.addEventListener('focus', () => { void sync.sync() })

## Adopting later

Screenshot PWA: `appRootName: 'Screenshot'`; collections captures and prefs; optional blobs for images; replace localStorage history with put/list and periodic sync.

Pidro: `appRootName: 'Pidro'`; one JSON per game instead of monolithic history.json; migrate existing folder files once for granular merge.

## Development

Install deps, run test, and build with your Node toolchain (Vitest + tsup). Scripts: test, build, typecheck.

## License

Private Yearly Labs package.
