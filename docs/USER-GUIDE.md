# HelixMind Panel — user guide

---

## Before anything else

**Everything runs in your browser.** Your sequences are never uploaded. Results,
run history, notifications and your layout are stored in this browser and this
browser only — clearing site data clears them, and another machine will not see
them. Only signing in talks to a server.

**Finished runs keep their results.** When a scan, simulation, experiment or
prediction completes, the panel files the whole thing — what went in, the
parameters, the seed, the build, and what came out. Open **Activity** to find it
again, reopen it, or export it. That means results survive you navigating away,
and it also means this device holds sequence data: if you share the machine,
clear it from **Settings → Danger zone** when you are done.

The archive keeps the 100 most recent runs, up to 64MB. Beyond that the oldest
are dropped to make room. Some browsers — private windows especially — will not
let the panel store anything; when that happens the Overview says so plainly and
you should export what you need instead.

---

## The workbench

```
┌────────────────────────────────────────────────────────────┐
│  HelixMind   [ search…  Ctrl K ]        🔔  ▤ ▤ ▤  ⚙       │  title bar
├────┬───────────────┬───────────────────────────────────────┤
│ 🔬 │               │ Overview │ DNA Scanner ● × │ sample.fa │  tabs
│ ▶  │   sidebar     ├───────────────────────────┬───────────┤
│ 🧬 │               │                           │           │
│    │               │                           │           │
│ ?  │               │        the bench          │ inspector │
│ 👤 │               │                           │           │
│ ⚙  │               ├───────────────────────────┴───────────┤
│    │               │  Alerts │ Run log │ History           │  console
├────┴───────────────┴───────────────────────────────────────┤
│ HelixMind Lab │ ✓ │ 1 sequence │ 2 AMR threats            │  status bar
└────────────────────────────────────────────────────────────┘
```

| Region | What it is for |
|---|---|
| **Rail** (far left) | Switches what the sidebar shows. Help, account and preferences at the bottom. |
| **Sidebar** | Analyses, run state, or the gene library. |
| **Tabs** | Every analysis you have opened — and, at the far end of the strip, what the open one is working on. |
| **Bench** | The analysis itself. |
| **Inspector** (right) | That analysis's inputs and parameters. |
| **Console** | Alerts, the run log, and finished runs. |
| **Status bar** | Alerts and runs on the left; the open analysis's readouts on the right. **Most items are clickable.** |

Every region can be hidden — from the title bar's layout menu, the sidebar's
Preferences mode, or Settings → Layout. Your arrangement is remembered.

---

## Keyboard

| | |
|---|---|
| `Ctrl K` / `Ctrl P` | Search analyses and genes |
| `Ctrl Shift P` | Run a command |
| `Ctrl B` | Sidebar |
| `Ctrl Alt B` | Inspector |
| `Ctrl J` | Console |
| `Ctrl \`` | Console → Run log |
| `Ctrl ,` | Settings |
| `Alt W` | Close the open analysis |
| `Alt Shift T` | Reopen the last closed analysis |
| `Alt Shift ←` / `→` | Move the open analysis along the strip |
| `← →` | Move between tabs (when the strip has focus) |
| `Home` / `End` | First / last tab |
| `Delete` | Close the focused tab |
| `Ctrl Alt +` / `-` / `0` | Interface scale |
| `Esc` | Leave focus mode or restore the console |

> Why `Alt` and not `Ctrl` for closing and reopening? Browsers reserve `Ctrl W`
> and `Ctrl Shift T` for their own tabs and will not release them to a page.

---

## Search — `Ctrl K`

Typing searches analyses and genes together. Three prefixes narrow it:

| Prefix | Searches |
|---|---|
| *(none)* | Analyses and genes |
| `>` | Commands — layout, console, tabs, account |
| `@` | The gene library |
| `?` | Help, support and about |

- **Recent** picks appear first when the box is empty.
- **`Tab`** completes to the best match.
- Matches are **bold** so you can see why a result is there.

---

## Tabs

Opening an analysis keeps it open. Each tab can carry a small dot:

| Dot | Meaning |
|---|---|
| Pulsing white | That analysis is running |
| Amber | It raised warnings |
| Red | It raised errors |

The dot sits where the close button goes and swaps for it on hover. The count
badge beside the overflow button carries an amber dot if anything anywhere needs
attention.

**Drag a tab** to reorder the strip; the order is remembered. `Alt Shift ←` and
`Alt Shift →` do the same from the keyboard, and both are also on the tab's
right-click menu as *Move left* / *Move right*.

**Right-click a tab** for Close / Close others / Close all / Reopen closed, plus
the two move commands. The `⋯` button lists everything open with the same
actions.

**The last analysis open cannot be closed.** The bench always has a view on
screen, so a strip that said "nothing open" would be describing something that
isn't true — the last tab keeps no close button, and `Alt W`, middle-click and
`Delete` all leave it alone. Hovering it says so, and each of those keys answers
with a line in the status bar rather than appearing to do nothing. *Close all*
is the way to clear the deck: it closes everything and lands you on a single
Overview tab, with `Alt Shift T` still holding the rest.

> A run **ends when you leave the analysis that started it.** The status bar
> says so for a few seconds. This is a known limitation, not a crash — and the
> run is still filed in **History** and, if it completed, in **Activity** with
> its result.

---

## The console

**Alerts** — what needs attention, grouped by the analysis that raised it. Click
an alert to open that analysis. Alerts persist when you navigate away, so you
can scan three files and review all the warnings together. Dismiss per-group or
all at once.

**Run log** — line-by-line output. Filter by text, by analysis, or by level.
Matches are highlighted. Copy the whole log from the toolbar. It follows the tail
only while you are already at the bottom, so scrolling back is never yanked away.

