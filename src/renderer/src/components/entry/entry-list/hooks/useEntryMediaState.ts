import { useState, useEffect } from 'react'
import { mediaExpandedCache } from '../utils/entry-caches'

/**
 * Hook for managing media (images/videos) expanded state
 * with LRU cache persistence
 *
 * @param entryId - Unique entry identifier
 * @returns Media expanded state management
 */
export function useEntryMediaState(entryId: string) {
  const [isMediaExpanded, setIsMediaExpanded] = useState(
    () => mediaExpandedCache.get(entryId) ?? false,
  )

  // Sync media expanded state to LRU cache for persistence
  useEffect(() => {
    mediaExpandedCache.set(entryId, isMediaExpanded)
  }, [entryId, isMediaExpanded])

  return {
    isMediaExpanded,
    setIsMediaExpanded,
  }
}
