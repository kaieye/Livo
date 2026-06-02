import {
  lazy,
  Suspense,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  useLayoutEffect,
  memo,
  type SyntheticEvent,
  type UIEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { useVirtualizer } from '@tanstack/react-virtual'
import { openExternalUrlSafe } from '../../services/external-url'
import { useEntryStore } from '../../store/entry-store'
import { useFeedStore } from '../../store/feed-store'
import {
  useGeneralSettingKey,
  useGeneralSettingsShallowSelector,
  useTranslationSettingKey,
} from '../../store/settings-store'
import { FeedViewType, VIEW_DEFINITIONS } from '../../../../shared/types'
import { VIEW_TYPE_I18N_KEYS } from '../../lib/view-type-keys'
import { RECOMMENDED_CATEGORY } from '../../hooks/useInitRecommendedFeeds'
import { SkeletonList } from '../ui/Skeleton'
import { QueuedImage } from '../ui/QueuedImage'
import { HomeInlineSearch } from './HomeInlineSearch'
import {
  ContextMenu,
  useEntryContextMenu,
  useEntryContextActions,
} from '../ui/ContextMenu'
import { VideoPlayer, pauseInlineVideos } from '../ui/VideoPlayer'
import { blurhashToAverageColor } from '../../lib/blurhash'
import {
  getImageProxyFallbackUrls,
  getThumbnailUrl,
} from '../../lib/image-proxy'
import { groupEntriesByDate } from '../../lib/date-groups'
import { useAsyncSocialDedupe } from '../../hooks/useAsyncSocialDedupe'
import {
  canonicalizeSocialUrl,
  normalizeSocialHandle,
} from '../../lib/social-url'
import { LRUCache } from '../../lib/lru-cache'
import { getEntryLoadLimit } from '../../lib/entry-load-limit'
import { useHomeFeedCoordinator } from '../../hooks/useHomeFeedCoordinator'
import { formatDistanceToNow } from 'date-fns'
import { getDateLocale } from '../../lib/date-locale'
import {
  isRedundantRichText,
  normalizeLooseText,
  splitHtmlIntoParagraphs,
} from '../../lib/entry-text'
import {
  decodeHtmlEntitiesUrl,
  decodeMediaUrl,
  extractIgCacheKeyFromUrl,
  hasTinyDecorativeDimensions,
  isDecorativeSocialImageUrl,
} from '../../lib/entry-media-url'
import {
  cleanSocialPlainText,
  cleanSocialTextHtml,
  extractImagesFromHtml,
  extractPixnoyOriginUrl,
  getPhotoDedupeKey,
  getPhotoDedupeKeys,
  isGenericInstagramIconUrl,
  isLikelyImageByUrl,
  isRenderableVideoMediaItem,
  normalizeInstagramUnavatar,
  resolveEntryBrowserOpenUrl,
  withCacheBust,
} from '../../lib/social-entry-utils'
import {
  CheckCheck,
  Star,
  Loader2,
  Inbox,
  Play,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  MoreHorizontal,
  Eye,
  EyeOff,
  Globe,
  Languages,
  Sparkles,
} from 'lucide-react'
import type { Entry } from '../../../../shared/types'
import type { MediaItem } from '../../../../shared/types'
import { ViewRecommendations } from './ViewRecommendations'
import StarToggle from '../ui/StarToggle'

const SharePoster = lazy(() =>
  import('../ui/SharePoster').then((module) => ({
    default: module.SharePoster,
  })),
)

const SOCIAL_LIST_SCROLL_GUARD_PX = 120
const SOCIAL_LIST_LOAD_MORE_BOTTOM_OFFSET_PX = 260

/** Return a copy of the media item with decoded URLs.
 *  previewUrl is intentionally kept as-is (only HTML-entity decoded) so that
 *  mirror/proxy URLs (e.g. picnob/pixnoy) survive for rendering.
 *  decodeMediaUrl would unwrap them to expiring CDN URLs. */
function decodeMediaUrls(m: MediaItem): MediaItem {
  return {
    ...m,
    url: decodeMediaUrl(m.url),
    previewUrl: m.previewUrl
      ? decodeHtmlEntitiesUrl(m.previewUrl)
      : m.previewUrl,
  }
}

// LRU cache for expanded state of social media items
const expandedCache = new LRUCache<string, boolean>(200)
const mediaExpandedCache = new LRUCache<string, boolean>(200)
const tweetTranslationCache = new LRUCache<string, string[]>(100)
const tweetSummaryCache = new LRUCache<string, string>(100)
const MEDIA_SRC_CACHE_STORAGE_KEY = 'livo-picture-src-cache-v4'
const mediaSrcCache = new Map<string, string>()
let mediaSrcCacheLoaded = false
let mediaSrcCacheSaveTimer: number | null = null

function normalizeImageCacheKey(url: string): string {
  const raw = (url || '').trim()
  if (!raw) return ''
  try {
    const u = new URL(raw)
    // Keep query string: many image providers encode real media identity in search params.
    // Stripping query causes cross-entry collisions and wrong image reuse.
    const query = u.search || ''
    u.hash = ''
    return `${u.origin}${u.pathname}${query}`
  } catch {
    return raw.split('#')[0] || raw
  }
}

function getPhotoVariantQualityScore(photo: {
  url: string
  previewUrl?: string
}): number {
  const rawUrl = decodeMediaUrl(photo.url || '')
  const rawPreview = decodeMediaUrl(photo.previewUrl || '')
  const target = rawUrl || rawPreview
  if (!target) return 0

  let score = 0
  const lower = target.toLowerCase()
  if (extractIgCacheKeyFromUrl(rawUrl) || extractIgCacheKeyFromUrl(rawPreview))
    score += 12
  if (lower.includes('oh=') && lower.includes('oe=')) score += 8
  if (lower.includes('&_nc_') || lower.includes('?_nc_')) score += 5
  if (/cdninstagram|scontent\.|fbcdn\.net/.test(lower)) score += 4
  if (rawPreview) score += 2
  score += Math.min(target.length, 2000) / 2000
  return score
}

function dedupeGalleryPhotoVariants(
  photos: Array<{
    url: string
    previewUrl?: string
    width?: number
    height?: number
    blurhash?: string
  }>,
) {
  const kept = new Map<
    string,
    {
      photo: {
        url: string
        previewUrl?: string
        width?: number
        height?: number
        blurhash?: string
      }
      score: number
      order: number
    }
  >()
  const fallback = new Map<
    string,
    {
      photo: {
        url: string
        previewUrl?: string
        width?: number
        height?: number
        blurhash?: string
      }
      score: number
      order: number
    }
  >()

  const register = (
    map: Map<
      string,
      {
        photo: {
          url: string
          previewUrl?: string
          width?: number
          height?: number
          blurhash?: string
        }
        score: number
        order: number
      }
    >,
    key: string,
    payload: {
      photo: {
        url: string
        previewUrl?: string
        width?: number
        height?: number
        blurhash?: string
      }
      score: number
      order: number
    },
  ) => {
    const existing = map.get(key)
    if (
      !existing ||
      payload.score > existing.score ||
      (payload.score === existing.score && payload.order < existing.order)
    ) {
      map.set(key, payload)
    }
  }

  for (let index = 0; index < photos.length; index += 1) {
    const photo = photos[index]
    const keys = getPhotoDedupeKeys(photo.url || '', photo.previewUrl || '')
    const payload = {
      photo,
      score: getPhotoVariantQualityScore(photo),
      order: index,
    }
    if (keys.length === 0) {
      const fallbackKey =
        normalizeImageCacheKey(
          decodeMediaUrl(photo.url || photo.previewUrl || ''),
        ) || `idx:${index}`
      register(fallback, fallbackKey, payload)
      continue
    }
    for (const key of keys) register(kept, key, payload)
  }

  const merged = [...kept.values(), ...fallback.values()].sort(
    (a, b) => a.order - b.order,
  )

  const unique: Array<{
    url: string
    previewUrl?: string
    width?: number
    height?: number
    blurhash?: string
  }> = []
  const seenOrders = new Set<number>()
  for (const entry of merged) {
    if (seenOrders.has(entry.order)) continue
    seenOrders.add(entry.order)
    unique.push(entry.photo)
  }

  return unique
}

function isInstagramLikeGalleryPhoto(photo: {
  url: string
  previewUrl?: string
}): boolean {
  const candidate = decodeMediaUrl(
    photo.url || photo.previewUrl || '',
  ).toLowerCase()
  if (!candidate) return false
  return (
    candidate.includes('ig_cache_key=') ||
    /cdninstagram|scontent\.|fbcdn\.net|media\.(?:picnob|pixnoy|piokok|pixwox)\./i.test(
      candidate,
    )
  )
}

function ensuremediaSrcCacheLoaded(): void {
  if (mediaSrcCacheLoaded || typeof window === 'undefined') return
  mediaSrcCacheLoaded = true
  try {
    const raw = window.localStorage.getItem(MEDIA_SRC_CACHE_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, string>
    for (const [k, v] of Object.entries(parsed || {})) {
      if (k && v) mediaSrcCache.set(k, v)
    }
  } catch {
    // Ignore malformed cache.
  }
}

function persistmediaSrcCache(): void {
  if (typeof window === 'undefined') return
  if (mediaSrcCacheSaveTimer) window.clearTimeout(mediaSrcCacheSaveTimer)
  mediaSrcCacheSaveTimer = window.setTimeout(() => {
    try {
      const maxEntries = 1500
      const entries = Array.from(mediaSrcCache.entries())
      const sliced =
        entries.length > maxEntries
          ? entries.slice(entries.length - maxEntries)
          : entries
      const obj = Object.fromEntries(sliced)
      window.localStorage.setItem(
        MEDIA_SRC_CACHE_STORAGE_KEY,
        JSON.stringify(obj),
      )
    } catch {
      // Ignore storage failures.
    }
  }, 200)
}

function buildMediaFallbackCandidates(
  primaryUrl: string,
  coverUrl: string,
  mirrorOriginUrl: string,
): string[] {
  const proxyFallbacks = getImageProxyFallbackUrls(
    mirrorOriginUrl || coverUrl || primaryUrl,
    {
      width: 1280,
      quality: 85,
      format: 'jpg',
    },
  )
  const candidates = [
    primaryUrl,
    coverUrl,
    mirrorOriginUrl,
    ...proxyFallbacks,
  ].filter(Boolean)
  // For Instagram CDN URLs without a working mirror origin, reconstruct a mirror
  // proxy URL so expired signed CDN URLs can still be served via the mirror cache.
  const seedForMirror = mirrorOriginUrl || coverUrl || primaryUrl
  if (
    seedForMirror &&
    /cdninstagram\.com|fbcdn\.net|scontent\./i.test(seedForMirror)
  ) {
    const mirrorProxy = `https://media.pixnoy.com/get?url=${encodeURIComponent(seedForMirror)}`
    candidates.push(mirrorProxy)
  }
  const unique: string[] = []
  for (const url of candidates) {
    if (!/^https?:\/\//i.test(url)) continue
    const normalized = normalizeImageCacheKey(url)
    if (
      !normalized ||
      unique.some((existing) => normalizeImageCacheKey(existing) === normalized)
    )
      continue
    unique.push(url)
  }
  return unique
}

function advanceCardImageFallback(
  e: SyntheticEvent<HTMLImageElement>,
  seedUrl: string,
  onExhausted?: (img: HTMLImageElement) => void,
  previewUrl?: string,
): void {
  const img = e.currentTarget
  const normalizedSeed = decodeMediaUrl(seedUrl || '')
  const originFromMirror =
    extractPixnoyOriginUrl(seedUrl) || extractPixnoyOriginUrl(normalizedSeed)
  const candidates = buildMediaFallbackCandidates(
    img.currentSrc || img.src || normalizedSeed,
    normalizedSeed || seedUrl,
    originFromMirror,
  )
  // Keep the raw (non-normalized) mirror/proxy URL as a fallback.
  // normalizePicnobImageUrl() unwraps mirror proxy URLs (picnob/pixnoy) to direct
  // CDN URLs, but the mirror can still serve images when signed CDN URLs have expired.
  const rawDecoded = decodeHtmlEntitiesUrl(seedUrl || '')
  if (
    rawDecoded &&
    rawDecoded !== normalizedSeed &&
    /^https?:\/\//i.test(rawDecoded)
  ) {
    const rawKey = normalizeImageCacheKey(rawDecoded)
    if (
      rawKey &&
      !candidates.some((c) => normalizeImageCacheKey(c) === rawKey)
    ) {
      candidates.splice(1, 0, rawDecoded)
    }
  }
  // Also try previewUrl (may hold the original mirror proxy URL preserved during feed parsing).
  if (previewUrl) {
    const decodedPreview = decodeMediaUrl(previewUrl)
    for (const pUrl of [previewUrl, decodedPreview]) {
      if (pUrl && /^https?:\/\//i.test(pUrl)) {
        const pKey = normalizeImageCacheKey(pUrl)
        if (
          pKey &&
          !candidates.some((c) => normalizeImageCacheKey(c) === pKey)
        ) {
          candidates.splice(1, 0, pUrl)
          // Also add proxy-wrapped mirror URL as a candidate
          const mirrorProxyFallbacks = getImageProxyFallbackUrls(pUrl, {
            width: 1280,
            quality: 85,
            format: 'jpg',
          })
          for (const mpUrl of mirrorProxyFallbacks) {
            const mpKey = normalizeImageCacheKey(mpUrl)
            if (
              mpKey &&
              !candidates.some((c) => normalizeImageCacheKey(c) === mpKey)
            ) {
              candidates.push(mpUrl)
            }
          }
        }
      }
    }
  }
  const currentKey = normalizeImageCacheKey(img.currentSrc || img.src || '')
  const currentIdx = candidates.findIndex(
    (candidate) => normalizeImageCacheKey(candidate) === currentKey,
  )
  const nextIdx = currentIdx >= 0 ? currentIdx + 1 : 1
  if (nextIdx < candidates.length) {
    img.dataset.fallbackIndex = String(nextIdx)
    img.src = withCacheBust(candidates[nextIdx])
    return
  }
  onExhausted?.(img)
}

function getRememberedMediaSrc(coverUrl: string, primaryUrl: string): string {
  ensuremediaSrcCacheLoaded()
  const byUrl = mediaSrcCache.get(`url:${normalizeImageCacheKey(coverUrl)}`)
  if (byUrl) {
    if (/^https?:\/\/media\.(picnob|pixnoy)\.[^/]+\/get\?/i.test(byUrl)) {
      mediaSrcCache.delete(`url:${normalizeImageCacheKey(coverUrl)}`)
    } else {
      return byUrl
    }
  }
  return primaryUrl
}

function rememberMediaSrc(coverUrl: string, resolvedSrc: string): void {
  const src = (resolvedSrc || '').trim()
  if (!src) return
  ensuremediaSrcCacheLoaded()
  const urlKey = normalizeImageCacheKey(coverUrl)
  if (urlKey) mediaSrcCache.set(`url:${urlKey}`, src)
  persistmediaSrcCache()
}

/** Return true when the plain-text summary adds no information beyond the title. */
function isSummaryRedundant(title: string, summary: string): boolean {
  return isRedundantRichText(title, summary)
}

function hasVideoMedia(entry: Entry): boolean {
  if (
    (entry.media || []).some(
      (m) => m.type === 'video' && isRenderableVideoMediaItem(m),
    )
  )
    return true
  const html = `${entry.content || ''}\n${entry.summary || ''}`
  return /<video\b/i.test(html)
}

function countRenderableImages(entry: Entry): number {
  const keys = new Set<string>()
  for (const media of entry.media || []) {
    const preview = decodeMediaUrl(media.previewUrl || '')
    const primary = decodeMediaUrl(media.url || '')
    if (preview && isLikelyImageByUrl(preview))
      keys.add(normalizeImageCacheKey(preview))
    if (primary && isLikelyImageByUrl(primary))
      keys.add(normalizeImageCacheKey(primary))
  }
  const imageUrl = decodeMediaUrl(entry.imageUrl || '')
  if (imageUrl && isLikelyImageByUrl(imageUrl))
    keys.add(normalizeImageCacheKey(imageUrl))
  for (const img of extractImagesFromHtml(
    entry.content || entry.summary || '',
  )) {
    const decoded = decodeMediaUrl(img)
    if (decoded && isLikelyImageByUrl(decoded))
      keys.add(normalizeImageCacheKey(decoded))
  }
  return keys.size
}

function collectEntryPostHints(entry: Entry): Set<string> {
  const hints = new Set<string>()
  const push = (value: string) => {
    const key = (value || '').trim()
    if (key) hints.add(key)
  }
  const html = `${entry.content || ''}\n${entry.summary || ''}`
  const urls = [
    entry.url || '',
    entry.imageUrl || '',
    ...(entry.media || []).flatMap((m) => [m.url || '', m.previewUrl || '']),
    ...extractImagesFromHtml(html),
    ...(html.match(/https?:\/\/[^\s"'<>]+/g) || []),
  ]
    .map((u) => decodeMediaUrl(u))
    .filter(Boolean)

  for (const url of urls) {
    const igCacheKey = extractIgCacheKeyFromUrl(url)
    const base = decodeURIComponent(igCacheKey).split('.')[0] || ''
    if (base) push(`igk:${base}`)
    const shortcode =
      url.match(/instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i)?.[1] || ''
    if (shortcode) push(`igsc:${shortcode}`)
  }

  const textKey = normalizeLooseText(
    `${entry.title || ''} ${cleanSocialPlainText(html)}`,
  ).slice(0, 180)
  if (textKey) push(`txt:${textKey}`)
  return hints
}

function areStronglySameSocialPost(a: Entry, b: Entry): boolean {
  if (a.feedId !== b.feedId) return false
  const delta = Math.abs((a.publishedAt || 0) - (b.publishedAt || 0))
  if (delta > 7 * 24 * 60 * 60 * 1000) return false
  const aHints = collectEntryPostHints(a)
  const bHints = collectEntryPostHints(b)
  for (const hint of aHints) {
    if (bHints.has(hint)) return true
  }
  return false
}

function collapseCoverOnlyBeforeVideoEntries(entries: Entry[]): Entry[] {
  if (entries.length <= 1) return entries
  const compacted: Entry[] = []
  const LOOKAHEAD = 8
  for (let i = 0; i < entries.length; i += 1) {
    const current = entries[i]
    const currentIsSingleCover =
      !hasVideoMedia(current) && countRenderableImages(current) === 1
    if (currentIsSingleCover) {
      const upper = Math.min(entries.length - 1, i + LOOKAHEAD)
      let shouldMergeBackward = false
      for (let j = i + 1; j <= upper; j += 1) {
        const candidate = entries[j]
        if (!hasVideoMedia(candidate)) continue
        if (areStronglySameSocialPost(current, candidate)) {
          shouldMergeBackward = true
          break
        }
      }
      if (shouldMergeBackward) continue
    }
    compacted.push(current)
  }
  return compacted
}

/** Clean relative time by stripping verbose locale prefixes like the English "about" prefix. */
function cleanRelativeTime(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date)
  const result = formatDistanceToNow(d, {
    addSuffix: true,
    locale: getDateLocale(),
  })
  // Remove verbose prefixes for cleaner display.
  return result.replace(/^about\s*/gi, '').replace(/^大约\s*/g, '')
}

export function EntryList({ width }: { width?: number }) {
  const coordinator = useHomeFeedCoordinator()
  const {
    entries,
    isLoading,
    isLoadingMore,
    hasMoreEntries,
    loadMoreEntries,
    loadEntries,
    clearListCache,
    viewFeedIds,
    baseFilteredEntries,
    recommendedFeedIds,
    filterMode,
    setFilterMode,
    feedById,
    currentFeed,
    reloadCurrentList,
    reloadCurrentListFresh,
    handleListScroll: coordinatorHandleScroll,
    searchQuery,
    setSearchQuery,
    handleSearch,
    entryLoadLimit,
  } = coordinator
  const entryStore = useEntryStore()
  const {
    selectedEntry,
    selectEntry,
    markAllRead,
    markAboveRead,
    markBelowRead,
  } = entryStore
  const {
    selectedFeedId,
    feeds,
    activeView,
    refreshFeed,
    refreshMultiple,
    refreshAll,
    isRefreshing,
    refreshProgress,
  } = useFeedStore()
  const general = useGeneralSettingsShallowSelector((settings) => ({
    showRecommended: settings.showRecommended,
    groupByDate: settings.groupByDate,
    dimRead: settings.dimRead,
    imageProxy: settings.imageProxy,
  }))
  const { t } = useTranslation()

  // Context menu state
  const { menuState, showMenu, hideMenu } = useEntryContextMenu()
  // Share poster state
  const [posterEntry, setPosterEntry] = useState<Entry | null>(null)

  const viewDef = activeView !== null ? VIEW_DEFINITIONS[activeView] : null
  const displayTitle =
    selectedFeedId === 'starred'
      ? t('entryList.starred')
      : currentFeed?.title ||
        (viewDef
          ? t(VIEW_TYPE_I18N_KEYS[activeView!] || 'common.all')
          : t('common.all'))

  const mediaFailureRefreshAtRef = useRef(new Map<string, number>())
  const mediaFailureRefreshInFlightRef = useRef(new Set<string>())
  const handleEntryMediaAllFailed = useCallback(
    (entry: Entry) => {
      const feedId = entry.feedId
      if (!feedId) return
      if (mediaFailureRefreshInFlightRef.current.has(feedId)) return
      const now = Date.now()
      const last = mediaFailureRefreshAtRef.current.get(feedId) || 0
      const cooldownMs = 20 * 1000
      if (now - last < cooldownMs) return
      mediaFailureRefreshAtRef.current.set(feedId, now)
      mediaFailureRefreshInFlightRef.current.add(feedId)
      void refreshFeed(feedId)
        .then(() => {
          reloadCurrentListFresh()
        })
        .finally(() => {
          mediaFailureRefreshInFlightRef.current.delete(feedId)
        })
    },
    [refreshFeed, reloadCurrentListFresh],
  )

  // Picture feed entries must not go through social dedupe because dedupe merges media arrays
  // and can mix photos from different posts into a single card.
  const shouldDedupeSocialEntries = activeView === FeedViewType.SocialMedia
  const {
    entries: viewFilteredEntries,
    isProcessing: isSocialDedupeProcessing,
  } = useAsyncSocialDedupe(baseFilteredEntries, {
    enabled: shouldDedupeSocialEntries,
    cacheKey: `${activeView ?? 'all'}:${selectedFeedId ?? 'all'}`,
  })

  // Only reuse stale entries in broad scopes (all/view-wide).
  // For a concrete feed selection, showing previous-scope entries causes a visible flash.
  const allowStaleEntriesWhileLoading = !selectedFeedId
  const hasStaleEntriesWhileLoading =
    allowStaleEntriesWhileLoading &&
    (isLoading || isSocialDedupeProcessing) &&
    viewFilteredEntries.length === 0 &&
    entries.length > 0
  const baseRenderEntries = hasStaleEntriesWhileLoading
    ? entries
    : viewFilteredEntries
  const renderEntries = useMemo(
    () =>
      activeView === FeedViewType.SocialMedia
        ? collapseCoverOnlyBeforeVideoEntries(baseRenderEntries)
        : baseRenderEntries,
    [activeView, baseRenderEntries],
  )
  const entryIndexById = useMemo(
    () =>
      new Map(renderEntries.map((entry, index) => [entry.id, index] as const)),
    [renderEntries],
  )
  const groupedRenderEntries = useMemo(
    () => (general.groupByDate ? groupEntriesByDate(renderEntries) : []),
    [general.groupByDate, renderEntries],
  )
  const useVirtualSocialList = activeView === FeedViewType.SocialMedia
  const socialRows = useMemo(() => {
    if (!useVirtualSocialList) return []
    if (general.groupByDate) {
      return groupedRenderEntries.flatMap((group) => [
        {
          key: `header:${group.labelKey}:${group.label}`,
          type: 'header' as const,
          labelKey: group.labelKey,
          label: group.label,
        },
        ...group.entries.map((entry) => ({
          key: entry.id,
          type: 'entry' as const,
          entry,
          entryIndex: entryIndexById.get(entry.id) ?? 0,
        })),
      ])
    }
    return renderEntries.map((entry, index) => ({
      key: entry.id,
      type: 'entry' as const,
      entry,
      entryIndex: index,
    }))
  }, [
    entryIndexById,
    general.groupByDate,
    groupedRenderEntries,
    renderEntries,
    useVirtualSocialList,
  ])
  const isGridMode = viewDef?.gridMode ?? false
  const listScrollRef = useRef<HTMLDivElement>(null)
  const lastScrollScopeRef = useRef<string>('')
  const useVirtualLinearList =
    !isGridMode && activeView !== FeedViewType.SocialMedia
  const virtualizerEntries = useMemo(
    () => (useVirtualLinearList ? renderEntries : []),
    [renderEntries, useVirtualLinearList],
  )
  const linearListVirtualizer = useVirtualizer({
    count: virtualizerEntries.length,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => 180,
    overscan: 8,
    getItemKey: (index) => virtualizerEntries[index]?.id ?? index,
  })
  const virtualItems = linearListVirtualizer.getVirtualItems()
  // Progressive grid rendering: start with a batch and grow on scroll
  const GRID_INITIAL_COUNT = 40
  const GRID_LOAD_MORE_COUNT = 40
  const [gridVisibleCount, setGridVisibleCount] = useState(GRID_INITIAL_COUNT)
  // Reset visible count when the entries change (e.g. switching feeds/views)
  const gridEntriesKeyRef = useRef('')
  const gridEntriesKey = isGridMode
    ? `${activeView}:${selectedFeedId ?? ''}:${renderEntries.length}`
    : ''
  if (gridEntriesKey !== gridEntriesKeyRef.current) {
    gridEntriesKeyRef.current = gridEntriesKey
    if (gridVisibleCount !== GRID_INITIAL_COUNT)
      setGridVisibleCount(GRID_INITIAL_COUNT)
  }
  const gridEntries = useMemo(() => {
    if (!isGridMode) return []
    return renderEntries.slice(0, gridVisibleCount)
  }, [isGridMode, renderEntries, gridVisibleCount])
  const hasMoreGridEntries =
    isGridMode && gridVisibleCount < renderEntries.length
  const gridRows = useMemo(() => {
    if (!isGridMode) return []
    const rows: Entry[][] = []
    for (let index = 0; index < gridEntries.length; index += 2) {
      rows.push(gridEntries.slice(index, index + 2))
    }
    return rows
  }, [isGridMode, gridEntries])
  const gridRowVirtualizer = useVirtualizer({
    count: gridRows.length,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => 280,
    overscan: 3,
    getItemKey: (index) =>
      gridRows[index]?.map((entry) => entry.id).join(':') ?? index,
  })
  const gridVirtualRows = gridRowVirtualizer.getVirtualItems()

  const socialListVirtualizer = useVirtualizer({
    count: socialRows.length,
    getScrollElement: () => listScrollRef.current,
    estimateSize: (index) => (socialRows[index]?.type === 'header' ? 40 : 420),
    overscan: 3,
    getItemKey: (index) => socialRows[index]?.key ?? index,
  })
  const socialVirtualRows = socialListVirtualizer.getVirtualItems()

  useEffect(() => {
    const nextScope = `${activeView ?? 'all'}:${selectedFeedId ?? 'all'}`
    if (lastScrollScopeRef.current === nextScope) return
    lastScrollScopeRef.current = nextScope
    const el = listScrollRef.current
    if (!el) return
    el.scrollTo({ top: 0, behavior: 'auto' })
  }, [activeView, selectedFeedId])

  const handleListScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      // Delegate load-more logic to coordinator
      coordinatorHandleScroll(e)
      // Grid progressive rendering (local rendering concern)
      if (isGridMode && hasMoreGridEntries) {
        const el = e.currentTarget
        if (
          el.scrollTop > SOCIAL_LIST_SCROLL_GUARD_PX &&
          el.scrollTop + el.clientHeight >=
            el.scrollHeight - SOCIAL_LIST_LOAD_MORE_BOTTOM_OFFSET_PX
        ) {
          setGridVisibleCount((prev) =>
            Math.min(prev + GRID_LOAD_MORE_COUNT, renderEntries.length),
          )
        }
      }
    },
    [
      coordinatorHandleScroll,
      isGridMode,
      hasMoreGridEntries,
      renderEntries.length,
    ],
  )

  const renderLinearEntry = useCallback(
    (entry: Entry) => {
      return (
        <EntryCard
          entry={entry}
          isActive={selectedEntry?.id === entry.id}
          onSelect={() => selectEntry(entry)}
          feedTitle={feedById.get(entry.feedId)?.title}
          dimRead={general.dimRead}
          imageProxy={general.imageProxy}
          onContextMenu={(e) => showMenu(e, entry.id)}
        />
      )
    },
    [
      feedById,
      general.dimRead,
      general.imageProxy,
      selectEntry,
      selectedEntry?.id,
      showMenu,
    ],
  )

  return (
    <div
      className="flex flex-shrink-0 flex-col border-r bg-white dark:bg-surface-dark"
      style={{ width: width ?? (isGridMode ? 480 : 340) }}
    >
      {/* Header */}
      <div className="flex-shrink-0 space-y-2.5 px-4 pb-2 pt-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 truncate text-base font-semibold">
            {viewDef && <span className={viewDef.color}>{displayTitle}</span>}
            {!viewDef && displayTitle}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={async () => {
                if (selectedFeedId && selectedFeedId !== 'starred') {
                  await refreshFeed(selectedFeedId)
                } else if (activeView !== null) {
                  const viewFeedIds = feeds
                    .filter(
                      (f) => (f.view ?? FeedViewType.Articles) === activeView,
                    )
                    .map((f) => f.id)
                  await refreshMultiple(viewFeedIds)
                } else {
                  await refreshAll()
                }
                reloadCurrentListFresh()
              }}
              disabled={isRefreshing}
              className="rounded-lg p-1.5 hover:bg-surface-secondary disabled:opacity-50 dark:hover:bg-surface-dark-secondary"
              title={t('common.refresh')}
            >
              <RefreshCw
                size={16}
                className={`text-text-secondary dark:text-text-dark-secondary ${isRefreshing ? 'animate-spin' : ''}`}
              />
            </button>
            <button
              onClick={() => markAllRead(selectedFeedId || undefined)}
              className="rounded-lg p-1.5 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
              title={t('common.markAllRead')}
            >
              <CheckCheck
                size={16}
                className="text-text-secondary dark:text-text-dark-secondary"
              />
            </button>
          </div>
        </div>

        {/* Search */}
        <HomeInlineSearch
          query={searchQuery}
          onQueryChange={(value) => {
            setSearchQuery(value)
            if (!value.trim()) {
              reloadCurrentList()
            }
          }}
          onSubmit={handleSearch}
          entries={renderEntries}
          feedTitleFor={(entry) => feedById.get(entry.feedId)?.title ?? ''}
          onSelectEntry={(entry) => selectEntry(entry)}
          placeholder={t('entryList.searchArticles')}
        />

        {/* Filter tabs */}
        <div className="flex gap-1 text-xs">
          <button
            onClick={() => setFilterMode('all')}
            className={`rounded-full px-3 py-1 transition-colors ${
              filterMode === 'all'
                ? 'bg-accent text-white'
                : 'bg-surface-secondary hover:bg-surface-tertiary dark:bg-surface-dark-secondary dark:hover:bg-surface-dark-tertiary'
            }`}
          >
            {t('common.all')}
          </button>
          <button
            onClick={() => setFilterMode('unread')}
            className={`rounded-full px-3 py-1 transition-colors ${
              filterMode === 'unread'
                ? 'bg-accent text-white'
                : 'bg-surface-secondary hover:bg-surface-tertiary dark:bg-surface-dark-secondary dark:hover:bg-surface-dark-tertiary'
            }`}
          >
            {t('entryList.unread')}
          </button>
        </div>

        {isRefreshing && refreshProgress && refreshProgress.total > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-text-tertiary">
              <span>{`Refreshing ${refreshProgress.completed}/${refreshProgress.total}`}</span>
              <span>{`${refreshProgress.percent}%`}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-tertiary dark:bg-surface-dark-tertiary">
              <div
                className="h-full bg-accent transition-[width] duration-200"
                style={{
                  width: `${Math.max(0, Math.min(100, refreshProgress.percent))}%`,
                }}
              />
            </div>
            {refreshProgress.feedTitle && (
              <div className="truncate text-[11px] text-text-tertiary">
                {refreshProgress.feedTitle}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Entry list */}
      <div
        ref={listScrollRef}
        className="flex-1 overflow-y-auto"
        id="entry-list-scroll"
        onScroll={handleListScroll}
      >
        {isLoading && !hasStaleEntriesWhileLoading ? (
          <SkeletonList
            count={6}
            type={
              activeView === FeedViewType.SocialMedia
                ? 'social'
                : isGridMode
                  ? 'grid'
                  : 'article'
            }
          />
        ) : renderEntries.length === 0 ? (
          selectedFeedId && selectedFeedId !== 'starred' ? (
            /* A specific feed is selected but has no entries - offer refresh */
            <div className="flex flex-col items-center justify-center py-12 text-text-secondary dark:text-text-dark-secondary">
              <Inbox size={40} className="mb-3 text-text-tertiary" />
              <p className="text-sm">{t('entryList.noArticles')}</p>
              <button
                onClick={async () => {
                  await refreshFeed(selectedFeedId)
                  clearListCache()
                  loadEntries({ feedId: selectedFeedId, limit: entryLoadLimit })
                }}
                disabled={isRefreshing}
                className="mt-3 flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm text-white hover:bg-accent/90 disabled:opacity-50"
              >
                <RefreshCw
                  size={14}
                  className={isRefreshing ? 'animate-spin' : ''}
                />
                {isRefreshing ? t('common.refreshing') : t('common.refresh')}
              </button>
            </div>
          ) : activeView !== null ? (
            <ViewRecommendations viewType={activeView} />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-text-secondary dark:text-text-dark-secondary">
              <Inbox size={40} className="mb-3 text-text-tertiary" />
              <p className="text-sm">{t('entryList.noArticles')}</p>
              <p className="mt-1 text-xs">{t('entryList.addFeedToStart')}</p>
            </div>
          )
        ) : activeView === FeedViewType.SocialMedia ? (
          /* Social/Pictures timeline layout: virtualized to avoid mounting the whole feed at once */
          <div
            className="relative"
            style={{ height: `${socialListVirtualizer.getTotalSize()}px` }}
          >
            {socialVirtualRows.map((row) => {
              const item = socialRows[row.index]
              if (!item) return null
              return (
                <div
                  key={row.key}
                  data-index={row.index}
                  ref={socialListVirtualizer.measureElement}
                  className="absolute left-0 top-0 w-full"
                  style={{ transform: `translateY(${row.start}px)` }}
                >
                  {item.type === 'header' ? (
                    <div className="flex h-9 items-center border-b border-transparent bg-white/80 backdrop-blur-sm dark:bg-surface-dark/80">
                      <div className="dark:text-text-dark m-auto flex w-full max-w-[clamp(45ch,60vw,65ch)] select-none gap-3 pl-4 text-sm font-bold text-text">
                        <span>
                          {t(
                            item.labelKey,
                            item.labelKey === 'entryList.daysAgo'
                              ? { days: item.label.match(/\d+/)?.[0] }
                              : undefined,
                          ) || item.label}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <SocialMediaItem
                      entry={item.entry}
                      isActive={selectedEntry?.id === item.entry.id}
                      onSelect={() => selectEntry(item.entry)}
                      feedTitle={feedById.get(item.entry.feedId)?.title}
                      feedImage={feedById.get(item.entry.feedId)?.imageUrl}
                      feedSiteUrl={feedById.get(item.entry.feedId)?.siteUrl}
                      feedUrl={feedById.get(item.entry.feedId)?.url}
                      entryIndex={item.entryIndex}
                      totalEntries={renderEntries.length}
                      onMarkAboveRead={() => markAboveRead(item.entry.id)}
                      onMarkBelowRead={() => markBelowRead(item.entry.id)}
                      onContextMenu={(e) => showMenu(e, item.entry.id)}
                      dimRead={general.dimRead}
                      onMediaAllFailed={() =>
                        handleEntryMediaAllFailed(item.entry)
                      }
                    />
                  )}
                </div>
              )
            })}
          </div>
        ) : isGridMode ? (
          /* Grid layout for Videos/Pictures */
          <>
            <div
              className="relative"
              style={{ height: `${gridRowVirtualizer.getTotalSize()}px` }}
            >
              {gridVirtualRows.map((row) => {
                const rowEntries = gridRows[row.index]
                if (!rowEntries || rowEntries.length === 0) return null
                return (
                  <div
                    key={row.key}
                    data-index={row.index}
                    ref={gridRowVirtualizer.measureElement}
                    className="absolute left-0 top-0 w-full px-4"
                    style={{
                      transform: `translateY(${row.start}px)`,
                      paddingTop: row.index === 0 ? '1rem' : '0.375rem',
                    }}
                  >
                    <div className="grid grid-cols-2 gap-1.5">
                      {rowEntries.map((entry) => (
                        <GridCard
                          key={entry.id}
                          entry={entry}
                          isActive={selectedEntry?.id === entry.id}
                          onSelect={() => selectEntry(entry)}
                          feedTitle={feedById.get(entry.feedId)?.title}
                          feedImage={feedById.get(entry.feedId)?.imageUrl}
                          isVideo={activeView === FeedViewType.Videos}
                          showSummary={activeView !== FeedViewType.Videos}
                        />
                      ))}
                      {rowEntries.length === 1 && <div aria-hidden="true" />}
                    </div>
                  </div>
                )
              })}
            </div>
            {hasMoreGridEntries && (
              <div className="flex items-center justify-center py-4 text-text-tertiary">
                <Loader2 size={16} className="animate-spin" />
              </div>
            )}
          </>
        ) : useVirtualLinearList ? (
          <div
            className="relative"
            style={{ height: `${linearListVirtualizer.getTotalSize()}px` }}
          >
            {virtualItems.map((item) => {
              const entry = virtualizerEntries[item.index]
              if (!entry) return null
              return (
                <div
                  key={entry.id}
                  data-index={item.index}
                  ref={linearListVirtualizer.measureElement}
                  className="absolute left-0 top-0 w-full"
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  {renderLinearEntry(entry)}
                </div>
              )
            })}
          </div>
        ) : (
          renderEntries.map((entry) => (
            <div key={entry.id}>{renderLinearEntry(entry)}</div>
          ))
        )}

        {isLoadingMore && (
          <div className="flex items-center justify-center py-4 text-text-tertiary">
            <Loader2 size={16} className="animate-spin" />
          </div>
        )}

        {/* Context Menu */}
        {menuState.visible &&
          menuState.entryId &&
          (() => {
            const menuEntry = renderEntries.find(
              (e) => e.id === menuState.entryId,
            )
            if (!menuEntry) return null
            const menuIndex = renderEntries.findIndex(
              (e) => e.id === menuState.entryId,
            )
            return (
              <EntryContextMenuWrapper
                entry={menuEntry}
                entryIndex={menuIndex}
                totalEntries={renderEntries.length}
                x={menuState.x}
                y={menuState.y}
                onClose={hideMenu}
                onMarkAboveRead={() => markAboveRead(menuEntry.id)}
                onMarkBelowRead={() => markBelowRead(menuEntry.id)}
                onSharePoster={() => setPosterEntry(menuEntry)}
              />
            )
          })()}

        {/* Share Poster Modal */}
        {posterEntry && (
          <Suspense fallback={null}>
            <SharePoster
              entry={posterEntry}
              feedTitle={feedById.get(posterEntry.feedId)?.title}
              onClose={() => setPosterEntry(null)}
            />
          </Suspense>
        )}
      </div>
    </div>
  )
}

/** Context menu wrapper for entry items */
function EntryContextMenuWrapper({
  entry,
  entryIndex,
  totalEntries,
  x,
  y,
  onClose,
  onMarkAboveRead,
  onMarkBelowRead,
  onSharePoster,
}: {
  entry: Entry
  entryIndex: number
  totalEntries: number
  x: number
  y: number
  onClose: () => void
  onMarkAboveRead: () => void
  onMarkBelowRead: () => void
  onSharePoster: () => void
}) {
  const { markRead, toggleStar } = useEntryStore()
  const feedSiteUrl = useFeedStore(
    (state) => state.feeds.find((feed) => feed.id === entry.feedId)?.siteUrl,
  )
  const browserOpenUrl = resolveEntryBrowserOpenUrl(entry)
  const actions = useEntryContextActions({
    entry,
    entryIndex,
    totalEntries,
    onMarkRead: markRead,
    onToggleStar: toggleStar,
    onMarkAboveRead,
    onMarkBelowRead,
    onOpenInBrowser: browserOpenUrl
      ? () => {
          void openExternalUrlSafe(browserOpenUrl)
        }
      : undefined,
    feedSiteUrl,
    onSharePoster,
  })
  return <ContextMenu x={x} y={y} onClose={onClose} actions={actions} />
}

/** Standard list item card */
function EntryCard({
  entry,
  isActive,
  onSelect,
  feedTitle,
  dimRead,
  imageProxy,
  onContextMenu,
}: {
  entry: Entry
  isActive: boolean
  onSelect: () => void
  feedTitle?: string
  dimRead?: boolean
  imageProxy?: boolean
  onContextMenu?: (e: React.MouseEvent) => void
}) {
  const timeAgo = formatDistanceToNow(new Date(entry.publishedAt), {
    addSuffix: true,
    locale: getDateLocale(),
  })

  // Thumbnail: prefer first media photo, then imageUrl, then extract from content.
  // Use previewUrl (stable mirror proxy) when available instead of url (expiring CDN).
  const firstPhoto = entry.media?.find((m) => m.type === 'photo')
  const rawThumbnail = firstPhoto?.previewUrl
    ? decodeHtmlEntitiesUrl(firstPhoto.previewUrl)
    : decodeMediaUrl(
        firstPhoto?.url ||
          entry.media?.find((m) => m.type === 'video')?.previewUrl ||
          entry.imageUrl ||
          '',
      )
  const thumbnail =
    rawThumbnail && imageProxy
      ? getThumbnailUrl(rawThumbnail, 80)
      : rawThumbnail

  const hasThumbnail = !!thumbnail

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      onContextMenu={onContextMenu}
      className={`w-full cursor-pointer border-b border-surface-secondary px-4 py-3.5 text-left transition-colors dark:border-surface-dark-tertiary ${
        isActive
          ? 'border-l-2 !border-l-accent bg-accent/5'
          : 'hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary'
      } ${dimRead && entry.isRead && !isActive ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Unread indicator */}
        {!entry.isRead && (
          <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-accent" />
        )}

        <div
          className="min-w-0 flex-1"
          style={{ maxWidth: hasThumbnail ? 'calc(100% - 92px)' : undefined }}
        >
          {/* Feed name + time */}
          <div className="mb-0.5 flex items-center gap-1 text-[10px] font-bold text-text-secondary dark:text-text-dark-secondary">
            {feedTitle && (
              <span className="max-w-[120px] truncate">{feedTitle}</span>
            )}
            {feedTitle && <span className="text-text-tertiary">·</span>}
            <span className="flex-shrink-0 text-text-tertiary">{timeAgo}</span>
            {entry.isStarred && (
              <Star
                size={10}
                className="flex-shrink-0 fill-yellow-500 text-yellow-500"
              />
            )}
          </div>

          {entry.title ? (
            <h3
              className={`line-clamp-2 text-sm leading-snug ${
                entry.isRead
                  ? 'text-text-secondary dark:text-text-dark-secondary'
                  : 'font-medium'
              }`}
            >
              {entry.title}
            </h3>
          ) : (
            (() => {
              const fallback = (entry.summary || entry.content || '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
              return fallback ? (
                <h3
                  className={`line-clamp-2 text-sm leading-snug ${
                    entry.isRead
                      ? 'text-text-secondary dark:text-text-dark-secondary'
                      : 'font-medium'
                  }`}
                >
                  {fallback}
                </h3>
              ) : null
            })()
          )}

          {entry.title &&
            entry.summary &&
            !isSummaryRedundant(entry.title, entry.summary) &&
            (() => {
              const cleanSummary = entry.summary
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
              return cleanSummary ? (
                <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-text-secondary dark:text-text-dark-secondary">
                  {cleanSummary}
                </p>
              ) : null
            })()}
        </div>

        {/* Compact 80x80 thumbnail */}
        {hasThumbnail && (
          <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-surface-tertiary dark:bg-surface-dark-tertiary">
            <QueuedImage
              src={thumbnail}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              onError={(e) => {
                advanceCardImageFallback(e, rawThumbnail, (img) => {
                  img.parentElement!.style.display = 'none'
                })
              }}
            />
          </div>
        )}
      </div>
    </article>
  )
}

/** Grid card for media/video view */
export const GridCard = memo(function GridCard({
  entry,
  isActive,
  onSelect,
  onContextMenu,
  feedTitle,
  feedImage,
  isVideo,
  showSummary = true,
}: {
  entry: Entry
  isActive: boolean
  onSelect: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  feedTitle?: string
  feedImage?: string
  isVideo?: boolean
  showSummary?: boolean
}) {
  const { t } = useTranslation()
  const photoCovers = useMemo(() => {
    const unique: string[] = []
    const push = (value: string) => {
      const candidate = decodeMediaUrl(value || '').trim()
      if (!candidate || !isLikelyImageByUrl(candidate)) return
      const key = normalizeImageCacheKey(candidate)
      if (!key) return
      if (unique.some((u) => normalizeImageCacheKey(u) === key)) return
      unique.push(candidate)
    }

    for (const media of entry.media || []) {
      if (media.type !== 'photo') continue
      push(media.previewUrl || '')
      push(media.url || '')
      if (unique.length >= 4) break
    }
    if (unique.length === 0) push(entry.imageUrl || '')
    return unique.slice(0, 4)
  }, [entry.imageUrl, entry.media])

  // Find the best image: first media photo/video, then imageUrl, then YouTube thumbnail from URL
  const coverUrl = (() => {
    const fromValidatedPhotos = photoCovers[0] || ''
    if (fromValidatedPhotos) return fromValidatedPhotos

    const fromMediaCandidates =
      [
        ...(entry.media || []).flatMap((media) => [
          media.previewUrl || '',
          media.url || '',
        ]),
        entry.imageUrl || '',
      ]
        .map((value) => decodeMediaUrl(value))
        .find((value) => !!value && isLikelyImageByUrl(value)) || ''
    if (fromMediaCandidates) return fromMediaCandidates

    // Derive YouTube thumbnail from entry URL
    const ytMatch = (entry.url || '').match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]+)/,
    )
    if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`
    return ''
  })()
  const cleanFeedAvatar = useMemo(() => {
    const candidate = normalizeInstagramUnavatar(feedImage || '')
    return candidate && !isGenericInstagramIconUrl(candidate) ? candidate : ''
  }, [feedImage])
  const avatarCandidates = useMemo(() => {
    const candidates = [
      cleanFeedAvatar,
      extractPixnoyOriginUrl(cleanFeedAvatar),
    ]
    const unique: string[] = []
    for (const c of candidates) {
      const candidate = (c || '').trim()
      if (!candidate || !/^https?:\/\//i.test(candidate)) continue
      const key = normalizeImageCacheKey(candidate)
      if (unique.some((u) => normalizeImageCacheKey(u) === key)) continue
      unique.push(candidate)
    }
    return unique
  }, [cleanFeedAvatar])
  const [avatarCandidateIndex, setAvatarCandidateIndex] = useState(0)
  const [avatarImageFailed, setAvatarImageFailed] = useState(false)
  useEffect(() => {
    setAvatarCandidateIndex(0)
    setAvatarImageFailed(false)
  }, [entry.id, avatarCandidates])
  const avatarUrl = avatarCandidates[avatarCandidateIndex] || ''
  const avatarLetter = (feedTitle || '?')[0]

  return (
    <button
      onClick={onSelect}
      onContextMenu={onContextMenu}
      className={`w-full overflow-hidden rounded-xl border text-left transition-all ${
        isActive
          ? 'border-accent ring-2 ring-accent/30'
          : 'border-transparent hover:border-border dark:hover:border-surface-dark-tertiary'
      } bg-surface-secondary dark:bg-surface-dark-secondary`}
    >
      {/* Cover image */}
      <div className="relative aspect-[4/3] bg-surface-tertiary dark:bg-surface-dark-tertiary">
        {!isVideo && photoCovers.length > 1 ? (
          <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-[1px] bg-black/10">
            {photoCovers.map((src, idx) => (
              <img
                key={`${entry.id}:photo:${idx}`}
                src={src}
                alt=""
                className="h-full w-full object-cover"
                loading={idx === 0 ? 'eager' : 'lazy'}
                onError={(e) => {
                  advanceCardImageFallback(e, src, (img) => {
                    img.style.display = 'none'
                  })
                }}
              />
            ))}
          </div>
        ) : coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              advanceCardImageFallback(e, coverUrl, (img) => {
                const root = img.closest('button') as HTMLElement | null
                if (root) {
                  root.style.display = 'none'
                } else {
                  img.style.display = 'none'
                }
              })
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-text-tertiary">
            {isVideo ? <Play size={32} /> : <Inbox size={32} />}
          </div>
        )}
        {isVideo && coverUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60">
              <Play size={18} className="ml-0.5 text-white" fill="white" />
            </div>
          </div>
        )}
        {/* Video duration badge */}
        {isVideo &&
          (() => {
            const videoMedia = entry.media?.find((m) => m.type === 'video')
            if (videoMedia?.duration && videoMedia.duration > 0) {
              const d = videoMedia.duration
              const h = Math.floor(d / 3600)
              const m = Math.floor((d % 3600) / 60)
              const s = Math.floor(d % 60)
              const formatted =
                h > 0
                  ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
                  : `${m}:${String(s).padStart(2, '0')}`
              return (
                <div className="absolute bottom-2 left-2 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  {formatted}
                </div>
              )
            }
            return null
          })()}
        {!entry.isRead && (
          <div className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-accent" />
        )}
        {entry.media &&
          entry.media.filter((m) => m.type === 'photo').length > 1 && (
            <div className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
              {entry.media.filter((m) => m.type === 'photo').length}{' '}
              {t('entryList.images')}
            </div>
          )}
      </div>

      {/* Info */}
      <div className="p-2">
        {(() => {
          const displayTitle =
            entry.title ||
            (entry.summary || entry.content || '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
          return displayTitle ? (
            <h3
              className={`truncate whitespace-nowrap text-xs leading-snug ${entry.isRead ? 'text-text-secondary dark:text-text-dark-secondary' : 'font-medium'}`}
            >
              {displayTitle}
            </h3>
          ) : null
        })()}
        {isVideo &&
          showSummary &&
          (() => {
            const cleanSummary = cleanSocialPlainText(
              entry.summary || entry.content || '',
            )
              .replace(/\s+/g, ' ')
              .trim()
            if (
              !cleanSummary ||
              isSummaryRedundant(entry.title || '', cleanSummary)
            ) {
              return null
            }
            return (
              <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-text-secondary dark:text-text-dark-secondary">
                {cleanSummary}
              </p>
            )
          })()}
        <div className="mt-1 flex items-center justify-between text-[10px] text-text-tertiary">
          <div className="flex min-w-0 items-center gap-1">
            <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-tertiary text-[9px] uppercase text-text-secondary dark:bg-surface-dark-tertiary dark:text-text-dark-secondary">
              {avatarUrl && !avatarImageFailed ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={() => {
                    const nextIndex = avatarCandidateIndex + 1
                    if (nextIndex < avatarCandidates.length) {
                      setAvatarCandidateIndex(nextIndex)
                      return
                    }
                    setAvatarImageFailed(true)
                  }}
                />
              ) : (
                avatarLetter
              )}
            </span>
            {feedTitle && (
              <span className="min-w-0 truncate text-[11px] font-medium">
                {feedTitle}
              </span>
            )}
          </div>
          {entry.publishedAt && (
            <span className="ml-2 flex-shrink-0 whitespace-nowrap text-[10px]">
              {cleanRelativeTime(entry.publishedAt)}
            </span>
          )}
        </div>
      </div>
    </button>
  )
})

export const SocialMediaItem = memo(function SocialMediaItem({
  entry,
  isActive,
  onSelect,
  onDoubleClick,
  feedTitle,
  feedImage,
  feedSiteUrl,
  feedUrl,
  entryIndex: _entryIndex,
  totalEntries: _totalEntries,
  onMarkAboveRead: _onMarkAboveRead,
  onMarkBelowRead: _onMarkBelowRead,
  onContextMenu,
  dimRead,
  onOpenBilibiliInPage,
  onMediaAllFailed,
}: {
  entry: Entry
  isActive: boolean
  onSelect: () => void
  onDoubleClick?: () => void
  feedTitle?: string
  feedImage?: string
  feedSiteUrl?: string
  feedUrl?: string
  entryIndex?: number
  totalEntries?: number
  onMarkAboveRead?: () => void
  onMarkBelowRead?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  dimRead?: boolean
  onOpenBilibiliInPage?: (entry: Entry, url: string) => void
  onMediaAllFailed?: () => void
}) {
  const { t } = useTranslation()
  const allEntries = useEntryStore((s) => s.entries)

  // Parse social media handle from URL
  const canonicalEntryUrl = useMemo(
    () => canonicalizeSocialUrl(entry.url || ''),
    [entry.url],
  )
  const parsed = parseSocialHandle(canonicalEntryUrl)
  const authorName = useMemo(() => {
    if (parsed.type === 'x') {
      const feedDisplayName = extractTwitterDisplayNameFromFeedTitle(
        feedTitle,
        parsed.handle,
      )
      if (feedDisplayName) return feedDisplayName
    }
    return (entry.author || feedTitle || parsed.handle || '')
      .replace(/^@+/, '')
      .trim()
  }, [entry.author, feedTitle, parsed.type, parsed.handle])

  const timeAgo = cleanRelativeTime(entry.publishedAt)

  // Content: prefer HTML content, fallback to summary
  const htmlContent = entry.content || entry.summary || ''
  // Sanitize HTML and strip media tags for inline display
  const sanitizedContent = useMemo(() => {
    if (!htmlContent.includes('<')) return ''
    return cleanSocialTextHtml(htmlContent)
  }, [htmlContent])
  // Plain text fallback
  const plainContent = useMemo(() => {
    const source = sanitizedContent || htmlContent
    const cleaned = cleanSocialPlainText(source)
    if (cleaned) return cleaned
    return (entry.title || '').trim()
  }, [sanitizedContent, htmlContent, entry.title])
  const relatedEntryFallback = useMemo(() => {
    const collectPostKeys = (candidate: Entry): Set<string> => {
      const keys = new Set<string>()
      const push = (k: string) => {
        const value = (k || '').trim()
        if (!value) return
        keys.add(value)
      }
      const htmlText = `${candidate.content || ''}\n${candidate.summary || ''}`
      const urls = [
        candidate.url || '',
        candidate.imageUrl || '',
        ...(candidate.media || []).flatMap((m) => [
          m.url || '',
          m.previewUrl || '',
        ]),
        ...extractImagesFromHtml(htmlText),
        ...(htmlText.match(/https?:\/\/[^\s"'<>]+/g) || []),
      ]
        .map((u) => decodeMediaUrl(u))
        .filter(Boolean)

      for (const url of urls) {
        const decoded = decodeMediaUrl(url)
        const igCacheKey = extractIgCacheKeyFromUrl(decoded)
        const base64Part = decodeURIComponent(igCacheKey).split('.')[0] || ''
        if (base64Part) {
          push(`igk:${base64Part}`)
          try {
            const instagramId = atob(base64Part)
            if (/^\d+$/.test(instagramId)) push(`igid:${instagramId}`)
          } catch {
            // ignore
          }
        }
        const shortcodeMatch = decoded.match(
          /instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i,
        )
        if (shortcodeMatch?.[1]) push(`igsc:${shortcodeMatch[1]}`)
      }
      return keys
    }

    const currentKeys = collectPostKeys(entry)
    const currentTextKey = normalizeLooseText(
      `${entry.title || ''} ${cleanSocialPlainText(entry.content || entry.summary || '')}`,
    ).slice(0, 180)
    const minTime = (entry.publishedAt || 0) - 30 * 24 * 60 * 60 * 1000
    const maxTime = (entry.publishedAt || 0) + 30 * 24 * 60 * 60 * 1000

    const isLikelySamePost = (candidate: Entry): boolean => {
      if (candidate.id === entry.id) return false
      if (candidate.feedId !== entry.feedId) return false
      const ts = candidate.publishedAt || 0
      if (ts < minTime || ts > maxTime) return false

      const candidateKeys = collectPostKeys(candidate)
      for (const key of currentKeys) {
        if (candidateKeys.has(key)) return true
      }
      if (currentTextKey) {
        const candidateTextKey = normalizeLooseText(
          `${candidate.title || ''} ${cleanSocialPlainText(candidate.content || candidate.summary || '')}`,
        ).slice(0, 180)
        if (candidateTextKey && candidateTextKey === currentTextKey) return true
      }
      return false
    }

    const getBestImage = (candidate: Entry): string => {
      const mediaPhotos = (candidate.media || []).filter(
        (m) => m.type === 'photo',
      )
      for (const photo of mediaPhotos) {
        const preview = decodeMediaUrl(photo.previewUrl || '')
        if (preview && isLikelyImageByUrl(preview)) return preview
        const primary = decodeMediaUrl(photo.url || '')
        if (primary && isLikelyImageByUrl(primary)) return primary
      }
      const entryImage = decodeMediaUrl(candidate.imageUrl || '')
      if (entryImage && isLikelyImageByUrl(entryImage)) return entryImage
      const contentImages = extractImagesFromHtml(
        candidate.content || candidate.summary || '',
      )
      const firstValid = contentImages.find((u) => isLikelyImageByUrl(u))
      return firstValid ? decodeMediaUrl(firstValid) : ''
    }

    const related = allEntries
      .filter(isLikelySamePost)
      .map((candidate) => ({
        candidate,
        cover: getBestImage(candidate),
        distance: Math.abs(
          (candidate.publishedAt || 0) - (entry.publishedAt || 0),
        ),
      }))
      .sort((a, b) => a.distance - b.distance)

    const withCover = related.find((item) => !!item.cover)
    if (withCover) return withCover
    return related[0] || null
  }, [allEntries, entry])
  const browserOpenUrl = useMemo(
    () =>
      resolveEntryBrowserOpenUrl(entry) ||
      resolveEntryBrowserOpenUrl(relatedEntryFallback?.candidate || entry),
    [entry, relatedEntryFallback],
  )
  // Folo-style: trust entry.media directly, only filter truly decorative assets and dedup by URL
  const photos = useMemo(() => {
    const seen = new Set<string>()
    const result: Array<{
      url: string
      previewUrl?: string
      width?: number
      height?: number
      blurhash?: string
    }> = []
    for (const m of entry.media || []) {
      if (
        m.type !== 'photo' &&
        !isLikelyImageByUrl(m.url || m.previewUrl || '')
      )
        continue
      const decoded = decodeMediaUrls(m)
      if (isDecorativeSocialImageUrl(decoded.url || decoded.previewUrl || ''))
        continue
      if (hasTinyDecorativeDimensions(decoded.width, decoded.height)) continue
      const key = (decoded.url || '').toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      result.push(decoded)
    }
    if (result.length > 0) return result
    const fallback = entry.imageUrl ? decodeMediaUrl(entry.imageUrl) : ''
    return fallback && isLikelyImageByUrl(fallback) ? [{ url: fallback }] : []
  }, [entry.media, entry.imageUrl])
  const videos = useMemo(() => {
    return (entry.media || [])
      .filter((m) => {
        if (m.type !== 'video') return false
        const url = decodeMediaUrl(m.url || '').toLowerCase()
        const preview = decodeMediaUrl(m.previewUrl || '').toLowerCase()
        if (isLikelyImageByUrl(url) || isLikelyImageByUrl(preview)) return false
        return true
      })
      .map(decodeMediaUrls)
      .filter((m) => isRenderableVideoMediaItem(m))
  }, [entry.media])
  const [isMediaExpanded, setIsMediaExpanded] = useState(
    () => mediaExpandedCache.get(entry.id) ?? false,
  )
  useEffect(() => {
    mediaExpandedCache.set(entry.id, isMediaExpanded)
  }, [entry.id, isMediaExpanded])
  const hasBilibiliPageVideo = useMemo(
    () =>
      videos.some((video) =>
        /(?:^|\.)bilibili\.com\/video\/|(?:^|\.)b23\.tv\//i.test(
          (video.url || '').toLowerCase(),
        ),
      ),
    [videos],
  )
  const visibleVideos = useMemo(() => {
    if (videos.length === 0) return videos
    const fallbackPreview =
      photos[0]?.url || relatedEntryFallback?.cover || entry.imageUrl || ''
    return videos.map((video) => {
      const rawPreview = decodeMediaUrl(video.previewUrl || '')
      const validPreview =
        rawPreview && isLikelyImageByUrl(rawPreview) ? rawPreview : ''
      if (validPreview) return { ...video, previewUrl: validPreview }
      if (!fallbackPreview) return video
      const fallback = decodeMediaUrl(fallbackPreview)
      if (!fallback || !isLikelyImageByUrl(fallback)) return video
      return { ...video, previewUrl: fallback }
    })
  }, [videos, photos, relatedEntryFallback, entry.imageUrl])
  const galleryPhotos = hasBilibiliPageVideo ? [] : photos
  const hasMirrorDerivedPhotoContent = useMemo(
    () =>
      /media\.(?:picnob|pixnoy|piokok|pixwox)\.|sp\d+\.pixnoy\./i.test(
        `${entry.content || ''}\n${entry.summary || ''}`,
      ),
    [entry.content, entry.summary],
  )
  const visibleGalleryPhotos =
    galleryPhotos.length > 9 && !isMediaExpanded
      ? galleryPhotos.slice(0, 9)
      : galleryPhotos

  // Collapsible content area for long social posts.
  const contentRef = useRef<HTMLDivElement>(null)
  const CONTENT_COLLAPSE_HEIGHT = 220
  const [isOverflow, setIsOverflow] = useState(false)
  const [isExpanded, setIsExpanded] = useState(
    () => expandedCache.get(entry.id) ?? false,
  )

  useLayoutEffect(() => {
    if (contentRef.current) {
      setIsOverflow(contentRef.current.scrollHeight > CONTENT_COLLAPSE_HEIGHT)
    }
  }, [sanitizedContent, plainContent])

  // Sync expand state to LRU cache
  useEffect(() => {
    expandedCache.set(entry.id, isExpanded)
  }, [isExpanded, entry.id])

  // Smart avatar: use unavatar.io for Twitter/X feeds (always-fresh),
  // Detect from siteUrl (x.com/user) or feedUrl (rsshub /twitter/user/xxx)
  const twitterAvatar = useMemo(() => {
    if (feedSiteUrl) {
      try {
        const { hostname, pathname } = new URL(feedSiteUrl)
        if (
          hostname === 'x.com' ||
          hostname === 'twitter.com' ||
          hostname === 'www.x.com' ||
          hostname === 'www.twitter.com'
        ) {
          const username = pathname.split('/').filter(Boolean)[0]
          if (username && /^[a-zA-Z0-9_]+$/.test(username)) {
            return `https://unavatar.io/x/${username}`
          }
        }
      } catch {}
    }
    if (feedUrl) {
      const m = feedUrl.match(/\/twitter\/user\/([a-zA-Z0-9_]+)/i)
      if (m) {
        return `https://unavatar.io/x/${m[1]}`
      }
    }
    return null
  }, [feedSiteUrl, feedUrl])
  const [avatarImageFailed, setAvatarImageFailed] = useState(false)
  const cleanAuthorAvatar = useMemo(() => {
    const candidate = normalizeInstagramUnavatar(entry.authorAvatar || '')
    return candidate && !isGenericInstagramIconUrl(candidate) ? candidate : ''
  }, [entry.authorAvatar])
  const cleanFeedImage = useMemo(() => {
    const candidate = normalizeInstagramUnavatar(feedImage || '')
    return candidate && !isGenericInstagramIconUrl(candidate) ? candidate : ''
  }, [feedImage])
  const avatarCandidates = useMemo(() => {
    const candidates = [
      twitterAvatar || '',
      cleanAuthorAvatar,
      extractPixnoyOriginUrl(cleanAuthorAvatar),
      cleanFeedImage,
      extractPixnoyOriginUrl(cleanFeedImage),
    ]
    const unique: string[] = []
    for (const c of candidates) {
      const candidate = (c || '').trim()
      if (!candidate) continue
      if (!/^https?:\/\//i.test(candidate)) continue
      const key = normalizeImageCacheKey(candidate)
      if (unique.some((u) => normalizeImageCacheKey(u) === key)) continue
      unique.push(candidate)
    }
    return unique
  }, [twitterAvatar, cleanAuthorAvatar, cleanFeedImage])
  const [avatarCandidateIndex, setAvatarCandidateIndex] = useState(0)
  useEffect(() => {
    setAvatarImageFailed(false)
    setAvatarCandidateIndex(0)
  }, [entry.id, avatarCandidates])
  const avatarUrl = avatarCandidates[avatarCandidateIndex] || ''
  const avatarLetter = (entry.author || feedTitle || '?')[0]

  // AI translation & summary state (per-tweet, with LRU cache persistence)
  const language = useGeneralSettingKey('language')
  const targetLanguage = useTranslationSettingKey('targetLanguage')
  const [tweetTranslatedParagraphs, setTweetTranslatedParagraphs] = useState<
    string[]
  >(() => tweetTranslationCache.get(entry.id) ?? [])
  const [tweetSummary, setTweetSummary] = useState<string | null>(
    () => tweetSummaryCache.get(entry.id) ?? null,
  )
  const [isTranslatingTweet, setIsTranslatingTweet] = useState(false)
  const [isSummarizingTweet, setIsSummarizingTweet] = useState(false)
  const [showTweetTranslation, setShowTweetTranslation] = useState(() =>
    tweetTranslationCache.has(entry.id),
  )
  const [showTweetSummary, setShowTweetSummary] = useState(() =>
    tweetSummaryCache.has(entry.id),
  )

  const tweetTextContent = useMemo(() => {
    const cleaned = cleanSocialPlainText(entry.content || entry.summary || '')
    if (cleaned) return cleaned
    return (entry.title || '').trim()
  }, [entry.content, entry.summary, entry.title])

  // Split content into paragraphs for bilingual translation
  const tweetParagraphs = useMemo(() => {
    const html = sanitizedContent || entry.content || entry.summary || ''
    if (html.includes('<')) {
      const safe = cleanSocialTextHtml(html)
      if (safe.trim()) return splitHtmlIntoParagraphs(safe)
    }
    const plain = cleanSocialPlainText(html)
    if (!plain) {
      const titleFallback = (entry.title || '').trim()
      return titleFallback ? [titleFallback] : []
    }
    // Split plain text by newlines so bilingual translation interleaves per paragraph
    const lines = plain
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
    return lines.length > 0 ? lines : [plain]
  }, [entry.content, entry.summary, entry.title, sanitizedContent])

  const handleTranslateTweet = useCallback(async () => {
    if (tweetParagraphs.length === 0) return
    // Toggle off
    if (showTweetTranslation && tweetTranslatedParagraphs.length > 0) {
      setShowTweetTranslation(false)
      return
    }
    // Toggle on if cached
    if (tweetTranslatedParagraphs.length > 0) {
      setShowTweetTranslation(true)
      return
    }
    // Do translation paragraph by paragraph
    setIsTranslatingTweet(true)
    setShowTweetTranslation(true)
    const targetLang = targetLanguage || language || 'zh-CN'
    const results: string[] = []
    for (let i = 0; i < tweetParagraphs.length; i++) {
      const plainText = tweetParagraphs[i].replace(/<[^>]*>/g, '').trim()
      if (!plainText || plainText.length < 5) {
        results.push('')
        continue
      }
      try {
        const result = await window.api.ai.translate(
          tweetParagraphs[i],
          targetLang,
        )
        if (result.success) {
          results.push(result.translation)
        } else {
          results.push(`<span class="text-red-400 text-xs">\u274c</span>`)
        }
      } catch {
        results.push(`<span class="text-red-400 text-xs">\u274c</span>`)
      }
      setTweetTranslatedParagraphs([...results])
    }
    tweetTranslationCache.set(entry.id, results)
    setIsTranslatingTweet(false)
  }, [
    entry.id,
    language,
    showTweetTranslation,
    targetLanguage,
    tweetParagraphs,
    tweetTranslatedParagraphs.length,
  ])

  const handleSummarizeTweet = useCallback(async () => {
    if (!tweetTextContent) return
    // Toggle off
    if (showTweetSummary && tweetSummary) {
      setShowTweetSummary(false)
      return
    }
    // Toggle on if cached
    if (tweetSummary) {
      setShowTweetSummary(true)
      return
    }
    // Do summary
    setIsSummarizingTweet(true)
    setShowTweetSummary(true)
    try {
      const result = await window.api.ai.summarize(
        tweetTextContent,
        language || 'zh-CN',
      )
      if (result.success) {
        setTweetSummary(result.summary)
        tweetSummaryCache.set(entry.id, result.summary)
      } else {
        setTweetSummary(`Error: ${result.error}`)
      }
    } catch (err) {
      setTweetSummary(`Error: ${String(err)}`)
    }
    setIsSummarizingTweet(false)
  }, [entry.id, language, showTweetSummary, tweetSummary, tweetTextContent])

  // Hover action bar state
  const [showActionBar, setShowActionBar] = useState(false)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = useCallback(() => {
    hoverTimerRef.current = setTimeout(() => setShowActionBar(true), 150)
  }, [])
  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    setShowActionBar(false)
  }, [])

  const handleSelect = useCallback(() => {
    pauseInlineVideos()
    onSelect()
  }, [onSelect])

  return (
    <article
      onClick={handleSelect}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onDoubleClick?.()
      }}
      onContextMenu={onContextMenu}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`@container relative mx-auto max-w-[clamp(45ch,60vw,65ch)] cursor-pointer rounded-md pl-4 pr-3 transition-colors duration-200 ${
        isActive
          ? 'bg-accent/10'
          : 'hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40'
      } ${dimRead && entry.isRead && !isActive ? 'opacity-50' : ''}`}
    >
      {/* Floating hover action bar */}
      {showActionBar && !isActive && (
        <SocialActionBar
          entry={entry}
          browserOpenUrl={browserOpenUrl}
          onContextMenu={onContextMenu}
          onTranslate={handleTranslateTweet}
          onSummarize={handleSummarizeTweet}
          isTranslating={isTranslatingTweet}
          isSummarizing={isSummarizingTweet}
          hasTranslation={tweetTranslatedParagraphs.length > 0}
          showTranslation={showTweetTranslation}
        />
      )}

      <div
        className={`group relative flex py-4 ${
          !entry.isRead
            ? 'before:absolute before:-left-3 before:top-8 before:block before:size-2 before:rounded-full before:bg-accent'
            : ''
        }`}
      >
        {/* Avatar */}
        <div className="mt-1 flex-shrink-0">
          {avatarUrl && !avatarImageFailed ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-8 w-8 rounded-full object-cover"
              referrerPolicy="no-referrer"
              onError={() => {
                const nextIndex = avatarCandidateIndex + 1
                if (nextIndex < avatarCandidates.length) {
                  setAvatarCandidateIndex(nextIndex)
                  return
                }
                setAvatarImageFailed(true)
              }}
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-tertiary text-sm font-bold text-text-secondary dark:bg-surface-dark-tertiary">
              {avatarLetter}
            </div>
          )}
        </div>

        {/* Content area */}
        <div className="ml-2 min-w-0 flex-1">
          {/* Author line */}
          <div className="-mt-0.5 flex-1 text-sm">
            <div className="flex select-none flex-wrap space-x-1 leading-6">
              <span className="inline-flex min-w-0 items-center gap-1 text-base font-semibold">
                {authorName}
                {parsed.type === 'x' && (
                  <svg
                    viewBox="0 0 24 24"
                    className="inline-block h-3 w-3 text-[#4A99E9]"
                    fill="currentColor"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                )}
                {parsed.type === 'telegram' && (
                  <svg
                    viewBox="0 0 24 24"
                    className="inline-block h-3 w-3 text-[#26A5E4]"
                    fill="currentColor"
                  >
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                  </svg>
                )}
                {parsed.type === 'bluesky' && (
                  <svg
                    viewBox="0 0 24 24"
                    className="inline-block h-3 w-3 text-[#0085FF]"
                    fill="currentColor"
                  >
                    <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.785 2.627 3.588 3.476 6.182 3.21l.206-.043c-2.87.482-6.082 1.563-6.082 5.609 0 4.051 4.494 3.693 6.137 3.051 3.09-1.208 4.343-4.514 4.635-6.117l.298.052c.291 1.603 1.542 4.909 4.632 6.117 1.643.642 6.137 1 6.137-3.051 0-4.046-3.212-5.127-6.082-5.609l.206.043c2.594.266 5.397-.583 6.182-3.21.246-.828.624-5.79.624-6.479 0-.688-.139-1.86-.902-2.203-.659-.299-1.664-.621-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8" />
                  </svg>
                )}
                {parsed.type === 'threads' && (
                  <svg
                    viewBox="0 0 24 24"
                    className="inline-block h-3 w-3 text-black dark:text-white"
                    fill="currentColor"
                  >
                    <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.19.408-2.285 1.33-3.082.88-.762 2.098-1.2 3.528-1.271 1.194-.06 2.3.076 3.29.378-.064-.349-.166-.676-.31-.978-.537-1.132-1.555-1.73-2.943-1.73h-.094c-.86.013-1.593.313-2.114.868l-1.37-1.508c.855-.775 2.006-1.2 3.338-1.23h.142c2.085 0 3.674.984 4.468 2.764.366.82.576 1.758.634 2.8.598.265 1.14.59 1.62.977 1.178.948 1.91 2.21 2.078 3.658.195 1.671-.331 3.396-1.48 4.854C17.95 22.78 15.618 23.976 12.186 24m-1.638-8.758c-1.035.055-1.75.462-2.076.814-.392.432-.575.96-.547 1.53.042.782.44 1.387 1.154 1.75.596.306 1.355.395 2.079.36 1.238-.067 2.198-.55 2.774-1.382.385-.554.639-1.265.748-2.124-.736-.26-1.567-.406-2.5-.401-.551.003-1.081.12-1.632.453" />
                  </svg>
                )}
              </span>
              {parsed.handle &&
                normalizeSocialHandle(parsed.handle).toLowerCase() !==
                  normalizeSocialHandle(authorName).toLowerCase() && (
                  <a
                    href={
                      parsed.type === 'x'
                        ? `https://x.com/${normalizeSocialHandle(parsed.handle)}`
                        : parsed.type === 'telegram'
                          ? `https://t.me/${parsed.handle}`
                          : parsed.type === 'bluesky'
                            ? `https://bsky.app/profile/${parsed.handle}`
                            : parsed.type === 'threads'
                              ? `https://www.threads.net/@${normalizeSocialHandle(parsed.handle)}`
                              : parsed.type === 'truth'
                                ? `https://truthsocial.com/@${normalizeSocialHandle(parsed.handle)}`
                                : '#'
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-500 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    @{normalizeSocialHandle(parsed.handle)}
                  </a>
                )}
              <span className="text-zinc-500">·</span>
              <span className="text-zinc-500">{timeAgo}</span>
            </div>

            {/* Content area with masked collapse for long posts */}
            <div
              className={`relative mt-1 text-base ${entry.isStarred ? 'pr-5' : ''}`}
            >
              <div
                ref={contentRef}
                className={`relative ${!isExpanded && isOverflow ? 'max-h-[220px] overflow-hidden' : ''}`}
                style={
                  !isExpanded && isOverflow
                    ? {
                        WebkitMaskImage:
                          'linear-gradient(to bottom, black 72%, transparent 100%)',
                        maskImage:
                          'linear-gradient(to bottom, black 72%, transparent 100%)',
                      }
                    : undefined
                }
              >
                {sanitizedContent ? (
                  <div
                    className="prose max-w-none cursor-pointer select-text align-middle text-sm leading-relaxed dark:prose-invert prose-blockquote:mt-0"
                    dangerouslySetInnerHTML={{ __html: sanitizedContent }}
                  />
                ) : (
                  <p className="cursor-pointer select-text whitespace-pre-line text-sm leading-relaxed">
                    {plainContent}
                  </p>
                )}
              </div>
              {isOverflow && !isExpanded && (
                <div className="absolute inset-x-0 -bottom-2 flex select-none justify-center py-2 duration-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsExpanded(true)
                    }}
                    title={t('entryList.expandMore', {
                      defaultValue: 'Expand',
                    })}
                    className="bg-background/95 hover:text-text-primary inline-flex h-7 w-7 items-center justify-center rounded-full border border-border text-text-secondary shadow-sm transition-colors"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              )}
              {isOverflow && isExpanded && (
                <div className="mt-1 flex justify-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsExpanded(false)
                    }}
                    title={t('entryList.collapse', {
                      defaultValue: 'Collapse',
                    })}
                    className="bg-background/95 hover:text-text-primary inline-flex h-7 w-7 items-center justify-center rounded-full border border-border text-text-secondary shadow-sm transition-colors"
                  >
                    <ChevronUp size={14} />
                  </button>
                </div>
              )}
              {entry.isStarred && (
                <Star
                  size={14}
                  className="absolute right-0 top-0 fill-yellow-500 text-yellow-500"
                />
              )}
            </div>
          </div>

          {/* Media gallery */}
          {galleryPhotos.length > 0 && (
            <div>
              <div className="relative">
                <SocialMediaGallery
                  photos={visibleGalleryPhotos}
                  cacheScope={entry.id}
                  onAllFailed={onMediaAllFailed}
                  hasMirrorDerivedContent={hasMirrorDerivedPhotoContent}
                />
              </div>
              {galleryPhotos.length > 9 && !isMediaExpanded && (
                <div className="mt-1 flex justify-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsMediaExpanded(true)
                    }}
                    title={t('entryList.expandMore', {
                      defaultValue: 'Expand',
                    })}
                    className="bg-background/95 hover:text-text-primary inline-flex h-7 w-7 items-center justify-center rounded-full border border-border text-text-secondary shadow-sm transition-colors"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Video items */}
          {visibleVideos.map((video, i) => (
            <div key={`video-${i}`} className="mt-3">
              <VideoPlayer
                src={video.url}
                previewImage={video.previewUrl}
                className="aspect-video w-full rounded-lg"
                onOpenBilibiliInPage={(url) =>
                  onOpenBilibiliInPage?.(entry, url)
                }
              />
            </div>
          ))}
          {galleryPhotos.length > 9 && isMediaExpanded && (
            <div className="mt-2 flex justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsMediaExpanded(false)
                }}
                title={t('entryList.collapse', { defaultValue: 'Collapse' })}
                className="bg-background/95 hover:text-text-primary inline-flex h-7 w-7 items-center justify-center rounded-full border border-border text-text-secondary shadow-sm transition-colors"
              >
                <ChevronUp size={14} />
              </button>
            </div>
          )}

          {/* AI Translation result - bilingual paragraph-by-paragraph */}
          {showTweetTranslation && (
            <div
              className="mt-2 rounded-lg border border-accent/20 bg-accent/5 p-2.5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-accent">
                <Languages size={12} />
                {t('social.translation')}
              </div>
              {isTranslatingTweet && tweetTranslatedParagraphs.length === 0 ? (
                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <Loader2 size={12} className="animate-spin" />
                  {t('entry.translating')}
                </div>
              ) : (
                <div className="space-y-0">
                  {tweetParagraphs.map((para, i) => {
                    const translated = tweetTranslatedParagraphs[i]
                    const isLoading =
                      isTranslatingTweet &&
                      i === tweetTranslatedParagraphs.length
                    const plainText = para.replace(/<[^>]*>/g, '').trim()
                    if (!plainText) return null
                    return (
                      <div
                        key={i}
                        className="group border-l-2 border-transparent pl-0 transition-colors hover:border-accent/30 hover:pl-2"
                      >
                        {para.includes('<') ? (
                          <div
                            className="!mb-0 text-sm leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: para }}
                          />
                        ) : (
                          <p className="!mb-0 whitespace-pre-line text-sm leading-relaxed">
                            {para}
                          </p>
                        )}
                        {translated ? (
                          <div className="relative mb-2 mt-0.5">
                            <div className="flex items-start gap-1.5">
                              <Languages
                                size={10}
                                className="mt-1 flex-shrink-0 text-accent/50"
                              />
                              <div
                                className="!mb-0 text-sm leading-relaxed text-accent/80 dark:text-orange-300/80"
                                dangerouslySetInnerHTML={{ __html: translated }}
                              />
                            </div>
                          </div>
                        ) : isLoading ? (
                          <div className="mb-2 mt-0.5 flex items-center gap-1.5 text-xs text-text-tertiary">
                            <Loader2 size={10} className="animate-spin" />
                            {t('entry.translating')}
                          </div>
                        ) : (
                          <div className="mb-2" />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* AI Summary result */}
          {showTweetSummary && (
            <div
              className="mt-2 rounded-lg border border-amber-300/30 bg-amber-50/50 p-2.5 dark:bg-amber-900/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <Sparkles size={12} />
                {t('social.aiSummary')}
              </div>
              {isSummarizingTweet ? (
                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <Loader2 size={12} className="animate-spin" />
                  {t('entry.generatingSummary')}
                </div>
              ) : (
                <p className="whitespace-pre-line text-sm leading-relaxed">
                  {tweetSummary}
                </p>
              )}
            </div>
          )}

          {/* Inline AI action buttons - below content */}
          {tweetTextContent && (
            <div
              className="mt-2 flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={handleTranslateTweet}
                disabled={isTranslatingTweet}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                  showTweetTranslation && tweetTranslatedParagraphs.length > 0
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-tertiary hover:bg-accent/5 hover:text-accent'
                }`}
                title={t('social.translateTweet')}
              >
                {isTranslatingTweet ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Languages size={12} />
                )}
                {t('social.translateTweet')}
              </button>
              <button
                onClick={handleSummarizeTweet}
                disabled={isSummarizingTweet}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                  showTweetSummary && tweetSummary
                    ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                    : 'text-text-tertiary hover:bg-amber-50/50 hover:text-amber-600 dark:hover:bg-amber-900/10 dark:hover:text-amber-400'
                }`}
                title={t('social.summarizeTweet')}
              >
                {isSummarizingTweet ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Sparkles size={12} />
                )}
                {t('social.summarizeTweet')}
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
})

/** Floating action bar on social media items. */
function SocialActionBar({
  entry,
  browserOpenUrl,
  onContextMenu,
  onTranslate,
  onSummarize,
  isTranslating,
  isSummarizing,
  hasTranslation,
  showTranslation,
}: {
  entry: Entry
  browserOpenUrl?: string
  onContextMenu?: (e: React.MouseEvent) => void
  onTranslate?: () => void
  onSummarize?: () => void
  isTranslating?: boolean
  isSummarizing?: boolean
  hasTranslation?: boolean
  showTranslation?: boolean
}) {
  const { markRead, toggleStar } = useEntryStore()
  const { t } = useTranslation()
  const resolvedBrowserOpenUrl = useMemo(
    () => browserOpenUrl || resolveEntryBrowserOpenUrl(entry),
    [browserOpenUrl, entry],
  )

  return (
    <div
      className="absolute -right-2 top-0 z-10 -translate-y-1/2 rounded-lg border border-gray-200 bg-white/90 p-1 shadow-sm backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-800/90"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-0.5">
        {/* Translate */}
        <button
          onClick={onTranslate}
          disabled={isTranslating}
          className={`rounded-md p-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-neutral-700 ${
            showTranslation && hasTranslation
              ? 'text-accent'
              : 'text-text-secondary dark:text-text-dark-secondary'
          }`}
          title={t('social.translateTweet')}
        >
          {isTranslating ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Languages size={14} />
          )}
        </button>
        {/* Summarize */}
        <button
          onClick={onSummarize}
          disabled={isSummarizing}
          className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-gray-100 dark:text-text-dark-secondary dark:hover:bg-neutral-700"
          title={t('social.summarizeTweet')}
        >
          {isSummarizing ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
        </button>
        {/* Open in browser */}
        {resolvedBrowserOpenUrl && (
          <button
            onClick={() => {
              void openExternalUrlSafe(resolvedBrowserOpenUrl)
            }}
            className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-gray-100 dark:text-text-dark-secondary dark:hover:bg-neutral-700"
            title={t('contextMenu.openInBrowser')}
          >
            <Globe size={14} />
          </button>
        )}
        {/* Divider */}
        <div className="mx-0.5 h-4 w-px bg-gray-200 dark:bg-neutral-600" />
        {/* Mark read/unread */}
        <button
          onClick={() => markRead(entry.id, !entry.isRead)}
          className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-gray-100 dark:text-text-dark-secondary dark:hover:bg-neutral-700"
          title={
            entry.isRead
              ? t('contextMenu.markUnread')
              : t('contextMenu.markRead')
          }
        >
          {entry.isRead ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        {/* Star */}
        <StarToggle
          isStarred={entry.isStarred}
          onToggle={() => toggleStar(entry.id)}
          size={14}
          title={entry.isStarred ? t('common.unstar') : t('common.star')}
          className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-gray-100 dark:text-text-dark-secondary dark:hover:bg-neutral-700"
        />
        {/* More (context menu) */}
        <button
          onClick={(e) => onContextMenu?.(e)}
          className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-gray-100 dark:text-text-dark-secondary dark:hover:bg-neutral-700"
          title={t('contextMenu.more')}
        >
          <MoreHorizontal size={14} />
        </button>
      </div>
    </div>
  )
}

/** Parse social media platform handle from URL - supports X/Twitter, Telegram, Bluesky, Threads, Truth Social */
function parseSocialHandle(url: string): {
  type: 'x' | 'telegram' | 'bluesky' | 'threads' | 'truth' | 'other'
  handle?: string
} {
  // X / Twitter including Nitter mirrors.
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    if (
      host === 'x.com' ||
      host === 'twitter.com' ||
      host === 'www.twitter.com' ||
      host.includes('nitter')
    ) {
      const first = u.pathname.split('/').filter(Boolean)[0]
      if (first && /^[a-zA-Z0-9_]+$/.test(first))
        return { type: 'x', handle: normalizeSocialHandle(first) }
    }
  } catch {
    // Ignore parse failure; regex fallbacks below.
  }
  const xMatch = url.match(
    /(?:twitter\.com|x\.com|nitter\.[^/]+)\/([a-zA-Z0-9_]+)/,
  )
  if (xMatch) return { type: 'x', handle: normalizeSocialHandle(xMatch[1]) }
  // RSSHub twitter route
  const xRss = url.match(/\/twitter\/user\/([a-zA-Z0-9_]+)/)
  if (xRss) return { type: 'x', handle: normalizeSocialHandle(xRss[1]) }
  // Telegram
  const tgMatch = url.match(/(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]+)/)
  if (tgMatch) return { type: 'telegram', handle: tgMatch[1] }
  const tgRss = url.match(/\/telegram\/channel\/([a-zA-Z0-9_]+)/)
  if (tgRss) return { type: 'telegram', handle: tgRss[1] }
  // Bluesky
  const bskyMatch = url.match(/bsky\.(?:app|social)\/profile\/([a-zA-Z0-9_.]+)/)
  if (bskyMatch) return { type: 'bluesky', handle: bskyMatch[1] }
  const bskyRss = url.match(/\/bsky\/profile\/([a-zA-Z0-9_.]+)/)
  if (bskyRss) return { type: 'bluesky', handle: bskyRss[1] }
  // Threads
  const threadsMatch = url.match(/threads\.net\/@?([a-zA-Z0-9_.]+)/)
  if (threadsMatch)
    return { type: 'threads', handle: normalizeSocialHandle(threadsMatch[1]) }
  const threadsRss = url.match(/\/threads\/user\/([a-zA-Z0-9_.]+)/)
  if (threadsRss)
    return { type: 'threads', handle: normalizeSocialHandle(threadsRss[1]) }
  // Truth Social
  const truthMatch = url.match(/truthsocial\.com\/@?([a-zA-Z0-9_]+)/)
  if (truthMatch)
    return { type: 'truth', handle: normalizeSocialHandle(truthMatch[1]) }
  const truthRss = url.match(/\/truthsocial\/user\/([a-zA-Z0-9_]+)/)
  if (truthRss)
    return { type: 'truth', handle: normalizeSocialHandle(truthRss[1]) }
  return { type: 'other' }
}

function extractTwitterDisplayNameFromFeedTitle(
  feedTitle?: string,
  handle?: string,
): string {
  let cleaned = (feedTitle || '').trim()
  if (!cleaned) return ''

  cleaned = cleaned
    .replace(/\s*-\s*(?:x|twitter)\s*$/i, '')
    .replace(/\s+on\s+(?:x|twitter)\s*$/i, '')
    .replace(/\(\s*@?[a-zA-Z0-9_]{1,15}\s*\)/g, '')
    .trim()

  const slashParts = cleaned
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
  if (slashParts.length > 1) {
    const nonHandle = slashParts.find(
      (part) => !/^@?[a-zA-Z0-9_]{1,15}$/.test(part),
    )
    if (nonHandle) cleaned = nonHandle
  }
  cleaned = cleaned.replace(/\/\s*@?[a-zA-Z0-9_]{1,15}\s*$/i, '').trim()

  if (!cleaned) return ''
  if (
    handle &&
    cleaned.replace(/^@/, '').toLowerCase() ===
      handle.replace(/^@/, '').toLowerCase()
  )
    return ''
  return cleaned.replace(/^@+/, '').trim()
}

/** Smart media gallery for social items.
 *  Same-ratio: horizontal layout with proportional sizes.
 *  Different-ratio: CSS grid with aspect-square items.
 *  Clicking images bubbles up to open the detail overlay; lightbox is in SocialOverlay.
 */
function SocialMediaGallery({
  photos,
  cacheScope,
  onAllFailed,
  hasMirrorDerivedContent,
}: {
  photos: Array<{
    url: string
    previewUrl?: string
    width?: number
    height?: number
    blurhash?: string
  }>
  cacheScope: string
  onAllFailed?: () => void
  hasMirrorDerivedContent?: boolean
}) {
  const allFailedNotifiedRef = useRef(false)
  const [failedPhotoTokens, setFailedPhotoTokens] = useState<Set<string>>(
    new Set(),
  )
  const [loadedPhotoTokens, setLoadedPhotoTokens] = useState<Set<string>>(
    new Set(),
  )
  const [suppressedPhotoTokens, setSuppressedPhotoTokens] = useState<
    Set<string>
  >(new Set())
  useEffect(() => {
    allFailedNotifiedRef.current = false
    setFailedPhotoTokens(new Set())
    setLoadedPhotoTokens(new Set())
    setSuppressedPhotoTokens(new Set())
  }, [cacheScope, photos])

  const uniquePhotos = useMemo(() => {
    return dedupeGalleryPhotoVariants(photos)
  }, [photos])

  const getPhotoCacheToken = useCallback(
    (photo: { url: string; previewUrl?: string }) => {
      const key = getPhotoDedupeKey(photo.url || '', photo.previewUrl || '')
      if (key) return key
      return normalizeImageCacheKey(photo.url || photo.previewUrl || '')
    },
    [],
  )

  const markPhotoFailed = useCallback(
    (photo: { url: string; previewUrl?: string }) => {
      const token = getPhotoCacheToken(photo)
      if (!token) return
      setFailedPhotoTokens((prev) => {
        if (prev.has(token)) return prev
        const next = new Set(prev)
        next.add(token)
        return next
      })
    },
    [getPhotoCacheToken],
  )

  const getInitialSrc = useCallback(
    (photo: { url: string; previewUrl?: string }) => {
      // Prefer previewUrl (mirror/proxy URL) when available — CDN signed URLs expire quickly.
      if (photo.previewUrl) {
        const raw = decodeHtmlEntitiesUrl(photo.previewUrl)
        if (raw && /^https?:\/\//i.test(raw)) {
          return getRememberedMediaSrc(raw, raw)
        }
      }
      const seedUrl = decodeMediaUrl(photo.url || '')
      const primaryUrl = decodeMediaUrl(photo.url || '')
      return getRememberedMediaSrc(seedUrl, primaryUrl || seedUrl)
    },
    [],
  )

  const visiblePhotos = useMemo(() => {
    if (suppressedPhotoTokens.size === 0) return uniquePhotos
    return uniquePhotos.filter((photo) => {
      const token = getPhotoCacheToken(photo)
      return !token || !suppressedPhotoTokens.has(token)
    })
  }, [getPhotoCacheToken, suppressedPhotoTokens, uniquePhotos])

  useEffect(() => {
    if (uniquePhotos.length < 2) return
    const lastPhoto = uniquePhotos[uniquePhotos.length - 1]
    const lastToken = getPhotoCacheToken(lastPhoto)
    if (
      !lastToken ||
      !failedPhotoTokens.has(lastToken) ||
      suppressedPhotoTokens.has(lastToken)
    )
      return
    if (!hasMirrorDerivedContent) return
    if (!isInstagramLikeGalleryPhoto(lastPhoto)) return

    let allPreviousLoaded = true
    for (let index = 0; index < uniquePhotos.length - 1; index += 1) {
      const token = getPhotoCacheToken(uniquePhotos[index])
      if (
        !token ||
        !loadedPhotoTokens.has(token) ||
        failedPhotoTokens.has(token)
      ) {
        allPreviousLoaded = false
        break
      }
    }

    if (!allPreviousLoaded) return
    setSuppressedPhotoTokens((prev) => {
      if (prev.has(lastToken)) return prev
      const next = new Set(prev)
      next.add(lastToken)
      return next
    })
  }, [
    failedPhotoTokens,
    getPhotoCacheToken,
    hasMirrorDerivedContent,
    loadedPhotoTokens,
    suppressedPhotoTokens,
    uniquePhotos,
  ])

  useEffect(() => {
    if (visiblePhotos.length === 0) return
    let visibleFailedCount = 0
    for (const photo of visiblePhotos) {
      const token = getPhotoCacheToken(photo)
      if (token && failedPhotoTokens.has(token)) visibleFailedCount += 1
    }
    if (visibleFailedCount !== visiblePhotos.length) return
    if (allFailedNotifiedRef.current) return
    allFailedNotifiedRef.current = true
    onAllFailed?.()
  }, [failedPhotoTokens, getPhotoCacheToken, onAllFailed, visiblePhotos])

  const rememberLoadedSrc = useCallback(
    (
      photo: { url: string; previewUrl?: string },
      _index: number,
      _img: HTMLImageElement,
    ) => {
      const token = getPhotoCacheToken(photo)
      if (!token) return
      rememberMediaSrc(
        decodeMediaUrl(photo.url || photo.previewUrl || ''),
        decodeMediaUrl(
          _img.currentSrc || _img.src || photo.url || photo.previewUrl || '',
        ),
      )
      setLoadedPhotoTokens((prev) => {
        if (prev.has(token)) return prev
        const next = new Set(prev)
        next.add(token)
        return next
      })
    },
    [getPhotoCacheToken],
  )

  const handlePhotoError = useCallback(
    (
      photo: { url: string; previewUrl?: string },
      index: number,
      e: SyntheticEvent<HTMLImageElement>,
    ) => {
      advanceCardImageFallback(
        e,
        photo.url || photo.previewUrl || '',
        (img) => {
          img.style.display = 'none'
          markPhotoFailed(photo)
        },
        photo.previewUrl,
      )
    },
    [markPhotoFailed],
  )

  // Detect whether all photos share the same aspect ratio.
  const allSameRatio = useMemo(() => {
    if (visiblePhotos.length <= 1) return true
    let ratio = 0
    for (const p of visiblePhotos) {
      if (p.width && p.height) {
        const r = p.height / p.width
        if (ratio === 0) ratio = r
        else if (ratio !== r) return false
      } else {
        return false
      }
    }
    return true
  }, [visiblePhotos])

  // Use CSS-driven responsive sizing to avoid one-frame stale-width jumps on window resize.

  return (
    <>
      {allSameRatio && visiblePhotos.every((p) => p.width && p.height) ? (
        /* Same ratio: horizontal layout */
        <div className="mt-4 flex gap-[8px] overflow-x-auto pb-2">
          {visiblePhotos.map((photo, i, list) => {
            const widthClass =
              list.length === 1
                ? 'w-full'
                : list.length === 2
                  ? 'w-[calc((100%-8px)/2)]'
                  : 'w-[calc((100%-16px)/3)]'
            const token = getPhotoCacheToken(photo)
            const isFailed = !!token && failedPhotoTokens.has(token)
            return (
              <div
                key={`${token || 'media'}:${i}`}
                className={`relative shrink-0 rounded ${widthClass}`}
                style={{
                  aspectRatio:
                    photo.width && photo.height
                      ? `${photo.width} / ${photo.height}`
                      : undefined,
                  height: 'auto',
                  maxHeight: list.length === 1 ? '66vh' : undefined,
                  backgroundColor: photo.blurhash
                    ? blurhashToAverageColor(photo.blurhash)
                    : undefined,
                }}
              >
                {isFailed ? (
                  <div className="dark:text-text-dark-tertiary flex h-full min-h-[120px] w-full items-center justify-center rounded bg-surface-tertiary text-xs text-text-tertiary dark:bg-surface-dark-tertiary">
                    图片加载失败
                  </div>
                ) : (
                  <img
                    src={getInitialSrc(photo)}
                    alt=""
                    className="h-full w-full rounded object-cover"
                    loading={i === 0 ? 'eager' : 'lazy'}
                    fetchPriority={i === 0 ? 'high' : 'auto'}
                    referrerPolicy="no-referrer"
                    onLoad={(e) => {
                      e.currentTarget.style.display = ''
                      rememberLoadedSrc(photo, i, e.currentTarget)
                    }}
                    onError={(e) => handlePhotoError(photo, i, e)}
                  />
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* Different ratios: CSS grid */
        <div className="mt-4">
          {visiblePhotos.length === 1 ? (
            (() => {
              const photo = visiblePhotos[0]
              const token = getPhotoCacheToken(photo)
              const isFailed = !!token && failedPhotoTokens.has(token)
              return isFailed ? (
                <div
                  className="dark:text-text-dark-tertiary flex w-full items-center justify-center rounded bg-surface-tertiary text-sm text-text-tertiary dark:bg-surface-dark-tertiary"
                  style={{ maxHeight: '70vh', minHeight: '240px' }}
                >
                  图片加载失败
                </div>
              ) : (
                <img
                  src={getInitialSrc(photo)}
                  alt=""
                  className="h-auto w-full rounded object-contain"
                  style={{
                    maxHeight: '70vh',
                    backgroundColor: photo.blurhash
                      ? blurhashToAverageColor(photo.blurhash)
                      : undefined,
                  }}
                  loading="eager"
                  fetchPriority="high"
                  referrerPolicy="no-referrer"
                  onLoad={(e) => {
                    e.currentTarget.style.display = ''
                    rememberLoadedSrc(photo, 0, e.currentTarget)
                  }}
                  onError={(e) => handlePhotoError(photo, 0, e)}
                />
              )
            })()
          ) : (
            <div
              className={`grid gap-2 ${
                visiblePhotos.length === 2
                  ? 'grid-cols-2'
                  : visiblePhotos.length === 3
                    ? 'grid-cols-2'
                    : visiblePhotos.length === 4
                      ? 'grid-cols-2'
                      : visiblePhotos.length >= 5
                        ? 'grid-cols-3'
                        : ''
              }`}
            >
              {visiblePhotos.map((photo, i) => {
                const token = getPhotoCacheToken(photo)
                const isFailed = !!token && failedPhotoTokens.has(token)
                return (
                  <div
                    key={`${token || 'media'}:${i}`}
                    className="relative aspect-square w-full"
                    style={{
                      ...(visiblePhotos.length === 3 && i === 2
                        ? { gridRow: 'span 2' }
                        : {}),
                    }}
                  >
                    {isFailed ? (
                      <div className="dark:text-text-dark-tertiary flex h-full w-full items-center justify-center rounded bg-surface-tertiary text-xs text-text-tertiary dark:bg-surface-dark-tertiary">
                        图片加载失败
                      </div>
                    ) : (
                      <img
                        src={getInitialSrc(photo)}
                        alt=""
                        className="aspect-square w-full rounded object-cover"
                        style={{
                          backgroundColor: photo.blurhash
                            ? blurhashToAverageColor(photo.blurhash)
                            : undefined,
                        }}
                        loading={i === 0 ? 'eager' : 'lazy'}
                        fetchPriority={i === 0 ? 'high' : 'auto'}
                        referrerPolicy="no-referrer"
                        onLoad={(e) => {
                          e.currentTarget.style.display = ''
                          rememberLoadedSrc(photo, i, e.currentTarget)
                        }}
                        onError={(e) => handlePhotoError(photo, i, e)}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </>
  )
}
