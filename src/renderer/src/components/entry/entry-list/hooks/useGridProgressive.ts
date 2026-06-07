import { useState, useEffect, useRef } from 'react'
import type { Entry } from '../../../../../../shared/types'
import type { FeedViewType } from '../../../../../../shared/types'

export interface GridProgressiveConfig {
  renderEntries: Entry[]
  isGridMode: boolean
  activeView: FeedViewType | null
  selectedFeedId: string | null
  initialCount?: number
  loadMoreCount?: number
}

export interface GridProgressiveResult {
  visibleCount: number
  hasMore: boolean
  loadMore: () => void
  reset: () => void
}

const DEFAULT_INITIAL_COUNT = 40
const DEFAULT_LOAD_MORE_COUNT = 40

/**
 * Hook for progressive grid rendering
 * Manages visible entry count and load-more logic
 */
export function useGridProgressive({
  renderEntries,
  isGridMode,
  activeView,
  selectedFeedId,
  initialCount = DEFAULT_INITIAL_COUNT,
  loadMoreCount = DEFAULT_LOAD_MORE_COUNT,
}: GridProgressiveConfig): GridProgressiveResult {
  const [visibleCount, setVisibleCount] = useState(initialCount)

  // Reset visible count when entries change (feed/view switch)
  const entriesKeyRef = useRef('')
  const entriesKey = isGridMode
    ? `${activeView}:${selectedFeedId ?? ''}:${renderEntries.length}`
    : ''

  useEffect(() => {
    if (entriesKey !== entriesKeyRef.current) {
      entriesKeyRef.current = entriesKey
      setVisibleCount(initialCount)
    }
  }, [entriesKey, initialCount])

  const hasMore = visibleCount < renderEntries.length

  const loadMore = () => {
    setVisibleCount((prev) =>
      Math.min(prev + loadMoreCount, renderEntries.length),
    )
  }

  const reset = () => {
    setVisibleCount(initialCount)
  }

  return {
    visibleCount,
    hasMore,
    loadMore,
    reset,
  }
}
