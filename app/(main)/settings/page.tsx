"use client"

import { useMemo, useState } from "react"
import {
  Bell,
  Check,
  Keyboard,
  Layout,
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
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Chip,
  EditorLayout,
  EditorScroll,
  EmptyState,
  Pane,
  PaneHeader,
  WBInput,
  useStatusItems,
  useWorkbench,
} from "@/components/workbench"

/* ============================================================================
   Settings rows — modelled on VS Code's settings editor: one row per setting,
   label and description on the left, control on the right.
   ========================================================================= */

function SettingRow({
  label,
  description,
  children,
  className,
}: {
  label: string
  description?: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-border/60 px-3 py-2.5 last:border-0",
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
    keywords: "alerts email inbox scans uploads",
  },
  {
    id: "workbench",
    title: "Workbench",
    icon: Layout,
    keywords: "layout side bar panel inspector status breadcrumbs tabs zen",
  },
  {
    id: "appearance",
    title: "Appearance",
    icon: Monitor,
    keywords: "theme dark zoom font size density",
  },
  {
    id: "keyboard",
    title: "Keyboard shortcuts",
    icon: Keyboard,
    keywords: "keybindings chords hotkeys palette",
  },
  {
    id: "danger",
    title: "Danger zone",
    icon: ShieldAlert,
    keywords: "delete data destroy irreversible",
    danger: true,
  },
]

const SHORTCUTS: Array<[string, string]> = [
  ["Command palette", "Ctrl K  /  Ctrl P"],
  ["Toggle side bar", "Ctrl B"],
  ["Toggle inspector", "Ctrl Alt B"],
  ["Toggle bottom panel", "Ctrl J"],
  ["Focus terminal", "Ctrl `"],
  ["Close current view", "Alt W"],
  ["Zoom in / out", "Ctrl Alt +  /  Ctrl Alt -"],
  ["Reset zoom", "Ctrl Alt 0"],
  ["Exit zen mode", "Esc"],
]

