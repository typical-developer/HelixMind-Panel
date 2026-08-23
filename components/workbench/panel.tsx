"use client"

import * as React from "react"
import {
  AlertCircle,
  ChevronsDownUp,
  ChevronsUpDown,
  Info,
  Terminal as TerminalIcon,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"

import { ToolbarButton, WBSelect } from "./primitives"
import {
  useWorkbench,
  type LogLevel,
  type LogLine,
  type PanelTabId,
  type Problem,
} from "./workbench-provider"

const PANEL_TABS: Array<{ id: PanelTabId; label: string }> = [
  { id: "problems", label: "Problems" },
  { id: "output", label: "Output" },
  { id: "terminal", label: "Terminal" },
]

/**
 * The bottom panel. Same furniture as VS Code's: a row of underlined tab
 * headings on the left, panel actions on the right, and a monospace body that
 * fills whatever height the resize handle gives it.
 */
export function BottomPanel() {
  const {
    panelTab,
    setPanelTab,
    panelMaximized,
    togglePanelMaximized,
    togglePanel,
    problems,
    clearLogs,
  } = useWorkbench()

  const errors = problems.filter((p) => p.severity === "error").length
  const warnings = problems.filter((p) => p.severity === "warning").length

  return (
    <section
      aria-label="Panel"
      className="flex h-full min-h-0 flex-col overflow-hidden border-t border-border bg-surface"
    >
      <header className="flex h-9 shrink-0 items-center gap-1 border-b border-border pr-1.5 pl-3">
        <div role="tablist" aria-label="Panel views" className="flex items-stretch gap-4">
          {PANEL_TABS.map((tab) => {
            const active = panelTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPanelTab(tab.id)}
                className={cn(
                  "relative flex cursor-pointer items-center gap-1.5 text-xs font-medium tracking-wide uppercase",
                  "transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground/80",
                )}
              >
                {tab.label}
                {tab.id === "problems" && (errors > 0 || warnings > 0) && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--wb-selected)] px-1 text-2xs font-semibold text-foreground tabular">
                    {errors + warnings}
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
          {panelTab !== "problems" && (
            <ToolbarButton
              icon={Trash2}
              label="Clear output"
              side="top"
              onClick={clearLogs}
            />
          )}
          <ToolbarButton
            icon={panelMaximized ? ChevronsDownUp : ChevronsUpDown}
            label={panelMaximized ? "Restore panel size" : "Maximize panel"}
            side="top"
            onClick={togglePanelMaximized}
          />
          <ToolbarButton
            icon={X}
            label="Close panel"
            side="top"
            onClick={togglePanel}
          />
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {panelTab === "problems" && <ProblemsView />}
        {panelTab === "output" && <OutputView />}
        {panelTab === "terminal" && <TerminalView />}
      </div>
    </section>
  )
}

/* ============================================================================
   Problems
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

function ProblemsView() {
  const { problems } = useWorkbench()

  const grouped = React.useMemo(() => {
    const map = new Map<string, Problem[]>()
    for (const p of problems) {
      const list = map.get(p.source) ?? []
      list.push(p)
      map.set(p.source, list)
    }
    return [...map.entries()]
  }, [problems])

  if (problems.length === 0) {
    return (
      <div className="flex h-full items-center px-3 text-sm text-muted-foreground">
        No problems have been detected in the workspace.
      </div>
    )
  }

  return (
    <div className="seq-scroll h-full overflow-auto py-1">
      {grouped.map(([source, list]) => (
        <div key={source}>
          <div className="flex h-[22px] items-center gap-1.5 px-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">{source}</span>
            <span className="tabular">({list.length})</span>
          </div>
          {list.map((problem, i) => {
            const Icon = SEVERITY_ICON[problem.severity]
            return (
              <div
                key={`${source}-${i}`}
                className="row-hover flex min-h-[22px] items-start gap-2 py-0.5 pr-3 pl-7 text-sm"
              >
                <Icon
                  className={cn(
                    "mt-0.5 size-3.5 shrink-0",
                    SEVERITY_CLASS[problem.severity],
                  )}
                />
                <span className="min-w-0 flex-1 text-foreground/85">
                  {problem.message}
                </span>
                {problem.at && (
                  <span className="shrink-0 font-mono text-xs text-muted-foreground/70">
                    {problem.at}
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
   Output
   ========================================================================= */

function OutputView() {
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
        <span className="text-xs text-muted-foreground">Channel</span>
        <WBSelect
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className="h-6 w-56 text-xs"
          aria-label="Output channel"
        >
          {channels.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "All channels" : c}
            </option>
          ))}
        </WBSelect>
        <span className="ml-auto font-mono text-xs text-muted-foreground tabular">
          {filtered.length} lines
        </span>
      </div>
      <LogStream lines={filtered} showSource={channel === "all"} />
    </div>
  )
}

