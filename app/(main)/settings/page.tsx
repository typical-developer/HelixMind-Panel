"use client"

import { useMemo, useRef, useState } from "react"
import {
  Bell,
  Bug,
  Keyboard,
  Layout,
  LifeBuoy,
  Mail,
  Monitor,
  PanelBottom,
  PanelLeft,
  PanelRight,
  RotateCcw,
  Search,
  ShieldAlert,
  Type,
  User,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "@/hooks/use-toast"
import { APP_VERSION, SUPPORT_EMAIL } from "@/lib/app-info"
import { clearWorkspace, formatBytes, measureUsage } from "@/lib/storage"
import { clearActivity } from "@/lib/activity-store"
import { clearSnapshot } from "@/lib/lab-snapshot"
import { setPreferences, usePreferences } from "@/lib/preferences"
import { useSupport } from "@/components/support/support-provider"
import {
  Chip,
  ViewLayout,
  ViewScroll,
  EmptyState,
  Pane,
  PaneHeader,
  WBInput,
  useStatusItems,
  useViewContext,
  useWorkbench,
} from "@/components/workbench"

/* ============================================================================
   Settings rows — one row per setting, label and description on the left,
   control on the right.
   ========================================================================= */

function SettingRow({
  label,
  description,
  children,
  className,
  /** Highlighted when the search matched this row. */
  matched,
}: {
  label: string
  description?: string
  children?: React.ReactNode
  className?: string
  matched?: boolean
}) {
  return (
    <div
      data-matched={matched || undefined}
      className={cn(
        "flex items-start justify-between gap-4 border-b border-border/60 px-3 py-2.5 last:border-0",
        "transition-colors duration-200",
        matched && "bg-warning/10",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-sm text-foreground">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children && <div className="shrink-0 pt-0.5">{children}</div>}
    </div>
  )
}

interface Section {
  id: string
  title: string
  icon: React.ComponentType<{ className?: string }>
  /** Terms the filter matches against, beyond the visible row labels. */
  keywords: string
  danger?: boolean
}

const SECTIONS: Section[] = [
  { id: "profile", title: "Profile", icon: User, keywords: "account name email user" },
  {
    id: "notifications",
    title: "Notifications",
    icon: Bell,
    keywords: "alerts email inbox scans uploads toasts confirm",
  },
  {
    id: "layout",
    title: "Layout",
    icon: Layout,
    keywords: "sidebar console inspector status context bar tabs focus mode",
  },
  {
    id: "appearance",
    title: "Appearance",
    icon: Monitor,
    keywords: "theme dark scale font size density zoom",
  },
  {
    id: "keyboard",
    title: "Keyboard shortcuts",
    icon: Keyboard,
    keywords: "keybindings chords hotkeys palette",
  },
  {
    id: "support",
    title: "Support",
    icon: LifeBuoy,
    keywords: "help bug report problem contact version about diagnostics",
  },
  {
    id: "danger",
    title: "Danger zone",
    icon: ShieldAlert,
    keywords: "delete data destroy irreversible reset clear storage",
  },
]

/**
 * Every individual setting, for row-level search.
 *
 * The search used to match section *keywords* only and then hide every section
 * that did not match — so typing "focus mode" blanked five of six panes to
 * reveal one row, and typing the exact label of a row that had no matching
 * keyword found nothing at all.
 */
const SETTING_INDEX: Array<{ section: string; label: string; terms: string }> = [
  { section: "profile", label: "Full name", terms: "name profile account" },
  { section: "profile", label: "Email address", terms: "email address account" },
  { section: "notifications", label: "In-app notifications", terms: "toast alert popup feedback" },
  { section: "notifications", label: "Email notifications", terms: "email inbox digest" },
  { section: "notifications", label: "Confirm destructive actions", terms: "confirm undo delete clear warning" },
  { section: "layout", label: "Sidebar", terms: "sidebar explorer tree ctrl b" },
  { section: "layout", label: "Inspector", terms: "inspector parameters right column" },
  { section: "layout", label: "Console", terms: "console log alerts history ctrl j" },
  { section: "layout", label: "Open tabs", terms: "tabs analyses strip" },
  { section: "layout", label: "Context bar", terms: "context breadcrumb" },
  { section: "layout", label: "Status bar", terms: "status strip bottom" },
  { section: "layout", label: "Reset layout", terms: "reset default restore" },
  { section: "appearance", label: "Colour theme", terms: "theme dark light colour color" },
  { section: "appearance", label: "Interface scale", terms: "zoom scale font size text" },
  { section: "appearance", label: "Focus mode", terms: "focus distraction zen" },
  { section: "support", label: "Report a problem", terms: "bug issue support help contact" },
  { section: "support", label: "Contact support", terms: "email support help" },
  { section: "support", label: "Version", terms: "version build about" },
  { section: "danger", label: "Delete all data", terms: "delete clear wipe reset storage" },
]

const SHORTCUTS: Array<[string, string]> = [
  ["Search analyses and commands", "Ctrl K  /  Ctrl P"],
  ["Run a command", "Ctrl Shift P"],
  ["Toggle sidebar", "Ctrl B"],
  ["Toggle inspector", "Ctrl Alt B"],
  ["Toggle console", "Ctrl J"],
  ["Open the run log", "Ctrl `"],
  ["Close the open analysis", "Alt W"],
  ["Reopen closed analysis", "Alt Shift T"],
  ["Move between open analyses", "← →"],
  ["Larger / smaller interface", "Ctrl Alt +  /  Ctrl Alt -"],
  ["Reset interface scale", "Ctrl Alt 0"],
  ["Open settings", "Ctrl ,"],
  ["Exit focus mode", "Esc"],
]

export default function Settings() {
  const { user } = useAuth()
  const wb = useWorkbench()
  const preferences = usePreferences()
  const { openReport, openAbout } = useSupport()

  const [query, setQuery] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [flashed, setFlashed] = useState<string | null>(null)
  const flashTimer = useRef<number | null>(null)

  const needle = query.trim().toLowerCase()

  /** Matching rows, for the suggestion list under the search field. */
  const suggestions = useMemo(() => {
    if (!needle) return []
    return SETTING_INDEX.filter((entry) =>
      `${entry.label} ${entry.terms}`.toLowerCase().includes(needle),
    ).slice(0, 6)
  }, [needle])

  const visibleSections = useMemo(() => {
    if (!needle) return SECTIONS
    const sectionsWithMatch = new Set(suggestions.map((s) => s.section))
    return SECTIONS.filter(
      (s) =>
        sectionsWithMatch.has(s.id) ||
        `${s.title} ${s.keywords}`.toLowerCase().includes(needle),
    )
  }, [needle, suggestions])

  const matchedLabels = useMemo(
    () => new Set(suggestions.map((s) => s.label)),
    [suggestions],
  )

  /**
   * Jump to a row and flash it.
   *
   * Scrolling alone left the operator hunting for which of eight rows they had
   * just been sent to.
   */
  const jumpTo = (sectionId: string, label?: string) => {
    document
      .getElementById(sectionId)
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
    if (!label) return
    setFlashed(label)
    if (flashTimer.current) window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlashed(null), 1600)
  }

  const usage = useMemo(() => measureUsage(), [])

  const handleDeleteAll = () => {
    clearWorkspace()
    clearActivity()
    clearSnapshot()
    setConfirmOpen(false)
    setConfirmText("")
    toast({
      variant: "success",
      title: "Workspace cleared",
      description:
        "Activity, runs, notifications, preferences and layout have been removed from this browser.",
    })
    // The layout store has been wiped from under the running app; putting the
    // defaults back on screen keeps the two in step without a reload.
    wb.resetLayout()
  }

  useStatusItems(
    useMemo(
      () => [
        {
          id: "scale",
          label:
            wb.zoom === 0 ? "Scale 100%" : `Scale ${wb.zoom > 0 ? "+" : ""}${wb.zoom}`,
          title: "Interface scale — Ctrl+Alt+= and Ctrl+Alt+-",
          onClick: wb.zoomReset,
        },
        {
          id: "storage",
          label: formatBytes(usage.bytes),
          title: `This workspace uses ${formatBytes(usage.bytes)} of browser storage across ${usage.keys} key${usage.keys === 1 ? "" : "s"}`,
        },
      ],
      [wb.zoom, wb.zoomReset, usage],
    ),
  )

  useViewContext(
    needle
      ? `Filtered to “${query}” · ${visibleSections.length} of ${SECTIONS.length} sections`
      : null,
  )

  const isVisible = (id: string) => visibleSections.some((s) => s.id === id)

  return (
    <ViewLayout
      inspectorId="settings"
      defaultInspectorSize={22}
      inspector={<SettingsToc sections={visibleSections} onJump={jumpTo} />}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="relative flex h-9 shrink-0 items-center gap-2 border-b border-border px-2">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <WBInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search settings"
              className="h-7 pr-7 pl-7"
              aria-label="Search settings"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:bg-[var(--wb-active)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
              >
                <X className="size-3" />
              </button>
            )}

            {/* Autocomplete over individual settings, so a half-remembered
                name lands on the row rather than on a filtered page. */}
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 z-30 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-[var(--shadow-menu)]">
                {suggestions.map((entry) => {
                  const section = SECTIONS.find((s) => s.id === entry.section)
                  return (
                    <button
                      key={`${entry.section}-${entry.label}`}
                      type="button"
                      onClick={() => {
                        setQuery("")
                        // Let the full list re-render before scrolling to it.
                        requestAnimationFrame(() =>
                          jumpTo(entry.section, entry.label),
                        )
                      }}
                      className="row-hover flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-left text-sm focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none focus-visible:ring-inset"
                    >
                      {section && (
                        <section.icon className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-foreground/90">
                        {entry.label}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground/70">
                        {section?.title}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground tabular">
            {visibleSections.length} / {SECTIONS.length}
          </span>
        </div>

        {visibleSections.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No settings match"
            description={`Nothing matches “${query}”.`}
          />
        ) : (
          <ViewScroll>
            <div className="mx-auto flex max-w-3xl flex-col gap-3 p-3">
              {isVisible("profile") && (
                <Pane id="profile">
                  <PaneHeader icon={User} title="Profile" subtitle="account details" />
                  <div className="flex items-center gap-3 border-b border-border/60 px-3 py-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-raised text-lg font-semibold text-foreground">
                      {user?.name?.charAt(0).toUpperCase() ?? "G"}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {user?.name ?? "Guest"}
                      </p>
                      <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                        <Mail className="size-3 shrink-0" />
                        <span className="truncate">
                          {user?.email ?? "Not signed in"}
                        </span>
                      </p>
                    </div>
                    <Chip tone="success" className="ml-auto">
                      active
                    </Chip>
                  </div>

                  <SettingRow
                    label="Full name"
                    description="Set when you created the account. The API has no endpoint for changing it."
                    matched={flashed === "Full name"}
                  >
                    <WBInput
                      value={user?.name ?? "Guest"}
                      readOnly
                      className="w-56"
                      aria-label="Full name"
                    />
                  </SettingRow>
                  <SettingRow
                    label="Email address"
                    description="Used to sign in. Changing it is not supported yet."
                    matched={flashed === "Email address"}
                  >
                    <WBInput
                      value={user?.email ?? ""}
                      readOnly
                      className="w-56"
                      aria-label="Email address"
                    />
                  </SettingRow>
                </Pane>
              )}

              {isVisible("notifications") && (
                <Pane id="notifications">
                  <PaneHeader
                    icon={Bell}
                    title="Notifications"
                    subtitle="how you're told about activity"
                  />
                  {/* These now persist and are actually read. They used to be
                      component state that "Save changes" pretended to store. */}
                  <SettingRow
                    label="In-app notifications"
                    description="Show a toast when a run finishes, an export is ready or an upload is rejected."
                    matched={flashed === "In-app notifications"}
                  >
                    <Switch
                      checked={preferences.inAppNotifications}
                      onCheckedChange={(v) => {
                        setPreferences({ inAppNotifications: v })
                        toast({
                          title: v
                            ? "In-app notifications on"
                            : "In-app notifications off",
                        })
                      }}
                      aria-label="In-app notifications"
                    />
                  </SettingRow>
                  <SettingRow
                    label="Email notifications"
                    description="Not connected — the API exposes no mail endpoint. Your choice is remembered for when it does."
                    matched={flashed === "Email notifications"}
                  >
                    <Switch
                      checked={preferences.emailNotifications}
                      onCheckedChange={(v) =>
                        setPreferences({ emailNotifications: v })
                      }
                      aria-label="Email notifications"
                    />
                  </SettingRow>
                  <SettingRow
                    label="Confirm destructive actions"
                    description="Ask before clearing history or deleting workspace data."
                    matched={flashed === "Confirm destructive actions"}
                  >
                    <Switch
                      checked={preferences.confirmDestructive}
                      onCheckedChange={(v) =>
                        setPreferences({ confirmDestructive: v })
                      }
                      aria-label="Confirm destructive actions"
                    />
                  </SettingRow>
                </Pane>
              )}

              {isVisible("layout") && (
                <Pane id="layout">
                  <PaneHeader
                    icon={Layout}
                    title="Layout"
                    subtitle="which regions are visible"
                  />
                  <SettingRow
                    label="Sidebar"
                    description="Analyses, runs and the gene library."
                    matched={flashed === "Sidebar"}
                  >
                    <Switch
                      checked={wb.sidebarVisible}
                      onCheckedChange={wb.toggleSidebar}
                      aria-label="Sidebar"
                    />
                  </SettingRow>
                  <SettingRow
                    label="Inspector"
                    description="The right-hand column holding the open analysis's inputs and parameters."
                    matched={flashed === "Inspector"}
                  >
                    <Switch
                      checked={wb.inspectorVisible}
                      onCheckedChange={wb.toggleInspector}
                      aria-label="Inspector"
                    />
                  </SettingRow>
                  <SettingRow
                    label="Console"
                    description="Alerts, the run log and the history of finished runs."
                    matched={flashed === "Console"}
                  >
                    <Switch
                      checked={wb.panelVisible}
                      onCheckedChange={wb.togglePanel}
                      aria-label="Console"
                    />
                  </SettingRow>
                  <SettingRow
                    label="Open tabs"
                    description="Keep every analysis you open one click away."
                    matched={flashed === "Open tabs"}
                  >
                    <Switch
                      checked={wb.tabBarVisible}
                      onCheckedChange={wb.toggleTabBar}
                      aria-label="Open tabs"
                    />
                  </SettingRow>
                  <SettingRow
                    label="Context bar"
                    description="The line above the bench naming what the open analysis is working on."
                    matched={flashed === "Context bar"}
                  >
                    <Switch
                      checked={wb.contextBarVisible}
                      onCheckedChange={wb.toggleContextBar}
                      aria-label="Context bar"
                    />
                  </SettingRow>
                  <SettingRow
                    label="Status bar"
                    description="The summary strip along the bottom of the window."
                    matched={flashed === "Status bar"}
                  >
                    <Switch
                      checked={wb.statusBarVisible}
                      onCheckedChange={wb.toggleStatusBar}
                      aria-label="Status bar"
                    />
                  </SettingRow>
                  <SettingRow
                    label="Reset layout"
                    description="Restore every region to its default size and visibility."
                    matched={flashed === "Reset layout"}
                  >
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        wb.resetLayout()
                        toast({ title: "Layout reset to defaults" })
                      }}
                      className="h-7"
                    >
                      <RotateCcw className="size-3.5" />
                      Reset
                    </Button>
                  </SettingRow>
                </Pane>
              )}

              {isVisible("appearance") && (
                <Pane id="appearance">
                  <PaneHeader
                    icon={Monitor}
                    title="Appearance"
                    subtitle="theme and density"
                  />
                  <SettingRow
                    label="Colour theme"
                    description="HelixMind ships a single dark lab theme, tuned for long sessions."
                    matched={flashed === "Colour theme"}
                  >
                    <Chip tone="info">Dark</Chip>
                  </SettingRow>
                  <SettingRow
                    label="Interface scale"
                    description="Scales every region of the panel. Ctrl+Alt+= and Ctrl+Alt+- do the same (plain Ctrl+ is the browser's own zoom)."
                    matched={flashed === "Interface scale"}
                  >
                    <div className="flex items-center gap-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={wb.zoomOut}
                        className="h-7 w-7 p-0"
                        aria-label="Zoom out"
                      >
                        <Type className="size-3" />
                      </Button>
                      <span className="w-12 text-center font-mono text-xs text-muted-foreground tabular">
                        {wb.zoom === 0 ? "100%" : `${wb.zoom > 0 ? "+" : ""}${wb.zoom}`}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={wb.zoomIn}
                        className="h-7 w-7 p-0"
                        aria-label="Zoom in"
                      >
                        <Type className="size-4" />
                      </Button>
                    </div>
                  </SettingRow>
                  <SettingRow
                    label="Focus mode"
                    description="Hide every region except the bench itself. Esc exits."
                    matched={flashed === "Focus mode"}
                  >
                    <Switch
                      checked={wb.focusMode}
                      onCheckedChange={wb.toggleFocusMode}
                      aria-label="Focus mode"
                    />
                  </SettingRow>
                </Pane>
              )}

              {isVisible("keyboard") && (
                <Pane id="keyboard">
                  <PaneHeader
                    icon={Keyboard}
                    title="Keyboard shortcuts"
                    subtitle={`${SHORTCUTS.length} bindings`}
                  />
                  <div className="divide-y divide-border/60">
                    {SHORTCUTS.map(([label, chord]) => (
                      <div
                        key={label}
                        className="row-hover flex items-center justify-between gap-4 px-3 py-1.5"
                      >
                        <span className="truncate text-sm text-foreground/85">
                          {label}
                        </span>
                        <kbd className="shrink-0 rounded-sm border border-border bg-[var(--wb-raised)] px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                          {chord}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </Pane>
              )}

              {isVisible("support") && (
                <Pane id="support">
                  <PaneHeader
                    icon={LifeBuoy}
                    title="Support"
                    subtitle="getting help, and reporting problems"
                  />
                  <SettingRow
                    label="Report a problem"
                    description="Collects the route, your open analyses, current alerts and the last 50 log lines. You review it before anything is shared."
                    matched={flashed === "Report a problem"}
                  >
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openReport()}
                      className="h-7"
                    >
                      <Bug className="size-3.5" />
                      Report
                    </Button>
                  </SettingRow>
                  <SettingRow
                    label="Contact support"
                    description="For account recovery and anything the panel cannot do itself."
                    matched={flashed === "Contact support"}
                  >
                    <a
                      href={`mailto:${SUPPORT_EMAIL}`}
                      className="text-sm text-foreground underline underline-offset-2 hover:text-foreground/80"
                    >
                      {SUPPORT_EMAIL}
                    </a>
                  </SettingRow>
                  <SettingRow
                    label="Version"
                    description="What this build is, where your data lives, and what is not finished yet."
                    matched={flashed === "Version"}
                  >
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={openAbout}
                      className="h-7 font-mono"
                    >
                      {APP_VERSION}
                    </Button>
                  </SettingRow>
                </Pane>
              )}

              {isVisible("danger") && (
                <Pane id="danger" className="border-destructive/30">
                  <PaneHeader
                    icon={ShieldAlert}
                    title="Danger zone"
                    subtitle="irreversible actions"
                    className="text-destructive"
                  />
                  <SettingRow
                    label="Delete all data"
                    description={`Removes every run, notification, preference and saved layout from this browser — ${formatBytes(
                      usage.bytes,
                    )} across ${usage.keys} key${usage.keys === 1 ? "" : "s"}. You stay signed in.`}
                    matched={flashed === "Delete all data"}
                  >
                    {/* This button had no onClick at all: the most destructive
                        control in the app did nothing when pressed. */}
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-7"
                      onClick={() => {
                        if (!preferences.confirmDestructive) {
                          handleDeleteAll()
                          return
                        }
                        setConfirmText("")
                        setConfirmOpen(true)
                      }}
                    >
                      Delete all data
                    </Button>
                  </SettingRow>
                </Pane>
              )}
            </div>
          </ViewScroll>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete everything in this workspace?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                This removes your activity log, finished runs, run output,
                notifications, saved layout and preferences from this browser.
                It cannot be undone.
              </span>
              <span className="block">
                Your account is not affected and you will stay signed in.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground">
              Type <span className="font-mono text-foreground">delete</span> to
              confirm
            </span>
            <WBInput
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="delete"
              autoComplete="off"
              aria-label="Type delete to confirm"
            />
          </label>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmText.trim().toLowerCase() !== "delete"}
              onClick={handleDeleteAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ViewLayout>
  )
}

function SettingsToc({
  sections,
  onJump,
}: {
  sections: Section[]
  onJump: (id: string) => void
}) {
  const wb = useWorkbench()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="seq-scroll min-h-0 flex-1 overflow-y-auto p-3">
        <Pane>
          <PaneHeader title="Sections" />
          <div className="p-1.5">
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onJump(s.id)}
                className={cn(
                  "row-hover flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                  "focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
                  s.danger ? "text-destructive/85" : "text-muted-foreground",
                )}
              >
                <s.icon className="size-3.5 shrink-0" />
                <span className="truncate">{s.title}</span>
              </button>
            ))}
          </div>
        </Pane>

        <Pane className="mt-3">
          <PaneHeader title="Regions" />
          <div className="grid grid-cols-3 gap-1.5 p-3">
            {[
              {
                icon: PanelLeft,
                label: "Sidebar",
                on: wb.sidebarVisible,
                toggle: wb.toggleSidebar,
              },
              {
                icon: PanelBottom,
                label: "Console",
                on: wb.panelVisible,
                toggle: wb.togglePanel,
              },
              {
                icon: PanelRight,
                label: "Inspector",
                on: wb.inspectorVisible,
                toggle: wb.toggleInspector,
              },
            ].map((r) => (
              // These were three inert divs that merely reported state. They
              // look exactly like buttons, so they are buttons now.
              <button
                key={r.label}
                type="button"
                onClick={r.toggle}
                aria-pressed={r.on}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-1 rounded-sm border py-2 text-xs transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
                  r.on
                    ? "border-border bg-[var(--wb-active)] text-foreground/80"
                    : "border-border/60 bg-[var(--wb-raised)] text-muted-foreground/60 hover:text-muted-foreground",
                )}
              >
                <r.icon className="size-3.5" />
                {r.label}
              </button>
            ))}
          </div>
        </Pane>
      </div>

      {/* The "Save changes" button is gone. It set a two-second "Saved" label
          and persisted nothing; every control on this page now applies
          immediately and stores itself, so there is nothing left to save. */}
      <p className="shrink-0 border-t border-border p-3 text-xs leading-relaxed text-muted-foreground/70">
        Changes apply immediately and are saved in this browser.
      </p>
    </div>
  )
}
