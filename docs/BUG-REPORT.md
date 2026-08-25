# Bug report

Everything found during the production-readiness pass, with file references,
how it showed up, and what happened to it.

**Summary:** 63 issues. 56 fixed, 7 open (5 by your decision, 1 third-party,
1 needing a backend change).

Nothing here was found by reading alone — the app was built, typechecked,
covered with 160 unit tests, and driven in a browser end to end. The second-pass
findings below were each measured in the running app rather than argued from the
source: the toast bug via `elementFromPoint` hit-testing, the alignment bug via a
script that ranges each first text line and compares centres, and the archive by
reading records back out of IndexedDB.

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

### L6 · The last tab refused to close in silence — **FIXED** *(reported)*
`components/workbench/workbench-provider.tsx`

The guard that keeps one tab open was correct and completely invisible. The ×
simply was not rendered on the last tab, and `Alt W`, middle-click and `Delete`
returned without a word — reported as "it's like the last tab can't be closed
and there's no feedback telling you", which is exactly what a working guard and
a broken control look like from the outside.

**Fixed:** the tab's tooltip now reads `… — stays open, the bench always has a
view`, and every refused close puts "The last analysis stays open" in the status
bar for four seconds, announced via `aria-live`. Both come off the single guard
in `closeTab`, so no close path can refuse quietly. Verified in the browser
across `Alt W`, middle-click and the context menu.

### L7 · The toast wore a colour it did not need — **FIXED** *(your request)*
`components/ui/toast.tsx`

Every severity painted a 2px rule down the leading edge — `before:bg-success`
being the green on each routine "finished". `Toaster` already draws a
per-severity icon, so the rule was a second mark saying the same thing, and it
made the most-repeated notification in the app its most colourful element.

**Fixed:** one neutral surface for every variant. `variant` stays in the API —
it selects the icon. Verified: a "stopped" toast renders with
`::before` content `none`, a neutral `rgb(26,26,26)` panel, and its amber
warning icon intact.

### C9 · Sign-in was impossible on any deployment — **FIXED** *(reported)*
`api/main.ts`, `next.config.mjs`

Reported as *"Could not reach the server. Check your connection and try again"*
when signing in to the hosted panel. The connection was fine; the browser never
sent the request.

Measured against the live backend — a preflight `OPTIONS /api/v1/auth/login`
carrying each `Origin`:

| Origin | Response |
|---|---|
| `http://localhost:3000` | **204**, `access-control-allow-origin: http://localhost:3000` |
| a `*.vercel.app` origin | **500**, no CORS headers |
| `https://example.com` | **500**, no CORS headers |
| `http://localhost:5173` | **500**, no CORS headers |
| the backend's own origin | **500**, no CORS headers |

The allowlist holds exactly one origin, and an unlisted one makes the CORS
middleware throw rather than deny — which Express turns into a 500 carrying no
`Access-Control-Allow-Origin`. The browser then blocks the request before it is
sent, `fetch` rejects with a bare `TypeError`, and the `TypeError` branch in
`request()` prints the "could not reach" line. Reproduced exactly by running the
login `fetch` from `https://example.com`: `TypeError: Failed to fetch`.

So the panel worked locally and could not sign in from anywhere else. Nothing in
`.env.example` helped — it *recommended* setting `NEXT_PUBLIC_API_URL` to the
backend's host, which is the setting that guarantees the failure.

**Fixed:** the browser now calls `/api/backend/*` on the panel's own origin and
`next.config.mjs` rewrites that to the backend server-side, where CORS does not
apply. `NEXT_PUBLIC_API_URL` stays as an override for pointing at a local
backend and is documented as "leave unset when deployed"; the blank-but-set case
is handled too, since `??` treats an empty string as configured. Verified: the
proxy returns the backend's own `401 {"status":"error","error":"Unauthorized
request"}` for `GET /me/auth` and its own `"Invalid email or password"` for a
`POST /auth/login` with a junk payload, proving method, headers and body all
survive the hop.

The real fix belongs in the backend's CORS configuration, which is outside this
repo. This makes the frontend work without it.

### L8 · Four horizontal bars, one of them redundant — **FIXED**
`components/workbench/tab-bar.tsx`, `components/workbench/workbench.tsx`

The context bar was a 28px band under the tabs drawing the view's icon, its
name, its group, and what it was working on. The active tab already carried the
icon and name, the sidebar carried the group, and `VIEWS` is flat — so three of
its four parts were repeats stacked on a bench that already had a title bar, a
tab strip and a status strip.

**Fixed:** the band is gone; the one line only it carried rides at the end of
the tab strip, hidden by a container query when the bench is too narrow for it.
`contextBarVisible` and its toggle came out of all six places that carried them
(provider, title-bar menu, sidebar menu, sidebar Preferences, Settings → Layout,
the palette) plus the diagnostics snapshot. A layout persisted by an older build
still holds the key; it is ignored, so no migration was needed.