/* ============================================================================
   Terminal
   ========================================================================= */

function TerminalView() {
  const { logs, view } = useWorkbench()
  const cwd = view ? view.href.replace(/^\//, "") : "~"

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--term-bg)]">
      <LogStream
        lines={logs}
        showSource
        prompt={
          <div className="flex items-center gap-1.5 pt-1 pl-1">
            <span className="text-[var(--term-green)]">helixmind@lab</span>
            <span className="text-[var(--term-dim)]">:</span>
            <span className="text-[var(--term-blue)]">~/{cwd}</span>
            <span className="text-[var(--term-dim)]">$</span>
            {/* Decorative caret — the terminal mirrors run output, it does not
                accept input. */}
            <span
              aria-hidden
              className="ml-0.5 inline-block h-3.5 w-[7px] animate-soft-pulse bg-[var(--term-fg)]"
            />
          </div>
        }
        empty={
          <div className="flex items-start gap-2 p-1 text-[var(--term-dim)]">
            <TerminalIcon className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Waiting for output. Run a scan or start a simulation and its log
              stream appears here.
            </span>
          </div>
        }
      />
    </div>
  )
}

/* ============================================================================
   Shared monospace log stream
   ========================================================================= */

const LEVEL_CLASS: Record<LogLevel, string> = {
  info: "text-[var(--term-fg)]",
  success: "text-[var(--term-green)]",
  warn: "text-[var(--term-yellow)]",
  error: "text-[var(--term-red)]",
  debug: "text-[var(--term-dim)]",
  command: "text-[var(--term-cyan)]",
}

const LEVEL_GLYPH: Record<LogLevel, string> = {
  info: "›",
  success: "✔",
  warn: "▲",
  error: "✖",
  debug: "·",
  command: "$",
}

function formatTime(ts: number) {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function LogStream({
  lines,
  showSource,
  prompt,
  empty,
}: {
  lines: LogLine[]
  showSource?: boolean
  prompt?: React.ReactNode
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

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="seq-scroll min-h-0 flex-1 overflow-auto p-2 font-mono text-xs leading-5"
    >
      {lines.length === 0 && empty}

      {lines.map((line) => (
        <div
          key={line.id}
          className="animate-line-in flex items-start gap-2 rounded-xs px-1 hover:bg-[var(--wb-hover)]"
        >
          <span className="shrink-0 text-[var(--term-dim)] tabular">
            {formatTime(line.ts)}
          </span>
          {showSource && (
            <span className="shrink-0 text-[var(--term-magenta)]">
              [{line.source}]
            </span>
          )}
          <span className={cn("shrink-0", LEVEL_CLASS[line.level])}>
            {LEVEL_GLYPH[line.level]}
          </span>
          <span className={cn("min-w-0 flex-1 break-words", LEVEL_CLASS[line.level])}>
            {line.message}
          </span>
        </div>
      ))}

      {prompt}
      <div ref={endRef} />
    </div>
  )
}
