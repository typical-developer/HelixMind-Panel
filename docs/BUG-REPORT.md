# Bug report

Everything found during the production-readiness pass, with file references,
how it showed up, and what happened to it.

**Summary:** 48 issues. 42 fixed, 6 open (5 by your decision, 1 third-party).

Nothing here was found by reading alone — the app was built, typechecked,
covered with 142 unit tests, and driven in a browser end to end.

---

## Severity key

| | |
|---|---|
| **Critical** | Shows the user something untrue, or a core action does nothing. |
| **High** | A feature is broken or unusable. |
| **Medium** | Works, but wrongly or confusingly. |
| **Low** | Polish, tidiness, dead code. |

---

## Critical — fabricated data

### C1 · The entire Overview was invented — **FIXED**
`app/(main)/dashboard/page.tsx`

Every figure on the landing page was a string literal on a workspace that had
never run anything:

- `"24,521"` sequences analysed, `"↑ 12% from last week"`
- `"7"` active simulations, `"2 running now"`
- `"3"` AMR threats, `"Critical — review markers"`
- `"99.2%"` pipeline health, `"No failed jobs in 24h"`
- Five invented activity rows (`sample_A12.fasta scanned · 2m ago`)
- Storage `4.2 / 10 GB` with a hardcoded `w-[42%]` bar
- Three engines hardcoded to `operational`
- `useViewContext("helixmind-lab · 4 engines online · 2 runs in the last hour")`

**Fixed:** every value derives from `lib/activity-store.ts`. A new workspace
reads 0 and offers a "Get started" card. Verified: after one scan and one
prediction the tiles read 1 sequence / 2 AMR threats, matching the runs.

### C2 · The three Overview panels were props — **FIXED**
`components/dna-viewer.tsx`, `components/mutation-table.tsx`, `components/amr-chart.tsx`

The sequence viewer rendered a 300-base `ATGCTAGC…` literal with a "hotspot
15–25" corresponding to nothing; the mutation log listed five invented variants
with hand-assigned risk labels no rule produced; the chart drew six fixed
resistance percentages. **None changed when you ran anything.**

**Fixed:** all three read `lib/lab-snapshot.ts` — your last real scan and
prediction — with proper empty states. Verified: viewer showed
`TGT_synthetic · 306,000 bp · GC 49.0%` with the 5 planted variants highlighted.

### C3 · Gene library statistics were fiction — **FIXED**
`lib/amr-records.ts`

`AMR_DATABASE_STATS` claimed 2,847 genes, 456 organisms, 128 drug classes and
"Last Updated 2024-01-12" against a table of **five records**.

**Fixed:** `databaseStats()` counts the data. Now reads 9 / 7 / 8 / 9.

### C4 · Two divergent gene tables — **FIXED**
`lib/amr-records.ts` vs `app/(main)/amr-analysis-engine/resistance-predictor/page.tsx`

`lib/amr-records.ts` — whose own docstring called itself the single source of
truth — held 5 genes. The predictor kept a private `amrDatabase` with 7
different ones. Only 2 overlapped. You could score `vanA` in the predictor and
then find nothing for it in the library or the palette. Both tables also had a
field called `impact` meaning different things (a prevalence % vs a 0–1 score).

**Fixed:** merged to 9 markers with `prevalence` and `confidence` named
separately. Test asserts every gene from both original tables is present.

---

## Critical — controls that did nothing

### C5 · "Delete all data" had no handler — **FIXED**
`app/(main)/settings/page.tsx`

The most destructive control in the app was `<Button variant="destructive">`
with **no `onClick`**. Clicking it did nothing at all.

**Fixed:** real handler, behind an `AlertDialog` requiring you to type `delete`.
Clears the workspace but not your session.

### C6 · "Save changes" saved nothing — **FIXED**
`app/(main)/settings/page.tsx`

`handleSave` set a flag that changed the label to "Saved" for two seconds. The
notification toggles were plain `useState` — every preference was gone on
reload.

**Fixed:** `lib/preferences.ts` persists them, and they are read. The button is
gone; a line explains changes apply immediately. "In-app notifications" now
genuinely gates toasts.

### C7 · The AMR threat indicator went nowhere — **FIXED** *(your report)*
`app/(main)/dashboard/page.tsx:65`

