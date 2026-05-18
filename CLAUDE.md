# Truck Packer — Project Notes for Claude Code

This file is a handoff doc for Claude Code sessions. It documents
architecture, conventions, and known traps. Update it as the codebase
evolves.

## Repo layout

```
index.html                       HTML shell + CSS + CDN scripts + Firebase init
                                 (Vite injects the bundled JS at build time)
src/main.jsx                     React app (single file, ~6,300 lines)
src/data/                        Pure data (library, categories, vendors, etc.)
src/utils/                       Pure utilities (storage, dates, auth, etc.)
vite.config.js                   base = '/Truck-Packer/' for GitHub Pages
eslint.config.js                 Flat config; no-undef + a few others
firestore.rules                  Security rules (deployed)
.github/workflows/deploy.yml     Build with Vite + deploy to GitHub Pages
docs/AUTH_SETUP.md               Walkthrough for the auth + rules deploy

Outside this repo:
  ~/scripts/my-apps-script/     Apps Script project (Dashboard.gs etc.)
                                Managed via clasp. Pushes the public
                                dashboard to script.google.com.
```

## Stack

- **React 18 UMD** + Firebase compat SDK 10.11 + jsPDF + LZ-String, all from
  CDN. ESLint config declares them as globals so `no-undef` is happy.
- **Vite 6** for JSX transpilation and bundling. esbuild handles JSX in
  classic mode (`React.createElement`); we don't need `@vitejs/plugin-react`
  because React itself is global.
- **GitHub Actions** builds and deploys to GitHub Pages on every push to
  `main`. Pages source must be set to "GitHub Actions" (not "Branch") in
  repo settings.
- **Firestore** is the source of truth. Offline persistence via IndexedDB.
  LocalStorage is a per-show fallback cache, not authoritative.

## Firestore schema

```
/events/{slug}/layouts/{truckId}     placed items + scans for one trailer
/events/{slug}/meta/{truckId}        trailer metadata (#, driver, contents…)
/events/{slug}/status/{truckId}      status (staged/loaded/dispatched/…)
/events/{slug}/logs/{docId}          activity feed
/events/{slug}/cases/{caseId}        scanned case → current truck
/events/{slug}/config/event          event name, total-load offset
/events/{slug}                       top-level: name, slug, createdAt

/config/library                      GLOBAL item library (shared across shows)
/config/currentShow                  { eventId } — which show the public dashboard reads
```

## Auth model

- Anyone can read `/config/library`, `/config/currentShow`, and
  `events/*/status/*` (public dashboard relies on this).
- Everything else requires the calling Firebase UID to be in the
  `isStaff()` allowlist in `firestore.rules`.
- Sign-in is Google OAuth via Firebase Auth (popup flow). Non-staff users
  who sign in will see permission-denied errors on all reads — this is
  intentional. Don't add client-side checks; let Firestore do it.
- `?public=1` URL param skips the sign-in screen entirely. The public
  dashboard at script.google.com uses this implicitly (different origin).

## Per-show vs global localStorage

Per-show keys are namespaced `truckPacker_{name}_{slug}`:
  `trucks`, `truckLoaded`, `notes`, `history`, `curId`

Global keys (user preferences, no slug):
  `view`, `showName`, `eventId`, `stackHighlight`, `signCurrentOnly`,
  `signFont`, `webhooks`, `activeWH`, `dispatchWH`, `tlFilter`,
  `tlOrderByStatus`, `historyFilter`, `historyTruckFilter`

Use `evKey(name)` helper inside App() for show-scoped keys. Direct
`truckPacker_*` literals are fine for global preferences.

## Critical traps

1. **No undefined setters in the show-load reset block.** That block at
   line ~1855 in main.jsx clears state on every show switch. Each setter
   name must match an actual useState declaration; ESLint `no-undef`
   catches this now, but only if you run `npm run lint` (or commit and
   let CI catch it).

2. **Hooks must be called in the same order every render.** The auth gate
   is implemented as a separate `AuthGate` component that wraps `App` for
   exactly this reason — App's hooks only run once the user is resolved.
   Don't add early returns inside App that skip hook calls.

3. **Firestore reads through Vite dev server**: `vite dev` uses port 5173.
   Make sure `localhost` is in the Firebase Auth Authorized Domains list
   for sign-in to work locally.

4. **GitHub Pages cache.** The first deploy after a push can take 2-10
   minutes to propagate. Add `?bust=anything` to the URL to force-fetch.

5. **The item library is global, not per-show.** Items added or edited
   here appear in every show. Vendor prefix (CL/4W/PRG/CT) drives the
   sidebar filter — see `src/data/vendors.js`.

## Common operations

```bash
npm run dev          # local dev with HMR; open http://localhost:5173/Truck-Packer/
npm run build        # production build → dist/
npm run preview      # serve the built dist/ locally
npm run lint         # ESLint (errors fail the CI build; warnings just report)

# Update Firestore rules
npx firebase deploy --only firestore:rules --project ktm-logistics-b2309

# Update GAS public dashboard
cd ~/scripts/my-apps-script
clasp push
clasp deploy --deploymentId AKfycbz-K_UtMZpW5jVh4Ztdx71ul0a5T8ko62KSV6EEsW1avidYRdGaDFOzFLts4JXFBaBXDQ \
  --description "…"

# Manual backup of all Firestore data
# Open splash screen → click 💾 BACKUP ALL → JSON downloads
```

## Open work

See git history; the highest-impact remaining items as of this writing:

- **Modularize phase 2** — split views (Splash, Packer, TruckList, Manifest,
  EventReport, Signs, AutoPick, Recovery) out of `src/main.jsx`. Needs a
  React Context for shared state since views touch ~50 state values.
- **Automated cloud backup** — daily scheduled job that snapshots all
  events/* to GCS or Drive. Currently just a manual button on splash.
- **Clone Show feature** — "create new show from template" with optional
  fleet copy. Big UX win for recurring clients.
- **Library CSV import** — let non-devs self-serve adding 4Wall/PRG/CT
  inventory.
