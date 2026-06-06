import type { FeedWithCount } from '../../../shared/types'

export type FeedRefreshIssueTranslator = (
  key: string,
  options?: Record<string, string>,
) => string

export const FEED_REFRESH_FAILURE_BADGE_GRACE_MS = 60 * 60 * 1000

export function getFeedRefreshIssueLabel(
  feed: Pick<
    FeedWithCount,
    'lastRefreshStatus' | 'lastRefreshError' | 'lastRefreshAttemptedAt'
  >,
  t: FeedRefreshIssueTranslator,
  showErrorBadge?: boolean,
  now = Date.now(),
): string | null {
  if (feed.lastRefreshStatus !== 'failed') return null
  if (showErrorBadge === false) return null
  if (
    feed.lastRefreshAttemptedAt != null &&
    now - feed.lastRefreshAttemptedAt < FEED_REFRESH_FAILURE_BADGE_GRACE_MS
  ) {
    return null
  }
  const error = feed.lastRefreshError?.trim()
  return error
    ? t('sidebar.feedRefreshFailed', { error })
    : t('sidebar.feedRefreshFailedFallback')
}
