'use client'

import * as React from 'react'
import { GripVerticalIcon } from 'lucide-react'
import * as ResizablePrimitive from 'react-resizable-panels'

import { cn } from '@/lib/utils'

/**
 * Thin wrappers over react-resizable-panels v4.
 *
 * v4 renamed the primitives (`PanelGroup` → `Group`, `PanelResizeHandle` →
 * `Separator`) and swapped `direction` for `orientation`.
 *
 * It also stopped emitting the attribute the old styles keyed off. v2 put
 * `data-panel-group-direction` on both group and handle; v4 sets the group's
 * `flex-direction` inline and marks only the separator, with `aria-orientation`
 * — so the orientation-dependent rules below select on that instead. Note the
 * ARIA sense is perpendicular to the group's: a *horizontal* group is divided
 * by a *vertical* separator.
 */
function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Group>) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      // Direction comes from the library's own inline style; this only needs to
      // guarantee the box fills its parent.
      className={cn('flex h-full w-full', className)}
      {...props}
    />
  )
}

function ResizablePanel({
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Panel>) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Separator> & {
  withHandle?: boolean
}) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        'bg-border focus-visible:ring-ring relative flex items-center justify-center',
        // Default: a vertical separator dividing a horizontal group. The visual
        // line stays 1px; the generous hit area lives in ::after.
        'w-px after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2',
        // A horizontal separator divides a vertical group — flip both the line
        // and its hit area onto the other axis.
        'aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full',
        'aria-[orientation=horizontal]:after:inset-x-0 aria-[orientation=horizontal]:after:inset-y-auto',
        'aria-[orientation=horizontal]:after:top-1/2 aria-[orientation=horizontal]:after:left-0',
        'aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full',
        'aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2',
        'focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden',
        '[&[aria-orientation=horizontal]>div]:rotate-90',
        className,
      )}
      {...props}
    >
      {withHandle && (
        <div className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border">
          <GripVerticalIcon className="size-2.5" />
        </div>
      )}
    </ResizablePrimitive.Separator>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