**History** — finished runs, with duration and outcome, **kept between visits**.
Export as JSON. Clearing offers an undo. The top row opens **Activity**, which
is where a run's actual results live.

> The log buffers 500 lines and keeps the most recent 200 across a reload. If
> you need the full record of a run, export it from Activity rather than
> relying on the log.

---

## The analyses

### Overview
A summary of what this workspace has actually done — nothing is shown that you
have not produced. On a new workspace it offers a "Get started" card instead.

The sequence viewer, mutation log and resistance chart show your **most recent**
scan and prediction. The inspector lists recent activity (click through to the
source) and per-engine usage.

### DNA Scanner
Upload a target FASTA; optionally a reference.

- Without a reference: length, GC content, ambiguous bases, putative ORFs.
- With one: substitutions called between the two, as SNPs classified
  transition/transversion.

Accepts `.fasta .fa .fna .ffn .faa .frn .txt`, up to 32 MB. Multi-FASTA files
let you switch sequences from the inspector.

> Comparison is **position-to-position with no gap handling**. An insertion or
> deletion shifts every downstream call, so a large length difference between
> target and reference is flagged in the console — treat those results with
> suspicion.

Export statistics as JSON or variants as CSV.

### Mutation Simulator
Runs a sequence forward through up to 10 generations.

Each generation applies substitutions at your rate scaled by temperature
(ten-fold per 50 °C above 37 °C), plus indels at a tenth of that rate. Fitness
starts at 100 and drops for non-synonymous coding changes (−1.5), premature stop
codons (−6) and indels (−10, they frameshift everything downstream).

**Start / Pause / Reset.** Pause keeps every generation computed so far; pressing
Start again resumes. A finished run restarts from zero.

Every run uses a fixed random seed, written into the export — the same seed
reproduces the run exactly.

> **Not yet connected:** pH, nutrient and oxygen are recorded and exported but do
> not affect the outcome.

### Microbe Growth Lab
Logistic growth under environmental stress.

Temperature (Gaussian about 37 °C, no growth outside 10–46 °C), pH (optimum 7),
nutrients (Monod saturation, consumed as the culture grows) and oxygen. The
antibiotic toggle applies a dose whose effect falls as the culture acquires
resistance; resistance decays once the dose is removed.

The stress monitor shows how far each variable is from optimal. The adaptation
log records selection and mutation events and streams to the run log.

Export the curve as CSV or the chart as PNG.

> **Not yet connected:** the strain you pick, and the custom-strain sliders, are
> displayed but do not drive the model. Every strain currently grows the same.

### Resistance Predictor
Select detected markers; get predicted resistance grouped by drug class.

Each class takes its strongest marker's confidence. **Synergy rules** can raise
it:

- `gyrA` + `parC` → Fluoroquinolones **90%** (either alone: 40%)
- `blaCTX-M` + `blaOXA-48` → Carbapenems **99%**

A marker not normally reported in the chosen organism raises an advisory in the
console.

> **Not yet connected:** the organism flags unexpected markers but does not
> change the score. This is **not a diagnostic tool** — clinical resistance is
> determined by susceptibility testing.

### Gene Library
Nine curated resistance markers. Filter by gene, antibiotic, organism, drug class
or mechanism. Hover a row to **analyse that marker in the Resistance Predictor**
(it arrives preselected) or copy its symbol.

### Activity
Everything this workspace has recorded — every run, every export — with filters
for engine, kind and severity, and free-text search. Runs that produced a result
carry a **result** chip; open one to see:

- **Result** — the headline numbers.
- **Provenance** — the inputs, the parameters, the seed and the build that
  produced it. This is what lets you repeat a run and get the same answer, or
  say exactly what an old result was based on.
- **Stored result** — the record as archived, and an Export button.

Export what a filter has narrowed to as CSV or JSON from the pane header.

### Notifications
A subset of Activity: finished scans, simulations, predictions and detected
threats — the things worth interrupting you about — with read and dismissed
state. Exports are not included; those are in Activity. Click one to open the
analysis that produced it. Marking read, dismissing and clearing all offer an
undo.

### Settings
Search jumps to individual settings, not just sections — matching rows appear in
a dropdown and flash when you land on them.

**Profile** is read-only; the API has no endpoint for changing it.
**Danger zone → Delete all data** removes the activity log, archived results
(including any sequence previews they hold), notifications, preferences and
layout from this device. It tells you how many runs it is about to delete. You
stay signed in.
**Notifications** — in-app toasts (off suppresses confirmations but never
errors), email (stored, not connected), and whether destructive actions ask
first. **Layout**, **Appearance**, **Keyboard shortcuts**, **Support**, and a
**Danger zone**.

**Delete all data** wipes activity, runs, notifications, preferences and layout
from this browser. It asks you to type `delete`. You stay signed in.

---

## Getting help

**Rail → `?`**, or `Ctrl K` then `?`.

**Report a problem** builds a diagnostic bundle: app version, current route, open
analyses, layout, current alerts, the last 50 log lines, and your browser
details. **It shows you the whole thing before you do anything with it**, and it
excludes your sequences, your email and your sign-in token.

Nothing is transmitted automatically — the panel has no support endpoint, and it
does not pretend otherwise. You get three options: **Copy**, **Download JSON**,
or **Open in email**. If the log is too long for a mail link you will be told to
attach the file instead.

**Report this error** also appears on the error screen if a view fails, pre-filled
with the error and its reference.

**About** lists the version, where your data lives, and the current known
limitations.

---

## Signing in

Sign-up creates an account but does **not** sign you in — sign in afterwards with
your new credentials.

**Password reset is not available.** There is no endpoint for it, so the page
does not pretend to send a code. Email support to recover an account.

Signing out clears your token. Your workspace data stays on the device.
