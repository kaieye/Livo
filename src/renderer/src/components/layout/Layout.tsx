import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { EntryList } from '../entry/EntryList'
import { EntryContent } from '../entry/EntryContent'
import { SkeletonList } from '../ui/Skeleton'
import { ResizeHandle } from '../ui/ResizeHandle'
import { useDiscoverStore } from '../../store/discover-store'
import { useEntryStore } from '../../store/entry-store'
import { useFeedStore } from '../../store/feed-store'
import { useStoreShallow } from '../../store/helpers'
import { FeedViewType } from '../../../../shared/types'
import { getEntryLoadLimit } from '../../lib/entry-load-limit'
import { useLayoutFocusTarget } from '../../hooks/useLayoutFocusTarget'
import { useFocusableHotkeyScope } from '../../hooks/useHotkeyScope'

const RECOMMENDED_CATEGORY = 'Recommended'
const DigestContent = lazy(() =>
  import('./DigestContent').then((module) => ({
    default: module.DigestContent,
  })),
)
const WideViewContent = lazy(() =>
  import('../entry/WideViewContent').then((module) => ({
    default: module.WideViewContent,
  })),
)
const DiscoverPanel = lazy(() =>
  import('../discover/DiscoverPanel').then((module) => ({
    default: module.DiscoverPanel,
  })),
)

// Persisted widths key
const STORAGE_KEY = 'livo-panel-widths'

function loadWidths(): { sidebar: number; entryList: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return { sidebar: 260, entryList: 340 }
}

function saveWidths(sidebar: number, entryList: number) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ sidebar, entryList }))
}

// Constraints
const SIDEBAR_MIN = 200
const SIDEBAR_MAX = 400
const ENTRY_LIST_MIN = 260
const ENTRY_LIST_MAX = 640

