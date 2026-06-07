import { useVirtualizer } from '@tanstack/react-virtual'
import type { RefObject } from 'react'
import type { Entry } from '../../../../../../shared/types'
import type { EntryListSocialRow } from '../../../../lib/entry-list-model'

export interface LinearVirtualizerConfig {
  entries: Entry[]
  scrollElement: RefObject<HTMLDivElement | null>
}

export interface GridVirtualizerConfig {
  gridRows: Entry[][]
  scrollElement: RefObject<HTMLDivElement | null>
}

export interface SocialVirtualizerConfig {
  socialRows: EntryListSocialRow[]
  scrollElement: RefObject<HTMLDivElement | null>
}

/**
 * Hook for linear list virtualization
 */
export function useLinearVirtualizer({
  entries,
  scrollElement,
}: LinearVirtualizerConfig) {
  return useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollElement.current,
    estimateSize: () => 180,
    overscan: 8,
    getItemKey: (index) => entries[index]?.id ?? index,
  })
}

/**
 * Hook for grid layout virtualization
 */
export function useGridVirtualizer({
  gridRows,
  scrollElement,
}: GridVirtualizerConfig) {
  return useVirtualizer({
    count: gridRows.length,
    getScrollElement: () => scrollElement.current,
    estimateSize: () => 280,
    overscan: 3,
    getItemKey: (index) =>
      gridRows[index]?.map((entry) => entry.id).join(':') ?? index,
  })
}

/**
 * Hook for social media timeline virtualization
 */
export function useSocialVirtualizer({
  socialRows,
  scrollElement,
}: SocialVirtualizerConfig) {
  return useVirtualizer({
    count: socialRows.length,
    getScrollElement: () => scrollElement.current,
    estimateSize: (index) => (socialRows[index]?.type === 'header' ? 40 : 420),
    overscan: 3,
    getItemKey: (index) => socialRows[index]?.key ?? index,
  })
}
