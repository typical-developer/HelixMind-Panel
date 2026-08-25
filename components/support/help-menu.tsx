"use client"

import * as React from "react"
import { BookOpen, Bug, HelpCircle, Info, Keyboard } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { APP_NAME, APP_VERSION, SUPPORT_EMAIL } from "@/lib/app-info"
import { useWorkbench } from "@/components/workbench"

import { useSupport } from "./support-provider"

/**
 * Help, on the rail.
 *
 * The panel had no route to support of any kind: no way to report a problem,
 * no list of what the keyboard does outside the Settings view, and nothing
 * naming the build you were running. This is the one place all three live.
 */
export function HelpMenu() {
  const { openReport, openAbout, aboutOpen, setAboutOpen } = useSupport()
  const { openPalette, setActivity } = useWorkbench()

  return (
    <>
      {/* No tooltip on this trigger, deliberately.
          `TooltipTrigger asChild` wrapping `DropdownMenuTrigger asChild` has
          both primitives cloning props onto the same node, and with the
          provider's zero-delay tooltip the hover-open re-render lands between
          pointerdown and pointerup — so the menu sometimes simply refused to
          open. The account button beside this one has never had the problem
          because it never had the wrapper; the title attribute carries the
          label instead. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Help and support"
            title="Help and support"
            className={cn(
              "flex size-12 shrink-0 cursor-pointer items-center justify-center",
              "text-muted-foreground transition-colors duration-100",
              "hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none focus-visible:ring-inset",
            )}
          >
            <HelpCircle className="size-5 transition-transform duration-150 active:scale-90" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent side="right" align="end" className="w-60">
          <DropdownMenuLabel>Help</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => openReport()}
            className="cursor-pointer gap-2"
          >
            <Bug className="size-3.5" />
            Report a problem
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => openPalette("?")}
            className="cursor-pointer gap-2"
          >
            <BookOpen className="size-3.5" />
            Search help
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setActivity("preferences")}
            className="cursor-pointer gap-2"
          >
            <Keyboard className="size-3.5" />
            Keyboard shortcuts
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={openAbout} className="cursor-pointer gap-2">
            <Info className="size-3.5" />
            About {APP_NAME}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </>
  )
}

/**
 * What this build is, and what it is honest about.
 *
 * The last section is deliberate: several controls in the lab are still
 * decorative, and a user who has just been surprised by one deserves to find
 * that out from the app rather than from a support thread.
 */
function AboutDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">{APP_NAME}</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            Version {APP_VERSION}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
          <p>
            A genomic analysis bench: FASTA parsing and variant calling,
            generational mutation dynamics, population growth under
            environmental stress, and rule-based resistance prediction.
          </p>

          <div className="space-y-1.5 rounded-md border border-border p-3">
            <p className="font-medium text-foreground/85">Where your data lives</p>
            <p>
              Analyses run in this browser. Runs, notifications, layout and
              history are stored locally and never uploaded. Only sign-in talks
              to a server.
            </p>
            <p>
              {/* The archive changed what "stored locally" means: it is no
                  longer only labels and layout, it is results, including
                  sequence previews. Someone sharing a machine deserves to know
                  that from the app. */}
              Finished runs also keep their results — parameters, findings and a
              preview of the sequence — so you can reopen them from{" "}
              <span className="text-foreground/85">Activity</span>. They stay on
              this device. Clear them from Settings → Danger zone.
            </p>
          </div>

          <div className="space-y-1.5 rounded-md border border-warning/30 p-3">
            <p className="font-medium text-warning">Known limitations</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>
                A run stops when you leave the analysis that started it — runs do
                not continue in the background.
              </li>
              <li>
                In the Growth Lab, the strain you pick is displayed but does not
                yet drive the model.
              </li>
              <li>
                In the Mutation Simulator, pH, nutrients and oxygen are recorded
                but do not yet affect mutation rate.
              </li>
              <li>
                In the Resistance Predictor, the organism flags unexpected
                markers but does not change the score.
              </li>
              <li>
                Resistance calls score marker <em>presence</em> against a curated
                table. Presence is not phenotype, and no breakpoint standard
                (EUCAST or CLSI) is applied — this is not a susceptibility
                report.
              </li>
              <li>Password reset is not available — contact support.</li>
            </ul>
          </div>

          <p>
            Support:{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-foreground underline underline-offset-2"
            >
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