```ts
{ id: "threats", label: "3 AMR threats", tone: "danger" }   // no onClick
```

`StatusBar` renders an item without `onClick` as a `<span>`, so it could not be
clicked. **Fixed:** opens the Resistance Predictor, with a title explaining why.
Verified in-browser: click navigates and opens the tab. Every `useStatusItems`
call across all six views was audited — each item now has an `onClick` or an
explanatory `title`.

### C8 · "Close all" never closed everything — **FIXED, then superseded**
`components/workbench/workbench-provider.tsx`

It cleared `openTabs` then navigated to `/dashboard` — and navigating is exactly
what re-adds a tab. The strip was never actually empty.

**Fixed:** a suppression ref lets that one navigation through. Verified:
`openTabs: []`, strip reads "Nothing open".

**Superseded by C8b.** Making the strip genuinely empty was the wrong target:
see below.

### C8b · An empty strip described a bench that was showing something — **FIXED**
`components/workbench/workbench-provider.tsx`, `components/workbench/tab-bar.tsx`

The fix above did what it said, and that turned out to be the bug. This is a
routed app — a view is always on screen, because the URL always points at one.
So "Close all" left the Overview rendered under a strip reading *Nothing open*,
and closing the last tab did the same thing for a beat. Reported from use: *"the
overview opens … but it shows nothing open."*

An empty strip is only honest in an editor that can show a blank watermark. This
one cannot, so the model changed rather than the mechanics:

- **The last tab cannot be closed.** Guarded inside `closeTab` rather than on
  the button, because six paths reach it — the ×, middle-click, `Delete`,
  `Alt W`, the context menu and the palette. Guarding the button is how VS Code
  shipped [the same bug](https://github.com/Microsoft/vscode/issues/56715) and
  let middle-click walk past it. The last tab renders no × at all.
- **"Close all" leaves one Overview tab**, which also retired the suppression
  ref from C8 — with the Overview staying open, the navigation effect finds it
  already present and does nothing.
- **The restore path now normalises what it reads** (`lib/open-tabs.ts`):
  unknown hrefs dropped, repeats collapsed, an empty list floored to the
  Overview. That last rule is a migration — anyone who used "Close all" on the
  C8 build has `openTabs: []` in localStorage right now.

Covered by 11 tests in `tests/open-tabs.test.ts`, including the two states that
are otherwise only reachable by editing storage by hand.

**On duplicate tabs**, asked at the same time: they are not reachable through the
UI, and never were. A tab is a *route*, not a document — `openTabs` holds
registry hrefs, every insertion site guards with `.includes()`, `normalizeHref()
` collapses query strings so `?q=mecA` and `?q=vanA` are one tab, and `VIEWS` is
a fixed list with no "open another copy" action. Nor would they cost
performance: only the active route is mounted. The one real exposure was the
restore path above, where a repeat would have produced two tabs sharing a React
key — closing either would have closed the other.

### C9 · Pause could never pause — **FIXED**
`app/(main)/mutation-simulator/page.tsx`

`handleStart` called `handleReset()` **unconditionally on its first line**,
setting `isRunning` false — so the `if (isRunning)` check below it could never
be true. Pressing "Pause" threw the run away and restarted from generation zero.

**Fixed:** decision extracted to `nextRunAction()` in `lib/mutation-model.ts`
with 7 tests, including one named for this regression.

---

## High

### H1 · No user feedback anywhere — **FIXED**
`toast()` was **never called in the entire codebase**, though `<Toaster />` was
mounted. Instead there were six native `alert()` calls (five in the Growth Lab,
one in the Mutation Simulator). Exports, copies, deletions, sign-in and sign-out
all completed silently.

**Fixed:** every `alert()` replaced; ~30 toast points added across uploads,
exports, copies, auth, run completion and destructive actions.

### H2 · Two toast systems, both dead — **FIXED**
`sonner` was a dependency with `components/ui/sonner.tsx` importing
`next-themes`, and neither was used anywhere. **Fixed:** both dependencies and
the file removed.

### H3 · Toast config made it unusable — **FIXED**
`hooks/use-toast.ts` had `TOAST_LIMIT = 1` and `TOAST_REMOVE_DELAY = 1_000_000`
(16 minutes). Every toast ever shown stayed in the array long after leaving the
screen, occupying the single slot. **Fixed:** 3 and 400 ms.
Also fixed a `useEffect` dep that subscribed/unsubscribed on every state change.

### H4 · ORF detection could hang the tab for minutes — **FIXED**
`app/(main)/dna-scanner/page.tsx`

```js
seq.match(/ATG(?:.{3})+?(?:TAA|TAG|TGA)/g)
```

That lazy quantifier backtracks catastrophically. On the 3 MB genome shipped in
`test-files/` it pinned the main thread. **Fixed:** `findORFs()` is a linear
scan of three frames. Test asserts a megabase sequence completes under 3 s.

### H5 · A scan hung forever in a background tab — **FIXED**
`app/(main)/dna-scanner/page.tsx`

*Found by browser testing.* The progress yield awaited `requestAnimationFrame`,
which **does not fire in a non-visible tab** — so a scan started and left in
another tab sat on "Analysing…" indefinitely. **Fixed:** races the frame against
a 50 ms timer.

### H6 · Successful scans were recorded as "stopped" — **FIXED**
*Found by browser testing.* The scanner published `running` → `null`, which the
provider cannot distinguish from a view unmounting mid-run. Every successful
scan was filed in history as **stopped** and raised a false
"runs end when you leave" warning. **Fixed:** publishes `done`. Verified:
history now reads `completed · TGT_synthetic · 5 variants`.

### H7 · The Growth Lab's start/pause recorded nothing — **FIXED**
*Found by browser testing.* A regex edit left `if (!isRunning) {}` — an empty
block — so pausing never logged the experiment. **Fixed and re-verified:**
`growth.completed · 22 steps · 3,009 cells`.

### H8 · Gene links polluted the open-tab set — **FIXED**
`components/workbench/side-bar.tsx`, `command-palette.tsx`

Rows called `openTab('…/gene-database?q=mecA')`. That string matches no registry
href, so the tab was invisible in the strip while still accumulating — one entry
per gene clicked — in persisted layout. **Fixed:** `normalizeHref()`.

### H9 · Password reset was a dead end — **FIXED**
`app/(auth)/reset-password/page.tsx`

Originally it *lied*: step one claimed "Verification code sent to your email"
without sending one, step two accepted any non-empty string, step three
announced "Password reset successfully!" and redirected. A user walked away
believing their password had changed.

A previous pass replaced the claims with an error but left the whole wizard
standing — ~140 lines rendering `verify` and `reset` steps that were
**unreachable**, because `setStep` was never called from anywhere.

**Fixed:** replaced with an honest page pointing at support. Redundant nested
layout (with two unused font instances and duplicate metadata) deleted.

### H10 · Notification feed was seeded fiction — **FIXED**
`components/notifications/notifications-provider.tsx`

Three hardcoded notifications ("Upload Complete · 2 mins ago") on a workspace
that had never uploaded anything. Its `push()` — the only route for a real
event — was **never called by anything**. Times were literal strings, so ages
never changed and were already wrong on load. Nothing persisted.

**Fixed:** derived from the activity log; only read/dismissed ids are stored;
`createdAt` is epoch ms formatted live. Verified: 4 real notifications with
"7m ago" / "18m ago" ticking correctly.

### H11 · History never survived a reload — **FIXED**
The History tab said "No finished runs in this session yet" after every refresh.
**Fixed:** runs (50) and log tail (200) persist.

### H12 · Restored log ids collided — **FIXED**
*Found by browser testing.* Restoration reused stored ids, but the workbench
writes two boot lines from a child effect that runs **before** the parent
restore effect — so restored id 0 collided with boot id 0, and React rendered
duplicate keys. **Fixed:** restored entries are renumbered.

### H13 · The help menu would not open — **FIXED**
*Found by browser testing.* `TooltipTrigger asChild` wrapping
`DropdownMenuTrigger asChild` has both primitives cloning props onto one node;
with the zero-delay tooltip the hover re-render lands between pointerdown and
pointerup. **Fixed:** tooltip removed, matching the adjacent account button.

---

## Medium

### M1 · No error handling on any upload path — **FIXED**
`dna-scanner`, `mutation-simulator` and `settings` contained **zero `catch`
blocks**. No file-type or size validation anywhere: dropping in a PDF produced
an empty sequence list and a pane reading "select a target sequence".
**Fixed:** `validateFastaFile()` on all three, with `try/catch` and toasts.

### M2 · Three different export implementations — **FIXED**
The scanner built a Blob URL and **never revoked it** (leaked on every export);
the simulator built one and did; the AMR engine encoded the whole report into a
`data:` URI. None gave any confirmation. CSV was joined with bare commas, so
`"Cell wall remodeling, high-level"` silently split into two columns.
**Fixed:** one `lib/download.ts` — revokes, quotes CSV properly, writes a UTF-8
BOM for Excel, toasts, and logs the export.

### M3 · Clipboard failures looked like successes — **FIXED**
`navigator.clipboard` was called unguarded and the success tick was shown either
way. It is undefined on insecure origins. **Fixed:** `copyToClipboard()` reports
honestly.

### M4 · `role="tablist"` with no arrow keys — **FIXED**
The tab strip declared the role without implementing any of its contract, so
keyboard users tabbed through every close button in turn. **Fixed:** ←/→,
Home/End, Delete, and a roving tabindex.

### M5 · No confirmation on any destructive action — **FIXED**
Clear notifications, clear run log, clear history and delete-all were all
one-click and irreversible. **Fixed:** undo toasts on the reversible ones, typed
confirmation on delete-all, gated by a new preference.

### M6 · Console channel name mismatch — **FIXED**
The Growth Lab published alerts as `microbe-growth-lab` and log lines as
`microbe-lab`. **Fixed:** `source` now comes from the registry.

### M7 · The chart was reflowed twice a second — **FIXED**
`app/(main)/microbe-growth-lab/page.tsx` toggled the chart container between
`99.5%` and `100%` on a 1.5 s interval to force Recharts to re-measure — for the
entire run. `ResponsiveContainer` already observes its own box. **Fixed.**

### M8 · Growth history grew without bound — **FIXED**
Every tick pushed a point forever and handed the whole array to Recharts.
**Fixed:** capped at 600.

### M9 · Snapshot arrays were mutated in place — **FIXED**
`getState()` returned its live `growthHistory`, which it then mutated, so the
chart's `useMemo` never invalidated. **Fixed:** fresh arrays.

### M10 · Stress levels could exceed 100% — **FIXED**
`Math.abs(oxygen − 21) / 21` is unbounded above; progress bars drew past their
track. **Fixed:** clamped.

### M11 · A "seeded" RNG that was neither — **FIXED**
`SeededRandom` was re-seeded with `Date.now() + generation` every step (so runs
were never reproducible despite the name) and multiplied a ~1.7e12 seed by 9301,
exceeding `Number.MAX_SAFE_INTEGER` and measurably biasing output.
**Fixed:** mulberry32, seeded once per run, seed written into the export.

### M12 · Insertions were always zero — **FIXED**
The type declared `insertion | deletion`, the fitness function penalised them —
and nothing ever generated one. The "Insertions" tile was hardwired to 0.
**Fixed:** indels generated at 10% of the substitution rate, applied
back-to-front. Tile now reads "Indels" with an in/del breakdown.

### M13 · Coding context was arbitrary — **FIXED**
`context: i < length - 100 ? "coding" : "non-coding"` — the last 100 bases of
any sequence were "non-coding" and everything else was "coding".
**Fixed:** real ORF membership via `isCoding()`.

### M14 · Two divergent FASTA parsers — **FIXED**
The scanner split the whole file on `>` and stripped everything outside `ATGCN`;
the simulator walked lines and kept whatever it found. The same file produced
different lengths and therefore different statistics depending on which view you
opened it in. A third parser in the Growth Lab kept digits and whitespace.
**Fixed:** one parser. A `>` mid-description no longer splits a record; IUPAC
codes fold to `N` so coordinates stay correct.

### M15 · `signUp` signature documented the opposite of the code — **FIXED**
The context type declared `(email, password, name)`; the implementation and its
only caller both used `(name, email, password)`. All three are `string`, so
TypeScript could not see it. **Fixed.**

### M16 · Sign-up faked a session — **FIXED**
On success it called `setUser({name, email})` even though signup returns no
token — so the app believed you were signed in while every request would 401.
**Fixed.**

### M17 · An unauthenticated session check on every load — **FIXED**
`checkAuth()` fired on mount regardless of whether a token existed, so a
first-time visitor's first action was a request guaranteed to 401. A failing
token was also never cleared. **Fixed.**

### M18 · API client threw strings, not Errors — **FIXED**
`api/main.ts` threw `error.message` on the error path, so every call site's
`e instanceof Error` check fell through. It also parsed every response as JSON
unconditionally — an HTML error page surfaced to the user as
`Unexpected token '<'`. **Fixed**, plus a 20 s timeout and a configurable base
URL.

### M19 · Settings search blanked the page — **FIXED**
It matched section keywords only, then hid every non-matching section. Typing
"focus mode" blanked five of six panes to reveal one row. **Fixed:** row-level
index with an autocomplete dropdown that scrolls to and flashes the row.

### M20 · Three names for one view — **FIXED**
"Gene Library" (registry) vs "Gene Database" (AMR nav) vs `GeneDatabase`.
**Fixed:** Gene Library everywhere.

### M21 · Gene rows were inert — **FIXED**
Nine rows of read-only text with nothing to do to any of them, and no path from
the library to the predictor that scores those very genes. **Fixed:** row
actions open the predictor with the marker preselected (`?genes=`).

### M22 · Alerts named a source you could not reach — **FIXED**
The Alerts tab grouped by a bare string with nothing behind it. **Fixed:**
clicking an alert or its heading opens the view that raised it.

### M23 · Run log had no text search — **FIXED**
A 500-line buffer fills in under a minute; the only filter was a channel
dropdown. **Fixed:** text filter with match highlighting, plus a level filter,
copy, and history export.

### M24 · Alerts vanished when you navigated away — **FIXED**
`useAlerts` cleared on unmount, so the Alerts tab could only ever show the view
you were looking at. **Fixed:** alerts persist and are dismissed explicitly.

### M25 · A locale string where a timestamp belonged — **FIXED**
The predictor stamped `new Date().toLocaleString()` into exported reports.
**Fixed:** ISO 8601, formatted for display only.

### M26 · Growth CSV misreported resistance — **FIXED**
It wrote the *final* resistance against every historical row, so an exported
curve claimed the culture was fully resistant from inoculation. **Fixed.**

### M27 · Side effects inside a state updater — **FIXED**
`reopenClosedTab` called `router.push` inside `setClosedTabs`. React may re-run
an updater — it does under StrictMode — firing the router twice. **Fixed.**

### M28 · Navigation during popover teardown — **FIXED**
*Found by browser testing.* Closing the notification popover and navigating
synchronously produced React's "cannot update a component while rendering a
different component". **Fixed:** navigation deferred to a microtask.

### M29 · Ctrl+Shift+T could never fire — **FIXED**
*Found by browser testing.* Browsers reserve it for reopening their own tabs and
will not surrender it to page content — the codebase already knew this about
Ctrl+W. **Fixed:** rebound to Alt+Shift+T. Verified working.

---

## Low

### L1 · Dead code — **FIXED**
Seven orphaned components (`adaptation-log`, `environment-panel`, `growth-chart`,
`simulation-panel`, `strain-selector`, `stress-monitor`, `theme-provider`) —
`strain-selector` was a second, divergent copy of the strain table. Removed,
along with `sonner`, `next-themes` and `components/ui/sonner.tsx`.

### L2 · Lowercase component name — **FIXED**
`export default function signupPage()`. Renamed.

### L3 · Toaster mounted below the auth pages — **FIXED**
It lived inside `Workbench`, so nothing on sign-in could toast. Moved to root.

### L4 · Boot screen dot — **FIXED** *(your request)*
Removed the pulsing dot beside the loading text; the sweeping bar carries it.

### L5 · Unused imports and variables — **FIXED**
Including `useRouter` in `AuthContext` (declared, never used).

---

## Open — kept deliberately, at your direction

These are **not fixed**. You asked that the controls stay and be documented.
They are also surfaced in-app under **Help → About → Known limitations**.

### O1 · The Growth Lab strain selector does not drive the model
`app/(main)/microbe-growth-lab/page.tsx`, `lib/growth-model.ts`

`STRAINS` carries `growthRate`, `tempOptimal` and `resistance`, and
`currentStrain` is used **only** for display: the status bar label, the export
metadata and the inspector. `MicrobeSimulation` has a fixed `MAX_GROWTH_RATE`
and a fixed 37 °C optimum.

**Consequence:** *Thermus aquaticus*, optimum 70 °C, grows exactly like
*E. coli*, and dies above 46 °C. The custom-strain sliders — growth rate,
optimal temperature, innate resistance — change nothing.

*To fix:* pass the strain into the constructor and read `tempOptimal` in
`temperatureCoeff`, `growthRate` in place of `MAX_GROWTH_RATE`, and seed
`avgResistance` from `resistance` (`handleReset` already does the last one).

### O2 · Mutation Simulator pH, nutrients and oxygen are inert
`lib/mutation-model.ts`

Only `temperature` and `substitutionRate` enter the calculation. `pH`,
`nutrients` and `oxygen` are collected, stored and exported — the export says so
in a `note` field — but never read.

*To fix:* extend `temperatureFactor` into a combined stress factor. The Growth
Lab's `phCoeff` and `oxygenCoeff` are already written and tested.

### O3 · The Resistance Predictor organism does not affect scoring
`lib/amr-model.ts`

Picking *E. coli* or *S. aureus* yields identical scores for the same markers.
The organism now *does* flag markers not normally reported in it — `mecA` in
*E. coli* raises an advisory in the console — but it does not change confidence.

*To fix:* weight `confidence` by whether the marker is reported in that
organism. `AMRRecord.organisms` already carries the data.

### O4 · The backend layer is implemented but unused
`api/simulation.ts`, `api/fasta-actions.ts`

Three endpoints exist and **nothing imports them**:

| Function | Endpoint | What it would do |
|---|---|---|
| `parse_fasta` | `POST /simulation/parse-fasta` | Server-side FASTA parsing |
| `simulate_mutation` | `POST /simulation/simulate` | Server-side simulation |
| `previouslyReadFastas` | `GET /simulation/fastas` | **Server-side upload history** |

The third matters most: it is a real cross-device history the panel does not
use. Everything is currently local to one browser.

The host (`helix-core-backend.onrender.com`) did not respond during this pass —
30 s timeout, no status. The base URL is now `NEXT_PUBLIC_API_URL`.

### O5 · Runs stop when you leave the analysis
`components/workbench/workbench-provider.tsx`

State lives in the routed page component, so navigating away unmounts it and
ends the run. The tab-bar docstring claimed "a half-finished simulation survives
a detour into the gene library and comes back exactly as it was left" — it did
not, and the comment has been corrected.

The panel is now **honest** about it: leaving raises a toast
("Runs end when you leave the analysis that started them") and the run is filed
as *stopped*. Fixing it properly means hoisting run state above the router or
moving the engines into a worker.

---

## Open — third party

### O6 · Duplicate React key warning on first paint
Dev-only console warning (`key: 0`) on a **full page load** only. It does not
occur on client-side navigation between any two routes.

Ruled out: every keyed list in `app/` and `components/` was audited and each key
is unique within its parent — skeletons, sequence rows, mutation rows, activity
rows, strains, stress levels, tabs, gene rows. The restored-log id collision
that *was* ours is fixed separately (H12) and this warning survives it.

The pattern — initial mount only, never on navigation — points at the outer
`ResizablePanelGroup` in `components/workbench/workbench.tsx`, which mounts once
per page load, unlike the per-view group in `ViewLayout` (which remounts on every
navigation and produces no warning). Cosmetic; React strips it in production.

---

## What was verified in the browser

Signed in against a local mock API (the real backend was unreachable), then:

- **306,000 bp scan** — completed, GC 49.0%, exactly the 5 planted variants
  found, ORF count correct, run filed as *completed*
- **Overview** — went from all-zero + "Get started" to real counts, real
  sequence, real variant list, real chart
- **AMR threat indicator** — clicked, navigated, opened the tab
- **Close all** — `openTabs: []`, strip reads "Nothing open" *(behaviour later
  replaced — see C8b; "Close all" now leaves a single Overview tab)*
- **Alt+Shift+T** — reopened the closed analysis and navigated to it
- **Synergy rule** — gyrA alone 40%, gyrA + parC 90%, marked *synergy*
- **Gene Library → Predictor** — marker arrives preselected
- **Growth Lab** — start, pause, run recorded
- **Notifications** — 4 real entries with live relative times
- **Every route** — swept for console errors

Automated each loop: `tsc --noEmit`, `vitest run` (131 tests), `next build`.
