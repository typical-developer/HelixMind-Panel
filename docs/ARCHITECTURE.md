# HelixMind Panel — architecture

Every layer of the app, what it owns, and why it is shaped the way it is.

---

## 1. The shape of the thing

HelixMind Panel is a **Next.js 16 App Router** application that presents itself as
an IDE-style workbench: a rail down the left, a sidebar, a strip of open tabs, a
main "bench", a console underneath and a status strip along the bottom.

The single most important fact about it:

> **Every analysis runs in your browser.** Nothing is computed on a server.
> The only network call the app makes is authentication.

That is not an accident of the prototype — it is the current design. Sequences
you upload are read with `File.text()`, parsed in JavaScript, and the results are
kept in `localStorage`. Nothing is uploaded.

```
┌──────────────────────────────────────────────────────────────┐
│ app/layout.tsx           AuthProvider · Toaster · Analytics   │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ app/(main)/layout.tsx   auth gate                        │ │
│ │  NotificationsProvider                                   │ │
│ │   WorkbenchProvider  ── ConsoleProvider + LayoutProvider  │ │
│ │    SupportProvider                                       │ │
│ │     Workbench  ── rail │ sidebar │ tabs │ bench │ console │ │
│ │        └── {children}  = the routed view                 │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Directory map

| Path | What lives there |
|---|---|
| `app/(auth)/` | Sign in, sign up, password reset. No workbench chrome. |
| `app/(main)/` | Everything behind the auth gate. Wrapped in the workbench. |
| `components/workbench/` | The shell: provider, rail, sidebar, tabs, console, status bar, palette, primitives. |
| `components/support/` | Bug reporting and the help menu. |
| `components/notifications/` | The bell, the row component, the feed provider. |
| `components/ui/` | shadcn/Radix primitives. |
| `lib/` | All pure logic and all persistence. **No React components.** |
| `api/` | The HTTP client and auth calls. |
| `tests/` | Vitest suites over `lib/`. |
| `docs/` | This file and its siblings. |

The rule that keeps this navigable: **`lib/` never imports from `components/`**.
Logic can be tested without rendering, and a view can be rewritten without
touching the model behind it.

---

## 3. The workbench provider — and why it is three contexts

`components/workbench/workbench-provider.tsx` is the heart of the app. It is
split into **three separate React contexts**, and the split is load-bearing.

### 3.1 Why not one context

A running simulation pushes a log line several times a second. If layout state
and console output shared one context, every one of those lines would re-render
the title bar, the rail, the sidebar, the tab strip, the status bar *and* the
open view. The split means output only re-renders the things that display
output.

### 3.2 The three contexts

```
ConsoleActionsContext   the writers      — identity NEVER changes
      │                                     (every function is useCallback([]))
ConsoleSignalsContext   run + alert state — changes on run/alert transitions only
      │
ConsoleStateContext     logs, history…   — changes on every log line
      │
