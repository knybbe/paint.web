# paint.web

An unofficial, fully offline-capable Progressive Web App inspired by **Paint.NET** (Rick Brewster / dotPDN LLC). It is a browser-native image editor: layers, history, tools, adjustments, effects, and adaptive chrome (desktop menubar + tool rail + inspectors; tablet hybrid; phone command deck).

**Live:** [https://knybbe.github.io/paint.web/](https://knybbe.github.io/paint.web/)

**Not affiliated with or endorsed by Rick Brewster or dotPDN LLC.** Paint.NET is a trademark of its respective owners. This project reimplements familiar behavior for the web; it does not use Paint.NET source code or proprietary assets.

## Features

- 100% client-side after first load (no server, no account, no cloud)
- Installable PWA with a service worker that caches the entire app
- Multi-document tabs, multi-layer documents, unlimited undo/redo (capped)
- Tools, menus, and shortcuts aligned with Paint.NET 4/5; command palette via Ctrl/Cmd+K
- Dark and light themes, HiDPI-correct canvas drawing, and chrome that switches by viewport: desktop menubar + tool rail + inspectors, tablet hybrid, phone deck
- Fit to View, continuous trackpad pinch zoom, and File > Open Recent that reopens stored images
- Open PNG / JPEG / BMP / GIF / WebP / `.pdnweb`; save those plus a layered `.pdnweb` format

## How to run locally

Requires Node.js 20+.

```bash
npm install
npm run icons          # generates PWA PNG icons (already committed under public/icons)
npm run dev            # http://localhost:5173
```

Any static file server works after a production build. The File System Access API and service worker need a **secure context** (localhost or HTTPS).

## How to build for production

```bash
npm test
npm run build
npm run preview        # serves dist/ with the service worker
```

`dist/` is a static site. Host it on GitHub Pages, Netlify, nginx, or any object store. The Vite PWA plugin emits a service worker that precaches JS, CSS, HTML, icons, and the web manifest (cache-first, with `index.html` as the navigation fallback).

After the first visit the app loads and edits with the network disabled.

## Architecture

| Area | Location |
| --- | --- |
| Document, layers, pixels, blend, selection | `src/core/` |
| Undo/redo (command snapshots) | `src/core/history.ts`, `src/app-state.ts` |
| Tools | `src/tools/` |
| Adjustments & effects | `src/effects/` |
| UI chrome (desktop menubar, tool rail, inspectors, phone deck, canvas) | `src/ui/` |
| Shortcuts | `src/shortcuts.ts` |
| PWA | `public/manifest.webmanifest`, `vite-plugin-pwa` |

Pixel data lives in `PixelBuffer` (typed arrays) so the document model is testable without a browser. The display path composites layers, then blits to a workspace canvas with nearest-neighbor zoom-in, a checkerboard, optional pixel grid, rulers, guides, and marching ants.

## Feature status

| Area | Status |
| --- | --- |
| PWA / offline / install | **Full** — manifest, icons, Workbox precache, file handlers |
| Layers (opacity, blend, visibility, lock, reorder, merge, flatten, duplicate) | **Full** for the classic 14 Paint.NET blend modes |
| Layer masks | **Basic** — per-layer grayscale mask in the model and compositor; no dedicated mask UI yet |
| History panel + undo/redo | **Full** (pixel snapshots; memory-limited) |
| Image / canvas size, rotate, flip, crop | **Full** |
| Zoom, pan, Fit to View, rulers, pixel grid, guides | **Full** (pinch / Ctrl+wheel is continuous; Fit to View is on the title row, status bar, and View menu) |
| Selection tools (rect, ellipse, lasso, wand) + combine modes | **Full** |
| Move selection / move pixels (nubs, rotate, copy) | **Full** (approximate of PDN’s transform nubs) |
| Pencil, brush, eraser, bucket, gradient, picker | **Full** |
| Clone stamp, recolor, text, line/curve, shapes | **Full** (text is a single-line stamp; PDN 5 rich text is not cloned) |
| Pressure, anti-alias, brush width `[` `]` | **Full** where the Pointer Events API exposes pressure |
| Adjustments (auto-level, B&W, brightness, curves, HSL, invert, invert alpha, levels, posterize, sepia) | **Full** with live preview |
| Effects (Gaussian / motion / radial blur, sharpen, noise, reduce noise, median, oil, emboss, edges, outline, polar invert, twist, tile reflection, pixelate, bulge, clouds, Julia) | **Implemented** (faithful results, not bit-identical to PDN) |
| File open/save + File System Access API | **Full** with download/upload fallback |
| Clipboard | **Full** via `ClipboardItem` + in-memory fallback |
| Keyboard shortcuts | **Full** for the documented PDN command set used here |
| Dark / light theme | **Full** |
| Phone / tablet chrome | **Full** — phone command deck + sheets; tablet hybrid (menubar, rail, inspector); desktop menubar + tool rail + docks. Ctrl/Cmd+K opens the command palette |
| IndexedDB settings + recent list | **Full** (Open Recent reopens stored file blobs) |
| Restore workspace after refresh/close (including undo/redo) | **Full** |
| Floating paste (apply on Enter or tool change) | **Full** |
| Native `.pdn` files | **Not supported** (proprietary .NET binary). Use PNG or `.pdnweb` |
| Plugins / Indirect UI / custom brushes | **Not implemented** |
| Print | **Basic** (opens a printable flattened image) |

## Known limitations vs native Paint.NET

- Not pixel-identical. Blend math, anti-aliasing, and effect kernels are independent implementations.
- Native `.pdn` cannot be opened. Layered documents use a documented JSON+PNG format: **`.pdnweb`**.
- TIFF is not a first-class save format (some browsers can *open* TIFF via `createImageBitmap`).
- GIF save is a simple 256-color single frame, not animation.
- Effects run on the main thread; very large canvases (8K, many layers) will hitch. Tiling/WebGL acceleration is structured for later, not complete.
- Undo stores layer snapshots, so history memory grows with image size. The stack is capped (default 80).
- No selection antialiasing feather beyond raster masks; no PDN 5 shape engine / fancy brushes / image-well.
- Color management is sRGB only (no ICC).
- This is not a substitute for Paint.NET when you need plugin compatibility or exact file interchange.

## Tests

```bash
npm test                 # unit tests (document, history, blend, selection)
npm run test:e2e         # Playwright: shell, menus, dialogs, tools, layers (writes e2e/artifacts/*.png)
npm run test:visual      # write/update visual snapshot baselines
npm run test:visual:check  # fail if chrome/menus/dialogs changed
```

`npm test` also runs jsdom **interaction tests** (`tests/ui-chrome.test.ts`) that click menus, dialogs, tools, and layer commands. Those would have failed on the original menu bug (mousedown rebuilt the bar so the document listener treated the click as “outside”).

The first time you run Playwright on a machine:

```bash
npx playwright install chromium
npx playwright install-deps chromium   # Linux: ATK/GTK libs; needs sudo
```

Open `e2e/artifacts/` after `test:e2e` to inspect screenshots. Pixel baselines live in `e2e/visual.spec.ts-snapshots/`.

Unit tests cover color conversion, blend math, the document/layer model, selection/flood-fill, and history undo/redo including pixel restore.

## License

MIT. See [LICENSE](LICENSE).
