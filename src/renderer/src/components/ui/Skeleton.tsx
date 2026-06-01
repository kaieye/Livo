/**
 * Skeleton loading components.
 * Provides skeleton placeholders for social media items, article items, grid cards, etc.
 */

/** Social media timeline item skeleton. */
export function SocialMediaItemSkeleton() {
  return (
    <div className="mx-auto max-w-[clamp(45ch,60vw,65ch)] pl-4 pr-3">
      <div className="flex animate-pulse py-4">
        {/* Avatar */}
        <div className="mt-1 flex-shrink-0">
          <div className="h-8 w-8 rounded-full bg-surface-tertiary dark:bg-surface-dark-tertiary" />
        </div>
        {/* Content */}
        <div className="ml-2 min-w-0 flex-1 space-y-2">
          {/* Author line */}
          <div className="flex items-center gap-2">
            <div className="h-4 w-24 rounded bg-surface-tertiary dark:bg-surface-dark-tertiary" />
            <div className="h-3 w-16 rounded bg-surface-tertiary dark:bg-surface-dark-tertiary" />
            <div className="h-3 w-12 rounded bg-surface-tertiary dark:bg-surface-dark-tertiary" />
          </div>
          {/* Text content lines */}
          <div className="space-y-1.5">
            <div className="h-3.5 w-full rounded bg-surface-tertiary dark:bg-surface-dark-tertiary" />
            <div className="h-3.5 w-[85%] rounded bg-surface-tertiary dark:bg-surface-dark-tertiary" />
            <div className="h-3.5 w-[70%] rounded bg-surface-tertiary dark:bg-surface-dark-tertiary" />
          </div>
          {/* Media placeholder */}
          <div className="mt-3 flex gap-2">
            <div className="h-24 flex-1 rounded-lg bg-surface-tertiary dark:bg-surface-dark-tertiary" />
            <div className="h-24 flex-1 rounded-lg bg-surface-tertiary dark:bg-surface-dark-tertiary" />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Article list item skeleton */
export function ArticleItemSkeleton() {
  return (
    <div className="w-full animate-pulse border-b border-surface-secondary px-4 py-3.5 dark:border-surface-dark-tertiary">
      <div className="flex items-start gap-3">
        <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-surface-tertiary dark:bg-surface-dark-tertiary" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="h-3 w-20 rounded bg-surface-tertiary dark:bg-surface-dark-tertiary" />
            <div className="h-3 w-12 rounded bg-surface-tertiary dark:bg-surface-dark-tertiary" />
          </div>
          <div className="h-4 w-[80%] rounded bg-surface-tertiary dark:bg-surface-dark-tertiary" />
          <div className="h-3.5 w-full rounded bg-surface-tertiary dark:bg-surface-dark-tertiary" />
          <div className="h-3.5 w-[60%] rounded bg-surface-tertiary dark:bg-surface-dark-tertiary" />
        </div>
        <div className="h-20 w-20 flex-shrink-0 rounded-lg bg-surface-tertiary dark:bg-surface-dark-tertiary" />
      </div>
    </div>
  )
}

/** Grid card skeleton for media/video views */
export function GridCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl bg-surface-secondary dark:bg-surface-dark-secondary">
      <div className="aspect-[4/3] bg-surface-tertiary dark:bg-surface-dark-tertiary" />
      <div className="space-y-1.5 p-2">
        <div className="h-3 w-[70%] rounded bg-surface-tertiary dark:bg-surface-dark-tertiary" />
        <div className="h-2.5 w-[40%] rounded bg-surface-tertiary dark:bg-surface-dark-tertiary" />
      </div>
    </div>
  )
}

/** Render skeleton rows for a given count */
export function SkeletonList({
  count,
  type,
}: {
  count: number
  type: 'social' | 'article' | 'grid'
}) {
  const Component =
    type === 'social'
      ? SocialMediaItemSkeleton
      : type === 'grid'
        ? GridCardSkeleton
        : ArticleItemSkeleton

  if (type === 'grid') {
    return (
      <div className="grid grid-cols-2 gap-1.5">
        {Array.from({ length: count }).map((_, i) => (
          <Component key={i} />
        ))}
      </div>
    )
  }

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Component key={i} />
      ))}
    </>
  )
}
