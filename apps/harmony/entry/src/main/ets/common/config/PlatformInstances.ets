/**
 * Platform-specific instances and referer configuration.
 */

// ── Invidious instances (YouTube playback resolution) ──

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

// ── Piped instances (YouTube playback resolution) ──

export const PIPED_INSTANCES: string[] = [
  'https://pipedapi.kavin.rocks',
  'https://piped-api.privacy.com.de',
  'https://api.piped.projectsegfau.lt',
]

// ── Nitter instances (Twitter/X RSS feed generation) ──

export const DEFAULT_NITTER_INSTANCE = 'https://nitter.net'

export const FALLBACK_NITTER_INSTANCES = [
  'https://nitter.net',
]

// ── RSSHub instances ──

export const DEFAULT_RSSHUB_INSTANCE = 'https://rsshub.pseudoyu.com'

export const RSSHUB_INSTANCES: string[] = [
  'https://rsshub.pseudoyu.com',
  'https://rsshub.rssforever.com',
]

// ── Bilibili ──

export const BILIBILI_REFERER = 'https://www.bilibili.com/'
export const BILIBILI_ORIGIN = 'https://www.bilibili.com'

export function bilibiliSpaceReferer(uid: string): string {
  return `https://space.bilibili.com/${encodeURIComponent(uid)}`
}

// ── Instagram ──

export const INSTAGRAM_REFERER = 'https://www.instagram.com/'
export const INSTAGRAM_APP_ID = '936619743392459'
