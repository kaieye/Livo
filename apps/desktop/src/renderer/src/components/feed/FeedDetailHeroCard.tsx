import { useState, useMemo, useCallback } from 'react'
import { Rss } from 'lucide-react'
import {
  buildFeedDetailHeroAvatarCandidates,
  fallbackLabel,
} from '../../lib/feed-detail-hero-avatar'

interface FeedDetailHeroCardProps {
  title: string
  imageUrl?: string | null
  url?: string
  siteUrl?: string | null
  description?: string | null
  category?: string | null
  unreadLabel?: string
  viewLabel?: string
  feedUrl?: string
}

/**
 * FeedDetailHeroCard — a large centered hero card for the feed detail page.
 *
 * Mirrors Harmony's `FeedDetailHeroCard`:
 * - 88px avatar with multi-candidate fallback (feed image → unavatar.io → favicon)
 * - Prominent centered title (text-2xl font-bold)
 * - Optional description, meta badges, and feed URL
 */
export function FeedDetailHeroCard({
  title,
  imageUrl,
  url,
  siteUrl,
  description,
  category,
  unreadLabel,
  viewLabel,
  feedUrl: _feedUrl,
}: FeedDetailHeroCardProps) {
  const candidates = useMemo(
    () =>
      buildFeedDetailHeroAvatarCandidates({
        imageUrl,
        url,
        siteUrl,
        title,
      }),
    [imageUrl, url, siteUrl, title],
  )

  const [candidateIndex, setCandidateIndex] = useState(0)
  const [hasError, setHasError] = useState(false)

  const currentUrl =
    candidateIndex < candidates.length ? candidates[candidateIndex] : ''
  const exhausted = candidateIndex >= candidates.length
  const label = fallbackLabel(title)

  const handleError = useCallback(() => {
    if (candidateIndex + 1 < candidates.length) {
      setCandidateIndex((prev) => prev + 1)
    } else {
      setHasError(true)
    }
  }, [candidateIndex, candidates.length])

  const displayTitle = title || url || ''

  return (
    <div className="w-full rounded-[28px] bg-[var(--color-bg-secondary)] px-5 py-6">
      <div className="flex flex-col items-center gap-3.5">
        {/* Avatar — 88px */}
        {currentUrl && !exhausted && !hasError ? (
          <img
            src={currentUrl}
            alt=""
            onError={handleError}
            className="h-[88px] w-[88px] flex-shrink-0 rounded-[26px] bg-[var(--color-bg-tertiary)] object-cover shadow-sm"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-[88px] w-[88px] flex-shrink-0 items-center justify-center rounded-[26px] bg-[var(--color-accent)] shadow-sm"
          >
            <span className="text-[28px] font-bold text-white">{label}</span>
          </div>
        )}

        {/* Title */}
        <h2 className="line-clamp-2 max-w-full text-center text-2xl font-bold leading-tight text-[var(--color-text-primary)]">
          {displayTitle}
        </h2>

        {/* Meta badges */}
        {(viewLabel || unreadLabel || category) && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {viewLabel && (
              <span className="inline-flex items-center rounded-md bg-[var(--color-bg-tertiary)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
                {viewLabel}
              </span>
            )}
            {unreadLabel && (
              <span className="text-xs text-[var(--color-text-tertiary)]">
                {unreadLabel}
              </span>
            )}
            {category && (
              <span className="inline-flex items-center rounded-md bg-[var(--color-bg-tertiary)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
                {category}
              </span>
            )}
          </div>
        )}

        {/* Description */}
        {description && (
          <p className="line-clamp-3 max-w-prose text-center text-sm leading-relaxed text-[var(--color-text-tertiary)]">
            {description}
          </p>
        )}

        {/* Feed URL */}
        {(url || siteUrl) && (
          <div className="flex min-w-0 items-center gap-1.5">
            <Rss
              size={12}
              aria-hidden="true"
              className="flex-shrink-0 text-[var(--color-text-tertiary)]"
            />
            <span className="truncate text-xs text-[var(--color-text-tertiary)]">
              {url || siteUrl || ''}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
