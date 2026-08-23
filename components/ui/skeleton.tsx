import { cn } from '@/lib/utils'

/**
 * A placeholder bar or block.
 *
 * `delay` staggers its sheen (in ms) so a group of skeletons animates in
 * sequence instead of strobing in unison.
 */
function Skeleton({
  className,
  delay = 0,
  style,
  ...props
}: React.ComponentProps<'div'> & { delay?: number }) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn('sk', className)}
      style={{ ...style, ['--sk-delay' as string]: `${delay}ms` }}
      {...props}
    />
  )
}

export { Skeleton }