export function Layout() {
  const contentFocusRef = useRef<HTMLDivElement>(null)
  const { isDiscoverOpen } = useStoreShallow(useDiscoverStore, (s) => ({
    isDiscoverOpen: s.isOpen,
  }))
  const { activeView, selectedFeedId, feeds } = useStoreShallow(
    useFeedStore,
    (s) => ({
      activeView: s.activeView,
      selectedFeedId: s.selectedFeedId,
      feeds: s.feeds,
    }),
  )
  const { selectEntry, prefetchEntries } = useStoreShallow(
    useEntryStore,
    (s) => ({
      selectEntry: s.selectEntry,
      prefetchEntries: s.prefetchEntries,
    }),
  )
  const isContentFocusHighlighted = useLayoutFocusTarget(
    'content',
    contentFocusRef,
  )
  useFocusableHotkeyScope('content', contentFocusRef)
  const location = useLocation()
  const isDigestRoute = location.pathname === '/digest'

  // Clear stale detail content when switching view/feed scope.
  useEffect(() => {
    performance.mark('vs:selectEntry-null')
    void selectEntry(null)
  }, [activeView, selectedFeedId, selectEntry])

  // PERF: mark when React commits the new view layout (before paint)
  useLayoutEffect(() => {
    performance.mark('vs:layout-commit')
  }, [activeView, selectedFeedId])

  // PERF: defer content mount so Layout commits fast (skeleton first, then real component).
  // Uses a ref checked during render to show skeleton immediately on view switch,
  // then mounts the real component on the next animation frame.
  const deferRef = useRef(false)
  const prevViewKeyRef2 = useRef(`${activeView}:${selectedFeedId}`)
  const currentViewKey2 = `${activeView}:${selectedFeedId}`
  if (currentViewKey2 !== prevViewKeyRef2.current) {
    prevViewKeyRef2.current = currentViewKey2
    deferRef.current = true
  }
  // During render: if a switch was just detected, show skeleton regardless of state
  const effectiveShowContent = !deferRef.current

  useEffect(() => {
    if (!deferRef.current) return
    deferRef.current = false
    const raf = requestAnimationFrame(() => {
      performance.mark('vs:content-mounted')
      // Toggle dummy state to force re-render → real content mounts
      setShowContent((c) => !c)
    })
    return () => cancelAnimationFrame(raf)
  }, [activeView, selectedFeedId])

  // Dummy state to trigger re-render after rAF
  const [, setShowContent] = useState(true)

  // PERF: schedule a post-paint measurement collection
  useEffect(() => {
    const measure = () => {
      performance.mark('vs:paint')
      const marks = performance.getEntriesByType('mark')
      const startMark = marks.find((m) => m.name === 'vs:start')
      if (!startMark) return

      const measureFrom = (name: string, label: string) => {
        const m = marks.find((x) => x.name === name)
        if (m && m.startTime >= startMark.startTime) {
          console.log(
            `  ${label}: ${(m.startTime - startMark.startTime).toFixed(1)}ms`,
          )
        }
      }

      console.groupCollapsed(
        `🔍 View-switch perf (${(performance.now() - startMark.startTime).toFixed(1)}ms total to paint)`,
      )
      measureFrom('vs:store', '→ store update')
      measureFrom('vs:layout-commit', '→ Layout commit (skeleton)')
      measureFrom('vs:selectEntry-null', '→ selectEntry(null)')
      measureFrom('vs:content-mounted', '→ Content mounted')
      measureFrom('vs:wideview-memos', '→ WideView useMemos done')
      measureFrom('vs:wideview-masonry', '→ WideView masonryCards')
      measureFrom('vs:wideview-layout1', '→ WideView useLayoutEffect #1')
      measureFrom('vs:entrylist-memos', '→ EntryList useMemos done')
      measureFrom('vs:child-commit', '→ Child commit')
      measureFrom('vs:paint', '→ post-paint rAF')
      console.groupEnd()

      // Cleanup marks for next measurement
      ;[
        'vs:start',
        'vs:store',
        'vs:layout-commit',
        'vs:selectEntry-null',
        'vs:content-mounted',
        'vs:wideview-memos',
        'vs:wideview-masonry',
        'vs:wideview-layout1',
        'vs:entrylist-memos',
        'vs:child-commit',
        'vs:paint',
      ].forEach((name) => performance.clearMarks(name))
    }

    const raf = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(raf)
  }, [activeView, selectedFeedId])

  // Warm common timeline caches in the background to reduce first-switch stutter.
  useEffect(() => {
    if (feeds.length === 0) return

    let cancelled = false
    const run = async () => {
      const commonViews = [
        FeedViewType.SocialMedia,
        FeedViewType.Videos,
        FeedViewType.Pictures,
        FeedViewType.Articles,
      ]
      const tasks: Array<Promise<void>> = []

      for (const view of commonViews) {
        const feedIds = feeds
          .filter(
            (feed) =>
              (feed.view ?? FeedViewType.Articles) === view &&
              feed.category !== RECOMMENDED_CATEGORY &&
              feed.showInAll !== false,
          )
          .map((feed) => feed.id)
        if (feedIds.length === 0) continue
        tasks.push(prefetchEntries({ feedIds, limit: getEntryLoadLimit(view) }))
      }

      const allFeedIds = feeds
        .filter(
          (feed) =>
            feed.category !== RECOMMENDED_CATEGORY && feed.showInAll !== false,
        )
        .map((feed) => feed.id)
      if (allFeedIds.length > 0) {
        tasks.push(
          prefetchEntries({
            feedIds: allFeedIds,
            limit: getEntryLoadLimit(null),
          }),
        )
      }

      await Promise.allSettled(tasks)
    }

    const timer = window.setTimeout(
      () => {
        if (cancelled) return
        void run()
      },
      selectedFeedId ? 220 : 40,
    )

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [activeView, feeds, prefetchEntries, selectedFeedId])

  // Determine the effective view for layout decisions.
  // When activeView is null (All view) but a Pictures/Social/Videos feed is
  // selected, use the feed's configured view type so wide-view feeds render
  // with the proper 2-column layout instead of the article 3-column layout.
  const selectedFeedView =
    activeView === null && selectedFeedId
      ? (feeds.find((f) => f.id === selectedFeedId)?.view ?? null)
      : null
  const effectiveView = activeView ?? selectedFeedView

  // Views that use a 2-column layout (sidebar + wide content).
  const isWideView =
    effectiveView !== null &&
    [
      FeedViewType.SocialMedia,
      FeedViewType.Videos,
      FeedViewType.Pictures,
    ].includes(effectiveView)

  const [sidebarWidth, setSidebarWidth] = useState(() => loadWidths().sidebar)
  const [entryListWidth, setEntryListWidth] = useState(
    () => loadWidths().entryList,
  )

  // Which handle is being dragged: null | "sidebar" | "entryList"
  const dragging = useRef<'sidebar' | 'entryList' | null>(null)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const handleMouseDown = useCallback(
    (which: 'sidebar' | 'entryList', e: React.MouseEvent) => {
      e.preventDefault()
      dragging.current = which
      startX.current = e.clientX
      startWidth.current = which === 'sidebar' ? sidebarWidth : entryListWidth
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [sidebarWidth, entryListWidth],
  )

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const delta = e.clientX - startX.current
      const newWidth = startWidth.current + delta

      if (dragging.current === 'sidebar') {
        setSidebarWidth(Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, newWidth)))
      } else {
        setEntryListWidth(
          Math.max(ENTRY_LIST_MIN, Math.min(ENTRY_LIST_MAX, newWidth)),
        )
      }
    }

    const handleMouseUp = () => {
      if (dragging.current) {
        dragging.current = null
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        // Persist
        saveWidths(sidebarWidth, entryListWidth)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [sidebarWidth, entryListWidth])

  return (
    <div className="flex h-full w-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar width={sidebarWidth} />

      {/* Resize handle: sidebar ↔ main */}
      <ResizeHandle onMouseDown={(e) => handleMouseDown('sidebar', e)} />

      <div
        ref={contentFocusRef}
        tabIndex={-1}
        className={`flex min-w-0 flex-1 outline-none transition-shadow duration-300 ${
          isContentFocusHighlighted
            ? 'shadow-[inset_0_0_0_2px_rgb(var(--color-accent-rgb)/0.45)]'
            : ''
        }`}
      >
        {isDigestRoute ? (
          <Suspense fallback={<SkeletonList count={8} type="article" />}>
            <DigestContent />
          </Suspense>
        ) : isDiscoverOpen ? (
          <Suspense fallback={<SkeletonList count={8} type="article" />}>
            <DiscoverPanel />
          </Suspense>
        ) : !effectiveShowContent ? (
          /* Skeleton shown while deferring content mount */
          <div className="dark:bg-surface-dark flex min-w-0 flex-1 flex-col bg-white">
            <div className="flex h-12 items-center gap-2 border-b px-4">
              <div className="bg-surface-secondary h-4 w-24 animate-pulse rounded" />
            </div>
            <SkeletonList
              count={8}
              type={
                isWideView && effectiveView === FeedViewType.SocialMedia
                  ? 'social'
                  : isWideView
                    ? 'grid'
                    : 'article'
              }
            />
          </div>
        ) : isWideView ? (
          /* 2-column layout for Social Media / Videos */
          <div className="flex min-w-0 flex-1">
            <Suspense
              fallback={
                <SkeletonList
                  count={8}
                  type={
                    effectiveView === FeedViewType.SocialMedia
                      ? 'social'
                      : 'grid'
                  }
                />
              }
            >
              <WideViewContent />
            </Suspense>
          </div>
        ) : (
          <>
            {/* Entry List */}
            <EntryList width={entryListWidth} />

            {/* Resize handle: entry list ↔ content */}
            <ResizeHandle
              onMouseDown={(e) => handleMouseDown('entryList', e)}
            />

            {/* 主三栏阅读器详情列避开自定义标题栏，避免工具栏进入窗口拖拽命中区。 */}
            <div className="reader-titlebar-safe-pt flex min-w-0 flex-1">
              <EntryContent />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
