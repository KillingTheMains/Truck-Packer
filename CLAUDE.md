# Truck Packer — Developer Handoff Document
**Date:** May 17, 2026  
**Repo:** https://github.com/KillingTheMains/Truck-Packer  
**Live file:** `index.html` (single-file React PWA, ~6,759 lines)  
**Firebase project:** `ktm-logistics-b2309`  

---

## What This App Is

A real-time logistics tool for managing truck loads at live events. Used at SAP Sapphire 2026. Features:
- **Packer view:** Drag-and-drop items onto a 53' trailer canvas
- **Truck List:** Add/manage trailers, set statuses (Arrived, At Dock, Loaded, Dispatched, etc.)
- **Global Manifest:** Cross-truck item view with scan tracking
- **Activity Log:** Real-time feed of status changes
- **Event Report:** Fleet stats (fastest load, avg load time, etc.)
- **Multi-show splash screen:** Select or create shows, each namespaced in Firestore

---

## Tech Stack

- **React 18 UMD** + **Babel standalone** (JSX transpiled in-browser — no build step)
- **Firebase Firestore (compat SDK v10)** — real-time sync via `onSnapshot`
- **Single HTML file** — all CSS, JS, JSX in `index.html`

**Critical Babel behavior:** Babel transpiles `const` → `var`. This means variables declared with `const` inside a component are hoisted to function scope. Any `useEffect` dependency array that references a `const` declared *after* the effect in source order will evaluate as `undefined` when the effect runs. All state declarations and refs used in effects must appear *before* those effects in the source.

---

## Firestore Structure

### Pre-migration (legacy, still exists at root):
```
/status/{truckId}         — truck statuses
/layouts/{truckId}        — placed items per truck
/meta/{truckId}           — truck metadata (name, door type, etc.)
/logs/{docId}             — activity log entries
/cases/{docId}            — case barcode assignments
/config/library           — item library (GLOBAL — shared across all shows)
/config/event             — event name, load counts (LEGACY — pre-migration)
/config/currentShow       — { eventId: "sap-sapphire-26" } — which show is live/public
```

### Multi-event namespace (current):
```
/events/{eventId}/layouts/{truckId}
/events/{eventId}/meta/{truckId}
/events/{eventId}/status/{truckId}
/events/{eventId}/logs/{docId}
/events/{eventId}/cases/{docId}
/events/{eventId}/config/event     — { name, startedAt, loadCounts, startAt }
/config/library                    — GLOBAL, not per-event
/config/currentShow                — GLOBAL, points to active event
```

### Known shows in Firestore:
- `sap-sapphire-26` — SAP Sapphire 2026 (fully populated, migrated)
- `template-show` — Created during testing, contaminated with SAP data, needs deletion

The migration button on the splash screen copies root-level collections → `events/sap-sapphire-26/`. The migration has already been run.

---

## Key Code Patterns

### `evtCol` helper (line ~1513):
```javascript
const evtCol = (name) => db.collection('events').doc(currentEventId).collection(name);
```
All per-show Firestore reads/writes use `evtCol(...)` except `config/library` and `config/currentShow` which are global.

### Show selection (line ~1508):
```javascript
const [currentEventId, setCurrentEventId] = useState(() => {
  try { return lsGet('truckPacker_eventId') || null; } catch(e) { return null; }
});
```
- `null` → splash screen renders
- Any string → main app renders for that event

### `fsInboundRef` pattern (critical for understanding write loops):
A `useRef` flag set to `true` during Firestore snapshot processing to prevent the write-back effect from writing data that just came in from Firestore (would cause infinite loop). Reset via `fsInboundTick` state counter — incremented on every snapshot, with a dedicated `useEffect` that resets the flag whenever the tick changes. The tick + effect approach is needed because Firestore may echo back unchanged data, in which case no state setter fires and without the tick there's no trigger to reset the flag.

### Truck state (lines ~1529, ~2283–2287):
```javascript
const [trucks, setTrucks] = useState(() => initTrucks());
// ...
const sortedTruckIds = Object.keys(trucks).sort(...);
const effectiveCurId = trucks[curId] ? curId : (sortedTruckIds[0] || null);
const truck = effectiveCurId ? trucks[effectiveCurId] : { placed:{}, info:emptyTruckInfo(''), history:[] };
const { placed, info, history } = truck;
```
`initTrucks()` creates 70 hardcoded SAP truck IDs (`AMS1`, `FAV1`–`FAV69`). This is SAP-specific. For new shows, `trucks` should be `{}`.

