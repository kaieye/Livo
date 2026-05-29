import type { ReactNode } from 'react'

/**
 * Framed centered state card used by Discover for empty / loading / error
 * presentations. Shared between the Discover search results panel and
 * `DiscoverPreviewPage` so both surfaces feel continuous.
 *
 * Two layout variants:
 * - `inline` (default): renders with vertical padding (`py-10`) — meant for
 *   embedding inside a vertically-stacked list.
 * - `fill`: stretches to fill its flex parent via `flex-1` — used by the
 *   preview page where the state owns the full main column.
 */
export function DiscoverCenteredState({
  icon,
  title,
  hint,
  action,
  variant = 'inline',
}: {
  icon: ReactNode
  title: string
  hint?: string
  action?: ReactNode
  variant?: 'inline' | 'fill'
}) {
  const wrapperClass =
    variant === 'fill'
      ? 'flex flex-1 items-center justify-center px-6'
      : 'flex w-full items-center justify-center px-6 py-10'
  return (
    <div className={wrapperClass}>
      <div className="max-w-md text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)]">
          {icon}
        </div>
        <p className="text-sm font-medium text-[var(--color-text-primary)]">
          {title}
        </p>
        {hint && (
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-tertiary)]">
            {hint}
          </p>
        )}
        {action && <div className="mt-4 flex justify-center">{action}</div>}
      </div>
    </div>
  )
}
