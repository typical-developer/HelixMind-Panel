"use client"

import * as React from "react"
import {
  AlertCircle,
  CheckCircle2,
  CircleDot,
  Loader2,
  PanelBottom,
  TriangleAlert,
  Zap,
} from "lucide-react"

import { cn } from "@/lib/utils"

import { useConsole, useWorkbench } from "./workbench-provider"

/**
 * The 24px strip along the bottom. Left side is lab-wide — what needs
 * attention and what is running. Right side belongs to the open analysis:
 * views publish their own readouts with `useStatusItems`.
 */
export function StatusBar() {
  const { setPanelTab, panelVisible, togglePanel, openPalette } = useWorkbench()
  const { alerts, runStatus, statusItems } = useConsole()

  const errors = alerts.filter((a) => a.severity === "error").length
  const warnings = alerts.filter((a) => a.severity === "warning").length

  return (
    <footer
      aria-label="Status bar"
      className="relative flex h-6 shrink-0 items-stretch gap-0 overflow-hidden border-t border-border bg-chrome pr-1 pl-0 text-xs text-muted-foreground select-none"
    >
      {/* The lab you are working in, and the way into everything it can do.
          Never shrinks — it is the strip's anchor and its palette entry point. */}
      <button
        type="button"
        onClick={() => openPalette()}
        title="Search and run commands (Ctrl+K)"
        className="flex shrink-0 cursor-pointer items-center gap-1.5 bg-brand px-2 font-medium text-brand-foreground transition-colors hover:bg-brand/85 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none focus-visible:ring-inset"
      >
        <Zap className="size-3" />
        <span className="hidden sm:inline">HelixMind Lab</span>
      </button>

      <StatusItem
        icon={errors + warnings === 0 ? CheckCircle2 : AlertCircle}
        label={
          errors + warnings === 0 ? (
            "No alerts"
          ) : (
            <span className="flex items-center gap-1.5 tabular">
              {errors}
              <TriangleAlert className="size-3" />
              {warnings}
            </span>
          )
        }
        title={`${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${
          warnings === 1 ? "" : "s"
        } — open the console`}
        tone={errors > 0 ? "danger" : warnings > 0 ? "warning" : "default"}
        onClick={() => setPanelTab("alerts")}
      />

      {runStatus && (
        <StatusItem
          icon={runStatus.state === "running" ? SpinnerIcon : CircleDot}
          label={
            <span className="flex items-center gap-1.5">
              {runStatus.label}
              {typeof runStatus.progress === "number" && (
                <span className="tabular">{Math.round(runStatus.progress)}%</span>
              )}
            </span>
          }
          title={runStatus.detail ?? runStatus.label}
          tone={runStatus.state === "running" ? "info" : "default"}
          onClick={() => setPanelTab("log")}
        />
      )}

      <div className="flex-1" />

      {statusItems.map((item) => (
        <StatusItem
          key={item.id}
          icon={item.icon}
          label={item.label}
          title={item.title}
          tone={item.tone}
          onClick={item.onClick}
        />
      ))}

      <StatusItem
        icon={PanelBottom}
        label=""
        title="Toggle console (Ctrl+J)"
        tone={panelVisible ? "info" : "default"}
        onClick={togglePanel}
      />
    </footer>
  )
}

function SpinnerIcon({ className }: { className?: string }) {
  return <Loader2 className={cn("animate-spin", className)} />
}

function StatusItem({
  icon: Icon,
  label,
  title,
  tone = "default",
  onClick,
}: {
  icon?: React.ComponentType<{ className?: string }>
  label?: React.ReactNode
  title?: string
  tone?: "default" | "info" | "success" | "warning" | "danger"
  onClick?: () => void
}) {
  const toneClass = {
    default: "",
    info: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  }[tone]

  const content = (
    <>
      {Icon && <Icon className="size-3 shrink-0" />}
      {label !== "" && label !== undefined && (
        <span className="min-w-0 truncate">{label}</span>
      )}
    </>
  )

  const className = cn(
    // Items shrink and truncate rather than pushing the strip wider than the
    // window. `min-w-0` is what makes the inner `truncate` actually engage.
    "flex min-w-0 items-center gap-1.5 px-2 transition-colors duration-100",
    toneClass,
    onClick &&
      "cursor-pointer hover:bg-[var(--wb-selected)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none focus-visible:ring-inset",
  )

  if (!onClick) {
    return (
      <span className={className} title={title}>
        {content}
      </span>
    )
  }

  return (
    <button type="button" className={className} title={title} onClick={onClick}>
      {content}
    </button>
  )
}
