/**
 * Predicate for "is this stored feed the same one the user is configuring?"
 *
 * The match is over six URL pairs because the stored feed URL might equal:
 *   1. the bilibili-mapped URL we'd post on save           (most common)
 *   2. the literal targetUrl the user pasted/clicked
 *   3. the stored feed's siteUrl matching the mapped URL   (different RSSHub instance)
 *   4. the stored feed's siteUrl matching targetUrl
 *   5. the literal targetSiteUrl                            (when targetUrl came from RSSHub but site is canonical)
 *   6. the stored feed's siteUrl matching targetSiteUrl
 *
 * Any one match is enough — they're alternative shapes of the same identity.
 * All comparisons go through `normalizeFeedUrl` to strip trailing slashes
 * and lowercase the scheme/host.
 */

import { Feed } from '../../models/LivoModels'
import { normalizeFeedUrl } from './FeedSubscribeTargetUrl'

export interface FeedMatchTarget {
  targetUrl: string
  mappedTargetUrl: string
  targetSiteUrl: string
}

export function feedMatchesTarget(feed: Feed, target: FeedMatchTarget): boolean {
  const feedUrl = normalizeFeedUrl(feed.url)
  const feedSiteUrl = normalizeFeedUrl(feed.siteUrl || '')
  const targetUrl = normalizeFeedUrl(target.targetUrl)
  const mappedUrl = normalizeFeedUrl(target.mappedTargetUrl)
  const targetSiteUrl = normalizeFeedUrl(target.targetSiteUrl)

  if (feedUrl === mappedUrl) {
    return true
  }
  if (targetUrl && feedUrl === targetUrl) {
    return true
  }
  if (feedSiteUrl && feedSiteUrl === mappedUrl) {
    return true
  }
  if (targetUrl && feedSiteUrl && feedSiteUrl === targetUrl) {
    return true
  }
  if (targetSiteUrl && feedUrl === targetSiteUrl) {
    return true
  }
  if (targetSiteUrl && feedSiteUrl && feedSiteUrl === targetSiteUrl) {
    return true
  }
  return false
}
