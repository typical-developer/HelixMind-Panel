'use client'

import * as React from 'react'
import * as ToastPrimitives from '@radix-ui/react-toast'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

const ToastProvider = ToastPrimitives.Provider

/**
 * Bottom-right, above the status bar.
 *
 * The stock viewport pinned toasts to the top on small screens, where they
 * covered the title bar and its search field. The workbench has a fixed 24px
 * status strip along the bottom, so the stack is inset above it and stays in
 * one corner at every width.
 *
 * `pointer-events-none!` is load-bearing, and the `!` is the whole point.
 *
 * Radix sets `pointerEvents: hasToasts ? undefined : 'none'` as an *inline
 * style* on this element, so the moment one toast exists the viewport — a
 * full-width box with 36px of bottom padding — starts accepting clicks. It
 * sits directly over the status bar, so a visible toast made the console
 * toggle and every status item unclickable. A plain class loses to an inline
 * style; an important one does not. Individual toasts opt back in through
 * `pointer-events-auto` on `Toast` below, which still wins: `!important`
 * raises specificity on this element, not on its children.
 */
const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      'pointer-events-none! fixed right-0 bottom-0 z-[100] flex max-h-screen w-full max-w-[26rem] flex-col gap-2 p-3 pb-9 sm:max-w-[24rem]',
      className,
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

/**
 * One neutral surface for every severity.
 *
 * The stock `destructive` variant drew a solid red panel, louder than anything
 * else in this interface. That was replaced by a coloured rule down the leading
 * edge — quieter, but still a second mark saying what the icon already says,
 * and the green edge on every routine "done" was the most repeated splash of
 * colour in the app. `Toaster` renders a per-severity icon, which carries the
 * meaning without tinting the container; a toast should read as a message, not
 * as a status light.
 *
 * `variant` stays in the API — it still selects that icon.
 */
const toastVariants = cva(
  cn(
    'group pointer-events-auto relative flex w-full items-start gap-2.5 overflow-hidden rounded-md border py-2.5 pr-8 pl-3',
    'border-border bg-[var(--wb-overlay)] text-foreground shadow-[var(--shadow-menu)]',
    'transition-all',
    'data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none',
    'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-2 data-[state=open]:fade-in-0',
    'data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full',
    'data-[swipe=end]:animate-out',
  ),
  {
    variants: {
      // `destructive` keeps its marker class: ToastAction and ToastClose style
      // themselves off it via `group-[.destructive]`.
      variant: {
        default: '',
        success: '',
        warning: '',
        destructive: 'destructive',
        info: '',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

/**
 * The undo affordance. Sized to the workbench's 24px control height rather than
 * the stock 32px so a toast stays two lines tall.
 */
const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      'inline-flex h-6 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-border bg-transparent px-2 text-xs font-medium',
      'transition-colors hover:bg-[var(--wb-active)] hover:text-foreground',
      'focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none',
      'disabled:pointer-events-none disabled:opacity-50',
      className,
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      'absolute top-2 right-2 flex size-5 cursor-pointer items-center justify-center rounded-sm text-muted-foreground',
      'opacity-0 transition-opacity hover:bg-[var(--wb-active)] hover:text-foreground',
      'group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none',
      className,
    )}
    toast-close=""
    aria-label="Dismiss"
    {...props}
  >
    <X className="size-3.5" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn('text-sm font-medium text-foreground', className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn('text-xs leading-relaxed text-muted-foreground', className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

/** The severities a caller may ask for. */
export type ToastVariant = NonNullable<
  VariantProps<typeof toastVariants>['variant']
>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}
