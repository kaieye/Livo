import { useVirtualizer } from '@tanstack/react-virtual'
import type { VirtualItem } from '@tanstack/react-virtual'
import type { RefObject } from 'react'
import type { Entry } from '../../../../../../shared/types'
import type { EntryListSocialRow } from '../../../../lib/entry-list-model'
import { LRUCache } from '../../../../lib/lru-cache'

export interface LinearVirtualizerConfig {
  entries: Entry[]
  scrollElement: RefObject<HTMLDivElement | null>
  cacheKey?: string
}

export interface GridVirtualizerConfig {
  gridRows: Entry[][]
  scrollElement: RefObject<HTMLDivElement | null>
  cacheKey?: string
}

export interface SocialVirtualizerConfig {
  socialRows: EntryListSocialRow[]
  scrollElement: RefObject<HTMLDivElement | null>
  cacheKey?: string
}

const VIRTUALIZER_CACHE_CAPACITY = 8
const offsetCache = new LRUCache<string, number>(VIRTUALIZER_CACHE_CAPACITY)
const measurementsCache = new LRUCache<string, VirtualItem[]>(
  VIRTUALIZER_CACHE_CAPACITY,
)

/**
 * Hook for linear list virtualization
 */
export function useLinearVirtualizer({
  entries,
  scrollElement,
  cacheKey = 'linear',
}: LinearVirtualizerConfig) {
  return useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollElement.current,
    estimateSize: () => 180,
    overscan: 8,
    initialOffset: offsetCache.get(cacheKey) ?? 0,
    initialMeasurementsCache: measurementsCache.get(cacheKey) ?? [],
    getItemKey: (index) => entries[index]?.id ?? index,
    onChange: (instance) => {
      if (instance.isScrolling) return
      offsetCache.set(cacheKey, instance.scrollOffset ?? 0)
      measurementsCache.set(cacheKey, instance.measurementsCache)
    },
  })
}

/**
 * Hook for grid layout virtualization
 */
export function useGridVirtualizer({
  gridRows,
  scrollElement,
  cacheKey = 'grid',
}: GridVirtualizerConfig) {
  return useVirtualizer({
    count: gridRows.length,
    getScrollElement: () => scrollElement.current,
    estimateSize: () => 280,
    overscan: 3,
    initialOffset: offsetCache.get(cacheKey) ?? 0,
    initialMeasurementsCache: measurementsCache.get(cacheKey) ?? [],
    getItemKey: (index) =>
      gridRows[index]?.map((entry) => entry.id).join(':') ?? index,
    onChange: (instance) => {
      if (instance.isScrolling) return
      offsetCache.set(cacheKey, instance.scrollOffset ?? 0)
      measurementsCache.set(cacheKey, instance.measurementsCache)
    },
  })
}

/**
 * Hook for social media timeline virtualization
 */
export function useSocialVirtualizer({
  socialRows,
  scrollElement,
  cacheKey = 'social',
}: SocialVirtualizerConfig) {
  return useVirtualizer({
    count: socialRows.length,
    getScrollElement: () => scrollElement.current,
    estimateSize: (index) => (socialRows[index]?.type === 'header' ? 40 : 420),
    overscan: 3,
    initialOffset: offsetCache.get(cacheKey) ?? 0,
    initialMeasurementsCache: measurementsCache.get(cacheKey) ?? [],
    getItemKey: (index) => socialRows[index]?.key ?? index,
    onChange: (instance) => {
      if (instance.isScrolling) return
      offsetCache.set(cacheKey, instance.scrollOffset ?? 0)
      measurementsCache.set(cacheKey, instance.measurementsCache)
    },
  })
}
