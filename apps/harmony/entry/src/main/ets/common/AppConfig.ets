/**
 * Centralized application configuration
 * Contains all hardcoded instances, APIs, timeouts, and other app-wide settings
 */

// ==============================================================================
// Video Resolution Services
// ==============================================================================

/**
 * Primary Invidious instances for YouTube playback resolution
 * Used to fetch playable video streams when direct access fails
 */
export const INVIDIOUS_INSTANCES: string[] = [
  'https://inv.tux.pizza',
  'https://invidious.privacyredirect.com',
  'https://invidious.nerdvpn.de',
  'https://iv.nbooo.com',
  'https://invidious.protokolla.fi',
  'https://yewtu.be',
  'https://inv.nadeko.net',
  'https://invidious.fdn.fr',
]

/**
 * Primary Piped instances for YouTube playback resolution
 * Alternative to Invidious for YouTube video resolution
 */
export const PIPED_INSTANCES: string[] = [
  'https://pipedapi.kavin.rocks',
  'https://piped-api.privacy.com.de',
  'https://api.piped.projectsegfau.lt',
]

// ==============================================================================
// Social Media Instances
// ==============================================================================

/**
 * Default Nitter instance for Twitter/X content
 * Used for RSS feed generation from X/Twitter sources
 */
export const DEFAULT_NITTER_INSTANCE = 'https://nitter.net'

/**
 * Fallback Nitter instances for user/profile searching
 * Tried in order when primary instance fails
 */
export const FALLBACK_NITTER_INSTANCES = [
  'https://nitter.net',
]

/**
 * Default RSSHub instance
 * Used for transforming website content to RSS feeds
 */
export const DEFAULT_RSSHUB_INSTANCE = 'https://rsshub.pseudoyu.com'

/**
 * RSSHub instances for route fallback
 * Ordered by default priority
 */
export const RSSHUB_INSTANCES: string[] = [
  'https://rsshub.pseudoyu.com',
  'https://rsshub.rssforever.com',
]

// ==============================================================================
// Network Timeouts (milliseconds)
// ==============================================================================

/**
 * Timeout for direct YouTube playback fetch
 * If video resolution takes longer, falls back to Invidious/Piped
 */
export const DIRECT_PLAYBACK_TIMEOUT_MS = 7000

/**
 * Connection timeout for HTTP requests
 * Prevents hanging on unresponsive servers
 */
export const REQUEST_CONNECT_TIMEOUT_MS = 3500

/**
 * Read timeout for HTTP request responses
 * Prevents slow downloads from blocking the app
 */
export const REQUEST_READ_TIMEOUT_MS = 4500

/**
 * Shared desktop browser user agent
 */
export const DESKTOP_BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

/**
 * Basic browser user agent for generic HTTP fetches
 */
export const BASIC_BROWSER_USER_AGENT = 'Mozilla/5.0'

/**
 * Mobile browser user agent used for mobile-web authenticated endpoints
 */
export const MOBILE_BROWSER_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36'

/**
 * Shared accept-language header for generic web requests
 */
export const DEFAULT_ACCEPT_LANGUAGE = 'zh-CN,zh;q=0.9,en;q=0.8'

/**
 * Shared accept-language header for RSS requests
 */
export const RSS_ACCEPT_LANGUAGE = 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7'

/**
 * Timeout for Instagram profile search operations
 * Adjusts for the typically slower Instagram API
 */
export const INSTAGRAM_SEARCH_TIMEOUT_MS = 3500

/**
 * Default timeout for generic RSS requests
 */
export const RSS_REQUEST_TIMEOUT_MS = 15000

/**
 * Timeout for RSSHub route requests
 */
export const RSSHUB_REQUEST_TIMEOUT_MS = 3000

/**
 * Timeout for Instagram/Picnob RSSHub route requests
 */
export const RSSHUB_INSTAGRAM_REQUEST_TIMEOUT_MS = 8000

/**
 * Shared short timeout for fast remote probes
 */
export const SHORT_REQUEST_TIMEOUT_MS = 5000

/**
 * Shared medium timeout for common remote requests
 */
export const MEDIUM_REQUEST_TIMEOUT_MS = 8000

/**
 * Shared long timeout for heavier remote requests
 */
export const LONG_REQUEST_TIMEOUT_MS = 10000

/**
 * Shared AI request connection timeout
 */
export const AI_REQUEST_CONNECT_TIMEOUT_MS = 10000

/**
 * Shared AI request read timeout
 */
export const AI_REQUEST_READ_TIMEOUT_MS = 20000

/**
 * Shared accept header for generic JSON APIs
 */
export const ACCEPT_JSON = 'application/json, text/plain, */*'

/**
 * Shared accept header for generic HTML pages
 */
export const ACCEPT_HTML = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'

/**
 * Shared accept header for text/html fallback pages
 */
export const ACCEPT_TEXT_OR_HTML = 'text/plain,text/html;q=0.9,*/*;q=0.8'

/**
 * Shared accept header for RSS/Atom/XML content
 */
export const ACCEPT_RSS_XML = 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, */*'

/**
 * Shared accept header for generic file download
 */
export const ACCEPT_ANY = '*/*'

/**
 * Shared Bilibili web referer and origin
 */
export const BILIBILI_REFERER = 'https://www.bilibili.com/'
export const BILIBILI_ORIGIN = 'https://www.bilibili.com'

/**
 * Build Bilibili space referer by uid
 */
export function bilibiliSpaceReferer(uid: string): string {
  return `https://space.bilibili.com/${encodeURIComponent(uid)}`
}

/**
 * Shared Instagram web referer
 */
export const INSTAGRAM_REFERER = 'https://www.instagram.com/'

/**
 * Shared Instagram web app id header value
 */
export const INSTAGRAM_APP_ID = '936619743392459'
