# @yearlylabs/local-sync

Generic **browser** library so any PWA can map a user-picked local folder (often inside OneDrive / Google Drive / Dropbox / iCloud), persist the directory handle in IndexedDB, and sync **granular documents** across machines with last-write-wins or explicit conflict handling.

Inspired by Pidro folder sync, but **app-agnostic** — no game types.

## Install

Private package for now. Use a local path or GitHub Packages until published.

## Browser support

Chromium desktop and recent desktop Safari support folder sync via the File System Access API. Firefox and iOS Safari typically do not: status becomes unsupported and the library still uses IndexedDB only.

## On-disk layout

    mapped-folder/
      localsync/
        appId/
          meta.json
          collections/collection/docId.json
          blobs/collection/docId/blobKey

Document fields: version, id, collection, updatedAt, createdAt, deletedAt, deviceId, rev, baseUpdatedAt, payload.

Prefs tip: store one key per setting (prefs/theme.json, prefs/brushSize.json) so whole-settings-blob conflicts stay rare.

## Quick start

    import { createLocalSync } from '@yearlylabs/local-sync'

    const sync = createLocalSync({ appId: 'paint', conflictPolicy: 'detect' })
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

- createLocalSync({ appId, conflictPolicy? }) — factory
- isSupported() / getState() / subscribe(fn) — capability + status
- init() — restore directory handle from IndexedDB
- mapFolder() / unmapFolder() / requestPermission() — folder binding
- put(collection, id, payload) — upsert (clears tombstone)
- get / list — read non-deleted docs from IndexedDB
- delete(collection, id) — tombstone (sync-friendly delete)
- sync() — folder to IDB merge cycle
- onConflict / listConflicts / resolveConflict — conflict UX

Also exported: mergeDocuments, mergeOne, compareUpdatedAt for tests or custom pipelines.

## Merge and conflict rules

1. Different ids — keep both (granularity wins).
2. Same id, one side changed (baseUpdatedAt matches the other side updatedAt) — take the child.
3. Same id, both changed since a common base —
   - lww: newer updatedAt wins (tie-break deviceId, then rev).
   - detect: surface conflict; do not silently clobber.
4. Tombstones: delete wins if tombstone newer than live update; otherwise live resurrects.
5. Unresolved conflicts keep the local copy in IDB until resolveConflict.

## Paint-app sketch

    const sync = createLocalSync({ appId: 'paint', conflictPolicy: 'detect' })
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

Screenshot PWA: appId screenshot; collections captures and prefs; optional blobs for images; replace localStorage history with put/list and periodic sync.

Pidro: appId pidro; one JSON per game instead of monolithic history.json; migrate existing folder files once for granular merge.

## Development

Install deps, run test, and build with your Node toolchain (Vitest + tsup). Scripts: test, build, typecheck.

## License

Private Yearly Labs package.
