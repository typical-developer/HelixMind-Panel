"use client"

import * as React from "react"
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronsDownUp,
  ChevronsUpDown,
  CircleSlash,
  Copy,
  DownloadIcon,
  Info,
  ScrollText,
  Search,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { ToastAction } from "@/components/ui/toast"
import { copyToClipboard, downloadJSON, fileStamp } from "@/lib/download"

import { Chip, Row, RowIcon, ToolbarButton, WBInput, WBSelect } from "./primitives"
import {
  useConsole,
  useWorkbench,
  type LogLevel,
  type LogLine,
  type PanelTabId,
  type RunRecord,
  type WorkbenchAlert,
} from "./workbench-provider"
import { viewForSource } from "./registry"

const PANEL_TABS: Array<{ id: PanelTabId; label: string }> = [
  { id: "alerts", label: "Alerts" },
  { id: "log", label: "Run log" },
  { id: "history", label: "History" },
]

/**
 * The console: everything a run produces, in one place under the bench.
 * Alerts are what needs attention, the run log is what happened line by line,
 * and history is what the bench has finished.
 */
export function BottomPanel() {
  const { panelTab, setPanelTab, panelMaximized, togglePanelMaximized, togglePanel } =
    useWorkbench()
  const {
    alerts,
    logs,
    runHistory,
    clearLogs,
    clearRunHistory,
    dismissAlerts,
    restoreRunHistory,
  } = useConsole()

  const errors = alerts.filter((a) => a.severity === "error").length
  const warnings = alerts.filter((a) => a.severity === "warning").length

  const counts: Record<PanelTabId, number> = {
    alerts: errors + warnings,
    log: logs.length,
    history: runHistory.length,
  }

  /**
   * Clearing was silent and final in all three tabs.
   *
   * The run history in particular is the only record of what the bench has
   * done, and it now survives reloads — so throwing it away with one
   * unconfirmed click was worse than it used to be, not better.
   */
  const clearHistoryWithUndo = () => {
    const snapshot = [...runHistory]
    clearRunHistory()
    toast({
      title: "Run history cleared",
      description: `${snapshot.length} run${snapshot.length === 1 ? "" : "s"} removed.`,
      action: (
        <ToastAction altText="Undo" onClick={() => restoreRunHistory(snapshot)}>
          Undo
        </ToastAction>
      ),
    })
  }

  return (
    <section
      aria-label="Console"
      className="flex h-full min-h-0 flex-col overflow-hidden border-t border-border bg-surface"
    >
      <header className="flex h-9 shrink-0 items-center gap-1 border-b border-border pr-1.5 pl-3">
        <div role="tablist" aria-label="Console" className="flex items-stretch gap-4">
          {PANEL_TABS.map((tab) => {
            const active = panelTab === tab.id
            const count = counts[tab.id]
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPanelTab(tab.id)}
                className={cn(
                  "relative flex cursor-pointer items-center gap-1.5 text-sm",
                  "transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
                  active
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground/80",
                )}
              >
                {tab.label}
                {/* Counts move as output streams in. Keyed so the badge is
                    re-placed on each change rather than silently reading a
                    different number. */}
                {count > 0 && (
                  <span
                    key={count}
                    className={cn(
                      "animate-pop-in flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-2xs font-semibold tabular",
                      "transition-colors duration-200 ease-[var(--ease-standard)]",
                      active
                        ? "bg-[var(--wb-selected)] text-foreground"
                        : "bg-[var(--wb-active)] text-muted-foreground",
                      tab.id === "alerts" && errors > 0 && "bg-destructive/20 text-destructive",
                    )}
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
                {/* Active underline sits on the header's bottom hairline. */}
                <span
                  className={cn(
                    "absolute -bottom-[11px] left-0 h-px w-full transition-colors duration-150",
                    active ? "bg-brand" : "bg-transparent",
                  )}
                />
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex items-center gap-0.5">
          {panelTab === "alerts" && alerts.length > 0 && (
            <ToolbarButton
              icon={Trash2}
              label="Dismiss all alerts"
              side="top"
              onClick={() => {
                dismissAlerts()
                toast({ title: "Alerts dismissed" })
              }}
            />
          )}
          {panelTab === "log" && (
            <>
              <ToolbarButton
                icon={Copy}
                label="Copy the run log"
                side="top"
                disabled={logs.length === 0}
                onClick={() =>
                  copyToClipboard(
                    logs
                      .map(
                        (l) =>
                          `${formatTime(l.ts)} [${l.source}] ${l.level}: ${l.message}`,
                      )
                      .join("\n"),
                    `Copied ${logs.length} log line${logs.length === 1 ? "" : "s"}`,
                  )
                }
              />
              <ToolbarButton
                icon={Trash2}
                label="Clear run log"
                side="top"
                disabled={logs.length === 0}
                onClick={clearLogs}
              />
            </>
          )}
          {panelTab === "history" && (
            <>
              <ToolbarButton
                icon={DownloadIcon}
                label="Export run history as JSON"
                side="top"
                disabled={runHistory.length === 0}
                onClick={() =>
                  downloadJSON(
                    {
                      exportedAt: new Date().toISOString(),
                      runs: runHistory.map((r) => ({
                        ...r,
                        startedAt: new Date(r.startedAt).toISOString(),
                        endedAt: new Date(r.endedAt).toISOString(),
                        durationMs: r.endedAt - r.startedAt,
                      })),
                    },
                    {
                      filename: `helixmind-run-history-${fileStamp()}.json`,
                      description: `${runHistory.length} run${runHistory.length === 1 ? "" : "s"}.`,
                    },
                  )
                }
              />
              <ToolbarButton
                icon={Trash2}
                label="Clear run history"
                side="top"
                disabled={runHistory.length === 0}
                onClick={clearHistoryWithUndo}
              />
            </>
          )}
          <ToolbarButton
            icon={panelMaximized ? ChevronsDownUp : ChevronsUpDown}
            label={panelMaximized ? "Restore console size" : "Maximize console"}
            side="top"
            onClick={togglePanelMaximized}
          />
          <ToolbarButton
            icon={X}
            label="Close console"
            side="top"
            onClick={togglePanel}
          />
        </div>
      </header>

      {/* Keyed on the tab so switching fades the new body in, matching how the
          sidebar swaps modes. Without it the console was the one region that
          changed content with no transition at all, which read as a flicker. */}
      <div key={panelTab} className="animate-fade-in min-h-0 flex-1">
        {panelTab === "alerts" && <AlertsView />}
        {panelTab === "log" && <RunLogView />}
        {panelTab === "history" && <HistoryView />}
      </div>
    </section>
  )
}

/* ============================================================================
   Alerts
   ========================================================================= */

const SEVERITY_ICON = {
  error: AlertCircle,
  warning: TriangleAlert,
  info: Info,
} as const

const SEVERITY_CLASS = {
  error: "text-destructive",
  warning: "text-warning",
  info: "text-info",
} as const

function AlertsView() {
  const { alerts, dismissAlerts } = useConsole()
  const { openTab } = useWorkbench()

  const grouped = React.useMemo(() => {
    const map = new Map<string, WorkbenchAlert[]>()
    for (const a of alerts) {
      const list = map.get(a.source) ?? []
      list.push(a)
      map.set(a.source, list)
    }
    return [...map.entries()]
  }, [alerts])

  if (alerts.length === 0) {
    return (
      <ConsoleEmpty
        icon={CheckCircle2}
        message="Nothing needs attention. Bad input and notable results are raised here as you run."
      />
    )
  }

  return (
    <div className="animate-stagger seq-scroll h-full overflow-auto py-1">
      {grouped.map(([source, list]) => {
        // Alerts name a console channel; the registry knows which view owns
        // it. Before this the source was a bare string with nothing behind it,
        // so an alert told you a view had a problem but not how to reach it.
        const view = viewForSource(source)

        return (
          <div key={source} className="group/source">
            <div className="flex h-6 items-center gap-1.5 px-3 text-xs text-muted-foreground">
              {view ? (
                <button
                  type="button"
                  onClick={() => openTab(view.href)}
                  title={`Open ${view.label}`}
                  className="cursor-pointer font-medium text-foreground/80 hover:underline focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
                >
                  {view.label}
                </button>
              ) : (
                <span className="font-medium text-foreground/80">{source}</span>
              )}
              <span className="tabular">({list.length})</span>
              <button
                type="button"
                onClick={() => dismissAlerts(source)}
                className="ml-auto cursor-pointer rounded-sm px-1.5 py-0.5 text-2xs opacity-0 transition-opacity hover:bg-[var(--wb-active)] hover:text-foreground group-hover/source:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
              >
                Dismiss
              </button>
            </div>

            {list.map((alert, i) => {
              const Icon = SEVERITY_ICON[alert.severity]
              const row = (
                <>
                  <RowIcon icon={Icon} className={SEVERITY_CLASS[alert.severity]} />
                  <span className="min-w-0 flex-1 text-foreground/85">
                    {alert.message}
                  </span>
                  {alert.at && (
                    <span className="shrink-0 font-mono text-xs text-muted-foreground/70">
                      {alert.at}
                    </span>
                  )}
                </>
              )

              return view ? (
                <button
                  key={`${source}-${i}`}
                  type="button"
                  onClick={() => openTab(view.href)}
                  title={`Open ${view.label}`}
                  className="row-hover flex min-h-6 w-full cursor-pointer items-start gap-2 py-1 pr-3 pl-7 text-left text-sm focus-visible:ring-1 focus-visible:ring-ring/60 focus-visible:outline-none focus-visible:ring-inset"
                >
                  {row}
                </button>
              ) : (
                <div
                  key={`${source}-${i}`}
                  className="row-hover flex min-h-6 items-start gap-2 py-1 pr-3 pl-7 text-sm"
                >
                  {row}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

/* ============================================================================
   Run log
   ========================================================================= */

const LEVELS: Array<LogLevel | "all"> = [
  "all",
  "info",
  "success",
  "warn",
  "error",
  "debug",
  "command",
]

function RunLogView() {
  const { logs } = useConsole()
  const [channel, setChannel] = React.useState("all")
  const [level, setLevel] = React.useState<LogLevel | "all">("all")
  const [needle, setNeedle] = React.useState("")

  const channels = React.useMemo(
    () => ["all", ...Array.from(new Set(logs.map((l) => l.source))).sort()],
    [logs],
  )

  /**
   * Text search, added because the channel dropdown alone was not enough.
   *
   * The buffer holds 500 lines and a simulation fills it in under a minute,
   * so finding the generation where fitness dropped meant scrolling by eye.
   */
  const filtered = React.useMemo(() => {
    const term = needle.trim().toLowerCase()
    return logs.filter(
      (line) =>
        (channel === "all" || line.source === channel) &&
        (level === "all" || line.level === level) &&
        (!term || line.message.toLowerCase().includes(term)),
    )
  }, [channel, level, logs, needle])

  const narrowed = channel !== "all" || level !== "all" || needle.trim() !== ""

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-3">
        <div className="relative min-w-0 flex-1 sm:max-w-56">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2 text-muted-foreground" />
          <WBInput
            value={needle}
            onChange={(e) => setNeedle(e.target.value)}
            placeholder="Filter output"
            aria-label="Filter the run log"
            className="h-6 pl-6 text-xs"
          />
        </div>

        <WBSelect
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className="h-6 w-40 text-xs"
          aria-label="Filter the run log by source"
        >
          {channels.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "All analyses" : (viewForSource(c)?.label ?? c)}
            </option>
          ))}
        </WBSelect>

        <WBSelect
          value={level}
          onChange={(e) => setLevel(e.target.value as LogLevel | "all")}
          className="h-6 w-28 text-xs"
          aria-label="Filter the run log by level"
        >
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l === "all" ? "All levels" : l}
            </option>
          ))}
        </WBSelect>

        <span
          className="ml-auto shrink-0 font-mono text-xs text-muted-foreground tabular"
          // The buffer holds 500 lines and only the last 200 are written to
          // storage, so a reload silently shortens the log. Saying so in the
          // tooltip is cheaper than someone concluding output went missing.
          title="The console buffers 500 lines; the most recent 200 survive a reload. Export a run from Activity to keep its full record."
        >
          {narrowed ? `${filtered.length} / ${logs.length}` : `${logs.length}`} lines
        </span>
      </div>

      <LogStream
        lines={filtered}
        needle={needle.trim()}
        showSource={channel === "all"}
        empty={
          <ConsoleEmpty
            icon={narrowed ? Search : ScrollText}
            message={
              narrowed
                ? "No lines match these filters."
                : "No output yet. Start a scan or a simulation and its log streams here as it runs."
            }
          />
        }
      />
    </div>
  )
}

/* ============================================================================
   History
   ========================================================================= */

function HistoryView() {
  const { runHistory } = useConsole()
  const { openTab, setPanelTab } = useWorkbench()

  if (runHistory.length === 0) {
    return (
      <ConsoleEmpty
        icon={CircleSlash}
        message="No finished runs yet. Completed scans, simulations and experiments are kept here between visits."
      />
    )
  }

  return (
    <div className="seq-scroll h-full overflow-auto py-1">
      <button
        type="button"
        onClick={() => openTab("/activity")}
        className="row-hover flex w-full cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring/60 focus-visible:outline-none focus-visible:ring-inset"
      >
        {/* These rows say a run happened. Activity says what it found. */}
        Open Activity to search past runs and reopen their results
        <ArrowRight className="ml-auto size-3 shrink-0" />
      </button>
      <div className="animate-stagger">
      {runHistory.map((record) => (
        <Row
          key={record.id}
          icon={record.outcome === "completed" ? CheckCircle2 : CircleSlash}
          iconClassName={
            record.outcome === "completed" ? "text-success" : "text-muted-foreground"
          }
          label={record.label}
          description={record.detail}
          onClick={() => setPanelTab("log")}
          title={`${record.label}${record.detail ? ` — ${record.detail}` : ""} · ${new Date(
            record.startedAt,
          ).toLocaleString()}`}
          className="py-1.5"
          trailing={
            <>
              <Chip tone={record.outcome === "completed" ? "success" : "neutral"}>
                {record.outcome}
              </Chip>
              <span className="w-14 text-right font-mono text-xs text-muted-foreground tabular">
                {formatDuration(record.endedAt - record.startedAt)}
              </span>
              <span className="w-16 text-right font-mono text-xs text-muted-foreground/60 tabular">
                {formatTime(record.endedAt)}
              </span>
            </>
          }
        />
      ))}
      </div>
    </div>
  )
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${Math.round(seconds % 60)}s`
}

/* ============================================================================
   Shared pieces
   ========================================================================= */

function ConsoleEmpty({
  icon: Icon,
  message,
}: {
  icon: React.ComponentType<{ className?: string }>
  message: string
}) {
  return (
    <div className="flex h-full items-start gap-2 px-3 py-3 text-sm text-muted-foreground">
      <RowIcon icon={Icon} className="opacity-70" />
      <span className="max-w-lg leading-relaxed">{message}</span>
    </div>
  )
}

const LEVEL_CLASS: Record<LogLevel, string> = {
  info: "text-[var(--log-fg)]",
  success: "text-[var(--log-success)]",
  warn: "text-[var(--log-warn)]",
  error: "text-[var(--log-error)]",
  debug: "text-[var(--log-dim)]",
  command: "text-[var(--log-command)]",
}

const LEVEL_GLYPH: Record<LogLevel, string> = {
  info: "›",
  success: "✔",
  warn: "▲",
  error: "✖",
  debug: "·",
  command: "▸",
}

function formatTime(ts: number) {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** Mark the searched term inside a log line. */
function MarkedMessage({ text, needle }: { text: string; needle: string }) {
  if (!needle) return <>{text}</>
  const index = text.toLowerCase().indexOf(needle.toLowerCase())
  if (index === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-xs bg-warning/25 text-foreground">
        {text.slice(index, index + needle.length)}
      </mark>
      {text.slice(index + needle.length)}
    </>
  )
}

function LogStream({
  lines,
  showSource,
  needle = "",
  empty,
}: {
  lines: LogLine[]
  showSource?: boolean
  needle?: string
  empty?: React.ReactNode
}) {
  const endRef = React.useRef<HTMLDivElement>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const pinned = React.useRef(true)

  /**
   * The highest id seen on the previous render.
   *
   * `animate-line-in` was on every row unconditionally, so opening the console
   * on a full buffer played five hundred entrance animations at once, and every
   * change of filter replayed all of them. The animation is for *new output
   * arriving* — a line that was already there has not arrived. Only rows above
   * this mark animate.
   */
  const seen = React.useRef(-Infinity)
  const highWater = seen.current
  const newest = lines.length > 0 ? lines[lines.length - 1].id : seen.current
  React.useEffect(() => {
    seen.current = newest
  }, [newest])

  // Follow the tail only while the reader is already at the bottom, so
  // scrolling back through history isn't yanked away by new output.
  const onScroll = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
  }, [])

  React.useEffect(() => {
    if (pinned.current) endRef.current?.scrollIntoView({ block: "end" })
  }, [lines])

  if (lines.length === 0) {
    return <div className="min-h-0 flex-1 overflow-hidden">{empty}</div>
  }

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="seq-scroll min-h-0 flex-1 overflow-auto p-2 font-mono text-xs leading-5"
    >
      {lines.map((line) => (
        <div
          key={line.id}
          className={cn(
            "flex items-start gap-2 rounded-xs px-1 hover:bg-[var(--wb-hover)]",
            line.id > highWater && "animate-line-in",
          )}
        >
          <span className="shrink-0 text-[var(--log-dim)] tabular">
            {formatTime(line.ts)}
          </span>
          {showSource && (
            <span className="shrink-0 text-[var(--log-source)]">[{line.source}]</span>
          )}
          <span className={cn("shrink-0", LEVEL_CLASS[line.level])}>
            {LEVEL_GLYPH[line.level]}
          </span>
          <span className={cn("min-w-0 flex-1 break-words", LEVEL_CLASS[line.level])}>
            <MarkedMessage text={line.message} needle={needle} />
          </span>
        </div>
      ))}

      <div ref={endRef} />
    </div>
  )
}