---

## Second pass — reported by you

Everything below was found or fixed after the first pass, working from your
report: the toast fighting the bottom strip, icons not sitting on their labels,
too much colour on the notification surfaces, lists that stop without saying so,
and "when I run all the things, is the data just lost?".

### C10 · A visible toast made the status bar unclickable — **FIXED** *(reported)*
`components/ui/toast.tsx`

Radix sets `pointerEvents: hasToasts ? undefined : "none"` as an **inline
style** on its viewport (`@radix-ui/react-toast/dist/index.mjs:180`). So the
property is only ever set when there are *no* toasts — the moment one appears,
the `<ol>` falls back to `pointer-events: auto`. Ours is
`fixed right-0 bottom-0 w-full … p-3 pb-9`, a full-width box whose padding
sits directly over the 24px status strip.

**Consequence:** for the five seconds a toast was on screen, the console toggle,
every view-published status item and the palette button were dead. Since almost
every action in the panel raises a toast, this happened constantly.

**Fixed:** `pointer-events-none!` on the viewport. The `!` is the fix — a
plain class loses to an inline style. Toasts opt back in via the
`pointer-events-auto` already on `Toast`, which still wins because
`!important` raises specificity on that element, not on its children. Width
capped at `26rem` as well, so the box never spans the strip even while
transparent.

**Verified in the browser:** with a toast open, `getComputedStyle(viewport)`
reports `pointer-events: none`, `elementFromPoint` over three points on the
status bar returns the strip's own elements, and the toast's Undo and Close
remain hit-testable and functional.

### H14 · Results were discarded when you left the analysis — **FIXED** *(reported)*
`lib/run-archive.ts` and all four engine pages

State lived in the routed page component, so navigating away unmounted it and
took the mutation table, the generation series, the growth curve and the final
sequence with it. What survived was a one-line label in the activity log, a
label/duration/outcome row in History, and — for the scanner and predictor only
— a 900-base preview of the *latest* result. The simulator and growth lab
persisted nothing at all. Export was the only way to keep a result, and it had
to be clicked before leaving.

**Fixed:** an IndexedDB run archive. Each finished run files its inputs,
parameters, seed, build and result; `/activity/[runId]` reopens it. See
`docs/ARCHITECTURE.md` §5.2 for the shape and `docs/DOMAIN-RESEARCH.md`
§1–2 for why traceability is the requirement in this domain rather than a
nicety.

**Verified in the browser:** ran a resistance prediction, read the record back
out of IndexedDB directly (metadata, payload and its 2 calls), then loaded
`/activity/<id>` and confirmed the summary, provenance and stored result all
render from the archive.

### H15 · 188 of 200 activity events were unreachable — **FIXED** *(reported)*
`app/(main)/activity/page.tsx`, `app/(main)/dashboard/page.tsx`

The activity store has held 200 events since it was written. The only surface
that read it back rendered `events.slice(0, 12)`, with no "view all"
anywhere. The rest were recorded, persisted across reloads and counted in the
headline figures — and could not be seen. The sidebar had the same shape: six of
fifty finished runs, silently.

**Fixed:** `/activity`, a registered view with filters (engine, kind,
severity, free text), paging that names what it has not shown, and CSV/JSON
export of the filtered set. The Overview, the bell popover, the sidebar and the
console's History all link into it.

**Verified in the browser:** with 45 events seeded, the footer reads "Show 5
more · 5 remaining", the engine filter reports "11 of 45", search reports "1 of
45", and Clear restores the full list.

### H16 · The simulator recorded every generation twice — **FIXED**
`app/(main)/mutation-simulator/page.tsx`

Found by reading an archived run back and noticing that a 2-generation run had
filed four generation stats.

`setGenerationStats` was called from *inside* the `setMutations` updater, so
that it could read the accumulated mutation list for `calculateFitness`. A
state updater has to be a pure function of its argument — React is free to call
it more than once for a single update, and in development it deliberately does.

**Consequence:** every generation appended its row twice. The run chart plotted
each generation as two points, the run log emitted each line twice, and the
archived record's `generationStats` was double-length. `currentFitness`
happened to survive because it reads the last entry, which is why this was
invisible from the status bar.

This is the same class as M27, which was fixed elsewhere in the first pass; this
site was missed.

**Fixed:** the accumulated list is mirrored in a ref, so the row is computed once
outside any updater. The append is also made idempotent on `generation`, so a
replayed updater cannot duplicate a row even if the pattern is reintroduced.
A sweep for the same shape — a `set*` call inside another `set*` updater —
across `app/`, `components/`, `lib/`, `contexts/` and `hooks/` now
returns nothing.

