# Domain research — who this is for, and what that demands

A record of what an antimicrobial-resistance lab actually does, drawn from the
published literature and standards, and what each finding implies for this
panel. It exists so that design decisions here can be argued from the users'
work rather than from taste, and so that a later change can tell whether it is
breaking something load-bearing.

Every claim below carries its source. Where the panel does not meet a
requirement, that is said plainly rather than left for someone to discover.

---

## 1. The people

Two overlapping groups, with different tolerances.

**Clinical microbiology labs** run under accreditation. ISO 15189 is the
standard for medical laboratories, and its requirements are procedural as much
as technical: document control, version management, personnel competency,
equipment calibration, internal audit, corrective action — with complete
electronic records demonstrating traceability throughout
([ISO 15189 overview](https://simplerqms.com/iso-15189/),
[audit-trail requirements](https://www.compliancequest.com/cq-guide/automation-of-iso-15189-workflows/)).
Software in that environment is expected to leave an audit trail, not just a
result.

**Public-health and surveillance labs** feed national and global systems. WHO's
GLASS collects standardised AMR data and, in its 2025 report, drew on more than
23 million bacteriologically confirmed cases from 104 countries; WHO's stated
priority is that all countries report complete, high-quality data by 2030 and
that ≥80% can test all GLASS pathogens
([GLASS 2025 report](https://www.who.int/publications/i/item/9789240116337),
[summary](https://www.who.int/publications/i/item/B09585)).
"Complete and high-quality" is a data-provenance problem before it is a
sequencing problem.

**What follows for the panel.** A result that cannot be traced back to its
inputs is not usable by either group. This is the reasoning behind
`lib/run-archive.ts` and the Provenance pane on a run's detail view: inputs,
parameters, seed and build, kept with the result.

---

## 2. The standing complaint about tools like this one

The literature's criticism of WGS-based AMR prediction is not mainly that the
calling is wrong. It is that results are hard to reproduce between labs and hard
to report meaningfully.

**Reproducibility.** An inter-laboratory study gave participating labs the same
bacterial genomes and got discordant AMR predictions back, and concluded that
refinements are needed before clinical use — specifically comprehensive public
resistance databases and standards for sequence data quality
([Microbial Genomics / PMC7067211](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7067211/)).

**Reporting.** A named hurdle to adoption is how genomic data can be reported
meaningfully, given that clinicians and other stakeholders have varying
understanding of genomics
([ISO-certified AMR genomics workflow, *Nature Communications*](https://www.nature.com/articles/s41467-022-35713-4)).

> **Implication, acted on.** The run detail view leads with the numbers that
> matter, then provenance, then the raw record — rather than presenting the raw
> record and expecting the reader to extract meaning from it.

> **Implication, outstanding.** The panel's own reference data has no version.
> See §5.

---

## 3. A gene is not a phenotype

The single most important thing this panel currently understates.

- **Presence is not expression.** The presence of an AMR determinant does not
  guarantee expression sufficient to confer resistance detectable by standard
  phenotypic methods.
- **Databases disagree with each other.** On the same isolates, AMRFinderPlus,
  CARD and ResFinder detected 48, 53 and 42 genes respectively, averaging 8.3,
  18.6 and 7.1 genes per strain; even `mecA` detection ranged from 82.2% to
  100%. Total genotype–phenotype concordance in one uropathogen study was 91%
  (ResFinder), 85.7% (CARD) and 80.5% (AMRFinderPlus)
  ([database comparison](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12793696/),
  [AMR databases: opportunities and challenges](https://www.nature.com/articles/s44259-025-00169-1)).
- **Some catalogued genes are not causal.** `crpP` presence is not reliably
  associated with ciprofloxacin resistance, and many alleles have never been
  phenotypically characterised — beta-lactamases especially.
- **The threshold changes the answer.** Concordance depends on which
  interpretive threshold is used: EUCAST clinical breakpoints gave better
  phenotype–genotype concordance than CLSI for ampicillin, ciprofloxacin and
  teicoplanin in *E. faecium*, and epidemiological cut-offs give different
  answers again
  ([*The Lancet Microbe*](https://www.thelancet.com/journals/lanmic/article/PIIS2666-5247(23)00297-5/fulltext)).

> **Implication, acted on.** The Resistance Predictor's archived payload
> carries an explicit note that it is rule-based marker scoring for research
> use and not a susceptibility report, so an exported or reopened record cannot
> be mistaken for one.

> **Implication, outstanding.** The predictor shows a single confidence score
> per drug class with no interval and no breakpoint standard named. Given the
> above, a bare "98%" overstates what a marker rule can support. See §5.

---

## 4. What the panel gets right

Worth recording, so it is not undone by accident.

- **It runs locally and says so.** Sequence data never leaves the device. For a
  lab handling isolates from identifiable patients this is a genuine property,
  not a limitation — and the Overview and About dialog both state it.
- **It is honest about its own gaps.** The About dialog lists known limitations
  (inert strain selector, inert pH/nutrient/oxygen inputs, organism not
  affecting scoring, runs stopping on navigation). A tool that overstates itself
  in this domain is worse than one that does less.
- **Runs are seeded and the seed is kept.** The Mutation Simulator fixes its
  seed at the start of a run, carries it through every generation and now
  archives it. Same seed plus same parameters reproduces the run exactly, which
  is the property §2 says is missing from the field generally.

---

## 5. Outstanding, ordered by how much it matters

1. **Version the reference data.** `lib/amr-records.ts` is a curated gene table
   with no version, no source citation and no date. §2 and §3 both make this the
   highest-value gap: a result whose reference data cannot be identified is not
   reproducible, however carefully the run itself was recorded. The archive
   already has a place to put it — add `referenceVersion` to the record and
   surface it in Provenance.
2. **Cite each gene record.** Per §3, catalogued genes vary in how well
   characterised they are, and some are not causal. Each row should name its
   source and, where known, the evidence level. Tracked as
   `docs/SUGGESTIONS.md` §2.3.
3. **Name the interpretive standard, or refuse to imply one.** The predictor
   should either state which breakpoint framework it is scoring against
   (EUCAST or CLSI, with the version) or make clear it scores marker presence
   only. §3 shows the two frameworks give different answers on the same data.
4. **Intervals, not point estimates.** Tracked as `docs/SUGGESTIONS.md` §2.4;
   §3 is the evidence for why it matters here specifically.
5. **A visible "research use only" mark on the Resistance Predictor.** The
   About dialog carries the caveat; the view that produces the number does not.

---

## 6. How this doc should be used

When a change touches the analysis engines, their outputs or how results are
reported, check it against §3 and §5 first. The failure mode this domain
punishes is a tool that looks more certain than its method allows — and every
convenience that rounds a caveat away moves it in that direction.
