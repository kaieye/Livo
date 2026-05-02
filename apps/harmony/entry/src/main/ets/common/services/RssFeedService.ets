/**
 * Public seam for the RSS feed fetching subsystem.
 *
 * The implementation lives in ./rss-feed/ and is split into:
 *   - RssFeedFetcher: HTTP plumbing (RSSHub instance fallback, Nitter fallback)
 *   - RssFeedParser:  RSS/Atom XML and Bilibili dynamic JSON parsing
 *   - RssFeedService: orchestrator (this is what callers use)
 *
 * Callers continue to import RssFeedService and FeedRefreshPayload from this
 * file; the seam stays stable while the implementation can evolve underneath.
 */
export { RssFeedService, FeedRefreshPayload } from './rss-feed/RssFeedService'