**Verified in the browser:** a 3-generation run files exactly 3 stats, for
generations [1, 2, 3], with no duplicates, and the run log shows one line per
generation. The 2-generation run recorded before the fix is still in the log
with its doubled lines, which is what surfaced it.

### M30 · Icons were centred against two-line labels — **FIXED** *(reported)*
`components/workbench/primitives.tsx` and eleven call sites

No shared row primitive existed, so every "glyph beside a label" was written by
hand. Rows carrying a description used `items-center`, which centres the icon
on the *whole* text block and parks it in the gap between the title and the line
under it. Rows that did align to the first line each picked their own nudge —
`mt-0.5` in one pane, `mt-px` in the next, nothing in a third.

Affected: the console's History rows, Preferences → Layout toggles, the Growth
Lab's antibiotic switch, the simulator's FASTA drop zone, the Overview's Get
started cards, and the auth pages' error rows.

**Fixed:** `Row` and `RowIcon` in `primitives.tsx` own the contract. The
offset is arithmetic — half the difference between the line box and the icon —
written down once as `ICON_OFFSET` and applied everywhere, with
`items-start` always.

**Verified in the browser:** a measuring script walks every leading icon in a
flex row, ranges the first text line and compares centres. Across all nine
routes with content seeded, zero rows are off by more than 1px; the History rows
that were previously offset now measure exactly 0.

### M31 · One bit of state, drawn four times — **FIXED** *(reported)*
`components/notifications/NotificationItem.tsx`

An unread notification carried an accent rail, a dot beside the title, a tint
across the whole row, *and* a heavier title. Stacked up, a list of finished
scans read as a wall of highlighted rows — which is exactly the noise the rail
existed to cut through, and it left the severity icon (the only mark carrying
real information) competing with three that carried none.

**Fixed:** the rail and the title weight stay; the dot and the row tint go. One
edit covers both surfaces, since the bell popover and `/notifications` render
the same component.

### M32 · Notification bookkeeping grew without bound — **FIXED**
`components/notifications/notifications-provider.tsx`

`markAllAsRead` and `clearAll` folded in the id of **every** activity
event, exports included — ids that can never appear in this feed, so no user
action could ever remove them. Nothing pruned ids whose events had aged out of
the 200-event cap either. Both arrays were persisted on every change, so a
workspace in daily use accumulated thousands of dead ids permanently.

**Fixed:** scoped to notifiable events, and pruned against the live log on
hydration and on every change.

### M33 · Undo filed restored runs in the wrong place — **FIXED**
`components/workbench/workbench-provider.tsx`

`restoreRunHistory` concatenated records onto the end regardless of when they
ran. Correct for the mount-time restore, where the list is empty; wrong for the
other caller — undoing "clear run history" filed every restored run *below*
anything finished since, in a list whose whole contract is newest-first.

**Fixed:** sort by `endedAt` after renumbering.

### M34 · Every navigation away from a run raised a warning toast — **FIXED**
`components/workbench/workbench-provider.tsx`

A run ends when its view unmounts (O5), which is what happens every time you
open another analysis. Saying so is right; saying so in a pop-up is not —
switching analyses is the most repeated action in the app, and a toast on every
one of them trains the operator to dismiss toasts without reading them.

**Fixed:** routed to the status bar's `notify()` channel, which exists for
exactly this and is already announced via `aria-live`.

### M35 · Five hundred entrance animations at once — **FIXED**
`components/workbench/panel.tsx`

`animate-line-in` was on every log row unconditionally, so opening the console
on a full buffer played the entrance animation 500 times simultaneously, and
every change of filter replayed all of them. The animation is for output
*arriving*; a line already on screen has not arrived.

**Fixed:** only rows above the previous high-water id animate.

### M36 · A storage sweep on every recorded event — **FIXED**
`app/(main)/dashboard/page.tsx`

`useMemo(() => measureUsage(), [events])` ran a synchronous walk of every
`localStorage` key the panel owns on the completion of every scan, simulation
and export — with the dependency suppressed by a lint comment, because
`measureUsage` does not read `events` at all.

**Fixed:** measured once per mount, and the archive reports its own size.

### L9 · A raw palette colour outside the token system — **FIXED**
`app/(auth)/signup/page.tsx`

The password-requirement ticks used `bg-emerald-500/20 text-emerald-400` —
the only raw Tailwind palette colour left in the app, and a different green from
the `--color-success` every other surface uses.

**Fixed:** `bg-success/20 text-success`. Legacy `h-4 w-4` /
`flex-shrink-0` spellings on the auth pages modernised at the same time.

### L10 · Lists that stop without saying so — **FIXED** *(reported)*
Several files

Beyond the Overview and sidebar covered by H15: the bell popover rendered
**every** notification into a 288px scroller (two hundred rows of DOM behind a
box showing four), the palette's gene results stopped at eight with no way
through to the rest, and the run log silently persists only its last 200 lines
of 500 buffered.

