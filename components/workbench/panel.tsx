"use client"

import * as React from "react"
import {
  AlertCircle,
  CheckCircle2,
  ChevronsDownUp,
  ChevronsUpDown,
  CircleSlash,
  Info,
  ScrollText,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"

import { Chip, ToolbarButton, WBSelect } from "./primitives"
import {
  useWorkbench,
  type LogLevel,
  type LogLine,
  type PanelTabId,
  type RunRecord,
  type WorkbenchAlert,
} from "./workbench-provider"

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
  const {
    panelTab,
    setPanelTab,
    panelMaximized,
    togglePanelMaximized,
    togglePanel,
    alerts,
    logs,
    runHistory,
    clearLogs,
    clearRunHistory,
  } = useWorkbench()

  const errors = alerts.filter((a) => a.severity === "error").length
  const warnings = alerts.filter((a) => a.severity === "warning").length

  const counts: Record<PanelTabId, number> = {
    alerts: errors + warnings,
    log: logs.length,
    history: runHistory.length,
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
                {count > 0 && (
                  <span
                    className={cn(
                      "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-2xs font-semibold tabular",
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
          {panelTab === "log" && (
            <ToolbarButton
              icon={Trash2}
              label="Clear run log"
              side="top"
              onClick={clearLogs}
            />
          )}
          {panelTab === "history" && (
            <ToolbarButton
              icon={Trash2}
              label="Clear run history"
              side="top"
              onClick={clearRunHistory}
            />
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

      <div className="min-h-0 flex-1">
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
  info: "text-brand-bright",
} as const

function AlertsView() {
  const { alerts } = useWorkbench()

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
    <div className="seq-scroll h-full overflow-auto py-1">
      {grouped.map(([source, list]) => (
        <div key={source}>
          <div className="flex h-6 items-center gap-1.5 px-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">{source}</span>
            <span className="tabular">({list.length})</span>
          </div>
          {list.map((alert, i) => {
            const Icon = SEVERITY_ICON[alert.severity]
            return (
              <div
                key={`${source}-${i}`}
                className="row-hover flex min-h-6 items-start gap-2 py-1 pr-3 pl-7 text-sm"
              >
                <Icon
                  className={cn(
                    "mt-0.5 size-3.5 shrink-0",
                    SEVERITY_CLASS[alert.severity],
                  )}
                />
                <span className="min-w-0 flex-1 text-foreground/85">
                  {alert.message}
                </span>
                {alert.at && (
                  <span className="shrink-0 font-mono text-xs text-muted-foreground/70">
                    {alert.at}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/* ============================================================================
   Run log
   ========================================================================= */

function RunLogView() {
  const { logs } = useWorkbench()
  const [channel, setChannel] = React.useState("all")

  const channels = React.useMemo(
    () => ["all", ...Array.from(new Set(logs.map((l) => l.source))).sort()],
    [logs],
  )

  const filtered = React.useMemo(
    () => (channel === "all" ? logs : logs.filter((l) => l.source === channel)),
    [channel, logs],
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-3">
        <span className="text-xs text-muted-foreground">From</span>
        <WBSelect
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className="h-6 w-56 text-xs"
          aria-label="Filter the run log by source"
        >
          {channels.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "All analyses" : c}
            </option>
          ))}
        </WBSelect>
        <span className="ml-auto font-mono text-xs text-muted-foreground tabular">
          {filtered.length} {filtered.length === 1 ? "line" : "lines"}
        </span>
      </div>
      <LogStream
        lines={filtered}
        showSource={channel === "all"}
        empty={
          <ConsoleEmpty
            icon={ScrollText}
            message="No output yet. Start a scan or a simulation and its log streams here as it runs."
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
  const { runHistory, setPanelTab } = useWorkbench()

  if (runHistory.length === 0) {
    return (
      <ConsoleEmpty
        icon={CircleSlash}
        message="No finished runs in this session yet."
      />
    )
  }

  return (
    <div className="seq-scroll h-full overflow-auto py-1">
      {runHistory.map((record) => (
        <button
          key={record.id}
          type="button"
          onClick={() => setPanelTab("log")}
          className="row-hover flex w-full cursor-pointer items-center gap-2.5 px-3 py-1.5 text-left focus-visible:ring-1 focus-visible:ring-ring/60 focus-visible:outline-none focus-visible:ring-inset"
        >
          {record.outcome === "completed" ? (
            <CheckCircle2 className="size-3.5 shrink-0 text-success" />
          ) : (
            <CircleSlash className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-foreground/90">
              {record.label}
            </span>
            {record.detail && (
              <span className="block truncate text-xs text-muted-foreground/70">
                {record.detail}
              </span>
            )}
          </span>
          <Chip tone={record.outcome === "completed" ? "success" : "neutral"}>
            {record.outcome}
          </Chip>
          <span className="w-14 shrink-0 text-right font-mono text-xs text-muted-foreground tabular">
            {formatDuration(record.endedAt - record.startedAt)}
          </span>
          <span className="w-16 shrink-0 text-right font-mono text-xs text-muted-foreground/60 tabular">
            {formatTime(record.endedAt)}
          </span>
        </button>
      ))}
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
      <Icon className="mt-0.5 size-3.5 shrink-0 opacity-70" />
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

function LogStream({
  lines,
  showSource,
  empty,
}: {
  lines: LogLine[]
  showSource?: boolean
  empty?: React.ReactNode
}) {
  const endRef = React.useRef<HTMLDivElement>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const pinned = React.useRef(true)

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
          className="animate-line-in flex items-start gap-2 rounded-xs px-1 hover:bg-[var(--wb-hover)]"
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
            {line.message}
          </span>
        </div>
      ))}

      <div ref={endRef} />
    </div>
  )
}
