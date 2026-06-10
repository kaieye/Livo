/**
 * WideViewContent - Full-width content panel for Social Media / Videos views.
 *
 * These views use a 2-column layout: sidebar + content.
 * There is NO separate entry-list or entry-detail panel - the content
 * fills the entire remaining area after the sidebar.
 *
 * Interaction model:
 * - Videos: click shows modal with embedded player + title + description
 * - Social media: click shows animated overlay with full entry content;
 *   double-click opens in browser; Escape closes overlay
 */
import {
  lazy,
  Suspense,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  useLayoutEffect,
  type SyntheticEvent,
  type UIEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { openExternalUrlSafe } from '../../services/external-url'
import { useEntryStore } from '../../store/entry-store'
import { useFeedStore } from '../../store/feed-store'
import { useAppIsHydrated } from '../../store/app-store'
import { useStoreShallow } from '../../store/helpers'
import {
  useGeneralSettingKey,
  useGeneralSettingsShallowSelector,
  useTranslationSettingKey,
} from '../../store/settings-store'
import {
  FeedViewType,
  VIEW_DEFINITIONS,
  type Entry,
} from '../../../../shared/types'
import { VIEW_TYPE_I18N_KEYS } from '../../lib/view-type-keys'
import { RECOMMENDED_CATEGORY } from '../../hooks/useInitRecommendedFeeds'
import { formatDistanceToNow } from 'date-fns'
import { getDateLocale } from '../../lib/date-locale'
import { SkeletonList } from '../ui/Skeleton'
import {
  ContextMenu,
  useEntryContextMenu,
  useEntryContextActions,
} from '../ui/ContextMenu'
import { ScrollArea } from '../ui/ScrollArea'
import { transformVideoUrl } from '../media/MediaPlayer'
import { usePictureMasonry } from '../../hooks/usePictureMasonry'
import { useTimelineView } from '../../hooks/useTimelineView'
import { useVideoGrid } from '../../hooks/useVideoGrid'
import { useOverlayMediaGallery } from '../../hooks/useOverlayMediaGallery'
import { useLayoutFocusTarget } from '../../hooks/useLayoutFocusTarget'
import { useSocialOverlayAvatar } from '../../hooks/useSocialOverlayAvatar'
import { useWideViewEntries } from '../../hooks/useWideViewEntries'
import { useRegisterCommand } from '../../hooks/useRegisterCommand'
import { useStableHomeFeedLoadOptions } from '../../hooks/useStableHomeFeedLoadOptions'
import { canonicalizeSocialUrl } from '../../lib/social-url'
import { HOTKEY_OVERLAY_SCOPES } from '../../lib/hotkey-scope'
import {
  buildBilibiliInAppPlayerUrl,
  normalizeBilibiliVideoUrl,
  resolveBilibiliVideoPageUrl,
} from '../../lib/bilibili-video'
import { getImageProxyFallbackUrls } from '../../lib/image-proxy'
import { getEntryLoadLimit } from '../../lib/entry-load-limit'
import {
  areHomeFeedLoadOptionsEqual,
  buildHomeFeedLoadOptions,
} from '../../lib/home-feed-scope'
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
  rememberedMasonrySizeByUrl,
  type MasonryCardData,
} from '../../lib/picture-masonry'
import { sanitizeHTML } from '../../utils/sanitize'
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
  normalizeImageCacheKey,
  normalizeInstagramUnavatar,
  resolveEntryBrowserOpenUrl,
  withCacheBust,
} from '../../lib/social-entry-utils'
import { Loader2, Inbox, RefreshCw, X, ExternalLink } from 'lucide-react'
import { WideViewHeader } from './WideViewHeader'
import { ViewRecommendations } from './ViewRecommendations'
import { useAISummary } from '../../hooks/useAISummary'
import { useAITranslation } from '../../hooks/useAITranslation'
import { AISummaryPanel } from './AISummaryPanel'
import { markStartupComponentMounted } from '../../lib/startup-block-diagnostics'

const SharePoster = lazy(() =>
  import('../ui/SharePoster').then((module) => ({
    default: module.SharePoster,
  })),
)
const PictureMasonry = lazy(() =>
  import('./PictureMasonry').then((module) => ({
    default: module.PictureMasonry,
  })),
)
const TimelineSection = lazy(() =>
  import('./TimelineSection').then((module) => ({
    default: module.TimelineSection,
  })),
)
const VideoGridSection = lazy(() =>
  import('./VideoGridSection').then((module) => ({
    default: module.VideoGridSection,
  })),
)
const SocialOverlayView = lazy(() =>
  import('./SocialOverlayView').then((module) => ({
    default: module.SocialOverlayView,
  })),
)

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

function getVideoColumnCount(containerWidth: number): number {
  return containerWidth >= 1600
    ? 5
    : containerWidth >= 1200
      ? 4
      : containerWidth >= 800
        ? 3
        : 2
}

function getMasonryColumnCount(containerWidth: number): number {
  return containerWidth >= 1600
    ? 7
    : containerWidth >= 1400
      ? 6
      : containerWidth >= 1100
        ? 5
        : containerWidth >= 800
          ? 4
          : 3
}

const MASONRY_INITIAL_RENDER = 30
const MASONRY_RENDER_BATCH = 40
const PAGED_LOAD_MORE_SCROLL_GUARD_PX = 120
const SOCIAL_PAGED_LOAD_MORE_BOTTOM_OFFSET_PX = 280
const VIDEO_PAGED_LOAD_MORE_BOTTOM_OFFSET_PX = 1100
const EMPTY_SCOPED_ENTRIES: Entry[] = []

const rememberedContainerWidthByView = new Map<string, number>()

/** Return true when the plain-text description adds no information beyond the title. */
function isDescriptionRedundant(
  title: string,
  descriptionHtml: string,
): boolean {
  return isRedundantRichText(title, descriptionHtml)
}

