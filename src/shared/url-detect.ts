/**
 * Unified Instagram / mirror URL detection.
 *
 * Single source of truth for "is this URL related to Instagram or one of its
 * mirror-proxy sites?" — replaces 37+ inline regex / string-includes checks
 * scattered across the codebase.
 */

// ── Mirror hostnames ─────────────────────────────────────────────────────────
// All known mirror domains + CDN subdomain patterns.
const MIRROR_HOST_RE =
  /(?:^|\.)((?:picnob(?:\.info)?|pixnoy|piokok|pixwox)\.com|(?:picnob|pixnoy|piokok|pixwox)\.[^/]+)$/i
const MIRROR_CDN_RE =
  /^(?:media\.(?:picnob|pixnoy|piokok|pixwox)|sp\d+\.pixnoy)\.[^/]+$/i

// ── Instagram feed URL patterns ──────────────────────────────────────────────
// Matches any URL containing instagram / mirror keywords.
const INSTAGRAM_FEED_RE = /instagram|picnob(?:\.info)?|pixnoy|piokok|pixwox/i

// Matches user-route paths like /instagram/user/... or /picnob/user/...
const INSTAGRAM_USER_ROUTE_RE =
  /(?:^|\/)(?:instagram|picnob(?:\.info)?|pixnoy|piokok|pixwox)\/user\//i

// ── Public API ───────────────────────────────────────────────────────────────

/** Does `hostname` belong to a known Instagram mirror site (including CDN)? */
export function isMirrorHost(hostname: string): boolean {
  const lower = hostname.toLowerCase()
  return MIRROR_CDN_RE.test(lower) || MIRROR_HOST_RE.test(lower)
}

/**
 * Does `url` point to a mirror CDN image (media.*.com, spN.pixnoy.com) or
 * carry an ig_cache_key parameter?
 */
export function isMirrorMediaUrl(url: string): boolean {
  return (
    /^https?:\/\/media\.(?:picnob|pixnoy|piokok|pixwox)\.[^/]+\//i.test(url) ||
    /^https?:\/\/sp\d+\.pixnoy\.[^/]+\//i.test(url) ||
    url.includes('ig_cache_key=')
  )
}

/**
 * Broad check: does `url` reference Instagram or any mirror site at all?
 * Use for gating Instagram-specific behaviour (avatar expiry, backoff, etc.).
 */
export function isInstagramFeedUrl(url: string): boolean {
  return INSTAGRAM_FEED_RE.test(url)
}

/**
 * Does `url` point to a user feed route (/user/ path segment)?
 * Used for view-type detection and feed-route classification.
 */
export function isInstagramUserFeedUrl(url: string): boolean {
  return INSTAGRAM_USER_ROUTE_RE.test(url)
}

/**
 * Broader proxy check: hostname contains a mirror keyword OR the full URL
 * matches a known mirror media pattern.  Use when checking arbitrary
 * user-supplied URLs that may be proxied.
 */
export function isMirrorProxyUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (
      host.includes('picnob') ||
      host.includes('pixnoy') ||
      host.includes('pixwox') ||
      host.includes('piokok')
    ) {
      return true
    }
  } catch {
    // not a valid URL — fall through to media check
  }
  return isMirrorMediaUrl(url)
}
