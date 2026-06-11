import {
  lazy,
  Suspense,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  type UIEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { openExternalUrlSafe } from '../../services/external-url'
import { useEntryStore } from '../../store/entry-store'
import { useFeedStore } from '../../store/feed-store'
import { useStoreShallow } from '../../store/helpers'
import { useGeneralSettingsShallowSelector } from '../../store/settings-store'
import { FeedViewType, VIEW_DEFINITIONS } from '../../../../shared/types'
import { VIEW_TYPE_I18N_KEYS } from '../../lib/view-type-keys'
import {
  ContextMenu,
  useEntryContextMenu,
  useEntryContextActions,
} from '../ui/ContextMenu'
import { useAsyncSocialDedupe } from '../../hooks/useAsyncSocialDedupe'
import { EntryListHeader } from './entry-list/EntryListHeader'
import { EntryListContent } from './entry-list/EntryListContent'
import { useGridProgressive } from './entry-list/hooks/useGridProgressive'
import { useEntryFeedMaps } from './entry-list/hooks/useEntryFeedMaps'
import { useHomeFeedCoordinator } from '../../hooks/useHomeFeedCoordinator'
import { useRegisterCommand } from '../../hooks/useRegisterCommand'
import { HOTKEY_OVERLAY_SCOPES } from '../../lib/hotkey-scope'
import { buildCachedEntryListDerivedModel } from '../../lib/entry-list-model'
import { buildEntryReadingSurfaceRenderModel } from '../../lib/entry-reading-surface-model'
import { resolveEntryBrowserOpenUrl } from './entry-list/utils/entry-media'
import type { Entry } from '../../../../shared/types'
import {
  markStartupComponentMounted,
  recordStartupBlockEvent,
} from '../../lib/startup-block-diagnostics'

const SharePoster = lazy(() =>
  import('../ui/SharePoster').then((module) => ({
    default: module.SharePoster,
  })),
)

const SCROLL_GUARD_PX = 120
const LOAD_MORE_BOTTOM_OFFSET_PX = 260

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

export function EntryList({ width }: { width?: number }) {
  console.time('[PERF] EntryList render')
  useEffect(() => {
    markStartupComponentMounted('EntryList')
    console.timeEnd('[PERF] EntryList render')
  }, [])

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

  const { menuState, showMenu, hideMenu } = useEntryContextMenu()
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

  const shouldDedupeSocialEntries = activeView === FeedViewType.SocialMedia
  const {
    entries: viewFilteredEntries,
    isProcessing: isSocialDedupeProcessing,
  } = useAsyncSocialDedupe(baseFilteredEntries, {
    enabled: shouldDedupeSocialEntries,
    cacheKey: `${activeView ?? 'all'}:${selectedFeedId ?? 'all'}`,
  })

  const { renderEntries: baseRenderEntries, hasStaleEntriesWhileLoading } =
    useMemo(() => {
      const start = performance.now()
      const model = buildEntryReadingSurfaceRenderModel({
        sourceEntries: entries,
        scopedEntries: viewFilteredEntries,
        isLoading,
        isPostProcessing: isSocialDedupeProcessing,
        allowStaleEntriesWhileLoading: !selectedFeedId,
      })
      recordStartupBlockEvent(
        'EntryList.readingSurfaceModel',
        `source=${entries.length} scoped=${viewFilteredEntries.length} render=${model.renderEntries.length}`,
        performance.now() - start,
      )
      return model
    }, [
      entries,
      isLoading,
      isSocialDedupeProcessing,
      selectedFeedId,
      viewFilteredEntries,
    ])
  const isGridMode = viewDef?.gridMode ?? false
  const listScrollRef = useRef<HTMLDivElement>(null)
  const lastScrollScopeRef = useRef<string>('')

  const gridProgressive = useGridProgressive({
    renderEntries: baseRenderEntries,
    isGridMode,
    activeView,
    selectedFeedId,
  })

  const {
    renderEntries,
    socialRows,
    useVirtualLinearList,
    virtualizerEntries,
    gridRows,
    hasMoreGridEntries,
  } = useMemo(() => {
    const start = performance.now()
    const model = buildCachedEntryListDerivedModel({
      baseRenderEntries,
      activeView,
      groupByDate: general.groupByDate,
      isGridMode,
      gridVisibleCount: gridProgressive.visibleCount,
      cacheKey: `${activeView ?? 'all'}:${selectedFeedId ?? 'all'}:${filterMode}`,
    })
    recordStartupBlockEvent(
      'EntryList.derivedModel',
      `base=${baseRenderEntries.length} render=${model.renderEntries.length} virtual=${model.virtualizerEntries.length}`,
      performance.now() - start,
    )
    return model
  }, [
    activeView,
    baseRenderEntries,
    filterMode,
    general.groupByDate,
    gridProgressive.visibleCount,
    isGridMode,
    selectedFeedId,
  ])

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
      coordinatorHandleScroll(e)
      if (isGridMode && hasMoreGridEntries) {
        const el = e.currentTarget
        if (
          el.scrollTop > SCROLL_GUARD_PX &&
          el.scrollTop + el.clientHeight >=
            el.scrollHeight - LOAD_MORE_BOTTOM_OFFSET_PX
        ) {
          gridProgressive.loadMore()
        }
      }
    },
    [coordinatorHandleScroll, isGridMode, hasMoreGridEntries, gridProgressive],
  )

  const { feedTitleById, feedImageById, feedSiteUrlById, feedUrlById } =
    useEntryFeedMaps(feedById)

  return (
    <div
      className="dark:bg-surface-dark flex flex-shrink-0 flex-col border-r bg-white"
      style={{ width: width ?? (isGridMode ? 480 : 340) }}
    >
      <EntryListHeader
        displayTitle={displayTitle}
        viewColor={viewDef?.color}
        searchQuery={searchQuery}
        onSearchQueryChange={(value) => {
          setSearchQuery(value)
          if (!value.trim()) {
            reloadCurrentList()
          }
        }}
        onSearchSubmit={handleSearch}
        entries={renderEntries}
        feedTitleFor={(entry) => feedById.get(entry.feedId)?.title ?? ''}
        onSelectEntry={selectEntry}
        filterMode={filterMode}
        onFilterModeChange={setFilterMode}
        isRefreshing={isRefreshing}
        onRefresh={refreshCurrentFeeds}
        onMarkAllRead={() => markAllRead(selectedFeedId || undefined)}
        refreshProgress={refreshProgress}
      />

      <div
        ref={listScrollRef}
        className="flex-1 overflow-y-auto"
        id="entry-list-scroll"
        onScroll={handleListScroll}
      >
        <EntryListContent
          isLoading={isLoading}
          hasStaleEntriesWhileLoading={hasStaleEntriesWhileLoading}
          activeView={activeView}
          selectedFeedId={selectedFeedId}
          isRefreshing={isRefreshing}
          isGridMode={isGridMode}
          renderEntries={renderEntries}
          socialRows={socialRows}
          virtualizerEntries={virtualizerEntries}
          gridRows={gridRows}
          useVirtualLinearList={useVirtualLinearList}
          hasMoreGridEntries={hasMoreGridEntries}
          isLoadingMore={isLoadingMore}
          scrollRef={listScrollRef}
          selectedEntryId={selectedEntry?.id ?? null}
          feedTitleById={feedTitleById}
          feedImageById={feedImageById}
          feedSiteUrlById={feedSiteUrlById}
          feedUrlById={feedUrlById}
          dimRead={general.dimRead}
          imageProxy={general.imageProxy}
          onRefresh={refreshCurrentFeeds}
          onSelectEntry={selectEntry}
          onMarkAboveRead={markAboveRead}
          onMarkBelowRead={markBelowRead}
          onContextMenu={showMenu}
          onMediaAllFailed={handleEntryMediaAllFailed}
        />

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