function buildOverlayPhotoFallbackCandidates(
  primaryUrl: string,
  coverUrl: string,
  mirrorOriginUrl: string,
): string[] {
  const proxyFallbacks = getImageProxyFallbackUrls(
    mirrorOriginUrl || coverUrl || primaryUrl,
    {
      width: 1600,
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

function advanceOverlayPhotoFallback(
  e: SyntheticEvent<HTMLImageElement>,
  seedUrl: string,
  onExhausted?: (img: HTMLImageElement) => void,
  previewUrl?: string,
): void {
  const img = e.currentTarget
  const normalizedSeed = decodeMediaUrl(seedUrl || '')
  const originFromMirror =
    extractPixnoyOriginUrl(seedUrl) || extractPixnoyOriginUrl(normalizedSeed)
  const candidates = buildOverlayPhotoFallbackCandidates(
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
          const mirrorProxyFallbacks = getImageProxyFallbackUrls(pUrl, {
            width: 1600,
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

export function WideViewContent() {
  useEffect(() => {
    markStartupComponentMounted('WideViewContent')
  }, [])

  const appIsHydrated = useAppIsHydrated()
  const {
    entries,
    isLoading,
    isLoadingMore,
    hasMoreEntries,
    loadEntries,
    loadSnapshot,
    loadMoreEntries,
    paginationOptions,
    paginationPageSize,
    selectEntry,
    markAllRead,
    markAboveRead,
    markBelowRead,
    searchQuery,
    setSearchQuery,
    search,
  } = useStoreShallow(useEntryStore, (s) => ({
    entries: s.entries,
    isLoading: s.isLoading,
    isLoadingMore: s.isLoadingMore,
    hasMoreEntries: s.hasMoreEntries,
    loadEntries: s.loadEntries,
    loadSnapshot: s.loadSnapshot,
    loadMoreEntries: s.loadMoreEntries,
    paginationOptions: s.paginationOptions,
    paginationPageSize: s.paginationPageSize,
    selectEntry: s.selectEntry,
    markAllRead: s.markAllRead,
    markAboveRead: s.markAboveRead,
    markBelowRead: s.markBelowRead,
    searchQuery: s.searchQuery,
    setSearchQuery: s.setSearchQuery,
    search: s.search,
  }))
  const {
    selectedFeedId,
    feeds,
    activeView,
    refreshFeed,
    refreshMultiple,
    refreshAll,
    isRefreshing,
    refreshProgress,
  } = useStoreShallow(useFeedStore, (s) => ({
    selectedFeedId: s.selectedFeedId,
    feeds: s.feeds,
    activeView: s.activeView,
    refreshFeed: s.refreshFeed,
    refreshMultiple: s.refreshMultiple,
    refreshAll: s.refreshAll,
    isRefreshing: s.isRefreshing,
    refreshProgress: s.refreshProgress,
  }))
  const general = useGeneralSettingsShallowSelector((settings) => ({
    showRecommended: settings.showRecommended,
    language: settings.language,
    groupByDate: settings.groupByDate,
    videoPagination: settings.videoPagination,
    videosPerPage: settings.videosPerPage,
    bilibiliOpenInPage: settings.bilibiliOpenInPage,
    dimRead: settings.dimRead,
  }))
  const { t } = useTranslation()
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all')

  // Derive effective active view: when in "All" view (activeView=null) but
  // a Pictures/Social/Videos feed is selected, use the feed's view type so
  // the wide-view content renders with the proper layout and behaviour.
  const effectiveActiveView = useMemo(() => {
    if (activeView !== null) return activeView
    if (!selectedFeedId) return null
    const feed = feeds.find((f) => f.id === selectedFeedId)
    const feedView = feed?.view ?? FeedViewType.Articles
    return [
      FeedViewType.SocialMedia,
      FeedViewType.Videos,
      FeedViewType.Pictures,
    ].includes(feedView)
      ? feedView
      : null
  }, [activeView, selectedFeedId, feeds])
  const [masonryProbeVersion, setMasonryProbeVersion] = useState(0)
  const entryLoadLimit = useMemo(
    () => getEntryLoadLimit(effectiveActiveView),
    [effectiveActiveView],
  )
  const canUseArticleSearch =
    effectiveActiveView !== FeedViewType.SocialMedia &&
    effectiveActiveView !== FeedViewType.Pictures &&
    effectiveActiveView !== FeedViewType.Videos
  const activeSearchQuery = canUseArticleSearch ? searchQuery : ''
  const hasActiveSearchQuery = activeSearchQuery.trim().length > 0

  // Video modal state
  const [videoEntry, setVideoEntry] = useState<Entry | null>(null)
  const [inlineBilibili, setInlineBilibili] = useState<{
    entry: Entry
    url: string
  } | null>(null)

  // Social media overlay state.
  const [socialEntry, setSocialEntry] = useState<Entry | null>(null)

  const videoGridRef = useRef<HTMLDivElement>(null)
  // Context menu state
  const { menuState, showMenu, hideMenu } = useEntryContextMenu()
  // Share poster state
  const [posterEntry, setPosterEntry] = useState<Entry | null>(null)

  const viewDef =
    effectiveActiveView !== null ? VIEW_DEFINITIONS[effectiveActiveView] : null
  const feedById = useMemo(
    () => new Map(feeds.map((f) => [f.id, f] as const)),
    [feeds],
  )
  const userFeeds = useMemo(
    () => feeds.filter((f) => f.category !== RECOMMENDED_CATEGORY),
    [feeds],
  )

  const derivedLoadOptions = useMemo(
    () =>
      buildHomeFeedLoadOptions({
        selectedFeedId,
        activeView: effectiveActiveView,
        feeds: userFeeds,
        unreadOnly: filterMode === 'unread',
        limit: entryLoadLimit,
      }),
    [
      effectiveActiveView,
      entryLoadLimit,
      filterMode,
      selectedFeedId,
      userFeeds,
    ],
  )
  const currentLoadOptions = useStableHomeFeedLoadOptions(derivedLoadOptions)
  const entriesMatchCurrentScope = useMemo(
    () =>
      areHomeFeedLoadOptionsEqual(currentLoadOptions, {
        ...paginationOptions,
        limit: paginationPageSize || undefined,
      }),
    [currentLoadOptions, paginationOptions, paginationPageSize],
  )
  const scopedEntries = useMemo(
    () => (entriesMatchCurrentScope ? entries : EMPTY_SCOPED_ENTRIES),
    [entries, entriesMatchCurrentScope],
  )
  const scopedIsLoading = isLoading || !entriesMatchCurrentScope
  const scopedHasMoreEntries = entriesMatchCurrentScope && hasMoreEntries

  // Loading entries when feed selection changes
  useEffect(() => {
    if (!appIsHydrated) return
    void loadSnapshot(currentLoadOptions)
  }, [appIsHydrated, currentLoadOptions, loadSnapshot])

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      search(activeSearchQuery)
    },
    [activeSearchQuery, search],
  )

  const currentFeed = selectedFeedId ? feedById.get(selectedFeedId) : undefined
  const title =
    selectedFeedId === 'starred'
      ? t('entryList.starred')
      : currentFeed?.title ||
        (viewDef
          ? t(VIEW_TYPE_I18N_KEYS[effectiveActiveView!] || 'common.all')
          : t('common.all'))

  const reloadCurrentList = useCallback(() => {
    void loadEntries(currentLoadOptions)
  }, [currentLoadOptions, loadEntries])
  const handleSearchQueryChange = useCallback(
    (value: string) => {
      setSearchQuery(value)
      if (!value.trim()) {
        reloadCurrentList()
      }
    },
    [reloadCurrentList, setSearchQuery],
  )
  const handleRefreshCurrentView = useCallback(async () => {
    if (selectedFeedId && selectedFeedId !== 'starred') {
      await refreshFeed(selectedFeedId)
    } else if (effectiveActiveView !== null) {
      const currentViewFeedIds = feeds
        .filter(
          (f) => (f.view ?? FeedViewType.Articles) === effectiveActiveView,
        )
        .map((f) => f.id)
      await refreshMultiple(currentViewFeedIds)
    } else {
      await refreshAll()
    }
    reloadCurrentList()
  }, [
    effectiveActiveView,
    feeds,
    refreshAll,
    refreshFeed,
    refreshMultiple,
    reloadCurrentList,
    selectedFeedId,
  ])

  useRegisterCommand({
    id: 'wide-view:refresh-current',
    shortcutId: 'refresh-current',
    scopes: ['content'],
    blockedScopes: HOTKEY_OVERLAY_SCOPES,
    handler: (event) => {
      if (isRefreshing || isEditableTarget(event.target)) return false
      event.preventDefault()
      void handleRefreshCurrentView()
    },
  })

  const {
    renderEntries,
    timelineEntries,
    shouldShowLoadingSkeleton,
    timelineIndexById,
    timelineFeedMetaByEntryId,
    videoFeedMetaByEntryId,
    renderEntryById,
    renderEntryIndexById,
  } = useWideViewEntries({
    entries: scopedEntries,
    feeds,
    feedById,
    activeView: effectiveActiveView,
    selectedFeedId,
    showRecommended: general.showRecommended,
    isLoading: scopedIsLoading,
  })
  const isPicturesAllView =
    effectiveActiveView === FeedViewType.Pictures && !selectedFeedId
  const isTimelineView =
    effectiveActiveView === FeedViewType.SocialMedia ||
    (effectiveActiveView === FeedViewType.Pictures && !!selectedFeedId)
  // Pre-compute masonry card data to avoid per-render extraction
  const masonryCards = useMemo<MasonryCardData[]>(() => {
    if (!isPicturesAllView) return []
    const result: MasonryCardData[] = []
    for (const entry of renderEntries) {
      let firstImage = ''
      let firstImageWidth: number | undefined
      let firstImageHeight: number | undefined
      let firstImageBlurhash: string | undefined
      let photoCount = 0
      for (const m of entry.media || []) {
        if (m.type !== 'photo') continue
        const url = decodeMediaUrl(m.previewUrl || m.url || '')
        if (!url || !isLikelyImageByUrl(url) || isDecorativeSocialImageUrl(url))
          continue
        if (hasTinyDecorativeDimensions(m.width, m.height)) continue
        photoCount++
        if (!firstImage) {
          const rememberedSize = rememberedMasonrySizeByUrl.get(url)
          firstImage = url
          firstImageWidth = m.width || rememberedSize?.width
          firstImageHeight = m.height || rememberedSize?.height
          firstImageBlurhash = m.blurhash
        }
      }
      if (!firstImage) {
        const fallback = decodeMediaUrl(entry.imageUrl || '')
        if (
          fallback &&
          isLikelyImageByUrl(fallback) &&
          !isDecorativeSocialImageUrl(fallback)
        ) {
          const rememberedSize = rememberedMasonrySizeByUrl.get(fallback)
          firstImage = fallback
          firstImageWidth = rememberedSize?.width
          firstImageHeight = rememberedSize?.height
        }
      }
      if (!firstImage) continue
      result.push({
        id: entry.id,
        feedId: entry.feedId,
        firstImage,
        width: firstImageWidth,
        height: firstImageHeight,
        blurhash: firstImageBlurhash,
        photoCount,
        publishedAt: entry.publishedAt || 0,
      })
    }
    void masonryProbeVersion
    return result
  }, [isPicturesAllView, masonryProbeVersion, renderEntries])

  const dateLocale = useMemo(() => {
    void general.language
    return getDateLocale()
  }, [general.language])
  // Measure container width for masonry / grid.
  // Keep updates synchronous with ResizeObserver to avoid one-frame stale widths on window resize.
  const containerRef = useRef<HTMLDivElement>(null)
  const isContentFocusHighlighted = useLayoutFocusTarget(
    'content',
    containerRef,
  )
  const lastScrollScopeRef = useRef<string>('')
  const viewKey = `${effectiveActiveView ?? 'all'}:${selectedFeedId ?? ''}`
  const [containerWidth, setContainerWidth] = useState(
    () => rememberedContainerWidthByView.get(viewKey) ?? 0,
  )
  const {
    shouldUseVirtualTimeline,
    renderedEntries: renderedTimelineEntries,
    groupedEntries: groupedRenderedTimelineEntries,
    virtualizer: timelineVirtualizer,
    virtualItems: virtualTimelineItems,
    handleScroll: handleTimelineScroll,
  } = useTimelineView({
    enabled: isTimelineView,
    entries: timelineEntries,
    groupByDate: general.groupByDate,
    scrollElementRef: containerRef,
    cacheKey: `${viewKey}:timeline`,
  })
  const handlePagedEntryScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget
      const hasScrolledEnough = el.scrollTop > PAGED_LOAD_MORE_SCROLL_GUARD_PX
      const bottomOffset =
        effectiveActiveView === FeedViewType.Videos
          ? VIDEO_PAGED_LOAD_MORE_BOTTOM_OFFSET_PX
          : SOCIAL_PAGED_LOAD_MORE_BOTTOM_OFFSET_PX
      const nearBottom =
        el.scrollTop + el.clientHeight >= el.scrollHeight - bottomOffset
      if (!nearBottom || !hasScrolledEnough) return
      if (hasActiveSearchQuery) return
      if (!scopedHasMoreEntries || isLoadingMore) return
      void loadMoreEntries()
    },
    [
      effectiveActiveView,
      hasActiveSearchQuery,
      isLoadingMore,
      loadMoreEntries,
      scopedHasMoreEntries,
    ],
  )

  useEffect(() => {
    if (!isPicturesAllView) return
    if (hasActiveSearchQuery) return
    if (!scopedHasMoreEntries || isLoadingMore) return
    // If initial viewport has too few image cards to produce scrolling,
    // prefetch additional pages so user can see more results immediately.
    if (masonryCards.length >= MASONRY_INITIAL_RENDER) return
    void loadMoreEntries()
  }, [
    isPicturesAllView,
    hasActiveSearchQuery,
    isLoadingMore,
    masonryCards.length,
    loadMoreEntries,
    scopedHasMoreEntries,
  ])

  useEffect(() => {
    const nextScope = `${effectiveActiveView ?? 'all'}:${selectedFeedId ?? 'all'}`
    if (lastScrollScopeRef.current === nextScope) return
    lastScrollScopeRef.current = nextScope
    const el = containerRef.current
    if (!el) return
    el.scrollTo({ top: 0, behavior: 'auto' })
  }, [effectiveActiveView, selectedFeedId])

  // Single useLayoutEffect: measure + observe container width for Videos/Pictures,
  // and sync cached width on view switch to prevent flash.
  useLayoutEffect(() => {
    // Sync cached width immediately to prevent first-render flash
    const cached = rememberedContainerWidthByView.get(viewKey)
    if (cached) {
      setContainerWidth((prev) => (prev === cached ? prev : cached))
    }

    // Only Videos and Pictures views need ResizeObserver + width tracking
    if (effectiveActiveView !== FeedViewType.Videos && !isPicturesAllView)
      return

    const el = containerRef.current
    if (!el) return

    const updateWidth = () => {
      const newWidth = Math.round(el.getBoundingClientRect().width)
      rememberedContainerWidthByView.set(viewKey, newWidth)
      setContainerWidth((prev) => (prev === newWidth ? prev : newWidth))
    }

    updateWidth()

    const ro = new ResizeObserver(updateWidth)
    ro.observe(el)
    window.addEventListener('resize', updateWidth)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', updateWidth)
    }
  }, [effectiveActiveView, isPicturesAllView, viewKey])

  const videoColumnCount = useMemo(
    () => getVideoColumnCount(containerWidth),
    [containerWidth],
  )
  const {
    viewModel: videoViewModel,
    goPrevPage,
    goNextPage,
  } = useVideoGrid({
    activeView: effectiveActiveView,
    entries: renderEntries,
    videoColumnCount,
    videoPaginationEnabled: general.videoPagination,
    configuredVideosPerPage: Number(general.videosPerPage) || 20,
    inlineBilibiliOpen: !!inlineBilibili,
    containerRef,
    videoGridRef,
    pageScopeKey: `${effectiveActiveView ?? 'all'}:${selectedFeedId ?? 'all'}:${filterMode}`,
  })
  const masonryColumnCount = useMemo(
    () => getMasonryColumnCount(containerWidth),
    [containerWidth],
  )
  const {
    renderLimit: masonryRenderLimit,
    setRenderLimit: setMasonryRenderLimit,
    visibleCards: visibleMasonryCards,
    columns: masonryColumns,
    isFirstScreenReady: isMasonryFirstScreenReady,
    isContentVisible: isMasonryContentVisible,
  } = usePictureMasonry({
    enabled: isPicturesAllView,
    cards: masonryCards,
    entries: renderEntries,
    columnCount: masonryColumnCount,
    containerWidth,
    scopeKey: `${effectiveActiveView ?? 'all'}:${selectedFeedId ?? 'all'}`,
    decodeMediaUrl,
    onCacheUpdated: () => setMasonryProbeVersion((prev) => prev + 1),
  })
  const handleMasonryScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      if (!isPicturesAllView) return
      if (masonryRenderLimit >= masonryCards.length) return
      const el = e.currentTarget
      const hasScrolledEnough = el.scrollTop > 120
      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 900
      if (!nearBottom || !hasScrolledEnough) return
      setMasonryRenderLimit((prev) =>
        Math.min(prev + MASONRY_RENDER_BATCH, masonryCards.length),
      )
    },
    [
      isPicturesAllView,
      masonryCards.length,
      masonryRenderLimit,
      setMasonryRenderLimit,
    ],
  )

  // Click handler: for Bilibili (open-in-page ON), play inline in current page; otherwise open modal
  const handleVideoClick = useCallback(
    (entry: Entry) => {
      selectEntry(entry) // marks read
      const shouldInlineBilibili = general.bilibiliOpenInPage
      const bilibiliUrl = shouldInlineBilibili
        ? resolveBilibiliVideoPageUrl(entry)
        : null
      if (bilibiliUrl) {
        setVideoEntry(null)
        setInlineBilibili({ entry, url: bilibiliUrl })
        return
      }
      setInlineBilibili(null)
      setVideoEntry(entry)
    },
    [general.bilibiliOpenInPage, selectEntry],
  )

  // Click handler: single-click opens the social overlay, double-click opens the browser.
  const handleSocialClick = useCallback(
    (entry: Entry) => {
      selectEntry(entry) // marks read
      setSocialEntry(entry)
    },
    [selectEntry],
  )

  const handleSocialDoubleClick = useCallback((entry: Entry) => {
    if (!entry.url) return
    const target = canonicalizeSocialUrl(entry.url)
    if (!target) return
    void openExternalUrlSafe(target)
  }, [])

  const handleSocialBilibiliOpenInPage = useCallback(
    (entry: Entry, url: string) => {
      selectEntry(entry)
      setVideoEntry(null)
      setSocialEntry(null)
      setInlineBilibili({ entry, url })
    },
    [selectEntry],
  )

  // Close social overlay on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (videoEntry) setVideoEntry(null)
        else if (inlineBilibili) setInlineBilibili(null)
        else if (socialEntry) setSocialEntry(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [videoEntry, inlineBilibili, socialEntry])

  useEffect(() => {
    const canStayInline =
      effectiveActiveView === FeedViewType.Videos ||
      effectiveActiveView === FeedViewType.SocialMedia
    if (!canStayInline || !general.bilibiliOpenInPage) {
      setInlineBilibili(null)
    }
  }, [effectiveActiveView, general.bilibiliOpenInPage])

  useEffect(() => {
    // Switching subscription/feed should always exit full-page inline player.
    setInlineBilibili(null)
  }, [selectedFeedId])

  return (
    <div className="dark:bg-surface-dark relative flex min-w-0 flex-1 flex-col bg-white">
      <WideViewHeader
        activeView={effectiveActiveView}
        inlineBilibili={!!inlineBilibili}
        title={title}
        viewDef={viewDef}
        filterMode={filterMode}
        isRefreshing={isRefreshing}
        refreshProgress={refreshProgress}
        searchQuery={activeSearchQuery}
        onBack={() => setInlineBilibili(null)}
        onRefresh={handleRefreshCurrentView}
        onToggleUnreadFilter={() =>
          setFilterMode(filterMode === 'unread' ? 'all' : 'unread')
        }
        onMarkAllRead={() => markAllRead(selectedFeedId || undefined)}
        onSearch={handleSearch}
        onSearchQueryChange={handleSearchQueryChange}
        onSetFilterMode={setFilterMode}
      />

      {/* Content area - fills remaining space */}
      <ScrollArea
        ref={containerRef}
        rootClassName={`flex-1 min-h-0 transition-shadow duration-300 ${
          isContentFocusHighlighted
            ? 'shadow-[inset_0_0_0_2px_rgba(255,92,0,0.55)]'
            : ''
        }`}
        viewportClassName={`h-full ${
          effectiveActiveView === FeedViewType.Videos ||
          isPicturesAllView ||
          (effectiveActiveView === FeedViewType.SocialMedia && !!inlineBilibili)
            ? 'overflow-hidden'
            : 'overflow-y-auto'
        }`}
        tabIndex={-1}
        onScroll={(e) => {
          handleTimelineScroll(e)
          handleMasonryScroll(e)
          handlePagedEntryScroll(e)
        }}
      >
        {shouldShowLoadingSkeleton ? (
          <SkeletonList
            count={8}
            type={
              effectiveActiveView === FeedViewType.SocialMedia ||
              (effectiveActiveView === FeedViewType.Pictures &&
                !!selectedFeedId)
                ? 'social'
                : effectiveActiveView === FeedViewType.Videos ||
                    isPicturesAllView
                  ? 'grid'
                  : 'article'
            }
          />
        ) : renderEntries.length === 0 ? (
          selectedFeedId && selectedFeedId !== 'starred' ? (
            <div className="text-text-secondary dark:text-text-dark-secondary flex flex-col items-center justify-center py-12">
              <Inbox size={40} className="text-text-tertiary mb-3" />
              <p className="text-sm">{t('entryList.noArticles')}</p>
              <button
                onClick={async () => {
                  await refreshFeed(selectedFeedId)
                  loadEntries({ feedId: selectedFeedId, limit: entryLoadLimit })
                }}
                disabled={isRefreshing}
                className="bg-accent hover:bg-accent/90 mt-3 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                <RefreshCw
                  size={14}
                  className={isRefreshing ? 'animate-spin' : ''}
                />
                {isRefreshing ? t('common.refreshing') : t('common.refresh')}
              </button>
            </div>
          ) : effectiveActiveView !== null ? (
            <ViewRecommendations viewType={effectiveActiveView} />
          ) : (
            <div className="text-text-secondary dark:text-text-dark-secondary flex flex-col items-center justify-center py-12">
              <Inbox size={40} className="text-text-tertiary mb-3" />
              <p className="text-sm">{t('entryList.noArticles')}</p>
              <p className="mt-1 text-xs">{t('entryList.addFeedToStart')}</p>
            </div>
          )
        ) : inlineBilibili &&
          (effectiveActiveView === FeedViewType.Videos ||
            effectiveActiveView === FeedViewType.SocialMedia) ? (
          <div className="dark:bg-surface-dark flex h-full min-h-[520px] flex-col bg-white">
            <div className="min-h-0 flex-1 bg-black">
              <webview
                src={inlineBilibili.url}
                className="h-full w-full border-0"
                useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
              />
            </div>
          </div>
        ) : isTimelineView ? (
          /* Social media timeline: centered full-width layout */
          <Suspense fallback={<SkeletonList count={8} type="social" />}>
            <TimelineSection
              shouldUseVirtualTimeline={shouldUseVirtualTimeline}
              virtualItems={virtualTimelineItems}
              totalVirtualSize={timelineVirtualizer.getTotalSize()}
              measureElement={timelineVirtualizer.measureElement}
              timelineEntries={timelineEntries}
              renderedEntries={renderedTimelineEntries}
              groupedEntries={groupedRenderedTimelineEntries}
              timelineIndexById={timelineIndexById}
              feedMetaByEntryId={timelineFeedMetaByEntryId}
              activeEntryId={socialEntry?.id}
              dimRead={general.dimRead}
              isLoadingMore={isLoadingMore}
              onSelectEntry={handleSocialClick}
              onDoubleClickEntry={handleSocialDoubleClick}
              onMarkAboveRead={markAboveRead}
              onMarkBelowRead={markBelowRead}
              onContextMenuEntry={showMenu}
              onOpenBilibiliInPage={handleSocialBilibiliOpenInPage}
            />
          </Suspense>
        ) : isPicturesAllView ? (
          /* Pictures grid: show first image from each post, ordered left-to-right */
          <ScrollArea
            rootClassName="h-full"
            viewportClassName="h-full overflow-y-auto p-4 box-border"
            onScroll={(e) => {
              handleMasonryScroll(e)
              handlePagedEntryScroll(e)
            }}
          >
            {!isMasonryFirstScreenReady ? (
              <SkeletonList
                count={Math.max(8, masonryColumnCount * 4)}
                type="grid"
              />
            ) : (
              <Suspense
                fallback={
                  <SkeletonList
                    count={Math.max(8, masonryColumnCount * 4)}
                    type="grid"
                  />
                }
              >
                <PictureMasonry
                  columns={masonryColumns}
                  isReady={isMasonryFirstScreenReady}
                  isVisible={isMasonryContentVisible}
                  allCount={masonryCards.length}
                  visibleCount={visibleMasonryCards.length}
                  feedById={feedById}
                  entryById={renderEntryById}
                  locale={dateLocale}
                  onClickEntry={handleSocialClick}
                  onContextMenu={showMenu}
                />
              </Suspense>
            )}
          </ScrollArea>
        ) : effectiveActiveView === FeedViewType.Videos ? (
          /* Video grid with optional pagination */
          <div className={inlineBilibili ? 'h-full' : 'box-border h-full p-6'}>
            <Suspense fallback={<SkeletonList count={8} type="grid" />}>
              <VideoGridSection
                videoGridRef={videoGridRef}
                videoColumnCount={videoColumnCount}
                entries={videoViewModel.displayEntries}
                feedMetaByEntryId={videoFeedMetaByEntryId}
                videoPagination={videoViewModel.videoPagination}
                currentPage={videoViewModel.currentPage}
                totalPages={videoViewModel.totalPages}
                onSelectEntry={handleVideoClick}
                onContextMenuEntry={showMenu}
                onPrevPage={goPrevPage}
                onNextPage={goNextPage}
                onScroll={handlePagedEntryScroll}
              />
            </Suspense>
          </div>
        ) : null}

        {/* Context Menu */}
        {menuState.visible &&
          menuState.entryId &&
          (() => {
            const menuEntry = renderEntryById.get(menuState.entryId)
            if (!menuEntry) return null
            const menuIndex = renderEntryIndexById.get(menuState.entryId) ?? -1
            return (
              <WideViewContextMenuWrapper
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
      </ScrollArea>

      {/* Video player modal */}
      {videoEntry && (
        <VideoModal
          entry={videoEntry}
          onClose={() => setVideoEntry(null)}
          feeds={feeds}
        />
      )}

      {/* Social media overlay */}
      {socialEntry && (
        <SocialOverlay
          entry={socialEntry}
          feed={feedById.get(socialEntry.feedId)}
          onClose={() => setSocialEntry(null)}
        />
      )}
    </div>
  )
}

// Video Modal

function VideoModal({
  entry,
  onClose,
  feeds,
}: {
  entry: Entry
  onClose: () => void
  feeds: { id: string; title?: string }[]
}) {
  const { t } = useTranslation()
  const bilibiliOpenInPage = useGeneralSettingKey('bilibiliOpenInPage')
  const feedTitle = feeds.find((f) => f.id === entry.feedId)?.title

  // Classify the video source: direct mp4, Bilibili iframe, YouTube (needs proxy), or unknown
  const videoSource = useMemo(() => {
    const urls = [
      entry.url || '',
      ...(entry.media || [])
        .filter((m) => m.type === 'video')
        .map((m) => m.url),
    ]

    for (const url of urls) {
      // Direct video file
      if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) {
        return { type: 'direct' as const, url }
      }
    }

    for (const url of urls) {
      // Bilibili - use full site player in app window for reliable login/quality switching
      const biliMatch = url.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/)
      if (biliMatch) {
        if (bilibiliOpenInPage) {
          return {
            type: 'bilibili' as const,
            url: `https://www.bilibili.com/video/${biliMatch[1]}`,
          }
        }
        return {
          type: 'bilibiliEmbed' as const,
          url: buildBilibiliInAppPlayerUrl(url, {
            includeOutsideFlag: true,
            fallbackToPage: true,
          }),
        }
      }
      const biliAvMatch = url.match(/bilibili\.com\/video\/(av\d+)/)
      if (biliAvMatch) {
        if (bilibiliOpenInPage) {
          return {
            type: 'bilibili' as const,
            url: `https://www.bilibili.com/video/${biliAvMatch[1]}`,
          }
        }
        return {
          type: 'bilibiliEmbed' as const,
          url: buildBilibiliInAppPlayerUrl(url, {
            includeOutsideFlag: true,
            fallbackToPage: true,
          }),
        }
      }
      if (/(?:^|\.)(?:bilibili\.com|b23\.tv)\//i.test(url)) {
        if (bilibiliOpenInPage) {
          return {
            type: 'bilibili' as const,
            url: normalizeBilibiliVideoUrl(url),
          }
        }
        return {
          type: 'bilibiliEmbed' as const,
          url: buildBilibiliInAppPlayerUrl(url, {
            includeOutsideFlag: true,
            fallbackToPage: true,
          }),
        }
      }
    }

    for (const url of urls) {
      // YouTube - needs Invidious proxy resolution
      const ytMatch = url.match(
        /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/,
      )
      if (ytMatch) {
        return { type: 'youtube' as const, url, videoId: ytMatch[1] }
      }
    }

    // Other embeddable via transformVideoUrl (Vimeo, TED, etc.)
    for (const url of urls) {
      const embed = transformVideoUrl(url)
      if (embed) {
        return {
          type: 'iframe' as const,
          url: embed.replace('autoplay=0', 'autoplay=1'),
        }
      }
    }

    return { type: 'none' as const, url: entry.url || '' }
  }, [bilibiliOpenInPage, entry])

  // State for YouTube proxy resolution
  // "resolving" - trying Invidious; "resolved" - got direct URL; "iframe" - use embed
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)
  const [useIframeFallback, setUseIframeFallback] = useState(false)

  // For YouTube: check login status first.
  // If logged in - skip slow Invidious and go straight to iframe (cookies work).
  // If not logged in - try Invidious proxy, then fall back to iframe.
  useEffect(() => {
    if (videoSource.type !== 'youtube') return
    let cancelled = false
    setResolving(true)
    setResolvedUrl(null)
    setUseIframeFallback(false)
    ;(async () => {
      try {
        // Check if user has linked their YouTube account
        const status = await window.api.video.ytStatus()
        if (status.loggedIn) {
          // Logged in - iframe with youtube.com (carries cookies), skip proxy
          if (!cancelled) {
            setUseIframeFallback(true)
            setResolving(false)
          }
          return
        }
      } catch {
        /* ignore, proceed to proxy */
      }

      // Not logged in - try Invidious/Piped proxy for direct URL
      try {
        const result = await window.api.video.resolve(videoSource.url)
        if (cancelled) return
        if (result.success && result.url) {
          setResolvedUrl(result.url)
        } else {
          setUseIframeFallback(true)
        }
      } catch {
        if (!cancelled) setUseIframeFallback(true)
      } finally {
        if (!cancelled) setResolving(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [videoSource])

  // Build YouTube iframe embed URL
  // IMPORTANT: use youtube.com (NOT youtube-nocookie.com) so login cookies are sent
  const youtubeIframeSrc = useMemo(() => {
    if (videoSource.type !== 'youtube' || !('videoId' in videoSource))
      return null
    return `https://www.youtube.com/embed/${videoSource.videoId}?controls=1&autoplay=1&mute=0`
  }, [videoSource])

  // Content description
  const description = useMemo(() => {
    const html = entry.content || entry.summary || ''
    if (!html) return ''
    let safe = sanitizeHTML(html)
    safe = safe.replace(
      /<(img|video|iframe|audio|picture|source|embed|object)\b[^>]*\/?>/gi,
      '',
    )
    safe = safe.replace(/<\/(video|iframe|audio|picture|embed|object)>/gi, '')
    return safe
  }, [entry])

  const timeAgo = formatDistanceToNow(new Date(entry.publishedAt), {
    addSuffix: true,
    locale: getDateLocale(),
  })

  if (videoSource.type === 'none') return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 lg:p-6"
      onClick={onClose}
    >
      <div
        className={`w-full ${videoSource.type === 'bilibili' ? 'max-w-[77vw]' : 'max-w-[74vw]'} flex max-h-[75vh] flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Video player - 16:9 aspect ratio */}
        <div
          className={`flex-shrink-0 overflow-hidden bg-black ${videoSource.type === 'bilibili' ? 'h-[66vh] rounded-xl' : 'relative aspect-video w-full rounded-t-xl'}`}
        >
          {/* Direct video file */}
          {videoSource.type === 'direct' && (
            <video
              src={videoSource.url}
              className="h-full w-full"
              controls
              autoPlay
              preload="metadata"
            />
          )}

          {/* Bilibili / Vimeo / TED iframe */}
          {videoSource.type === 'iframe' && (
            <iframe
              src={videoSource.url}
              className="h-full w-full"
              allowFullScreen
              allow="autoplay; encrypted-media; accelerometer; clipboard-write; gyroscope; picture-in-picture"
            />
          )}

          {/* Bilibili in-app playback (first-party webview for login + quality switch) */}
          {videoSource.type === 'bilibiliEmbed' && (
            <webview
              src={videoSource.url}
              className="h-full w-full"
              useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            />
          )}

          {/* Bilibili: keep inside current page and show web page on the right side */}
          {videoSource.type === 'bilibili' && (
            <div className="flex h-full w-full flex-col lg:flex-row">
              <div className="dark:bg-surface-dark w-full overflow-y-auto bg-white p-4 lg:w-[34%]">
                {entry.title && (
                  <h3 className="text-base font-semibold leading-snug">
                    {entry.title}
                  </h3>
                )}
                <div className="text-text-secondary dark:text-text-dark-secondary mt-1.5 flex items-center gap-2 text-xs">
                  {feedTitle && <span>{feedTitle}</span>}
                  <span>·</span>
                  <span>{timeAgo}</span>
                  {entry.url && (
                    <>
                      <span>·</span>
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent inline-flex items-center gap-1 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={11} />
                        {t('common.original')}
                      </a>
                    </>
                  )}
                </div>
                {description &&
                  !isDescriptionRedundant(entry.title, description) && (
                    <div
                      className="prose prose-sm text-text-secondary dark:prose-invert dark:text-text-dark-secondary mt-3 max-w-none"
                      dangerouslySetInnerHTML={{ __html: description }}
                    />
                  )}
              </div>
              <div className="h-[44vh] w-full bg-black lg:h-full lg:w-[66%]">
                <webview
                  src={videoSource.url}
                  className="h-full w-full"
                  useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
                />
              </div>
            </div>
          )}

          {/* YouTube - loading / resolving state */}
          {videoSource.type === 'youtube' && resolving && (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-white">
              <Loader2 size={32} className="animate-spin opacity-60" />
              <span className="text-sm opacity-60">正在解析视频地址...</span>
            </div>
          )}

          {/* YouTube - resolved via Invidious, play with native video */}
          {videoSource.type === 'youtube' &&
            resolvedUrl &&
            !resolving &&
            !useIframeFallback && (
              <video
                src={resolvedUrl}
                className="h-full w-full"
                controls
                autoPlay
                preload="metadata"
                onError={() => {
                  // Direct URL failed (expired, geo-blocked, etc.) - switch to iframe fallback
                  setResolvedUrl(null)
                  setUseIframeFallback(true)
                }}
              />
            )}

          {/* YouTube - iframe fallback (UA spoofed in main process to bypass bot detection) */}
          {videoSource.type === 'youtube' &&
            useIframeFallback &&
            !resolving &&
            youtubeIframeSrc && (
              <iframe
                src={youtubeIframeSrc}
                className="h-full w-full"
                allowFullScreen
                allow="autoplay; encrypted-media; accelerometer; clipboard-write; gyroscope; picture-in-picture"
              />
            )}
        </div>

        {/* Info area below video */}
        {videoSource.type !== 'bilibili' && (
          <div className="dark:bg-surface-dark max-h-[22vh] min-h-[132px] overflow-y-auto rounded-b-xl bg-white p-5">
            {entry.title && (
              <h3 className="text-base font-semibold leading-snug">
                {entry.title}
              </h3>
            )}
            <div className="text-text-secondary dark:text-text-dark-secondary mt-1.5 flex items-center gap-2 text-xs">
              {feedTitle && <span>{feedTitle}</span>}
              <span>·</span>
              <span>{timeAgo}</span>
              {entry.url && (
                <>
                  <span>·</span>
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent inline-flex items-center gap-1 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={11} />
                    {t('common.original')}
                  </a>
                </>
              )}
            </div>
            {description &&
              !isDescriptionRedundant(entry.title || '', description) && (
                <div
                  className="prose prose-sm text-text-secondary dark:prose-invert dark:text-text-dark-secondary mt-3 max-w-none"
                  dangerouslySetInnerHTML={{ __html: description }}
                />
              )}
          </div>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
      >
        <X size={20} />
      </button>
    </div>
  )
}

// Context Menu Wrapper

function WideViewContextMenuWrapper({
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
  const { markRead, toggleStar } = useStoreShallow(useEntryStore, (s) => ({
    markRead: s.markRead,
    toggleStar: s.toggleStar,
  }))
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

// Social Media Overlay
// Wide overlay: slides up on top of the timeline,
// shows AuthorHeader + full content + all media individually.

function SocialOverlay({
  entry,
  feed,
  onClose,
}: {
  entry: Entry
  feed?: { title?: string; imageUrl?: string; url?: string; siteUrl?: string }
  onClose: () => void
}) {
  const general = useGeneralSettingsShallowSelector((settings) => ({
    contentWidth: settings.contentWidth,
    contentMaxWidth: settings.contentMaxWidth,
    contentLineHeight: settings.contentLineHeight,
    contentFontFamily: settings.contentFontFamily,
    fontSize: settings.fontSize,
    language: settings.language,
  }))
  const targetLanguage = useTranslationSettingKey('targetLanguage')
  const timeAgo = formatDistanceToNow(new Date(entry.publishedAt), {
    addSuffix: true,
    locale: getDateLocale(),
  })

  const { avatarUrl, avatarLetter, avatarImageFailed, handleAvatarError } =
    useSocialOverlayAvatar({
      entryId: entry.id,
      author: entry.author,
      feedTitle: feed?.title,
      authorAvatar: entry.authorAvatar,
      feedImageUrl: feed?.imageUrl,
      feedSiteUrl: feed?.siteUrl,
      feedUrl: feed?.url,
      normalizeInstagramUnavatar,
      isGenericInstagramIconUrl,
      extractPixnoyOriginUrl,
      normalizeImageCacheKey,
    })

  // Full sanitized content - strip media tags to avoid duplication with the media gallery below
  // Content width mapping - matches EntryContent
  const contentWidthClasses = useMemo(
    () => ({
      narrow: 'max-w-[500px]',
      normal: 'max-w-[680px]',
      wide: 'max-w-[900px]',
      custom: '',
    }),
    [],
  )
  const contentWidthClass =
    general.contentWidth === 'custom'
      ? ''
      : contentWidthClasses[general.contentWidth] || contentWidthClasses.normal
  const contentWidthStyle =
    general.contentWidth === 'custom'
      ? { maxWidth: `${general.contentMaxWidth || 680}px` }
      : undefined

  const fullContent = useMemo(() => {
    const html = entry.content || entry.summary || ''
    if (!html.includes('<')) return ''
    return cleanSocialTextHtml(html)
  }, [entry])

  const plainContent = useMemo(
    () =>
      cleanSocialPlainText(fullContent || entry.content || entry.summary || ''),
    [fullContent, entry.content, entry.summary],
  )
  const allEntries = useEntryStore((s) => s.entries)

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

  // Split content into paragraphs for bilingual translation
  const paragraphs = useMemo(() => {
    if (fullContent) return splitHtmlIntoParagraphs(fullContent)
    if (plainContent) {
      // Split plain text by newlines so bilingual translation interleaves per paragraph
      const lines = plainContent
        .split(/\n+/)
        .map((line: string) => line.trim())
        .filter(Boolean)
      return lines.length > 0 ? lines : [plainContent]
    }
    return []
  }, [fullContent, plainContent])

  // All media items
  const photos = useMemo(() => {
    const mediaPhotos =
      entry.media
        ?.map((m) => ({
          ...m,
          url: decodeMediaUrl(m.url),
          // Keep original previewUrl (mirror/proxy URL) intact.
          // decodeMediaUrl would unwrap it to an expiring CDN URL via normalizePicnobImageUrl.
          previewUrl: m.previewUrl
            ? decodeHtmlEntitiesUrl(m.previewUrl)
            : m.previewUrl,
        }))
        .filter((photo) => {
          const preview = decodeMediaUrl(photo.previewUrl || '')
          const primary = decodeMediaUrl(photo.url || '')
          const passImage = isLikelyImageByUrl(preview || primary)
          const isDecorative = isDecorativeSocialImageUrl(preview || primary)
          const isTiny = hasTinyDecorativeDimensions(photo.width, photo.height)
          const raw = `${primary} ${preview}`.toLowerCase()
          const isVideo = /\.(mp4|webm|mov|m3u8)(\?|$)/i.test(raw)
          if (!passImage) return false
          if (isDecorative) return false
          if (isTiny) return false
          if (isVideo) return false
          return isLikelyImageByUrl(preview || primary)
        }) || []
    if (mediaPhotos.length > 0) {
      const seen = new Set<string>()
      const deduped: typeof mediaPhotos = []
      for (const photo of mediaPhotos) {
        const candidate = decodeMediaUrl(photo.url || photo.previewUrl || '')
        const keys = getPhotoDedupeKeys(photo.url || '', photo.previewUrl || '')
        if (keys.length === 0) {
          const fallbackKey = normalizeImageCacheKey(candidate)
          if (fallbackKey) keys.push(`raw:${fallbackKey}`)
        }
        // Treat as duplicate only when all identity keys are already seen.
        // Instagram/Picnob carousels often share preview keys across multiple photos.
        if (keys.every((key) => seen.has(key))) {
          continue
        }
        keys.forEach((key) => seen.add(key))
        deduped.push(photo)
      }
      return deduped
    }
    const fallback = entry.imageUrl ? decodeMediaUrl(entry.imageUrl) : ''
    return fallback && isLikelyImageByUrl(fallback)
      ? [{ url: fallback, type: 'photo' as const }]
      : []
  }, [entry.media, entry.imageUrl])
  const videos = useMemo(() => {
    const rawVideos = (entry.media || [])
      .filter((m) => m.type === 'video')
      .map((m) => ({
        ...m,
        url: decodeMediaUrl(m.url),
        previewUrl: m.previewUrl ? decodeMediaUrl(m.previewUrl) : m.previewUrl,
      }))
      .filter((m) => isRenderableVideoMediaItem(m))

    const unique: typeof rawVideos = []
    const seen = new Set<string>()
    for (const video of rawVideos) {
      const key = `${normalizeImageCacheKey(video.url || '')}|${normalizeImageCacheKey(video.previewUrl || '')}`
      if (seen.has(key)) continue
      seen.add(key)
      unique.push(video)
    }
    return unique
  }, [entry.media])
  const hasBilibiliPageVideo = useMemo(
    () =>
      videos.some((video) =>
        /(?:^|\.)bilibili\.com\/video\/|(?:^|\.)b23\.tv\//i.test(
          (video.url || '').toLowerCase(),
        ),
      ),
    [videos],
  )
  const videosWithCover = useMemo(() => {
    if (videos.length === 0) return videos
    const contentPreview =
      photos.length === 0
        ? extractImagesFromHtml(entry.content || entry.summary || '')[0] || ''
        : ''
    const derivePlatformCover = (url: string): string => {
      const raw = decodeMediaUrl(url || '')
      if (!raw) return ''
      const ytMatch = raw.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]+)/i,
      )
      if (ytMatch?.[1])
        return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`
      return ''
    }
    const firstPhotoPreview =
      photos[0] && 'previewUrl' in photos[0]
        ? decodeMediaUrl(photos[0].previewUrl || '')
        : ''
    const fallbackPreview =
      firstPhotoPreview ||
      photos[0]?.url ||
      relatedEntryFallback?.cover ||
      decodeMediaUrl(entry.imageUrl || '') ||
      contentPreview ||
      derivePlatformCover(entry.url || '') ||
      ''
    return videos.map((video) => {
      const rawPreview = decodeMediaUrl(video.previewUrl || '')
      const rawUrl = decodeMediaUrl(video.url || '')
      const validPreview =
        rawPreview && isLikelyImageByUrl(rawPreview) ? rawPreview : ''
      if (validPreview) return { ...video, previewUrl: validPreview }

      const derivedCover = derivePlatformCover(rawUrl)
      if (derivedCover) return { ...video, previewUrl: derivedCover }

      if (fallbackPreview && isLikelyImageByUrl(fallbackPreview)) {
        return { ...video, previewUrl: fallbackPreview }
      }
      return video
    })
  }, [
    videos,
    photos,
    relatedEntryFallback,
    entry.imageUrl,
    entry.content,
    entry.summary,
    entry.url,
  ])
  const displayPhotos = hasBilibiliPageVideo ? [] : photos

  const {
    previewIdx,
    setPreviewIdx,
    lightboxOpen,
    setLightboxOpen,
    failedPhotoTokens: failedOverlayPhotoTokens,
    getPhotoToken: getOverlayPhotoToken,
    getPhotoInitialSrc: getOverlayPhotoInitialSrc,
    handlePhotoError: handleOverlayPhotoError,
  } = useOverlayMediaGallery({
    entryId: entry.id,
    getPhotoDedupeKey,
    normalizeImageCacheKey,
    decodeUrlEntities: decodeHtmlEntitiesUrl,
    decodeMediaUrl,
    advanceOverlayPhotoFallback,
  })

  // AI Translation & Summary
  const { translatedParagraphs, isTranslating, showTranslation, translate } =
    useAITranslation({ entryId: entry.id })
  const { summary, error, isLoading: isSummarizing, summarize } = useAISummary()

  const handleTranslate = useCallback(() => {
    if (paragraphs.length === 0) return
    const targetLang = targetLanguage || general.language || 'zh-CN'
    void translate(paragraphs, targetLang)
  }, [general.language, paragraphs, targetLanguage, translate])

  const handleSummarize = useCallback(() => {
    if (!plainContent) return
    void summarize(plainContent, general.language || 'zh-CN')
  }, [general.language, plainContent, summarize])

  return (
    <Suspense fallback={null}>
      <SocialOverlayView
        onClose={onClose}
        contentWidthClass={contentWidthClass}
        contentWidthStyle={contentWidthStyle}
        plainContent={plainContent}
        isTranslating={isTranslating}
        showTranslation={showTranslation}
        translatedParagraphCount={translatedParagraphs.length}
        isSummarizing={false}
        showSummary={false}
        summary={null}
        browserOpenUrl={browserOpenUrl}
        onTranslate={handleTranslate}
        onSummarize={handleSummarize}
        lineHeight={general.contentLineHeight}
        fontFamily={general.contentFontFamily}
        avatarUrl={avatarUrl}
        avatarImageFailed={avatarImageFailed}
        avatarLetter={avatarLetter}
        authorName={entry.author || feed?.title || ''}
        timeAgo={timeAgo}
        onAvatarError={handleAvatarError}
        translatedParagraphs={translatedParagraphs}
        paragraphs={paragraphs}
        fullContent={fullContent}
        fontSize={general.fontSize || 16}
        displayPhotos={displayPhotos}
        videos={videosWithCover}
        previewIdx={previewIdx}
        lightboxOpen={lightboxOpen}
        failedPhotoTokens={failedOverlayPhotoTokens}
        getPhotoToken={getOverlayPhotoToken}
        getPhotoInitialSrc={getOverlayPhotoInitialSrc}
        onPhotoError={handleOverlayPhotoError}
        onSetPreviewIdx={setPreviewIdx}
        onSetLightboxOpen={setLightboxOpen}
      />
      {/* AI Summary — rendered within overlay context, shows when summary is available */}
      {(summary || isSummarizing || error) && (
        <div className="absolute bottom-6 left-1/2 z-[60] w-full max-w-xl -translate-x-1/2 px-4">
          <AISummaryPanel
            summary={summary}
            error={error}
            isLoading={isSummarizing}
            onRetry={handleSummarize}
          />
        </div>
      )}
    </Suspense>
  )
}
