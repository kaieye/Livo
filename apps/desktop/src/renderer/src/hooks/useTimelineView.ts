import { useCallback, useEffect, useMemo, useState, type RefObject, type UIEvent } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"

import type { Entry } from "../../../shared/types"
import { groupEntriesByDate } from "../lib/date-groups"
import { LRUCache } from "../lib/lru-cache"

const SOCIAL_INITIAL_RENDER_COUNT = 24
const SOCIAL_RENDER_BATCH = 80
const TIMELINE_CACHE_CAPACITY = 6

const timelineOffsetCache = new LRUCache<string, number>(TIMELINE_CACHE_CAPACITY)
const timelineMeasurementsCache = new LRUCache<string, unknown[]>(TIMELINE_CACHE_CAPACITY)

export function useTimelineView({
  enabled,
  entries,
  groupByDate,
  scrollElementRef,
  cacheKey,
}: {
  enabled: boolean
  entries: Entry[]
  groupByDate: boolean
  scrollElementRef: RefObject<HTMLElement | null>
  cacheKey: string
}) {
  const [renderLimit, setRenderLimit] = useState(SOCIAL_INITIAL_RENDER_COUNT)
  const shouldUseVirtualTimeline = enabled && !groupByDate

  const renderedEntries = useMemo(() => {
    if (!enabled || shouldUseVirtualTimeline) return entries
    return entries.slice(0, renderLimit)
  }, [enabled, entries, renderLimit, shouldUseVirtualTimeline])

  const groupedEntries = useMemo(
    () => groupByDate ? groupEntriesByDate(renderedEntries) : [],
    [groupByDate, renderedEntries],
  )

  useEffect(() => {
    if (!enabled || shouldUseVirtualTimeline) return
    setRenderLimit(SOCIAL_INITIAL_RENDER_COUNT)
  }, [enabled, shouldUseVirtualTimeline, entries])

  const handleScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    if (!enabled || shouldUseVirtualTimeline) return
    if (renderLimit >= entries.length) return
    const el = e.currentTarget
    const hasScrolledEnough = el.scrollTop > 120
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 800
    if (!nearBottom || !hasScrolledEnough) return
    setRenderLimit((prev) => Math.min(prev + SOCIAL_RENDER_BATCH, entries.length))
  }, [enabled, entries.length, renderLimit, shouldUseVirtualTimeline])

  const virtualizer = useVirtualizer({
    count: shouldUseVirtualTimeline ? entries.length : 0,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => 560,
    overscan: 2,
    getItemKey: (index) => entries[index]?.id ?? index,
    initialOffset: shouldUseVirtualTimeline ? (timelineOffsetCache.get(cacheKey) ?? 0) : 0,
    initialMeasurementsCache: shouldUseVirtualTimeline ? (timelineMeasurementsCache.get(cacheKey) as never[] | undefined) ?? [] : [],
    onChange: (instance) => {
      if (!shouldUseVirtualTimeline || instance.isScrolling) return
      timelineOffsetCache.set(cacheKey, instance.scrollOffset ?? 0)
      const measurements = (instance as { measurementsCache?: unknown[] }).measurementsCache
      if (measurements?.length) {
        timelineMeasurementsCache.set(cacheKey, measurements)
      }
    },
  })

  return {
    shouldUseVirtualTimeline,
    renderedEntries,
    groupedEntries,
    virtualizer,
    virtualItems: virtualizer.getVirtualItems(),
    handleScroll,
  }
}
