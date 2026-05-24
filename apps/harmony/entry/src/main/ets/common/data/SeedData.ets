import {
  DEFAULT_HARMONY_SETTINGS,
  Entry,
  Feed,
  FeedViewType,
  HarmonySettings,
} from '../models/LivoModels'
import seedFeedsData from './discover-builtin-feeds/seed-feeds.json'

interface SeedFeedJson {
  id: string
  title: string
  url: string
  siteUrl: string
  imageUrl?: string
  description: string
  category: string
  view: string
  createdDaysAgo: number
}

function resolveViewType(view: string): FeedViewType {
  switch (view) {
    case 'articles':
      return FeedViewType.Articles
    case 'social':
      return FeedViewType.SocialMedia
    case 'pictures':
      return FeedViewType.Pictures
    case 'videos':
      return FeedViewType.Videos
    default:
      return FeedViewType.Articles
  }
}

function buildSeedFeed(json: SeedFeedJson): Feed {
  const timestamp = Date.now() - json.createdDaysAgo * 24 * 60 * 60 * 1000
  const feed: Feed = {
    id: json.id,
    title: json.title,
    url: json.url,
    siteUrl: json.siteUrl,
    description: json.description,
    category: json.category,
    view: resolveViewType(json.view),
    showInAll: true,
    lastFetched: 0,
    etag: '',
    lastModified: '',
    errorCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  if (json.imageUrl && json.imageUrl.length > 0) {
    feed.imageUrl = json.imageUrl
  }
  return feed
}

export const SEED_FEEDS: Feed[] = seedFeedsData.feeds.map((item) => buildSeedFeed(item as SeedFeedJson))

export const SEED_ENTRIES: Entry[] = []

export function seedSettings(): HarmonySettings {
  return {
    autoRefresh: DEFAULT_HARMONY_SETTINGS.autoRefresh,
    aiSummaryEnabled: DEFAULT_HARMONY_SETTINGS.aiSummaryEnabled,
    aiSummaryAutoTrigger: DEFAULT_HARMONY_SETTINGS.aiSummaryAutoTrigger,
    aiTranslationEnabled: DEFAULT_HARMONY_SETTINGS.aiTranslationEnabled,
    aiTranslationLanguage: DEFAULT_HARMONY_SETTINGS.aiTranslationLanguage,
    aiTranslationAutoTrigger: DEFAULT_HARMONY_SETTINGS.aiTranslationAutoTrigger,
    imageProxyEnabled: DEFAULT_HARMONY_SETTINGS.imageProxyEnabled,
    searchAllHomeCategories: DEFAULT_HARMONY_SETTINGS.searchAllHomeCategories,
    refreshIntervalMinutes: DEFAULT_HARMONY_SETTINGS.refreshIntervalMinutes,
    themeMode: DEFAULT_HARMONY_SETTINGS.themeMode,
    themeAccent: DEFAULT_HARMONY_SETTINGS.themeAccent,
    language: DEFAULT_HARMONY_SETTINGS.language,
    remoteFeedUrl: DEFAULT_HARMONY_SETTINGS.remoteFeedUrl,
    showUnreadDot: DEFAULT_HARMONY_SETTINGS.showUnreadDot,
  }
}
