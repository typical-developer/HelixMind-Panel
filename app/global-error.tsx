"use client"

/**
 * The last line of defence: a failure in the root layout itself.
 *
 * This boundary *replaces* the root layout when it fires, so it has to render
 * its own `<html>` and `<body>` and cannot rely on globals.css having been
 * applied. Everything here is therefore inline and self-contained.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#000",
          color: "#ededed",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          fontSize: "13px",
          lineHeight: "18px",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 500 }}>
            HelixMind could not start
          </h1>
          <p style={{ margin: "0 0 16px", color: "#a1a1a1" }}>
            The application shell failed to load. Reloading usually clears it.
          </p>

          {error.digest && (
            <p
              style={{
                margin: "0 0 16px",
                color: "#7a7a7a",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                fontSize: "11px",
              }}
            >
              Reference {error.digest}
            </p>
          )}

          <button
            type="button"
            onClick={reset}
            style={{
              cursor: "pointer",
              borderRadius: "6px",
              border: "1px solid #ffffff24",
              background: "#ededed",
              color: "#0a0a0a",
              padding: "7px 14px",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            Reload HelixMind
          </button>
        </div>
      </body>
    </html>
  )
}
