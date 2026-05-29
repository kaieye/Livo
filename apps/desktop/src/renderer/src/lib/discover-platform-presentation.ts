/**
 * Platform presentation helpers for the Discover surface.
 *
 * Mirrors `apps/harmony/.../DiscoverCandidatePresentation.ets:platformColor()` so the
 * desktop UI uses the same palette as Harmony. Keep these two in sync when adding
 * new platforms.
 */

export type DiscoverPlatformId =
  | 'youtube'
  | 'bilibili'
  | 'x'
  | 'instagram'
  | 'nitter'
  | 'rsshub'
  | 'rss'

export interface DiscoverPlatformBadge {
  id: DiscoverPlatformId
  /** Short uppercased label shown inside the badge pill. */
  label: string
  /** Background color (matches Harmony palette). */
  color: string
}

/**
 * Infer a platform identity from a feed URL. Order matches Harmony's hostname
 * detection — Nitter is checked before generic RSSHub because nitter instances
 * also serve `*.rss` paths but with a distinct host.
 *
 * Note: this helper does NOT carry account/sign-in metadata. Today only
 * YouTube is gated by the backend (`discover-handlers.ts`); callers express
 * that policy explicitly at the call site (e.g. checking `platform.id ===
 * 'youtube'` alongside `useAccountStatusQuery('youtube')`). When the backend
 * adds a `requiresAccount` flag to `discover:search` results, prefer
 * threading that through instead of re-introducing platform-keyed gating
 * here.
 */
export function inferDiscoverPlatform(url: string): DiscoverPlatformBadge {
  const lower = (url || '').toLowerCase()

  if (/\/youtube\//i.test(lower) || /(^|\.)youtube\.com\//i.test(lower)) {
    return {
      id: 'youtube',
      label: 'YouTube',
      color: '#FF3B30',
    }
  }
  if (
    /\/bilibili\//i.test(lower) ||
    /(^|\.)bilibili\.com\//i.test(lower) ||
    /\/b23\.tv\//i.test(lower)
  ) {
    return {
      id: 'bilibili',
      label: 'Bilibili',
      color: '#00A1D6',
    }
  }
  if (/\/(?:twitter|x)\/user\//i.test(lower)) {
    return {
      id: 'x',
      label: 'X',
      color: '#111111',
    }
  }
  if (
    /(^|\.)nitter\./i.test(lower) ||
    /\/nitter\//i.test(lower) ||
    /\/twiiit\.com\//i.test(lower)
  ) {
    return {
      id: 'nitter',
      label: 'Nitter',
      color: '#475569',
    }
  }
  if (
    /\/instagram\//i.test(lower) ||
    /\/picnob(?:\.info)?\//i.test(lower) ||
    /\/pixnoy\//i.test(lower) ||
    /\/piokok\//i.test(lower) ||
    /\/imginn\//i.test(lower)
  ) {
    return {
      id: 'instagram',
      label: 'Instagram',
      color: '#E1306C',
    }
  }
  if (/(^|\.)rsshub\.|\/rsshub\.|\/api\/rsshub/i.test(lower)) {
    return {
      id: 'rsshub',
      label: 'RSSHub',
      color: '#2563EB',
    }
  }
  return {
    id: 'rss',
    label: 'RSS',
    color: '#16A34A',
  }
}