### `curId` default (line ~1533):
```javascript
const [curId, setCurId] = useState(()=>lsGet('truckPacker_curId')||'FAV1');
```
Defaults to `'FAV1'` — an SAP truck ID. Must be guarded against being undefined in trucks.

---

## What Was Built This Session

### 1. Multi-event architecture (commit `2a589d1`)
Full Firestore namespacing under `events/{eventId}/`. All 27+ Firestore call sites updated to use `evtCol()`. Splash screen added. Show management (create, open, set live). Data migration for SAP Sapphire 26.

### 2. Fixes applied this session:
- `fsInboundRef` stuck-true bug — status changes silently failed
- Screen flash on truck status change — two-write race condition around `clearDock`
- Event Report view added
- Activity log text legibility improved
- New show creation localStorage contamination — `eventSnap.exists` check added
- State clear on show switch — `setTrucks({})` etc. before populating from Firestore
- Show deletion with chunked batch deletes (handles >500 log docs)
- `TRUCK_IDS` fallback removed from Truck List
- `truck` undefined crash guard — `effectiveCurId` fallback

---

## Current Broken State

**The last commit (`71bff97`) is suspect.** The user reports "not working at all" after these changes were pushed. The most likely culprits:

### Problem 1: JSX ternary in packer view (most likely crash)
At line ~3906, a ternary was added around the canvas-wrap:
```jsx
<div className="content-area" ref={canvasRef}>
  {sortedTruckIds.length === 0 ? (
    <div>...empty state...</div>
  ) : (
  <div className="canvas-wrap">
    ... (hundreds of lines) ...
  </div>
  )}
  {/* BOTTOM PANEL */}
  <div className="bottom-panel">...
```

The `)}` closing the ternary is at line ~4120, right after the canvas-wrap close. **This may have broken the JSX tree** if the surrounding structure doesn't account for it properly. Babel parses this as a JSX text node issue if indentation creates an unexpected text child, or if there's a mismatched brace somewhere in the ~200 lines of canvas-wrap content.

**Recommended fix:** Remove the ternary entirely. Instead, add the empty state as a simple overlay:
```jsx
<div className="content-area" ref={canvasRef}>
  {sortedTruckIds.length === 0 && (
    <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',
      alignItems:'center',justifyContent:'center',gap:12,color:'#2a4a6a',zIndex:10}}>
      <div style={{fontSize:32}}>🚚</div>
      <div style={{fontSize:14,fontWeight:'bold',color:'#3a6a8a'}}>No trucks yet</div>
      <div style={{fontSize:11}}>Go to <strong>Truck List</strong> to add trucks</div>
    </div>
  )}
  <div className="canvas-wrap">
    ... existing canvas unchanged ...
  </div>
  {/* BOTTOM PANEL */}
  <div className="bottom-panel">
```
This avoids restructuring the JSX tree at all — the canvas-wrap always renders, just hidden behind an overlay.

### Problem 2: `initTrucks()` still used as initial state (line 1529)
```javascript
const [trucks, setTrucks] = useState(() => initTrucks());
```
Even though the initial load effect calls `setTrucks({})` immediately, the component renders once with 70 SAP trucks before the effect runs. For new shows this causes a flash of SAP data. Change to:
```javascript
const [trucks, setTrucks] = useState({});
```
SAP Sapphire 26 will still work because the initial load populates trucks from Firestore regardless of initial state.

### Problem 3: `updTruck(curId, fn)` called with undefined truck
Many callbacks do `updTruck(curId, tk => { ...tk.placed... })`. If `curId = 'FAV1'` and `trucks = {}`, then `tk` is `undefined` and destructuring it throws. Guard in `updTruck`:
```javascript
const updTruck = useCallback((id, fn) =>
  setTrucks(t => ({ ...t, [id]: fn(t[id] || { placed:{}, info:emptyTruckInfo(id), history:[], counter:1, scans:[] }) })), []);
```

