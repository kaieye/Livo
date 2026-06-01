import { useEffect, useRef } from 'react'
import type { FeedWithCount } from '../../../shared/types'
import { useFeedStore } from '../store/feed-store'
import {
  isSubscriptionFeedAvatarHydratable,
  buildSubscriptionPlatformAvatarCandidates,
  scoreStoredFeedImage,
  SUBSCRIPTIONS_AVATAR_HYDRATION_LIMIT,
  HYDRATION_GAP_MS,
} from '../lib/subscriptions-avatar-hydration'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Build a composite key that uniquely identifies a feed candidate for hydration.
 */
function feedHydrationKey(
  feed: Pick<FeedWithCount, 'url' | 'siteUrl'>,
): string {
  const url = (feed.url || '').trim()
  const siteUrl = (feed.siteUrl || '').trim()
  return `${url}|${siteUrl}`
}

/**
 * Hook that pre-resolves avatars for social-media feeds in the subscriptions
 * list. Runs once per mount (tracked by feed URL → siteUrl composite key).
 *
 * Strategy:
 * 1. Filter feeds that are hydratable (social platforms: Instagram, X, YouTube, Bilibili)
 * 2. Limit to `SUBSCRIPTIONS_AVATAR_HYDRATION_LIMIT` feeds per run (12)
 * 3. For each, construct unavatar.io candidate URLs and pick the best one
 * 4. Update the feed's `imageUrl` if the candidate is better than the current one
 * 5. Serial execution with `HYDRATION_GAP_MS` gap to avoid rate-limiting
 */
export function useSubscriptionsAvatarHydration(feeds: FeedWithCount[]) {
  const hydratedRef = useRef<Set<string>>(new Set())
  const runningRef = useRef(false)

  useEffect(() => {
    if (runningRef.current) return
    if (feeds.length === 0) return

    const hydratable = feeds.filter((feed) => {
      const key = feedHydrationKey(feed)
      if (hydratedRef.current.has(key)) return false
      return isSubscriptionFeedAvatarHydratable(feed)
    })

    if (hydratable.length === 0) return

    const targets = hydratable.slice(0, SUBSCRIPTIONS_AVATAR_HYDRATION_LIMIT)
    runningRef.current = true

    const run = async () => {
      const { updateFeed } = useFeedStore.getState()

      for (const feed of targets) {
        const key = feedHydrationKey(feed)
        hydratedRef.current.add(key)

        const currentScore = scoreStoredFeedImage(feed.imageUrl || '')

        // Build platform-avatar candidates
        const candidates = buildSubscriptionPlatformAvatarCandidates(
          feed.url,
          feed.siteUrl || '',
        )

        // Pick the best candidate (first unavatar URL with score > current)
        let bestCandidate: string | null = null
        let bestScore = currentScore
        for (const candidate of candidates) {
          const score = scoreStoredFeedImage(candidate)
          if (score > bestScore) {
            bestScore = score
            bestCandidate = candidate
          }
        }

        // Try main-process resolution for Instagram/Bilibili (deeper than unavatar)
        if (bestScore < 3) {
          try {
            // Use unavatar as a reasonable avatar when no better source available
            if (bestCandidate && bestScore > currentScore) {
              await updateFeed(feed.id, {
                imageUrl: bestCandidate,
              })
            }
          } catch {
            // Silently skip individual hydration failures.
          }
        } else if (bestCandidate && bestScore > currentScore) {
          try {
            await updateFeed(feed.id, {
              imageUrl: bestCandidate,
            })
          } catch {
            // Silently skip.
          }
        }

        // Gap between resolutions
        if (targets.indexOf(feed) < targets.length - 1) {
          await delay(HYDRATION_GAP_MS)
        }
      }

      runningRef.current = false
    }

    void run()
  }, [feeds])
}
