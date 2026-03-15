/**
 * Skeleton loading components.
 * Provides skeleton placeholders for social media items, article items, grid cards, etc.
 */

/** Social media timeline item skeleton. */
export function SocialMediaItemSkeleton() {
  return (
    <div className="max-w-[clamp(45ch,60vw,65ch)] mx-auto pl-4 pr-3">
      <div className="flex py-4 animate-pulse">
        {/* Avatar */}
        <div className="flex-shrink-0 mt-1">
          <div className="w-8 h-8 rounded-full bg-surface-tertiary dark:bg-surface-dark-tertiary" />
        </div>
        {/* Content */}
        <div className="ml-2 flex-1 min-w-0 space-y-2">
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
          <div className="flex gap-2 mt-3">
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
    <div className="w-full px-4 py-3.5 border-b border-surface-secondary dark:border-surface-dark-tertiary animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-2 h-2 rounded-full bg-surface-tertiary dark:bg-surface-dark-tertiary flex-shrink-0 mt-1.5" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="h-3 w-20 rounded bg-surface-tertiary dark:bg-surface-dark-tertiary" />
            <div className="h-3 w-12 rounded bg-surface-tertiary dark:bg-surface-dark-tertiary" />
          </div>
          <div className="h-4 w-[80%] rounded bg-surface-tertiary dark:bg-surface-dark-tertiary" />
          <div className="h-3.5 w-full rounded bg-surface-tertiary dark:bg-surface-dark-tertiary" />
          <div className="h-3.5 w-[60%] rounded bg-surface-tertiary dark:bg-surface-dark-tertiary" />
        </div>
        <div className="w-20 h-20 flex-shrink-0 rounded-lg bg-surface-tertiary dark:bg-surface-dark-tertiary" />
      </div>
    </div>
  )
}

/** Grid card skeleton for media/video views */
export function GridCardSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden bg-surface-secondary dark:bg-surface-dark-secondary animate-pulse">
      <div className="aspect-[4/3] bg-surface-tertiary dark:bg-surface-dark-tertiary" />
      <div className="p-2 space-y-1.5">
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
  type: "social" | "article" | "grid"
}) {
  const Component =
    type === "social"
      ? SocialMediaItemSkeleton
      : type === "grid"
        ? GridCardSkeleton
        : ArticleItemSkeleton

  if (type === "grid") {
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
