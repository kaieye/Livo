import { FeedViewType } from './types/feed'
import type { SettingsTabId } from './settings-schema'

export type DeepLinkAction =
  | { type: 'add-feed'; url: string }
  | { type: 'open-entry'; entryId: string }
  | { type: 'open-feed'; feedId: string }
  | { type: 'preview-feed'; url?: string }
  | { type: 'open-search'; query?: string }
  | { type: 'open-starred' }
  | { type: 'open-view'; view: FeedViewType }
  | { type: 'open-settings'; tab?: SettingsTabId }
  | { type: 'import-opml' }
  | { type: 'refresh-all' }
  | { type: 'login'; provider?: string }

const SETTINGS_TABS = new Set<SettingsTabId>([
  'general',
  'appearance',
  'reading',
  'shortcuts',
  'subscriptions',
  'ai',
  'translation',
  'actions',
  'user',
  'accounts',
  'data',
  'privacy',
  'about',
  'refreshLogs',
  'agentPermissions',
  'favorites',
  'fever',
])

const VIEW_TYPES: Record<string, FeedViewType> = {
  articles: FeedViewType.Articles,
  article: FeedViewType.Articles,
  social: FeedViewType.SocialMedia,
  'social-media': FeedViewType.SocialMedia,
  videos: FeedViewType.Videos,
  video: FeedViewType.Videos,
  pictures: FeedViewType.Pictures,
  picture: FeedViewType.Pictures,
  images: FeedViewType.Pictures,
}

function decodeSegment(value: string | undefined): string | null {
  if (!value) return null
  try {
    const decoded = decodeURIComponent(value).trim()
    return decoded || null
  } catch {
    return null
  }
}

function readHttpUrlParam(
  searchParams: URLSearchParams,
  name: string,
): string | null {
  const raw = searchParams.get(name)?.trim()
  if (!raw) return null
  try {
    const parsed = new URL(raw)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed.toString()
      : null
  } catch {
    return null
  }
}

function readSettingsTab(value: string | null): SettingsTabId | undefined {
  if (!value) return undefined
  const normalized = value.trim() as SettingsTabId
  return SETTINGS_TABS.has(normalized) ? normalized : undefined
}

function readViewType(value: string | null): FeedViewType | null {
  if (!value) return null
  return VIEW_TYPES[value.trim().toLowerCase()] ?? null
}

export function parseDeepLink(rawUrl: string): DeepLinkAction | null {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return null
  }

  if (parsed.protocol.toLowerCase() !== 'livo:') return null

  const segments = [
    parsed.hostname,
    ...parsed.pathname.split('/').filter(Boolean),
  ].filter(Boolean)
  const command = decodeSegment(segments[0])?.toLowerCase()
  const firstArg = decodeSegment(segments[1])

  switch (command) {
    case 'add-feed': {
      const url = readHttpUrlParam(parsed.searchParams, 'url')
      return url ? { type: 'add-feed', url } : null
    }
    case 'entry':
      return firstArg ? { type: 'open-entry', entryId: firstArg } : null
    case 'feed':
      return firstArg ? { type: 'open-feed', feedId: firstArg } : null
    case 'discover':
      return {
        type: 'preview-feed',
        url: readHttpUrlParam(parsed.searchParams, 'url') ?? undefined,
      }
    case 'search': {
      const query = parsed.searchParams.get('q')?.trim()
      return { type: 'open-search', query: query || undefined }
    }
    case 'starred':
      return { type: 'open-starred' }
    case 'view': {
      const view = readViewType(firstArg)
      return view === null ? null : { type: 'open-view', view }
    }
    case 'settings':
      return {
        type: 'open-settings',
        tab: readSettingsTab(parsed.searchParams.get('tab')),
      }
    case 'import-opml':
      return { type: 'import-opml' }
    case 'refresh':
      return { type: 'refresh-all' }
    case 'login':
      return { type: 'login', provider: firstArg ?? undefined }
    default:
      return null
  }
}
