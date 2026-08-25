# Suggestions

Where to take the panel next, in the order I would do it. Each item says what it
buys you and roughly what it costs.

---

## Milestone 1 — close the gaps this pass left open

These are the five items in BUG-REPORT.md § Open. They are first because each is
a control the user can already see and touch that does not do what it looks like
it does.

### 1.1 Make the strain selector drive the growth model · ~half a day
The highest-value item on this list: five strains and three custom sliders that
currently change nothing.

```ts
new MicrobeSimulation(random, strain)
temperatureCoeff(t, strain.tempOptimal)
growthRate = strain.growthRate            // instead of MAX_GROWTH_RATE
sim.avgResistance = strain.resistance     // handleReset already does this
```

The tests in `tests/models.test.ts` already pin the current curves, so a
regression will show up immediately. Add cases asserting *Thermus aquaticus*
peaks near 70 °C and that a slower strain reaches carrying capacity later.

### 1.2 Wire pH, nutrients and oxygen into mutation rate · ~2 hours
Replace `temperatureFactor` with a combined stress factor. `phCoeff` and
`oxygenCoeff` already exist and are tested in `lib/growth-model.ts` — lift them
into a shared `lib/environment.ts` rather than duplicating.

The two views currently disagree about what an environment even is: one uses
numeric pH/oxygen, the other uses strings (`"Normal (21%)"`). Unify on numbers
and let the select map to them.

### 1.3 Let the organism affect resistance scoring · ~2 hours
The advisory already fires. Turn it into a weight: a marker not reported in the
selected organism should score lower, not identically. `AMRRecord.organisms`
carries the data.

### 1.4 Keep runs alive across navigation · ~1–2 days
The one architectural item here. State lives in the routed page, so leaving ends
the run. Two routes:

- **Cheap:** hoist run state into a provider above the router, keyed by view.
  Fixes navigation; still dies on reload.
- **Right:** move the engines into a Web Worker. Fixes navigation *and* stops a
  megabase scan blocking the main thread, which would let the DNA Scanner report
  real percentage progress instead of an indeterminate sweep.

I would do the worker. The engines are already pure functions in `lib/` with no
DOM dependencies — that refactor was done partly with this in mind.

### 1.5 Decide what the backend is for · ~1 day once it responds
`parse_fasta`, `simulate_mutation` and `previouslyReadFastas` are implemented and
unused. `previouslyReadFastas` is the interesting one: a real cross-device
history the panel does not have.

Before wiring anything, settle the question the code currently dodges — is the
browser or the server the source of truth? A hybrid where both compute is the
worst outcome. My suggestion: keep computation local (it is fast, private, and
works offline) and use the server only for **sync** — upload history and saved
runs, so a second machine sees your work.

---

## Milestone 2 — make the science defensible

The panel is labelled a research tool, and these are the places where it
currently overstates what it knows.

### 2.1 Gapped alignment · ~1 day with a library
`callMutations` compares index to index. One indel and every downstream call is
wrong. The UI warns about this, which is the right stopgap, but a Smith-Waterman
or Needleman-Wunsch pass over a windowed region would make the variant list
trustworthy. `bio-seq` or a small hand-rolled affine-gap implementation both fit.

### 2.2 Reverse-strand ORFs · ~2 hours
`findORFs` scans three forward frames. Real ORF calling scans six. Cheap to add,
and roughly doubles the count on real genomes — worth doing before anyone
compares the number to another tool.

### 2.3 Cite the resistance data · ~half a day
`confidence` and `prevalence` are plausible but unsourced. Add a `source` field
per record (CARD, ResFinder, a PMID) and show it in the gene row. A research
tool that cannot say where a number came from is hard to defend.

There is already a ResFinder/PointFinder database and a PubMed service in
`New Helix/Annotation/` — unused by the app, but the obvious source.

### 2.4 Confidence intervals rather than point estimates · ~half a day
"99%" reads as certainty. A range, or a qualitative band with the underlying
evidence count, would be more honest.

---

## Milestone 3 — the workbench

### 3.1 Split view · ~1 day
The bench is one view at a time. Comparing two scans means switching tabs. The
resizable-panel infrastructure is already there.

### 3.2 Persist scanner and simulator inputs · ~2 hours
Reload and your uploaded file is gone. The snapshot store already keeps results;
keeping the parsed sequence (or an IndexedDB handle to the file) would let a run
be resumed. IndexedDB, not `localStorage` — a genome exceeds the quota.

### 3.3 Command palette: fuzzy matching · ~3 hours
Matching is currently substring. `cmdk`'s built-in scorer or a small
subsequence matcher would let "mutsim" find "Mutation Simulator". Recents,
highlighting and Tab-completion already landed this pass.

### 3.4 A real activity timeline view · **DONE**
`app/(main)/activity/page.tsx`, registered in the view registry so the sidebar,
tab strip and palette pick it up. Filters by engine, kind and severity plus
free-text search, paging that names what it has not shown, and CSV/JSON export
of whatever the filters have narrowed to. Rows link through to the archived run
that produced them (`app/(main)/activity/[runId]/page.tsx`).

