import { assertNetworkFetchUrl } from '../system/network-url-policy'

/**
 * Discovery-side URL safety guard.
 *
 * Discovery probes (YouTube / X / Bilibili / Instagram scrapers, profile
 * resolvers, platform-search) must never reach loopback or private-network
 * addresses — user-supplied queries and scraped profile URLs are untrusted.
 * This wrapper pins that policy: it calls `assertNetworkFetchUrl` with the
 * strict default (no `allowLoopback`, no `allowPrivateNetwork`) so the
 * "discovery is public-only" invariant lives in one named place rather than
 * being implicit-by-omission at 13 call sites.
 *
 * If discovery ever needs to relax this (e.g. allow a private RSSHub
 * instance), do it here — callers stay call-site-identical.
 */
export function assertPublicDiscoveryUrl(rawUrl: string): Promise<string> {
  return assertNetworkFetchUrl(rawUrl)
}
