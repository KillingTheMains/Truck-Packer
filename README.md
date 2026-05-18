# Truck Packer

Real-time logistics tool for managing truck loads at live events. Drag-and-drop
trailer canvas, multi-show Firestore sync, PDF generation, live status
dashboards, barcode scanning, and per-show activity logs.

Live: <https://killingthemains.github.io/Truck-Packer/>

## Project layout

```
index.html                  HTML shell + inline CSS + CDN scripts + Firebase init
src/main.jsx                React app (single file, ~6,300 lines — to be split)
vite.config.js              Vite build config (base = /Truck-Packer/)
eslint.config.js            ESLint flat config (no-undef + a few other essentials)
.github/workflows/deploy.yml CI: build with Vite, deploy to GitHub Pages
package.json                npm scripts (dev / build / preview / lint)
```

## Dev workflow

Requires Node 20+.

```bash
npm install        # one time
npm run dev        # local dev server with hot reload (http://localhost:5173)
npm run lint       # run ESLint (errors fail, warnings just report)
npm run build      # produce dist/ (what gets deployed)
npm run preview    # serve the built dist/ locally
```

Open `http://localhost:5173/Truck-Packer/` for dev (Vite respects the `base`
prefix from the config so dev and production URLs match).

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which:

1. Installs deps with `npm ci`
2. Runs `npm run lint` (fails the build on errors)
3. Runs `npm run build`
4. Uploads `dist/` to GitHub Pages

There is no manual deploy step.

**One-time setup** (already done): in repo Settings → Pages → Source, set to
"GitHub Actions" (not "Branch").

## CDNs (kept on purpose)

React, ReactDOM, Firebase, jsPDF, LZ-String, and html2canvas load from CDNs
via `<script>` tags in `index.html` rather than npm imports. This keeps the
Vite bundle small (~250 KB gzip) and means upgrading any of these libraries
is a single URL change. The trade-off is that `src/main.jsx` references them
as globals (`React`, `firebase`, `db`, `jspdf`, etc.), which the ESLint config
declares so `no-undef` doesn't false-positive.

## Firestore layout

```
/events/{slug}/layouts/{truckId}     placed items + scans for one trailer
/events/{slug}/meta/{truckId}        trailer metadata (#, driver, contents…)
/events/{slug}/status/{truckId}      status (staged/loaded/dispatched/…)
/events/{slug}/logs/{docId}          activity feed
/events/{slug}/cases/{caseId}        scanned case → current truck
/events/{slug}/config/event          event name, total-load offset
/events/{slug}                       top-level: name, slug, createdAt

/config/library                      GLOBAL item library (shared across shows)
/config/currentShow                  { eventId } — which show the public dashboard shows
```

Each `{slug}` is the show identifier (e.g. `sap-sapphire-26`). New shows
created via the splash screen get their own namespace; nothing is shared
across events except the item library and the currentShow pointer.

## Per-show localStorage

Show-specific data uses keys like `truckPacker_curId_{slug}`. Global user
preferences (view, signFont, stackHighlight) use plain `truckPacker_*`.
Switching shows never reads another show's cached fleet.