### Problem 4: Firestore catch block still seeds SAP trucks (line ~1930)
The `catch` block (Firestore offline fallback) does:
```javascript
const base = initTrucks(); // 70 SAP trucks!
setTrucks(parsed || base);
```
For a new empty show with no localStorage data, this seeds 70 SAP trucks. Fix: don't use `initTrucks()` in the catch block — just use `{}` or the parsed localStorage if it exists.

---

## What Still Needs To Be Done

### Immediate (make new shows work cleanly):
1. Fix the broken JSX (Problem 1 above) — revert the ternary to an overlay approach
2. Change `useState(() => initTrucks())` → `useState({})` (Problem 2)
3. Guard `updTruck` fn arg (Problem 3)
4. Fix catch block initTrucks (Problem 4)
5. Delete the contaminated `template-show` from Firestore (can be done via Firebase Console or the app's delete button once it's working)
6. Create a clean `Template Show` — it should open to empty packer, empty truck list

### Next (public dashboard sync):
The GAS (Google Apps Script) public dashboard still reads from the **root-level** `status` collection, not `events/{id}/status`. It needs updating to:
1. Read `config/currentShow` to get `eventId`
2. Read `events/{eventId}/status` for truck statuses

The GAS file is managed via `clasp`. The project is in `/Users/jasonbielsker/scripts` (or similar). Use Desktop Commander MCP to run `clasp push` after editing.

---

## Firestore Security Rules

Not documented — assumed open for dev. If you get permission denied errors, check Firebase Console → Firestore → Rules.

---

## How To Run / Test

The app is a PWA served from GitHub Pages or any static host. To test locally, open `index.html` directly in a browser (Firebase CDN scripts load fine from `file://`). The app connects to the live Firebase project — there is no dev/staging environment.

**Hard refresh after code changes:** The app uses a service worker (`manifest.json` referenced at top of `index.html`). Always hard-refresh (Cmd+Shift+R) after pushing changes.

---

## Git Workflow

After any change to `index.html`, commit and push via Desktop Commander:
```bash
cd "/Users/jasonbielsker/Library/CloudStorage/GoogleDrive-jason@killingthemains.com/My Drive/Cowork Playground/SAP Sapphire/Truck Packer"
git add index.html
git commit -m "Description of change"
git push
```

---

## Recent Commits (most recent first)

```
71bff97  Fix empty show: guard truck undefined crash, remove TRUCK_IDS fallback, show empty state  ← SUSPECT
1e24003  Fix show deletion: chunk deletes to handle large log collections (>500 docs)
1e84f21  Add show deletion to splash screen with two-click confirm
932ec9f  Fix show switching: clear stale state on load, show current show ID in toolbar
befc3c5  Fix new show creation bug: skip localStorage fallback when event doc exists
2a589d1  Multi-event architecture: splash screen, show management, migration, per-event namespacing
a1bdf54  Add Event Report view: fleet status, load times (fastest/slowest/avg/med), leaderboard
91158da  Fix screen flash: consolidate clearDock+status into one Firestore write
10f3971  Fix: move fsInboundTick state declaration before effects (Babel var hoisting)
e21c2b1  Fix: fsInboundRef stuck true when snapshot echoes unchanged data
```

**If everything is broken, consider reverting to `a1bdf54`** (last known-good commit before multi-event work) and rebuilding the new show flow more carefully, or reverting `71bff97` specifically and re-approaching the empty show problem.

---

## Suggested Approach for Next Session

1. **First: determine scope of breakage.** Open the app. Does the splash screen load? Does SAP Sapphire 26 open? Does the packer canvas render? Check browser console for errors.

2. **If it's a Babel/JSX parse error**, the console will show something like `SyntaxError: Unexpected token`. The fix is removing the ternary (Problem 1 above).

3. **If the packer renders but new shows are broken**, the crash is likely Problem 3 (updTruck with undefined truck). Add the guard to updTruck.

4. **After fixing**, create a fresh Template Show and verify it opens to a blank packer with a "🚚 No trucks yet" message, blank Truck List, and no SAP data anywhere.

5. **Do not** use `initTrucks()` anywhere for new shows — that function is SAP-specific and should eventually be removed or made data-driven.
