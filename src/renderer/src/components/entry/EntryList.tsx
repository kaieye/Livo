import {
  lazy,
  Suspense,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  useLayoutEffect,
  type UIEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { useVirtualizer } from '@tanstack/react-virtual'
import { openExternalUrlSafe } from '../../services/external-url'
import { useEntryStore } from '../../store/entry-store'
import { useFeedStore } from '../../store/feed-store'
import { useStoreShallow } from '../../store/helpers'
import { useGeneralSettingsShallowSelector } from '../../store/settings-store'
import { FeedViewType, VIEW_DEFINITIONS } from '../../../../shared/types'
import { VIEW_TYPE_I18N_KEYS } from '../../lib/view-type-keys'
import { SkeletonList } from '../ui/Skeleton'
import { HomeInlineSearch } from './HomeInlineSearch'
import {
  ContextMenu,
  useEntryContextMenu,
  useEntryContextActions,
} from '../ui/ContextMenu'
import { useAsyncSocialDedupe } from '../../hooks/useAsyncSocialDedupe'
import { EntryListEmpty } from './entry-list/EntryListEmpty'
import { EntryCard } from './entry-list/items/EntryCard'
import { GridCard } from './entry-list/items/GridCard'
import { SocialMediaItem } from './entry-list/items/SocialMediaItem'
import { useHomeFeedCoordinator } from '../../hooks/useHomeFeedCoordinator'
import { useRegisterCommand } from '../../hooks/useRegisterCommand'
import { HOTKEY_OVERLAY_SCOPES } from '../../lib/hotkey-scope'
import { buildEntryListDerivedModel } from '../../lib/entry-list-model'
import { buildEntryReadingSurfaceRenderModel } from '../../lib/entry-reading-surface-model'
import { resolveEntryBrowserOpenUrl } from './entry-list/utils/entry-media'
import { CheckCheck, Loader2, RefreshCw } from 'lucide-react'
import type { Entry } from '../../../../shared/types'
import StarToggle from '../ui/StarToggle'

const SharePoster = lazy(() =>
  import('../ui/SharePoster').then((module) => ({
    default: module.SharePoster,
  })),
)

const SOCIAL_LIST_SCROLL_GUARD_PX = 120
const SOCIAL_LIST_LOAD_MORE_BOTTOM_OFFSET_PX = 260

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

export function EntryList({ width }: { width?: number }) {
  const coordinator = useHomeFeedCoordinator()
  const {
    entries,
    isLoading,
    isLoadingMore,
    baseFilteredEntries,
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
    refreshCurrentFeeds,
  } = coordinator
  const {
    selectedEntry,
    selectEntry,
    markAllRead,
    markAboveRead,
    markBelowRead,
  } = useStoreShallow(useEntryStore, (s) => ({
    selectedEntry: s.selectedEntry,
    selectEntry: s.selectEntry,
    markAllRead: s.markAllRead,
    markAboveRead: s.markAboveRead,
    markBelowRead: s.markBelowRead,
  }))
  const {
    selectedFeedId,
    activeView,
    refreshFeed,
    isRefreshing,
    refreshProgress,
  } = useStoreShallow(useFeedStore, (s) => ({
    selectedFeedId: s.selectedFeedId,
    activeView: s.activeView,
    refreshFeed: s.refreshFeed,
    isRefreshing: s.isRefreshing,
    refreshProgress: s.refreshProgress,
  }))
  const general = useGeneralSettingsShallowSelector((settings) => ({
    showRecommended: settings.showRecommended,
    groupByDate: settings.groupByDate,
    dimRead: settings.dimRead,
    imageProxy: settings.imageProxy,
  }))
  const { t } = useTranslation()

  useRegisterCommand({
    id: 'entry-list:refresh-current',
    shortcutId: 'refresh-current',
    scopes: ['content'],
    blockedScopes: HOTKEY_OVERLAY_SCOPES,
    handler: (event) => {
      if (isRefreshing || isEditableTarget(event.target)) return false
      event.preventDefault()
      void refreshCurrentFeeds()
    },
  })

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

  const { renderEntries: baseRenderEntries, hasStaleEntriesWhileLoading } =
    useMemo(
      () =>
        buildEntryReadingSurfaceRenderModel({
          sourceEntries: entries,
          scopedEntries: viewFilteredEntries,
          isLoading,
          isPostProcessing: isSocialDedupeProcessing,
          allowStaleEntriesWhileLoading: !selectedFeedId,
        }),
      [
        entries,
        isLoading,
        isSocialDedupeProcessing,
        selectedFeedId,
        viewFilteredEntries,
      ],
    )
  const isGridMode = viewDef?.gridMode ?? false
  const listScrollRef = useRef<HTMLDivElement>(null)
  const lastScrollScopeRef = useRef<string>('')
  const GRID_INITIAL_COUNT = 40
  const GRID_LOAD_MORE_COUNT = 40
  const [gridVisibleCount, setGridVisibleCount] = useState(GRID_INITIAL_COUNT)
  const {
    renderEntries,
    socialRows,
    useVirtualLinearList,
    virtualizerEntries,
    gridRows,
    hasMoreGridEntries,
  } = useMemo(() => {
    const result = buildEntryListDerivedModel({
      baseRenderEntries,
      activeView,
      groupByDate: general.groupByDate,
      isGridMode,
      gridVisibleCount,
    })
    // PERF: mark EntryList derived model computation
    performance.mark('vs:entrylist-memos')
    return result
  }, [
    activeView,
    baseRenderEntries,
    general.groupByDate,
    gridVisibleCount,
    isGridMode,
  ])
  const linearListVirtualizer = useVirtualizer({
    count: virtualizerEntries.length,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => 180,
    overscan: 8,
    getItemKey: (index) => virtualizerEntries[index]?.id ?? index,
  })
  const virtualItems = linearListVirtualizer.getVirtualItems()
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

  // PERF: mark child component commit
  useLayoutEffect(() => {
    performance.mark('vs:child-commit')
  })

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
      className="dark:bg-surface-dark flex flex-shrink-0 flex-col border-r bg-white"
      style={{ width: width ?? (isGridMode ? 480 : 340) }}
    >
      {/* Header */}
      <div className="flex-shrink-0 space-y-2.5 px-4 pb-2 pt-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 truncate text-base font-semibold">
            {viewDef && <span className={viewDef.color}>{displayTitle}</span>}
            {!viewDef && displayTitle}
          </h2>
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
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 gap-1 text-xs">
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

          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={refreshCurrentFeeds}
              disabled={isRefreshing}
              className="hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary rounded-lg p-1.5 disabled:opacity-50"
              title={t('common.refresh')}
            >
              <RefreshCw
                size={16}
                className={`text-text-secondary dark:text-text-dark-secondary ${isRefreshing ? 'animate-spin' : ''}`}
              />
            </button>
            <button
              onClick={() => markAllRead(selectedFeedId || undefined)}
              className="hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary rounded-lg p-1.5"
              title={t('common.markAllRead')}
            >
              <CheckCheck
                size={16}
                className="text-text-secondary dark:text-text-dark-secondary"
              />
            </button>
          </div>
        </div>

        {isRefreshing && refreshProgress && refreshProgress.total > 0 && (
          <div className="space-y-1">
            <div className="text-text-tertiary flex items-center justify-between text-[11px]">
              <span>{`Refreshing ${refreshProgress.completed}/${refreshProgress.total}`}</span>
              <span>{`${refreshProgress.percent}%`}</span>
            </div>
            <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="bg-accent h-full transition-[width] duration-200"
                style={{
                  width: `${Math.max(0, Math.min(100, refreshProgress.percent))}%`,
                }}
              />
            </div>
            {refreshProgress.feedTitle && (
              <div className="text-text-tertiary truncate text-[11px]">
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
          <EntryListEmpty
            selectedFeedId={selectedFeedId}
            activeView={activeView}
            isRefreshing={isRefreshing}
            onRefresh={refreshCurrentFeeds}
          />
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
                    <div className="dark:bg-surface-dark/80 flex h-9 items-center border-b border-transparent bg-white/80 backdrop-blur-sm">
                      <div className="dark:text-text-dark text-text m-auto flex w-full max-w-[clamp(45ch,60vw,65ch)] select-none gap-3 pl-4 text-sm font-bold">
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
              <div className="text-text-tertiary flex items-center justify-center py-4">
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
          <div className="text-text-tertiary flex items-center justify-center py-4">
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
