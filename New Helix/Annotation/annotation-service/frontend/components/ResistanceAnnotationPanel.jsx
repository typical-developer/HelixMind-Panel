/**
 * HelixMind — ResistanceAnnotationPanel
 *
 * Streams resistance gene hits from the self-hosted ResFinder service
 * and renders them as they arrive. Plugs into the existing DNA Scanner.
 *
 * Usage:
 *   <ResistanceAnnotationPanel
 *     sequence={dnaSequence}
 *     organism="escherichia coli"
 *     onHitsFound={(hits) => highlightRegionsInViewer(hits)}
 *   />
 */

import { useState, useEffect, useRef, useCallback } from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONFIDENCE_CONFIG = {
  HIGH:   { color: "#22c55e", label: "High",   dot: "●" },
  MEDIUM: { color: "#f59e0b", label: "Medium", dot: "●" },
  LOW:    { color: "#ef4444", label: "Low",    dot: "●" },
};

const DRUG_CLASS_CONFIG = {
  "Beta-lactam":       { color: "#3b82f6", icon: "β"  },
  "Aminoglycoside":    { color: "#f97316", icon: "A"  },
  "Tetracycline":      { color: "#eab308", icon: "T"  },
  "Fluoroquinolone":   { color: "#ef4444", icon: "F"  },
  "Macrolide":         { color: "#a855f7", icon: "M"  },
  "Sulfonamide":       { color: "#94a3b8", icon: "S"  },
  "Trimethoprim":      { color: "#06b6d4", icon: "Tr" },
  "Colistin":          { color: "#dc2626", icon: "Co" },
  "Chloramphenicol":   { color: "#78716c", icon: "Ch" },
  "Glycopeptide":      { color: "#8b5cf6", icon: "G"  },
};

const DEFAULT_DRUG_CLASS = { color: "#64748b", icon: "?" };

