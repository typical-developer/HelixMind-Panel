# DNA Scanner — 3D Structure Feature

## What this is

Adds a "3D Structure" tab to `DNAScanner.tsx` that renders:
1. A DNA/RNA double helix from the uploaded sequence (procedural geometry, no external call)
2. A predicted protein fold for the sequence's longest ORF (via ESMFold API + Mol* viewer)

Both render from the *same* parsed sequence state DNA Scanner already produces on
upload — no separate upload, no duplicate parsing. Upload triggers the full scan
(stats, mutations, resistance, 3D structure) automatically; there's no manual
"Run Scan" step required anymore.

## Files

| File | Purpose |
|---|---|
| `src/lib/structure/DnaHelix3D.tsx` | Three.js component. Draws a double helix directly from sequence characters — fixed B-DNA geometry (rise/twist per base pair), colored spheres per nucleotide (A/T/C/G). No network call; pure client-side rendering. |
| `src/lib/structure/ProteinStructure3D.tsx` | Sends an amino-acid string to the ESMFold public API, gets back a PDB file, renders it with Mol* (`@rcsb/rcsb-molstar`). Has a pre-flight length guard — sequences over ~400 residues get a clear "unavailable" message instead of a failed API call. |
| `src/components/DNAScanner.tsx` | Modified, not new. Added: two imports, a `"structure"` tab, and a tab-content block that feeds `activeSequence.sequence` to the helix and `stats.orfs[0].proteinSequence` to the protein viewer. Also modified: file upload now auto-triggers the full scan pipeline (`runFullScan`) instead of requiring a button click. |

## Dependencies

```
npm install three @rcsb/rcsb-molstar
```

No backend changes required for this specific feature — both components run
entirely client-side (Three.js render + a direct fetch to the public ESMFold
endpoint from the browser).

## Known limitations (by design, not oversights)

- **ESMFold public endpoint caps at ~400 residues.** Longer ORFs show a
  handled "too long" state, not an error. Self-hosting ESMFold removes this
  cap but is out of scope for this feature as shipped.
- **Protein sequence currently comes from a naive ORF finder**
  (`detectORFs()` in `DNAScanner.tsx`): longest ATG→stop across 6 frames.
  This is a heuristic, not a validated gene call — it can pick the wrong
  frame/boundary, and it has no concept of introns, so it should not be
  treated as biologically authoritative, especially for anything eukaryotic.
  A separate service (below) addresses this.
- **No structural diffing yet.** The "3D Structure" tab shows one structure
  at a time; there's no reference-vs-target side-by-side or anomaly-highlighting
  view. That's planned as a follow-up, not part of this feature.

## Related, separate piece: `services/gene-caller/`

A standalone Express service (own `package.json`, runs on its own port,
**not yet wired into DNAScanner**) that replaces the naive ORF finder with
real gene-calling:
- Bacterial sequences → real **Prodigal** (via Docker container)
- Eukaryotic sequences → currently still a stub; AUGUSTUS integration is
  future work, not built yet

It's independent on purpose — it has its own tested API contract
(`POST /call-genes`, documented in its own README) and runs as a separate
process (Prodigal is a compiled binary, not something the frontend can
execute directly). Wiring it in later means adding one `fetch()` call
inside `runFullScan`, whose result would replace `stats.orfs[0]` as the
input to `ProteinStructure3D` — no other part of this feature changes.

**Status as of this handoff:** service is built and passes its own test
suite (happy path, domain branching, empty-result and error-case handling).
Real Prodigal execution requires Docker Desktop running locally — that's
the one external dependency this piece needs to function beyond the stub.

## Quick verification

1. Install deps, run the app.
2. Upload any FASTA in DNA Scanner — scan should run automatically.
3. Click "3D Structure" tab — helix should render immediately; protein
   panel will show "Folding via ESMFold…" then either the structure or
   the length-guard message, depending on ORF size.
