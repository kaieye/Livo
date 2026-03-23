import { useCallback, useEffect, useRef, useState } from "react"
import { Sidebar } from "./Sidebar"
import { EntryList } from "../entry/EntryList"
import { EntryContent } from "../entry/EntryContent"
import { WideViewContent } from "../entry/WideViewContent"
import { DiscoverPanel } from "../discover/DiscoverPanel"
import { useDiscoverStore } from "../../store/discover-store"
import { useEntryStore } from "../../store/entry-store"
import { useFeedStore } from "../../store/feed-store"
import { useStoreShallow } from "../../store/helpers"
import { FeedViewType } from "../../../../shared/types"
import { getEntryLoadLimit } from "../../lib/entry-load-limit"
import { useLayoutFocusTarget } from "../../hooks/useLayoutFocusTarget"
import { useFocusableHotkeyScope } from "../../hooks/useHotkeyScope"

const RECOMMENDED_CATEGORY = "Recommended"

// Persisted widths key
const STORAGE_KEY = "livo-panel-widths"

function loadWidths(): { sidebar: number; entryList: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
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
  const { isDiscoverOpen } = useStoreShallow(useDiscoverStore, (s) => ({ isDiscoverOpen: s.isOpen }))
  const { activeView, selectedFeedId, feeds } = useStoreShallow(useFeedStore, (s) => ({
    activeView: s.activeView,
    selectedFeedId: s.selectedFeedId,
    feeds: s.feeds,
  }))
  const { selectEntry, prefetchEntries } = useStoreShallow(useEntryStore, (s) => ({
    selectEntry: s.selectEntry,
    prefetchEntries: s.prefetchEntries,
  }))
  const isContentFocusHighlighted = useLayoutFocusTarget("content", contentFocusRef)
  useFocusableHotkeyScope("content", contentFocusRef)

  // Clear stale detail content when switching view/feed scope.
  useEffect(() => {
    void selectEntry(null)
  }, [activeView, selectedFeedId, selectEntry])

  // Warm common timeline caches in the background to reduce first-switch stutter.
  useEffect(() => {
    if (feeds.length === 0) return

    let cancelled = false
    const run = async () => {
      // Prioritize the currently janky tabs first.
      const commonViews = [
        FeedViewType.SocialMedia,
        FeedViewType.Videos,
        FeedViewType.Pictures,
        FeedViewType.Articles,
      ]
      const tasks: Array<Promise<void>> = []

      for (const view of commonViews) {
        const feedIds = feeds
          .filter((feed) =>
            (feed.view ?? FeedViewType.Articles) === view &&
            feed.category !== RECOMMENDED_CATEGORY &&
            feed.showInAll !== false,
          )
          .map((feed) => feed.id)
        if (feedIds.length === 0) continue
        tasks.push(prefetchEntries({ feedIds, limit: getEntryLoadLimit(view) }))
      }

      const allFeedIds = feeds
        .filter((feed) => feed.category !== RECOMMENDED_CATEGORY && feed.showInAll !== false)
        .map((feed) => feed.id)
      if (allFeedIds.length > 0) {
        tasks.push(prefetchEntries({ feedIds: allFeedIds, limit: getEntryLoadLimit(null) }))
      }

      await Promise.allSettled(tasks)
    }

    const timer = window.setTimeout(() => {
      if (cancelled) return
      void run()
    }, selectedFeedId ? 220 : 40)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [feeds, prefetchEntries, selectedFeedId])

  // Views that use a 2-column layout (sidebar + wide content).
  const isWideView = activeView !== null && [
    FeedViewType.SocialMedia,
    FeedViewType.Videos,
    FeedViewType.Pictures,
  ].includes(activeView)

  const [sidebarWidth, setSidebarWidth] = useState(() => loadWidths().sidebar)
  const [entryListWidth, setEntryListWidth] = useState(() => loadWidths().entryList)

  // Which handle is being dragged: null | "sidebar" | "entryList"
  const dragging = useRef<"sidebar" | "entryList" | null>(null)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const handleMouseDown = useCallback(
    (which: "sidebar" | "entryList", e: React.MouseEvent) => {
      e.preventDefault()
      dragging.current = which
      startX.current = e.clientX
      startWidth.current = which === "sidebar" ? sidebarWidth : entryListWidth
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
    },
    [sidebarWidth, entryListWidth],
  )

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const delta = e.clientX - startX.current
      const newWidth = startWidth.current + delta

      if (dragging.current === "sidebar") {
        setSidebarWidth(Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, newWidth)))
      } else {
        setEntryListWidth(Math.max(ENTRY_LIST_MIN, Math.min(ENTRY_LIST_MAX, newWidth)))
      }
    }

    const handleMouseUp = () => {
      if (dragging.current) {
        dragging.current = null
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
        // Persist
        saveWidths(sidebarWidth, entryListWidth)
      }
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [sidebarWidth, entryListWidth])

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar width={sidebarWidth} />

      {/* Resize handle: sidebar ↔ main */}
      <ResizeHandle onMouseDown={(e) => handleMouseDown("sidebar", e)} />

      <div
        ref={contentFocusRef}
        tabIndex={-1}
        className={`flex flex-1 min-w-0 outline-none transition-shadow duration-300 ${
          isContentFocusHighlighted ? "shadow-[inset_0_0_0_2px_rgba(255,92,0,0.45)]" : ""
        }`}
      >
        {isDiscoverOpen ? (
          <DiscoverPanel />
        ) : isWideView ? (
          /* 2-column layout for Social Media / Videos */
          <div className="flex flex-1 min-w-0">
            <WideViewContent />
          </div>
        ) : (
          <>
            {/* Entry List */}
            <EntryList width={entryListWidth} />

            {/* Resize handle: entry list ↔ content */}
            <ResizeHandle onMouseDown={(e) => handleMouseDown("entryList", e)} />

            {/* Entry Content */}
            <div className="flex flex-1 min-w-0">
              <EntryContent />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Draggable resize handle rendered between panels */
function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="relative z-10 w-0 flex-shrink-0 group"
    >
      {/* Invisible wider hit area */}
      <div className="absolute inset-y-0 -left-[3px] w-[6px] cursor-col-resize">
        {/* Visible line on hover / drag */}
        <div className="absolute inset-y-0 left-[2px] w-[2px] bg-transparent group-hover:bg-accent/40 group-active:bg-accent transition-colors" />
      </div>
    </div>
  )
}
