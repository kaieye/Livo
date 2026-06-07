import { useState, useEffect, useLayoutEffect } from 'react'
import { expandedCache } from '../utils/entry-caches'

/**
 * Hook for managing social media entry expanded/collapsed state
 * with LRU cache persistence
 *
 * @param entryId - Unique entry identifier
 * @returns Expanded state management
 */
export function useEntryExpanded(entryId: string) {
  const [isOverflow, setIsOverflow] = useState(false)
  const [isExpanded, setIsExpanded] = useState(
    () => expandedCache.get(entryId) ?? false,
  )

  // Reset overflow and expanded state when entry changes
  useLayoutEffect(() => {
    setIsOverflow(false)
    setIsExpanded(expandedCache.get(entryId) ?? false)
  }, [entryId])

  // Sync expanded state to LRU cache for persistence
  useEffect(() => {
    expandedCache.set(entryId, isExpanded)
  }, [isExpanded, entryId])

  return {
    isExpanded,
    setIsExpanded,
    isOverflow,
    setIsOverflow,
  }
}
