"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  Bell,
  CircleDot,
  GitBranch,
  Loader2,
  RefreshCw,
  Terminal,
  TriangleAlert,
  Zap,
} from "lucide-react"

import { cn } from "@/lib/utils"

import { useNotifications } from "@/components/notifications/notifications-provider"

import { useWorkbench } from "./workbench-provider"

/**
 * The 24px strip along the bottom. Left side is workspace-wide (branch, sync,
 * diagnostics); right side is contextual — views publish their own items with
 * `useStatusItems`, the way an editor shows cursor position and encoding.
 */
export function StatusBar() {
  const {
    problems,
    setPanelTab,
    panelVisible,
    togglePanel,
    runStatus,
    statusItems,
    openPalette,
    view,
  } = useWorkbench()
  const { unreadCount } = useNotifications()
  const router = useRouter()

  const errors = problems.filter((p) => p.severity === "error").length
  const warnings = problems.filter((p) => p.severity === "warning").length

  return (
    <footer
      aria-label="Status bar"
      className="relative flex h-6 shrink-0 items-stretch gap-0 border-t border-border bg-chrome pr-1 pl-0 text-xs text-muted-foreground select-none"
    >
      {/* Remote-indicator style brand chip. */}
      <button
        type="button"
        onClick={() => openPalette()}
        title="Open command palette (Ctrl+K)"
        className="flex cursor-pointer items-center gap-1.5 bg-brand px-2 font-medium text-white transition-colors hover:bg-brand/85 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none focus-visible:ring-inset"
      >
        <Zap className="size-3" />
        <span className="hidden sm:inline">HelixMind</span>
      </button>

      <StatusItem
        icon={GitBranch}
        label="main"
        title="Active workspace branch"
        onClick={() => router.push("/dashboard")}
      />
      <StatusItem icon={RefreshCw} label="" title="Synchronize workspace" />

      <StatusItem
        icon={AlertCircle}
        label={
          <span className="flex items-center gap-1.5 tabular">
            {errors}
            <TriangleAlert className="size-3" />
            {warnings}
          </span>
        }
        title={`${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${
          warnings === 1 ? "" : "s"
        }`}
        tone={errors > 0 ? "danger" : warnings > 0 ? "warning" : "default"}
        onClick={() => setPanelTab("problems")}
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
          onClick={() => setPanelTab("output")}
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

      {view && (
        <StatusItem
          label={view.fileName.split(".").pop()?.toUpperCase() ?? ""}
          title="View type"
        />
      )}
      <StatusItem label="UTF-8" title="Encoding" />

      <StatusItem
        icon={Terminal}
        label=""
        title="Toggle panel (Ctrl+J)"
        tone={panelVisible ? "info" : "default"}
        onClick={togglePanel}
      />
      <StatusItem
        icon={Bell}
        label={unreadCount > 0 ? String(unreadCount) : ""}
        title={
          unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
            : "Notifications"
        }
        tone={unreadCount > 0 ? "info" : "default"}
        onClick={() => router.push("/notifications")}
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
    info: "text-brand-bright",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  }[tone]

  const content = (
    <>
      {Icon && <Icon className="size-3 shrink-0" />}
      {label !== "" && label !== undefined && (
        <span className="truncate">{label}</span>
      )}
    </>
  )

  const className = cn(
    "flex items-center gap-1.5 px-2 transition-colors duration-100",
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