export default function Settings() {
  const { user } = useAuth()
  const wb = useWorkbench()

  const [notifications, setNotifications] = useState(true)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [saved, setSaved] = useState(false)
  const [query, setQuery] = useState("")

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const needle = query.trim().toLowerCase()
  const visibleSections = useMemo(
    () =>
      needle
        ? SECTIONS.filter((s) =>
            `${s.title} ${s.keywords}`.toLowerCase().includes(needle),
          )
        : SECTIONS,
    [needle],
  )

  useStatusItems(
    useMemo(
      () => [{ id: "zoom", label: wb.zoom === 0 ? "Zoom 100%" : `Zoom ${wb.zoom > 0 ? "+" : ""}${wb.zoom}` }],
      [wb.zoom],
    ),
  )

  const isVisible = (id: string) => visibleSections.some((s) => s.id === id)

  return (
    <EditorLayout
      inspectorId="settings"
      defaultInspectorSize={22}
      inspector={
        <SettingsToc sections={visibleSections} onSave={handleSave} saved={saved} />
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-2">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <WBInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search settings"
              className="h-7 pl-7"
              aria-label="Search settings"
            />
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
          <EditorScroll>
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

                  <div className="grid gap-3 p-3 sm:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium text-foreground/80">
                        Full name
                      </span>
                      <WBInput value={user?.name ?? "Guest"} readOnly />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium text-foreground/80">
                        Email address
                      </span>
                      <WBInput value={user?.email ?? ""} readOnly />
                    </label>
                  </div>
                </Pane>
              )}

              {isVisible("notifications") && (
                <Pane id="notifications">
                  <PaneHeader
                    icon={Bell}
                    title="Notifications"
                    subtitle="how you're told about activity"
                  />
                  <SettingRow
                    label="In-app notifications"
                    description="Show alerts for scans, uploads and simulation runs."
                  >
                    <Switch
                      checked={notifications}
                      onCheckedChange={setNotifications}
                      aria-label="In-app notifications"
                    />
                  </SettingRow>
                  <SettingRow
                    label="Email notifications"
                    description="Send important updates to your inbox."
                  >
                    <Switch
                      checked={emailNotifications}
                      onCheckedChange={setEmailNotifications}
                      aria-label="Email notifications"
                    />
                  </SettingRow>
                </Pane>
              )}

              {isVisible("workbench") && (
                <Pane id="workbench">
                  <PaneHeader
                    icon={Layout}
                    title="Workbench"
                    subtitle="which regions are visible"
                  />
                  <SettingRow
                    label="Side bar"
                    description="Explorer, search, run configurations and the gene database."
                  >
                    <Switch
                      checked={wb.sidebarVisible}
                      onCheckedChange={wb.toggleSidebar}
                      aria-label="Side bar"
                    />
                  </SettingRow>
                  <SettingRow
                    label="Inspector"
                    description="The right-hand column holding a view's inputs and parameters."
                  >
                    <Switch
                      checked={wb.inspectorVisible}
                      onCheckedChange={wb.toggleInspector}
                      aria-label="Inspector"
                    />
                  </SettingRow>
                  <SettingRow
                    label="Bottom panel"
                    description="Problems, output channels and the run terminal."
                  >
                    <Switch
                      checked={wb.panelVisible}
                      onCheckedChange={wb.togglePanel}
                      aria-label="Bottom panel"
                    />
                  </SettingRow>
                  <SettingRow
                    label="Editor tabs"
                    description="Keep opened views as closable tabs above the editor."
                  >
                    <Switch
                      checked={wb.tabBarVisible}
                      onCheckedChange={wb.toggleTabBar}
                      aria-label="Editor tabs"
                    />
                  </SettingRow>
                  <SettingRow
                    label="Breadcrumbs"
                    description="Show the workspace path above the editor."
                  >
                    <Switch
                      checked={wb.breadcrumbsVisible}
                      onCheckedChange={wb.toggleBreadcrumbs}
                      aria-label="Breadcrumbs"
                    />
                  </SettingRow>
                  <SettingRow
                    label="Status bar"
                    description="The summary strip along the bottom of the window."
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
                  >
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={wb.resetLayout}
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
                    description="HelixMind ships a single dark workbench theme."
                  >
                    <Chip tone="info">Dark</Chip>
                  </SettingRow>
                  <SettingRow
                    label="Interface zoom"
                    description="Scales every region of the workbench. Ctrl+Alt+= and Ctrl+Alt+- do the same (plain Ctrl+ is the browser's own zoom)."
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
                    label="Zen mode"
                    description="Hide all chrome and keep only the editor. Esc exits."
                  >
                    <Switch
                      checked={wb.zen}
                      onCheckedChange={wb.toggleZen}
                      aria-label="Zen mode"
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
                    description="Permanently remove every sequence, run and analysis in this workspace."
                  >
                    <Button variant="destructive" size="sm" className="h-7">
                      Delete all data
                    </Button>
                  </SettingRow>
                </Pane>
              )}
            </div>
          </EditorScroll>
        )}
      </div>
    </EditorLayout>
  )
}

function SettingsToc({
  sections,
  onSave,
  saved,
}: {
  sections: Section[]
  onSave: () => void
  saved: boolean
}) {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="seq-scroll min-h-0 flex-1 overflow-y-auto p-3">
        <Pane>
          <PaneHeader title="Table of contents" />
          <div className="p-1.5">
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollTo(s.id)}
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
          <PaneHeader title="Layout" />
          <div className="grid grid-cols-3 gap-1.5 p-3">
            {[
              { icon: PanelLeft, label: "Side" },
              { icon: PanelBottom, label: "Panel" },
              { icon: PanelRight, label: "Inspect" },
            ].map((r) => (
              <div
                key={r.label}
                className="flex flex-col items-center gap-1 rounded-sm border border-border bg-[var(--wb-raised)] py-2 text-xs text-muted-foreground"
              >
                <r.icon className="size-3.5" />
                {r.label}
              </div>
            ))}
          </div>
        </Pane>
      </div>

      <div className="shrink-0 border-t border-border p-3">
        <Button onClick={onSave} className="h-8 w-full">
          {saved ? (
            <>
              <Check className="size-3.5" /> Saved
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </div>
    </div>
  )
}