**Fixed:** the popover caps at 8 and names the total; the palette gains a
"+N more" row that opens the library; the log's line counter carries a tooltip
saying what survives a reload.

### S1 · No Content-Security-Policy — **FIXED (report-only)**
`next.config.mjs`

The old note argued a CSP was deliberately absent because a wrong one fails
closed. That holds for an *enforced* policy; it does not hold for a report-only
one, which never blocks. Shipping nothing meant the work never started.

**Fixed:** a full `Content-Security-Policy-Report-Only` covering
`default-src`, `base-uri`, `object-src 'none'`,
`frame-ancestors 'none'`, `form-action`, `img-src` (with `blob:` for
exports), `script-src`, `connect-src` (including a directly-configured
backend, if any) and `worker-src`. `'unsafe-eval'` is dev-only.
`Cross-Origin-Opener-Policy` and `X-DNS-Prefetch-Control` added alongside.

**Verified in the browser:** zero `securitypolicyviolation` events across all
nine routes plus the sign-in page, and blob URL creation and blob-backed image
loading both succeed. Promoting to enforcement is a one-word change once the
same is confirmed against a production build; the outstanding blocker is
`'unsafe-inline'` in `script-src`, which needs a nonce threaded through the
Next runtime.

### S2 · The auth token is readable by any script — **OPEN, documented**
`api/main.ts`, `contexts/AuthContext.tsx`

The bearer token is kept in `localStorage`, so any successful XSS can read
it. The lifecycle around it is otherwise sound: set on sign-in, removed on 401
and on sign-out.

**Not fixed, deliberately.** The fix is an httpOnly cookie, and the backend
returns the token in a JSON body rather than setting one — so this cannot be
closed from the frontend alone. The `/api/backend` rewrite already puts a
server hop in the path, which is where a cookie would be set once the backend
cooperates. Recorded here rather than left silent.

**Mitigation already in place:** no `dangerouslySetInnerHTML`, `innerHTML`,
`eval` or `new Function` anywhere in `app/`, `components/`, `lib/` or
`api/` — swept and confirmed — and the report-only CSP above is the
groundwork for constraining what an injected script could do.

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

### First pass

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

### Second pass

Instrumented rather than eyeballed. Each check below is a measurement taken in
the running app, not an impression of a screenshot.

- **Toast over the status bar** — with a toast open, the viewport computes
  `pointer-events: none`, `elementFromPoint` at three points along the
  status strip returns the strip's own elements, and the toast's Undo and Close
  are still hit-testable and functional.
- **Icon alignment** — a script walks every leading icon in a flex row, ranges
  the first line of the text beside it, and compares centres. Zero rows off by
  more than 1px across all ten routes, at every interface-scale step
  (13/14/16/18/20px root), and at 375px viewport width. The console History rows
  that were previously offset measure exactly 0.
- **All four engines archive their results** — each run driven to completion,
  then the record read back out of IndexedDB directly:
  - *Scanner*: 528bp target vs reference, 1 variant called, stats + variant +
    sequence preview stored, true counts reported alongside the bounded ones.
  - *Simulator*: 3 generations, seed `919363860` kept, generation series and
    final strand stored.
  - *Growth Lab*: 9 steps, full growth curve, adaptation log, environment.
  - *Predictor*: 2 markers, 2 drug classes, calls stored with the reference-data
    version that scored them.
- **Run detail renders per engine** — variant table for a scan, run chart plus
  generation table for a simulation, population curve for an experiment, and
  scored calls for a prediction, with the raw record collapsed beneath.
- **The generation double-count** — a 3-generation run files exactly 3 stats for
  generations [1, 2, 3], and the run log shows one line per generation. This is
  how H16 was found: an archived 2-generation run had four.
- **Activity is complete, Notifications is a subset** — with 48 events seeded
  including 3 exports, Activity reports 48 and its Exports filter finds 3; the
  notification feed reports 45 and contains no exports.
- **Overflow is named** — "Show 5 more · 5 remaining", "11 of 45" after an
  engine filter, "1 of 45" after a search, and Clear restores the full list.
- **Unread is one mark** — every notification row has exactly one rail, zero
  dots and no row tint.
- **CSP** — zero `securitypolicyviolation` events across all ten routes plus
  sign-in, with blob URL creation and blob-backed image loading both succeeding.
  The production policy drops `'unsafe-eval'` and `ws:` and adds
  `upgrade-insecure-requests`.
- **Deep routes do not litter the tab strip** — visiting `/activity/<id>`
  leaves a single `/activity` entry in the persisted `openTabs`.
- **No console errors or hydration warnings** on any route.

Automated each loop: `tsc --noEmit`, `vitest run` (160 tests),
`next build`.

