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
          <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary h-8 w-8 rounded-full" />
        </div>
        {/* Content */}
        <div className="ml-2 min-w-0 flex-1 space-y-2">
          {/* Author line */}
          <div className="flex items-center gap-2">
            <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary h-4 w-24 rounded" />
            <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary h-3 w-16 rounded" />
            <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary h-3 w-12 rounded" />
          </div>
          {/* Text content lines */}
          <div className="space-y-1.5">
            <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary h-3.5 w-full rounded" />
            <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary h-3.5 w-[85%] rounded" />
            <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary h-3.5 w-[70%] rounded" />
          </div>
          {/* Media placeholder */}
          <div className="mt-3 flex gap-2">
            <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary h-24 flex-1 rounded-lg" />
            <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary h-24 flex-1 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Article list item skeleton */
export function ArticleItemSkeleton() {
  return (
    <div className="border-surface-secondary dark:border-surface-dark-tertiary w-full animate-pulse border-b px-4 py-3.5">
      <div className="flex items-start gap-3">
        <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary mt-1.5 h-2 w-2 flex-shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary h-3 w-20 rounded" />
            <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary h-3 w-12 rounded" />
          </div>
          <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary h-4 w-[80%] rounded" />
          <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary h-3.5 w-full rounded" />
          <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary h-3.5 w-[60%] rounded" />
        </div>
        <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary h-20 w-20 flex-shrink-0 rounded-lg" />
      </div>
    </div>
  )
}

/** Grid card skeleton for media/video views */
export function GridCardSkeleton() {
  return (
    <div className="bg-surface-secondary dark:bg-surface-dark-secondary animate-pulse overflow-hidden rounded-xl">
      <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary aspect-[4/3]" />
      <div className="space-y-1.5 p-2">
        <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary h-3 w-[70%] rounded" />
        <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary h-2.5 w-[40%] rounded" />
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
