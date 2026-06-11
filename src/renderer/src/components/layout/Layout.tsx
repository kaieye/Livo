import {
  lazy,
  Profiler,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { useLocation } from 'react-router-dom'
import { ResizeHandle } from '../ui/ResizeHandle'
import { useDiscoverStore } from '../../store/discover-store'
import { useEntryStore } from '../../store/entry-store'
import { useFeedStore } from '../../store/feed-store'
import { useStoreShallow } from '../../store/helpers'
import { FeedViewType } from '../../../../shared/types'
import { buildEntryWarmupRequests } from '../../lib/entry-warmup'
import { useLayoutFocusTarget } from '../../hooks/useLayoutFocusTarget'
import { useFocusableHotkeyScope } from '../../hooks/useHotkeyScope'
import { EntryList } from '../entry/EntryList'
import { EntryEmptyState } from '../entry/entry-content/EntryEmptyState'
import { Sidebar } from './Sidebar'
import {
  markStartupComponentMounted,
  recordStartupReactProfiler,
} from '../../lib/startup-block-diagnostics'

const EntryContent = lazy(() =>
  import('../entry/EntryContent').then((m) => ({ default: m.EntryContent })),
)

const DigestContent = lazy(() =>
  import('./DigestContent').then((m) => ({ default: m.DigestContent })),
)

const WideViewContent = lazy(() =>
  import('../entry/WideViewContent').then((m) => ({
    default: m.WideViewContent,
  })),
)

const DiscoverPanel = lazy(() =>
  import('../discover/DiscoverPanel').then((m) => ({
    default: m.DiscoverPanel,
  })),
)

const RECOMMENDED_CATEGORY = 'Recommended'

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
const ENTRY_CONTENT_IDLE_TIMEOUT = 1200
const ENTRY_CONTENT_FALLBACK_DELAY = 900

function ContentPaneFallback() {
  return (
    <div className="bg-background dark:bg-background-dark min-w-0 flex-1" />
  )
}

export function Layout() {
  const contentFocusRef = useRef<HTMLDivElement>(null)
  const [shouldRenderEntryContent, setShouldRenderEntryContent] =
    useState(false)

  useLayoutEffect(() => {
    markStartupComponentMounted('Layout')
  }, [])

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
  const selectedEntryId = useEntryStore((s) => s.selectedEntry?.id ?? null)
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
      { timeout: 2500, fallbackDelay: 1800 },
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
      { timeout: 5000, fallbackDelay: 4000 },
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

  useEffect(() => {
    if (isDigestRoute || isDiscoverOpen || isWideView || !selectedEntryId) {
      setShouldRenderEntryContent(false)
      return
    }

    const cancelIdleTask = scheduleIdleTask(
      () => {
        recordStartupBlockEvent('EntryContent.idleMount')
        setShouldRenderEntryContent(true)
      },
      {
        timeout: ENTRY_CONTENT_IDLE_TIMEOUT,
        fallbackDelay: ENTRY_CONTENT_FALLBACK_DELAY,
      },
    )

    return cancelIdleTask
  }, [isDigestRoute, isDiscoverOpen, isWideView, selectedEntryId])

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
      <Profiler id="SidebarPane" onRender={recordStartupReactProfiler}>
        <Sidebar width={sidebarWidth} />
      </Profiler>
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
            <Suspense fallback={<ContentPaneFallback />}>
              <DigestContent />
            </Suspense>
          ) : isDiscoverOpen ? (
            <Suspense fallback={<ContentPaneFallback />}>
              <DiscoverPanel />
            </Suspense>
          ) : isWideView ? (
            <Suspense fallback={<ContentPaneFallback />}>
              <WideViewContent />
            </Suspense>
          ) : (
            <div className="reader-titlebar-safe-pt flex min-w-0 flex-1">
              <Profiler
                id="EntryListPane"
                onRender={recordStartupReactProfiler}
              >
                <EntryList width={entryListWidth} />
              </Profiler>
              <ResizeHandle
                onMouseDown={(e) => handleMouseDown('entryList', e)}
              />
              <Profiler id="ContentPane" onRender={recordStartupReactProfiler}>
                <div className="flex min-w-0 flex-1">
                  {!selectedEntryId ? (
                    <EntryEmptyState />
                  ) : shouldRenderEntryContent ? (
                    <Suspense fallback={<ContentPaneFallback />}>
                      <EntryContent />
                    </Suspense>
                  ) : (
                    <ContentPaneFallback />
                  )}
                </div>
              </Profiler>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
