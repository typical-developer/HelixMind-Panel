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

### 3.4 A real activity timeline view · ~half a day
The activity log holds 200 events and only the last 12 are shown. A filterable
timeline — by engine, by kind, by date — would make it useful rather than
decorative.

### 3.5 Drag to reorder tabs · ~3 hours
Standard in every editor; conspicuously missing here.

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

### 5.4 A Content-Security-Policy · ~half a day
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