WorkbenchContext        layout, tabs      — changes only on user action
```

| Hook | Subscribes to | Use it when |
|---|---|---|
| `useConsoleActions()` | writers only | A view **publishes** logs/alerts. Never re-renders you. |
| `useConsoleSignals()` | run source + per-source alert counts | You need to know *whether* something is happening. The tab strip uses this. |
| `useConsole()` | everything | You **display** output: the console panel, the status bar, the Runs sidebar. |
| `useWorkbench()` | layout, tabs, palette | Chrome and navigation. |

**The important consequence:** the tab strip shows a live "running" dot without
re-rendering on every log line, because `ConsoleSignalsContext` is memoised on
`alertMap` and `runStatus` alone.

### 3.3 The publishing hooks

Views do not reach into the console directly. They declare what they want shown:

```tsx
useAlerts("dna-scanner", alerts)     // → Alerts tab, tab dot, status bar
useLogStream("dna-scanner", lines)   // → Run log
useRunStatus({ label, state, source, progress, detail })
useStatusItems([{ id, label, onClick, title, tone }])
useViewContext("what this view is working on")
```

Two subtleties worth knowing:

- **`useLogStream` tracks the last line it emitted**, not a count. That makes it
  work for both append-only histories and fixed-size rolling buffers — the
  Growth Lab keeps only its last ten adaptation entries, and every one still
  reaches the log exactly once.
- **`useAlerts` deliberately does *not* clear on unmount.** Alerts survive you
  navigating away, which is what lets a background tab carry an attention dot
  and what lets the Alerts tab show findings from three different analyses at
  once.

### 3.4 Run lifecycle

`publishRunStatus` derives history from the *transition*, not the value:

```
null → running/paused        a run has started (recorded in a ref)
running/paused → done        finished    → history "completed" + success toast
running/paused → null        interrupted → history "stopped"  + warning toast
```

A view unmounting publishes `null`, so **leaving an analysis ends its run.**
That is a real limitation (see BUG-REPORT.md); the panel says so out loud with a
toast rather than letting the run vanish silently.

---

## 4. The registry

`components/workbench/registry.tsx` is the single source of truth for every
routed view. The rail, sidebar tree, tab strip, context bar and command palette
all read from it, so adding a view is one entry rather than six parallel edits.

```ts
{ href, source, label, group, icon, hint, runnable?, chord? }
```

`source` is the console channel the view publishes under. It exists so a log
line, an alert and a tab can all be traced back to the same view — before it,
the Growth Lab published alerts as `microbe-growth-lab` and log lines as
`microbe-lab`, and the console filed one view under two names.

`normalizeHref()` strips a query string back to the registry route. The gene
library is opened as `…/gene-database?q=mecA`; that string is for the router,
but only the bare route is a tab.

---

## 5. Persistence

All storage goes through `lib/storage.ts`. Nothing calls `localStorage`
directly, for three reasons: it is read during render (including the server
render, where it does not exist), Safari private mode throws on quota, and keys
are versioned so a shape change ships a new suffix rather than a migration.

| Key | Holds | Written by |
|---|---|---|
| `helixmind.workbench.v2` | Region visibility, sizes, open tabs | Layout provider |
| `helixmind.activity.v1` | The event log (cap 200) | `lib/activity-store.ts` |
| `helixmind.snapshot.v1` | Last scan + last prediction, for the Overview | `lib/lab-snapshot.ts` |
| `helixmind.runs.v1` | Finished runs (cap 50) | Console provider |
| `helixmind.runlog.v1` | Log tail (cap 200) | Console provider |
| `helixmind.notifications.v1` | Read/dismissed ids only | Notifications provider |
| `helixmind.preferences.v1` | Settings toggles | `lib/preferences.ts` |
| `helixmind.palette.recents.v1` | Last 6 palette picks | `lib/palette-recents.ts` |
| `Helix_user_token` | Auth token | `contexts/AuthContext.tsx` |

`CLEARABLE_KEYS` is everything except the token — "Delete all data" wipes the
workspace but does not sign you out.

> **Restored ids are renumbered.** The workbench writes two boot log lines from
> a child effect, which runs *before* the parent effect that restores the saved
> log. Restored entries are given negative ids so they cannot collide with what
> the current session has already written.

---

## 6. The activity store — the spine

`lib/activity-store.ts` is what makes the Overview a summary rather than a
poster. It is a plain module-level store with `useSyncExternalStore`, not a
context, because producers are views deep in the tree and consumers are chrome
above them — a context would have to wrap the whole app and re-render it on
every append.

```ts
recordActivity({ kind, engine, label, detail, href, severity, value })
```

| Kind | Raised by | Feeds |
|---|---|---|
| `scan.completed` | DNA Scanner | Sequences analysed, activity feed, notifications |
| `simulation.completed` | Mutation Simulator | Runs completed, feed, notifications |
| `growth.completed` | Growth Lab | Runs completed, feed, notifications |
| `prediction.completed` | Resistance Predictor | Runs completed, feed, notifications |
| `threat.detected` | Resistance Predictor | **AMR threats tile + status bar** |
| `export.created` | `lib/download.ts` | Activity feed |

Selectors — `summarise()`, `engineReports()` — are pure and unit-tested.

**Notifications are derived from this log, not stored separately.** The feed
provider owns only two arrays: which ids are read and which are dismissed. That
makes drift between the Overview's activity list and the bell impossible,
because there is only one list.

`lib/lab-snapshot.ts` is the companion: the *content* of the last scan (900-base
preview, 25 variants) and the last prediction, so the Overview's viewer, mutation
log and chart show real results.

---

## 7. The analysis engines

All four are pure functions in `lib/`, tested without rendering.

### 7.1 FASTA — `lib/fasta.ts`

Parsing walks lines rather than splitting on `>`, because `>` is only a record
separator at the start of a line. IUPAC ambiguity codes fold to `N` rather than
being dropped, so downstream coordinates stay correct.

**`findORFs()` is a linear scan of three reading frames.** It replaced the regex
`ATG(?:.{3})+?(?:TAA|TAG|TGA)`, whose lazy quantifier backtracks
catastrophically — on the 3 MB genome in `test-files/` it pinned the main thread
for minutes. An ORF must be ≥ 90 bp (30 codons) to count.

`callMutations()` is an **ungapped, position-to-position** comparison. A single
indel shifts every downstream call, which is why `qualityWarnings()` flags a
large length discrepancy. Results are capped at 50,000.

### 7.2 Mutation dynamics — `lib/mutation-model.ts`

```
temperatureFactor(°C) = 1.1 ^ ((T − 37) / 5)
effective substitution rate = base rate × temperatureFactor
indel rate = substitution rate × 0.1
```

- **`createRandom(seed)` is mulberry32.** The previous generator was re-seeded
  with `Date.now() + generation` every step (so nothing was reproducible) and
  multiplied a ~1.7e12 seed by 9301, overflowing `Number.MAX_SAFE_INTEGER` and
  biasing its output. The seed is now fixed at run start and written into the
  export.
- Transitions outnumber transversions ~2:1 (the `0.66` threshold).
- **Indels are generated**, applied back-to-front so an edit does not shift
  indices still to be visited. The "Indels" tile was previously hardwired to 0.
- Coding context is **real ORF membership**, not `position < length − 100`.
- Fitness: 100, less 1.5 per non-synonymous coding substitution, 6 for a
  premature stop, 10 per indel (frameshift).
- `nextRunAction()` decides start/pause/resume/restart. It is a separate pure
  function because the bug it replaced was invisible until you pressed the
  button.

### 7.3 Population growth — `lib/growth-model.ts`

Logistic growth with four multiplicative environmental coefficients:

```
growth = MAX_RATE × tempK × phK × nutrientK × oxygenK × (1 − N/K)
tempK      Gaussian about 37 °C, zero outside 10–46 °C
phK        inverted parabola about pH 7, width 2.5, clamped at 0
nutrientK  Monod:  S / (Kₛ + S),  Kₛ = 20
oxygenK    1 above 5 %, else 0.1
kill rate  Hill function; MIC rises 10 → 100 as resistance goes 0 → 1
```

Selection raises average resistance under antibiotic pressure and it decays
when the pressure is removed. History is capped at 600 points, and `getState()`
returns **fresh arrays** — the previous version handed out its live array and
then mutated it, so the chart's memo never invalidated.

### 7.4 Resistance prediction — `lib/amr-model.ts`

A lookup with a synergy pass, not a model. Markers are grouped by drug class
(the unit a clinician acts on), the class takes its strongest marker's
confidence, then synergy rules may raise — never lower — it.

```
gyrA + parC          → Fluoroquinolones 0.90   (either alone: 0.40)
blaCTX-M + blaOXA-48 → Carbapenems      0.99
```

Reads from `lib/amr-records.ts`, which is now genuinely the single source of
truth for all nine markers.

---

## 8. Feedback: toasts

`hooks/use-toast.ts` — a module-level store, so `toast()` is callable from plain
functions like `lib/download.ts`.

- 3 concurrent toasts, 5 s dwell (9 s for errors).
- Variants `success` / `warning` / `destructive` / `info`, each with an icon and
  a left accent rule — severity never rests on colour alone.
- **Settings → "In-app notifications" is honoured inside `toast()`**, at the one
  place every toast passes through. Errors are never suppressed: the preference
  is about routine confirmations, not about hiding failures.
- Mounted in the **root** layout, so the auth pages get it too.

---

## 9. Support and diagnostics

`lib/diagnostics.ts` builds a bundle: app version, route, layout state, open
tabs, current alerts, the last 50 log lines, and browser details. It deliberately
excludes the auth token, the user's email and any sequence data — and the dialog
renders the whole thing for review **before** the user does anything with it.

There is no support endpoint in the API, so the dialog offers only what a browser
can honestly do: **copy**, **download JSON**, **open in mail client**. Nothing
claims to file a ticket.

---

## 10. Auth and the API

`api/main.ts` wraps `fetch` with: a configurable base URL, a 20 s timeout,
tolerant body parsing (an HTML error page from a proxy no longer surfaces as
`Unexpected token '<'`), and errors that are always `Error` instances.

**The browser never calls the backend's host directly.** It calls
`/api/backend/*` on the panel's own origin, and a rewrite in `next.config.mjs`
forwards that to `API_UPSTREAM` from the server. The backend's CORS allowlist
holds `http://localhost:3000` and nothing else — every other origin gets a 500
with no `Access-Control-Allow-Origin` on the preflight — so a direct call works
in local development and nowhere else. Routing through our own origin removes
CORS from the picture entirely, and keeps working across Vercel's
per-deployment preview URLs, which no fixed allowlist could cover.

`NEXT_PUBLIC_API_URL` still overrides the base for the browser, for pointing at
a local or staging backend. It should be left unset in any deployment; see
`.env.example` for why.

`contexts/AuthContext.tsx`:

- Skips the session check entirely when no token is stored.
- Drops a token that fails validation rather than retrying it forever.
- **Sign-up does not sign you in** — the endpoint returns no token, so claiming
  a session would mean every subsequent request 401s.
- `signOut()` navigates, so no call site has to remember to.

Three endpoints exist and are used: `/auth/signup`, `/auth/login`, `/me/auth`.
Three more exist and are **not** used — see BUG-REPORT.md § Known gaps.

---

## 11. Verification

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest run — 131 tests over lib/
npm run build       # next build
npm run dev         # then drive the app
```

Tests cover `lib/` only, on purpose. The React tree is almost entirely layout,
panel sizing and navigation, which jsdom models badly enough that passing tests
would not mean much; those paths are verified by driving the running app.
