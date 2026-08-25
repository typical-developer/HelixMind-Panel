'use client'

import {
  AlertCircle,
  CheckCircle2,
  Info,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'

import { useToast } from '@/hooks/use-toast'
import { RowIcon } from '@/components/workbench/primitives'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast'

/**
 * Severity gets an icon as well as the accent rule, so the meaning does not
 * rest on colour alone — the panel's warning amber and success green are close
 * enough in luminance to be hard to tell apart with a colour vision deficiency.
 */
const VARIANT_ICON: Record<string, { Icon: LucideIcon; className: string }> = {
  success: { Icon: CheckCircle2, className: 'text-success' },
  warning: { Icon: TriangleAlert, className: 'text-warning' },
  destructive: { Icon: AlertCircle, className: 'text-destructive' },
  info: { Icon: Info, className: 'text-info' },
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider swipeDirection="right">
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const glyph = variant ? VARIANT_ICON[variant] : undefined

        return (
          <Toast key={id} variant={variant} {...props}>
            {/*
              The last place in the app hand-rolling its own icon offset, and it
              had both faults at once: `mt-0.5` was a pixel low even under the
              rule it was written for, and that rule pinned the glyph to the
              title while the description sat below it — so on the two-line
              toasts this app actually raises, the icon rode high in the corner.
            */}
            {glyph && (
              <RowIcon icon={glyph.Icon} size="4" className={glyph.className} />
            )}
            <div className="grid min-w-0 flex-1 gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