What is *not* done: filtering by date range. The free-text search and the
newest-first ordering cover most of what a range would, and a date picker is a
lot of surface for the remainder — worth adding when someone actually reaches
for it.

### 3.5 Drag to reorder tabs · **DONE**
Native HTML5 drag, plus `Alt Shift ←/→` and *Move left* / *Move right* on the
tab's right-click menu — the drag alone would have been mouse-only. Order lives
in `openTabs`, so it persists with the rest of the layout.

### 3.6 Pinned tabs · ~half a day
The natural generalisation of "the last tab cannot be closed": let the user
choose which tabs get that protection instead of it always falling to whichever
one is left. Pin from the right-click menu, pinned tabs shrink to their icon and
sort to the front, and *Close all* / *Close others* skip them — the contract
Chrome and VS Code both use, so it needs no explaining.

### 3.7 A section menu on the sidebar's "HelixMind Lab" header · ~1 hour
The header carries one action, *Collapse all groups*. The tree already marks
which views are open, so the actions that complete it are the ones the tab strip
owns: *Close all analyses* and *Reopen closed*. A `⋯` menu beside the collapse
button, the way VS Code's Explorer carries its overflow.

### 3.8 The layout controls exist in five places · ~2 hours
Found while removing the context bar, and left alone because you kept them. The
same handful of switches is reachable from:

1. the title bar's three buttons and its Customize menu,
2. the tab strip's inspector and console buttons — **pixel-identical** to two of
   the title bar's, a few inches away,
3. the sidebar header's `⋯` menu (four checkboxes),
4. the rail's Preferences mode (seven switches, zoom, reset),
5. Settings → Layout and Appearance.

Apple's guidance calls a nav bar, toolbar and tab bar competing on one view the
anti-pattern; five copies of one control set is the same failure spread wider.
The cheapest two cuts are (2) and (3) — neither owns anything the title bar does
not — which would take it to three surfaces: the toolbar, the rail, and Settings.

### 3.9 The Overview repeats the status bar · ~1 hour
*Running now* and *Open alerts* are two of the four tiles on the Overview, and
both are already in the status strip at all times, on every view. Dashboard
guidance is five to eight primary visuals and no duplicated readouts; dropping
those two would leave *Sequences analysed* and *AMR threats* — the pair that is
genuinely the workspace's story — with twice the room.

---

## Milestone 4 — accessibility and polish

### 4.1 An accessibility audit · ~1 day
Arrow-key tab navigation and the roving tabindex landed this pass. Still open:

- Live regions for run completion — a screen reader is told nothing when a scan
  finishes. `role="status"` exists on the scanner's progress panel; it should
  announce results too.
- Focus management on dialog close — focus should return to the trigger.
- Contrast audit of `--log-dim` (#7a7a7a on #0a0a0a is around 4.1:1, below AA for
  small text).
- The sequence viewer is a wall of unlabelled spans; it needs a text alternative.

### 4.2 Reduced motion · ~1 hour
`globals.css` neutralises page transitions, but the new pulsing tab dot and the
progress sweep should be covered too.

### 4.3 A light theme · ~1 day
Settings says "HelixMind ships a single dark lab theme" — true, and fine, but
the token structure in `globals.css` would support light with little work, and
`next-themes` was already a dependency (now removed; add it back if you do this).

---

## Milestone 5 — engineering

### 5.1 Component tests · ~1 day
131 tests cover `lib/`. The React tree has none. Playwright over the real app
would suit this better than jsdom — the workbench is mostly layout, panel sizing
and navigation, which jsdom models poorly. The flows worth pinning are exactly
the ones I drove by hand: scan → Overview, close-all, tab signals, the palette.

### 5.2 CI · ~2 hours
`typecheck`, `test` and `build` on every push. All three pass today; keeping them
passing is the point.

### 5.3 Error reporting · ~half a day
`ErrorState` shows a digest, and the report dialog collects a bundle — but
nothing aggregates them. Sentry (or equivalent) behind an env var would turn
one-off reports into a signal.

### 5.4 A Content-Security-Policy · **PARTLY DONE**
Shipped as `Content-Security-Policy-Report-Only` in `next.config.mjs`, verified
clean across every route in dev. Promoting it to enforcement needs two things:
the same confirmed against a production build, and a nonce threaded through the
Next runtime so `script-src` can drop `'unsafe-inline'`. The original note
below still describes that remaining work.


`next.config.mjs` explains, correctly, that a CSP was skipped because it needs a
nonce wired through the runtime and a wrong one fails closed. Worth doing before
this is public: it is the one significant header still missing.

### 5.5 Prune the remaining unused UI primitives · ~1 hour
Roughly 30 shadcn components in `components/ui/` are still unimported. They cost
nothing at runtime (tree-shaken) but they are noise when searching.

---

## Deliberately not suggested

- **A component library swap.** The Radix/shadcn base is working well.
- **A state library.** The three-context split does what Redux or Zustand would,
  with less indirection.
- **Server-side rendering of analyses.** Local computation is the panel's best
  property: fast, private, offline. Do not give it up without a reason.
