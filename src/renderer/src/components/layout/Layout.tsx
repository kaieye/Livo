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
import { buildEntryWarmupRequests } from '../../lib/entry-warmup'
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

const warmedEntryScopeKeys = new Set<string>()
let wideViewModulesPreloadPromise: Promise<unknown> | null = null

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

function scheduleIdleTask(
  callback: () => void,
  options: { timeout: number; fallbackDelay: number },
): () => void {
  if (typeof window === 'undefined') return () => {}

  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(callback, {
      timeout: options.timeout,
    })
    return () => window.cancelIdleCallback(handle)
  }

  const handle = window.setTimeout(callback, options.fallbackDelay)
  return () => window.clearTimeout(handle)
}

function preloadWideViewModules(): Promise<unknown> {
  wideViewModulesPreloadPromise ??= Promise.allSettled([
    import('../entry/WideViewContent'),
    import('../entry/TimelineSection'),
    import('../entry/VideoGridSection'),
    import('../entry/PictureMasonry'),
  ])

  return wideViewModulesPreloadPromise
}

async function warmEntryScopesInOrder(
  requests: ReturnType<typeof buildEntryWarmupRequests>,
  prefetchEntries: ReturnType<typeof useEntryStore.getState>['prefetchEntries'],
  isCancelled: () => boolean,
): Promise<void> {
  for (const request of requests) {
    if (isCancelled()) return
    if (warmedEntryScopeKeys.has(request.key)) continue

    warmedEntryScopeKeys.add(request.key)
    try {
      await prefetchEntries(request.options)
    } catch {
      warmedEntryScopeKeys.delete(request.key)
    }
  }
}

// Constraints
const SIDEBAR_MIN = 200
const SIDEBAR_MAX = 400
const ENTRY_LIST_MIN = 260
const ENTRY_LIST_MAX = 640

function PanelSkeleton({ type }: { type: 'article' | 'social' | 'grid' }) {
  return (
    <div className="dark:bg-surface-dark flex min-w-0 flex-1 flex-col bg-white">
      <div className="flex h-12 flex-shrink-0 items-center gap-2 border-b px-4">
        <div className="bg-surface-secondary dark:bg-surface-dark-secondary h-4 w-28 animate-pulse rounded" />
        <div className="bg-surface-secondary dark:bg-surface-dark-secondary ml-auto h-8 w-20 animate-pulse rounded-lg" />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <SkeletonList count={8} type={type} />
      </div>
    </div>
  )
}

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
  const { prefetchEntries } = useStoreShallow(useEntryStore, (s) => ({
    prefetchEntries: s.prefetchEntries,
  }))
  const isContentFocusHighlighted = useLayoutFocusTarget(
    'content',
    contentFocusRef,
  )
  useFocusableHotkeyScope('content', contentFocusRef)
  const location = useLocation()
  const isDigestRoute = location.pathname === '/digest'

  // Clear stale detail content when switching view/feed scope.
  useLayoutEffect(() => {
    const entryStore = useEntryStore.getState()
    if (entryStore.selectedEntry) void entryStore.selectEntry(null)
  }, [activeView, selectedFeedId])

  // Warm wide-view code shortly after first paint so the first column switch
  // avoids paying the lazy-import cost on the interaction path.
  useEffect(() => {
    const cancelIdleTask = scheduleIdleTask(
      () => {
        void preloadWideViewModules()
      },
      { timeout: 180, fallbackDelay: 120 },
    )

    return cancelIdleTask
  }, [])

  // Warm common timeline caches in the background to reduce first-switch stutter.
  useEffect(() => {
    if (feeds.length === 0) return

    let cancelled = false
    const requests = buildEntryWarmupRequests(feeds, RECOMMENDED_CATEGORY)
    if (requests.length === 0) return

    const cancelIdleTask = scheduleIdleTask(
      () => {
        if (cancelled) return
        void warmEntryScopesInOrder(requests, prefetchEntries, () => cancelled)
      },
      { timeout: 520, fallbackDelay: 520 },
    )

    return () => {
      cancelled = true
      cancelIdleTask()
    }
  }, [feeds, prefetchEntries])

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
        <div className="flex min-w-0 flex-1">
          {isDigestRoute ? (
            <Suspense fallback={<PanelSkeleton type="article" />}>
              <DigestContent />
            </Suspense>
          ) : isDiscoverOpen ? (
            <Suspense fallback={<PanelSkeleton type="article" />}>
              <DiscoverPanel />
            </Suspense>
          ) : isWideView ? (
            <Suspense
              fallback={
                <PanelSkeleton
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
          ) : (
            <>
              <EntryList width={entryListWidth} />

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
    </div>
  )
}