const STATUS_LABELS = {
  idle:     "Awaiting sequence",
  running:  "Scanning...",
  complete: null, // set dynamically
  error:    "Analysis failed",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ResistanceAnnotationPanel({
  sequence,
  organism = null,
  identityThreshold = 0.90,
  minCoverage = 0.60,
  onHitsFound = null,
  apiBase = "/api/annotation",
}) {
  const [status, setStatus]       = useState("idle");
  const [hits, setHits]           = useState([]);
  const [summary, setSummary]     = useState(null);
  const [error, setError]         = useState(null);
  const [expanded, setExpanded]   = useState(null);  // expanded hit index
  const readerRef                 = useRef(null);

  // ------------------------------------------------------------------
  // Stream analysis
  // ------------------------------------------------------------------

  const runAnalysis = useCallback(async () => {
    if (!sequence || sequence.length < 100) return;

    // Cancel any in-flight request
    readerRef.current?.cancel();
    readerRef.current = null;

    setStatus("running");
    setHits([]);
    setSummary(null);
    setError(null);
    setExpanded(null);

    try {
      const response = await fetch(`${apiBase}/resistance/stream`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sequence,
          organism,
          identity_threshold: identityThreshold,
          min_coverage:       minCoverage,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${response.status}`);
      }

      const reader  = response.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer    = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let event;
          try { event = JSON.parse(raw); }
          catch { continue; }

          if (event.status === "hit") {
            setHits(prev => {
              const updated = [...prev, event.data];
              onHitsFound?.(updated);
              return updated;
            });
          } else if (event.status === "complete") {
            setSummary(event.summary);
            setStatus("complete");
          } else if (event.status === "error") {
            setError(event.message);
            setStatus("error");
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message);
        setStatus("error");
      }
    }
  }, [sequence, organism, identityThreshold, minCoverage, apiBase, onHitsFound]);

  // Re-run when sequence changes
  useEffect(() => {
    runAnalysis();
    return () => readerRef.current?.cancel();
  }, [runAnalysis]);

  // ------------------------------------------------------------------
  // Highlight region in sequence viewer / Mol*
  // ------------------------------------------------------------------

  const handleHitClick = (hit) => {
    setExpanded(prev => (prev === hit.gene ? null : hit.gene));
    if (hit.position) {
      window.dispatchEvent(
        new CustomEvent("helix:highlight-region", { detail: hit.position })
      );
    }
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  const statusLabel =
    status === "complete"
      ? `${hits.length} gene${hits.length !== 1 ? "s" : ""} found`
      : STATUS_LABELS[status];

  return (
    <div style={styles.panel}>
      {/* ── Header ── */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.title}>Resistance Profile</span>
          {organism && (
            <span style={styles.organismBadge}>
              {organism}
            </span>
          )}
        </div>
        <div style={styles.statusBadge(status)}>
          {status === "running" && <Spinner />}
          {statusLabel}
        </div>
      </div>

      {/* ── Drug class summary bar ── */}
      {summary?.resistance_classes?.length > 0 && (
        <div style={styles.summaryBar}>
          {summary.resistance_classes.map(cls => {
            const cfg = DRUG_CLASS_CONFIG[cls] || DEFAULT_DRUG_CLASS;
            return (
              <span key={cls} style={styles.drugClassBadge(cfg.color)}>
                <span style={styles.drugClassIcon}>{cfg.icon}</span>
                {cls}
              </span>
            );
          })}
        </div>
      )}

      {/* ── Hits table ── */}
      {hits.length > 0 && (
        <div style={styles.table}>
          {/* Table header */}
          <div style={styles.tableHeader}>
            <span>Gene</span>
            <span>Drug Class</span>
            <span>Identity</span>
            <span>Coverage</span>
            <span>Confidence</span>
          </div>

          {/* Rows — stream in as they arrive */}
          {hits.map((hit, i) => {
            const conf       = CONFIDENCE_CONFIG[hit.confidence] || CONFIDENCE_CONFIG.LOW;
            const isExpanded = expanded === hit.gene;

            return (
              <div key={`${hit.gene}-${i}`}>
                <div
                  style={styles.tableRow(isExpanded)}
                  onClick={() => handleHitClick(hit)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === "Enter" && handleHitClick(hit)}
                >
                  <span style={styles.geneName}>
                    {hit.source === "chromosomal" && (
                      <span style={styles.sourceTag}>CHR</span>
                    )}
                    {hit.gene}
                  </span>
                  <span style={styles.drugClass}>
                    {hit.resistance_class || "—"}
                  </span>
                  <span>{hit.identity ? `${(hit.identity * 100).toFixed(1)}%` : "—"}</span>
                  <span>{hit.coverage  ? `${(hit.coverage  * 100).toFixed(1)}%` : "—"}</span>
                  <span style={{ color: conf.color, fontWeight: 600 }}>
                    {conf.dot} {conf.label}
                  </span>
                </div>

                {/* Expanded detail row */}
                {isExpanded && (
                  <div style={styles.expandedRow}>
                    {hit.accession && (
                      <div style={styles.detailLine}>
                        <span style={styles.detailLabel}>Accession</span>
                        <a
                          href={`https://www.ncbi.nlm.nih.gov/nuccore/${hit.accession}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={styles.link}
                        >
                          {hit.accession}
                        </a>
                      </div>
                    )}
                    {hit.mutation && (
                      <div style={styles.detailLine}>
                        <span style={styles.detailLabel}>Mutation</span>
                        <span style={styles.detailValue}>{hit.mutation}</span>
                      </div>
                    )}
                    {hit.phenotype && (
                      <div style={styles.detailLine}>
                        <span style={styles.detailLabel}>Phenotype</span>
                        <span style={styles.detailValue}>{hit.phenotype}</span>
                      </div>
                    )}
                    {hit.position && (
                      <div style={styles.detailLine}>
                        <span style={styles.detailLabel}>Position</span>
                        <span style={styles.detailValue}>
                          {hit.position.start}–{hit.position.end} bp
                        </span>
                      </div>
                    )}
                    <div style={styles.detailLine}>
                      <span style={styles.detailLabel}>Source</span>
                      <span style={styles.detailValue}>
                        {hit.source === "chromosomal"
                          ? "PointFinder (chromosomal point mutation)"
                          : "ResFinder (acquired resistance gene)"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Running skeleton ── */}
      {status === "running" && hits.length === 0 && (
        <div style={styles.skeleton}>
          {[1, 2, 3].map(i => (
            <div key={i} style={styles.skeletonRow(i)} />
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {status === "complete" && hits.length === 0 && (
        <div style={styles.emptyState}>
          <span style={styles.emptyIcon}>🔍</span>
          <p style={styles.emptyTitle}>No resistance genes detected</p>
          <p style={styles.emptyHint}>
            Try lowering the identity threshold or verify organism selection.
          </p>
        </div>
      )}

      {/* ── Error state ── */}
      {status === "error" && (
        <div style={styles.errorState}>
          <span>⚠️ {error || "Analysis failed"}</span>
          <button style={styles.retryButton} onClick={runAnalysis}>
            Retry
          </button>
        </div>
      )}

      {/* ── Coverage disclaimer ── */}
      {summary?.analysis_meta?.note && (
        <div style={styles.disclaimer}>
          ℹ️ {summary.analysis_meta.note}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <span style={styles.spinner} aria-label="Loading">
      ⟳
    </span>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = {
  panel: {
    background:   "#0f1117",
    border:       "1px solid #1e2433",
    borderRadius: "8px",
    padding:      "16px",
    fontFamily:   "'JetBrains Mono', 'Fira Code', monospace",
    fontSize:     "13px",
    color:        "#c9d1e0",
    minWidth:     "480px",
  },
  header: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    marginBottom:   "12px",
  },
  headerLeft: {
    display:    "flex",
    alignItems: "center",
    gap:        "8px",
  },
  title: {
    fontSize:   "14px",
    fontWeight: "700",
    color:      "#e2e8f0",
    letterSpacing: "0.02em",
  },
  organismBadge: {
    background:   "#1a2235",
    border:       "1px solid #2d3a52",
    borderRadius: "4px",
    padding:      "2px 8px",
    fontSize:     "11px",
    color:        "#64b5f6",
    fontStyle:    "italic",
  },
  statusBadge: (status) => ({
    display:      "flex",
    alignItems:   "center",
    gap:          "6px",
    padding:      "4px 10px",
    borderRadius: "20px",
    fontSize:     "11px",
    fontWeight:   "600",
    background:
      status === "complete" ? "#0d2a1a" :
      status === "running"  ? "#1a1f2e" :
      status === "error"    ? "#2a0d0d" : "#1a1f2e",
    color:
      status === "complete" ? "#22c55e" :
      status === "running"  ? "#60a5fa" :
      status === "error"    ? "#ef4444" : "#64748b",
    border: `1px solid ${
      status === "complete" ? "#166534" :
      status === "running"  ? "#1e3a5f" :
      status === "error"    ? "#7f1d1d" : "#1e2433"
    }`,
  }),
  summaryBar: {
    display:      "flex",
    flexWrap:     "wrap",
    gap:          "6px",
    marginBottom: "12px",
    padding:      "8px 10px",
    background:   "#0a0d14",
    borderRadius: "6px",
    border:       "1px solid #1a2235",
  },
  drugClassBadge: (color) => ({
    display:      "flex",
    alignItems:   "center",
    gap:          "5px",
    padding:      "3px 8px",
    borderRadius: "4px",
    background:   `${color}18`,
    border:       `1px solid ${color}44`,
    color:        color,
    fontSize:     "11px",
    fontWeight:   "600",
  }),
  drugClassIcon: {
    fontWeight:  "700",
    fontSize:    "10px",
    lineHeight:  "1",
  },
  table: {
    borderRadius: "6px",
    overflow:     "hidden",
    border:       "1px solid #1e2433",
    marginBottom: "12px",
  },
  tableHeader: {
    display:             "grid",
    gridTemplateColumns: "2fr 1.5fr 0.8fr 0.8fr 1fr",
    gap:                 "8px",
    padding:             "8px 12px",
    background:          "#0a0d14",
    color:               "#475569",
    fontSize:            "11px",
    fontWeight:          "600",
    letterSpacing:       "0.05em",
    textTransform:       "uppercase",
    borderBottom:        "1px solid #1e2433",
  },
  tableRow: (isExpanded) => ({
    display:             "grid",
    gridTemplateColumns: "2fr 1.5fr 0.8fr 0.8fr 1fr",
    gap:                 "8px",
    padding:             "10px 12px",
    cursor:              "pointer",
    transition:          "background 0.15s",
    borderBottom:        "1px solid #1a2235",
    background:          isExpanded ? "#111827" : "transparent",
    ":hover": { background: "#111827" },
    alignItems:          "center",
  }),
  geneName: {
    color:      "#93c5fd",
    fontWeight: "600",
    display:    "flex",
    alignItems: "center",
    gap:        "6px",
  },
  sourceTag: {
    background:   "#312e81",
    color:        "#a5b4fc",
    borderRadius: "3px",
    padding:      "1px 4px",
    fontSize:     "9px",
    fontWeight:   "700",
    letterSpacing: "0.05em",
  },
  drugClass: {
    color: "#94a3b8",
  },
  expandedRow: {
    background:   "#0a0f1a",
    borderBottom: "1px solid #1e2433",
    padding:      "10px 16px",
    display:      "flex",
    flexDirection:"column",
    gap:          "6px",
  },
  detailLine: {
    display: "flex",
    gap:     "12px",
  },
  detailLabel: {
    color:    "#475569",
    minWidth: "80px",
    fontSize: "11px",
  },
  detailValue: {
    color: "#94a3b8",
  },
  link: {
    color:          "#60a5fa",
    textDecoration: "none",
  },
  skeleton: {
    display:      "flex",
    flexDirection:"column",
    gap:          "8px",
    marginBottom: "12px",
  },
  skeletonRow: (i) => ({
    height:       "36px",
    borderRadius: "4px",
    background:   `rgba(30, 36, 51, ${0.9 - i * 0.15})`,
    animation:    "pulse 1.5s ease-in-out infinite",
    animationDelay: `${i * 0.15}s`,
  }),
  emptyState: {
    textAlign:    "center",
    padding:      "24px 16px",
    color:        "#475569",
  },
  emptyIcon: {
    fontSize:     "28px",
    display:      "block",
    marginBottom: "8px",
  },
  emptyTitle: {
    margin:     "0 0 4px",
    color:      "#64748b",
    fontWeight: "600",
  },
  emptyHint: {
    margin:   "0",
    fontSize: "11px",
  },
  errorState: {
    display:      "flex",
    alignItems:   "center",
    justifyContent:"space-between",
    padding:      "10px 12px",
    background:   "#2a0d0d",
    border:       "1px solid #7f1d1d",
    borderRadius: "6px",
    color:        "#fca5a5",
    marginBottom: "12px",
  },
  retryButton: {
    background:   "#7f1d1d",
    border:       "1px solid #991b1b",
    borderRadius: "4px",
    color:        "#fca5a5",
    cursor:       "pointer",
    padding:      "4px 10px",
    fontSize:     "11px",
  },
  disclaimer: {
    fontSize:  "10px",
    color:     "#374151",
    lineHeight:"1.5",
    padding:   "8px 10px",
    background:"#0a0d14",
    borderRadius:"4px",
    border:    "1px solid #1a2235",
  },
  spinner: {
    display:         "inline-block",
    animation:       "spin 1s linear infinite",
    fontSize:        "13px",
  },
};
