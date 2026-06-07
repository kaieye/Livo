import { useState, useEffect, useMemo } from 'react'
import {
  normalizeImageCacheKey,
  extractPixnoyOriginUrl,
} from '../utils/entry-media'

/**
 * Hook for managing avatar image with automatic fallback to candidate URLs
 * when loading fails
 *
 * @param entryId - Unique entry identifier for state reset
 * @param primaryAvatar - Primary avatar URL candidate (or array of candidates)
 * @returns Avatar state and error handler
 */
export function useEntryAvatar(
  entryId: string,
  primaryAvatar: string | string[],
) {
  // Build unique avatar candidates
  const avatarCandidates = useMemo(() => {
    const candidates = Array.isArray(primaryAvatar)
      ? primaryAvatar
      : [primaryAvatar, extractPixnoyOriginUrl(primaryAvatar)]

    const unique: string[] = []
    for (const c of candidates) {
      const candidate = (c || '').trim()
      if (!candidate || !/^https?:\/\//i.test(candidate)) continue
      const key = normalizeImageCacheKey(candidate)
      if (unique.some((u) => normalizeImageCacheKey(u) === key)) continue
      unique.push(candidate)
    }
    return unique
  }, [primaryAvatar])

  const [avatarCandidateIndex, setAvatarCandidateIndex] = useState(0)
  const [avatarImageFailed, setAvatarImageFailed] = useState(false)

  // Reset state when entry or candidates change
  useEffect(() => {
    setAvatarCandidateIndex(0)
    setAvatarImageFailed(false)
  }, [entryId, avatarCandidates])

  const avatarUrl = avatarCandidates[avatarCandidateIndex] || ''

  /**
   * Handle avatar image load error - try next candidate or mark as failed
   */
  const handleAvatarError = () => {
    const nextIndex = avatarCandidateIndex + 1
    if (nextIndex < avatarCandidates.length) {
      setAvatarCandidateIndex(nextIndex)
      return
    }
    setAvatarImageFailed(true)
  }

  return {
    avatarUrl,
    avatarImageFailed,
    handleAvatarError,
  }
}
