import { memo, startTransition, useState, useMemo, useCallback, useRef, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useFeedStore } from "../../store/feed-store"
import { useEntryStore } from "../../store/entry-store"
import { useSettingsStore } from "../../store/settings-store"
import { ImportProgressModal } from "../feed/ImportProgressModal"
import { FeedViewType, VIEW_DEFINITIONS, DEFAULT_SETTINGS } from "../../../../shared/types"
import { VIEW_TYPE_I18N_KEYS } from "../../lib/view-type-keys"
import { RECOMMENDED_CATEGORY } from "../../hooks/useInitRecommendedFeeds"
import {
  RECOMMENDED_ARTICLE_FEEDS,
  RECOMMENDED_SOCIAL_FEEDS,
  RECOMMENDED_VIDEO_FEEDS,
  DEFAULT_RSSHUB_INSTANCE,
} from "../../../../shared/discover-data"
import {
  Rss,
  Star,
  RefreshCw,
  Plus,
  Settings,
  ChevronRight,
  Trash2,
  CheckCheck,
  MessageSquare,
  Edit3,
  Check,
  X as XIcon,
  Upload,
  Download,
  FileText,
  MessageCircle,
  Image,
  Play,
  Bell,
  LayoutGrid,
  Compass,
  Keyboard,
  Search,
  Sparkles,
  FolderPlus,
  GripVertical,
  Link,
  Pencil,
  ExternalLink,
  Film,
} from "lucide-react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useAIChatStore } from "../../store/ai-chat-store"
import { useDiscoverStore } from "../../store/discover-store"
import { useQuickSearchStore } from "../search/QuickSearch"
import { useShortcutHelpStore } from "../shortcuts/ShortcutHelp"

const VIEW_ICONS: Record<FeedViewType, React.ReactNode> = {
  [FeedViewType.Articles]: <FileText size={18} />,
  [FeedViewType.SocialMedia]: <MessageCircle size={18} />,
  [FeedViewType.Videos]: <Play size={18} />,
  [FeedViewType.Pictures]: <Image size={18} />,
}

const EMPTY_FOLDERS_STORAGE_KEY = "livo-empty-folders"

function getPathLikeFromFeedUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol.toLowerCase() === "rsshub:") {
      return `/${parsed.hostname}${parsed.pathname}`
    }
    return parsed.pathname
  } catch {
    return rawUrl
  }
}

function inferFeedTitleFromUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    const pathLike = getPathLikeFromFeedUrl(rawUrl)
    const host = url.hostname.replace(/^www\./i, "")
    const bilibiliMatch = pathLike.match(/\/bilibili\/user\/(?:video|dynamic)\/(\d+)/i)
    if (bilibiliMatch?.[1]) return `UID ${bilibiliMatch[1]} - Bilibili`
    const twitterMatch = pathLike.match(/\/twitter\/user\/([^/?#]+)/i)
    if (twitterMatch?.[1]) return `${decodeURIComponent(twitterMatch[1]).replace(/^@/, "")} - X`
    const instagramMatch = pathLike.match(/\/instagram\/user\/([^/?#]+)/i)
    if (instagramMatch?.[1]) return `${decodeURIComponent(instagramMatch[1]).replace(/^@/, "")} - Ins`
    const picnobMatch = pathLike.match(/\/picnob(?:\.info)?\/user\/([^/?#]+)/i)
    if (picnobMatch?.[1]) return `${decodeURIComponent(picnobMatch[1]).replace(/^@/, "")} - Ins`
    return `${host} - RSS`
  } catch {
    return rawUrl
  }
}

function formatTwitterFeedTitle(candidateTitle: string | undefined, username: string): string {
  const fallback = (username || extractTwitterUsernameFromTitle(candidateTitle)).replace(/^@/, "").trim()
  let cleaned = (candidateTitle || "").trim()
  if (!cleaned || /^https?:\/\/\S+$/i.test(cleaned)) {
    return `${fallback || "X"} - X`
  }
  const stripHandleFragment = (value: string): string =>
    value
      .replace(/\s*[\/\s]*@?[a-zA-Z0-9_]{1,15}\s*$/i, "")
      .replace(/\s*\|\s*@?[a-zA-Z0-9_]{1,15}\s*$/i, "")
      .replace(/\s*\(\s*@?[a-zA-Z0-9_]{1,15}\s*\)\s*$/i, "")
      .trim()
  const escapedUser = fallback.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const withHandle = new RegExp(`^(.+?)\\s*\\(\\s*@?${escapedUser}\\s*\\)\\s*(?:\\/|[-\\u2013\\u2014]|on)\\s*(?:x|twitter)\\s*$`, "i")
  const fromWithHandle = cleaned.match(withHandle)?.[1]?.trim()
  if (fromWithHandle) return `${fromWithHandle} - X`
  const fromSlash = cleaned.match(/^(.+?)\s*(?:\/|[-\u2013\u2014]|on)\s*(?:x|twitter)\s*$/i)?.[1]?.trim()
  if (fromSlash) {
    const candidate = stripHandleFragment(fromSlash).replace(/^@/, "").trim()
    if (candidate && candidate.toLowerCase() !== fallback.toLowerCase()) return `${candidate} - X`
  }
  // Strip common leading platform markers repeatedly.
  cleaned = cleaned
    .replace(/^twitter\s*@?/i, "")
    .replace(/^x\s*@?/i, "")
    .replace(/^(?:x|twitter)\s*-\s*/i, "")
    .trim()
  // Strip trailing platform markers repeatedly.
  cleaned = cleaned
    .replace(/\s*-\s*(?:x|twitter)\s*$/i, "")
    .replace(/\s+on\s+(?:x|twitter)\s*$/i, "")
    .trim()
  cleaned = stripHandleFragment(cleaned)
  // Strong normalization for titles like "Display Name / @username".
  if (/[\/]/.test(cleaned) && /@[a-zA-Z0-9_]{1,15}/.test(cleaned)) {
    const prefix = cleaned.split(/[\/]/)[0]?.trim()
    if (prefix) cleaned = prefix
  }
  // Drop trailing or inline handle segments like " / @elonmusk" (including full-width slash).
  cleaned = cleaned
    .replace(/\s*[\/\s]*@?[a-zA-Z0-9_]{1,15}\b/g, "")
    .trim()
  // Normalize "Display Name / @username - X" to "Display Name - X".
  const slashParts = cleaned.split(/[\/]/).map((part) => part.trim()).filter(Boolean)
  if (slashParts.length > 1) {
    const nonHandle = slashParts.find((part) => !/^@?[a-zA-Z0-9_]{1,15}$/.test(part))
    if (nonHandle) cleaned = nonHandle
  }
  cleaned = cleaned.replace(/[\/\s]*@?[a-zA-Z0-9_]{1,15}\s*$/i, "").trim()
  cleaned = cleaned.replace(/^@/, "").trim()
  return `${cleaned || fallback || "X"} - X`
}

function extractTwitterUsernameFromRoute(route: string): string {
  const match = (route || "").match(/\/twitter\/user\/([^/?#]+)/i)
  return match?.[1] ? decodeURIComponent(match[1]).replace(/^@/, "") : ""
}

function extractTwitterUsernameFromAnyUrl(rawUrl?: string): string {
  const raw = (rawUrl || "").trim()
  if (!raw) return ""
  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.toLowerCase()
    if (host === "x.com" || host === "www.x.com" || host === "twitter.com" || host === "www.twitter.com") {
      const first = parsed.pathname.split("/").filter(Boolean)[0]
      if (first) return decodeURIComponent(first).replace(/^@/, "")
    }
    if (host.includes("nitter")) {
      const parts = parsed.pathname.split("/").filter(Boolean)
      if (parts.length >= 2 && parts[1].toLowerCase() === "rss" && /^[a-zA-Z0-9_]{1,15}$/.test(parts[0])) {
        return decodeURIComponent(parts[0]).replace(/^@/, "")
      }
    }
    const pathLike = getPathLikeFromFeedUrl(raw)
    return extractTwitterUsernameFromRoute(pathLike)
  } catch {
    return extractTwitterUsernameFromRoute(raw)
  }
}

function extractTwitterUsernameFromTitle(rawTitle?: string): string {
  const title = (rawTitle || "").trim()
  if (!title) return ""
  const at = title.match(/@([a-zA-Z0-9_]{1,15})/)
  if (at?.[1]) return at[1]
  const slash = title.match(/\/\s*@?([a-zA-Z0-9_]{1,15})\s*(?:-|$)/)
  if (slash?.[1]) return slash[1]
  return ""
}

function getSidebarFeedDisplayTitle(feed: { title?: string; url?: string; siteUrl?: string }): string {
  const rawTitle = (feed.title || "").trim()
  const twitterUsername =
    extractTwitterUsernameFromAnyUrl(feed.url) ||
    extractTwitterUsernameFromAnyUrl(feed.siteUrl) ||
    extractTwitterUsernameFromTitle(rawTitle)
  if (twitterUsername) return formatTwitterFeedTitle(rawTitle, twitterUsername)

  const instagramUsername = extractInstagramUsernameFromFeedRoute(feed.url || "") || extractInstagramNameFromUrl(feed.siteUrl || "")
  if (instagramUsername) return formatInstagramFeedTitle(rawTitle, instagramUsername)

  return rawTitle
}

function extractInstagramNameFromUrl(value: string): string {
  const raw = (value || "").trim()
  if (!raw) return ""
  try {
    const u = new URL(raw)
    const pathLike = getPathLikeFromFeedUrl(raw)
    const instagram = pathLike.match(/\/instagram\/user\/([^/?#]+)/i)
    if (instagram?.[1]) return decodeURIComponent(instagram[1]).replace(/^@/, "")
    const picnob = pathLike.match(/\/picnob(?:\.info)?\/user\/([^/?#]+)/i)
    if (picnob?.[1]) return decodeURIComponent(picnob[1]).replace(/^@/, "")
    if (/^(www\.)?instagram\.com$/i.test(u.hostname)) {
      return (u.pathname.split("/").filter(Boolean)[0] || "").replace(/^@/, "")
    }
  } catch {
    // Ignore.
  }
  return ""
}

function extractInstagramUsernameFromFeedRoute(value: string): string | null {
  try {
    const u = new URL(value)
    const pathLike = getPathLikeFromFeedUrl(value)
    const instagram = pathLike.match(/\/instagram\/user\/([^/?#]+)/i)
    if (instagram?.[1]) return decodeURIComponent(instagram[1]).replace(/^@/, "")
    const picnob = pathLike.match(/\/picnob(?:\.info)?\/user\/([^/?#]+)/i)
    if (picnob?.[1]) return decodeURIComponent(picnob[1]).replace(/^@/, "")
  } catch {
    // Ignore parse failures.
  }
  return null
}

function formatInstagramFeedTitle(candidateTitle: string | undefined, usernameOrUrl: string): string {
  const fromUrl = extractInstagramNameFromUrl(usernameOrUrl)
  const fallback = (fromUrl || usernameOrUrl || "").trim().replace(/^@/, "")
  let cleaned = (candidateTitle || "").trim()
  if (!cleaned || /^https?:\/\/\S+$/i.test(cleaned)) return `${fallback} - Ins`
  const fromAt = cleaned.match(/@([a-zA-Z0-9._]{1,30})/)
  if (fromAt?.[1]) return `${fromAt[1]} - Ins`
  const fromParenAt = cleaned.match(/\(\s*@([a-zA-Z0-9._]{1,30})\s*\)/)
  if (fromParenAt?.[1]) return `${fromParenAt[1]} - Ins`
  const fromPicnobSuffix = cleaned.match(/^([a-zA-Z0-9._]{1,30})\s*-\s*picnob(?:\.[^\s]+)?/i)
  if (fromPicnobSuffix?.[1]) return `${fromPicnobSuffix[1]} - Ins`
  const fromPicnob = cleaned.match(/^([a-zA-Z0-9._]{1,30})\s+\([^)]*\)\s+public\s+posts/i)
  if (fromPicnob?.[1]) return `${fromPicnob[1]} - Ins`
  cleaned = cleaned
    .replace(/^instagram\s*@?/i, "")
    .replace(/^ins\s*@?/i, "")
    .replace(/^(?:instagram|ins)\s*-\s*/i, "")
    .replace(/\s*-\s*(?:instagram|ins)\s*$/i, "")
    .replace(/\s*-\s*picnob(?:\.[^\s]+)?[\s\S]*$/i, "")
    .replace(/\s+public\s+posts[\s\S]*$/i, "")
    .replace(/^@/, "")
    .trim()
  return `${cleaned || fallback} - Ins`
}

function normalizeCandidateTitle(title: string | undefined, feedUrl: string): string {
  const cleaned = (title || "").trim()
  if (!cleaned || cleaned === feedUrl) return inferFeedTitleFromUrl(feedUrl)
  const bilibiliMatch = cleaned.match(/^(.+?)\s+的\s+bilibili\s+/i)
  if (bilibiliMatch?.[1]) return `${bilibiliMatch[1].trim()} - Bilibili`
  return cleaned
}

function extractBilibiliUidFromInput(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const directUid = trimmed.match(/^(?:uid[:\s-]*)?(\d{3,})$/i)
  if (directUid?.[1]) return directUid[1]
  const routeUid = trimmed.match(/\/bilibili\/user\/(?:video|dynamic)\/(\d+)/i)
  if (routeUid?.[1]) return routeUid[1]
  return null
}

function normalizeMatchKey(input: string): string {
  return input
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/\s*-\s*(youtube|bilibili)\s*$/i, "")
    .replace(/[@\s_.-]+/g, "")
    .trim()
}

function scoreVideoCandidateMatch(query: string, title: string): number {
  const q = normalizeMatchKey(query)
  const t = normalizeMatchKey(title)
  if (!q || !t) return 0
  if (t === q) return 300
  if (t.startsWith(q)) return 200
  if (t.includes(q)) return 100
  return 0
}

function loadPersistedEmptyFolders(): Array<{ name: string; view: FeedViewType | null }> {
  try {
    const raw = localStorage.getItem(EMPTY_FOLDERS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => item && typeof item.name === "string")
      .map((item) => ({
        name: item.name.trim(),
        view: typeof item.view === "number" ? item.view : null,
      }))
      .filter((item) => item.name.length > 0)
  } catch {
    return []
  }
}

export function Sidebar({ width }: { width?: number }) {
  const { feeds, selectedFeedId, activeView, setSelectedFeed, setActiveView, loadFeeds, refreshAll, refreshFeed, refreshMultiple, isRefreshing, removeFeed, updateFeed, importOPML, exportOPML } = useFeedStore()
  const { t } = useTranslation()
  const filteredFeeds = useMemo(
    () => activeView === null ? feeds : feeds.filter((f) => (f.view ?? FeedViewType.Articles) === activeView),
    [feeds, activeView]
  )
  const [allFeedsSearch, setAllFeedsSearch] = useState("")
  const allFeedsSearchLower = allFeedsSearch.trim().toLowerCase()
  const displayFeeds = useMemo(() => {
    if (activeView !== null || !allFeedsSearchLower) return filteredFeeds
    return filteredFeeds.filter((f) => {
      const title = f.title?.toLowerCase() || ""
      const url = f.url?.toLowerCase() || ""
      const siteUrl = f.siteUrl?.toLowerCase() || ""
      const category = f.category?.toLowerCase() || ""
      return title.includes(allFeedsSearchLower) || url.includes(allFeedsSearchLower) || siteUrl.includes(allFeedsSearchLower) || category.includes(allFeedsSearchLower)
    })
  }, [activeView, filteredFeeds, allFeedsSearchLower])
  const { markAllRead } = useEntryStore()
  const setSettingsOpen = useSettingsStore((s) => s.setOpen)
  const settingsLoaded = useSettingsStore((s) => s.isLoaded)
  const showRecommended = useSettingsStore((s) => s.settings.general.showRecommended)
  const opaqueSidebar = useSettingsStore((s) => s.settings.general.opaqueSidebar)
  const rawViewTabs = useSettingsStore((s) => s.settings.general.viewTabs)
  const viewTabs = useMemo(() => {
    const fallback = DEFAULT_SETTINGS.general.viewTabs
    const source = Array.isArray(rawViewTabs) ? rawViewTabs : fallback
    const valid = source.filter(
      (tab): tab is { id: FeedViewType; visible: boolean } =>
        !!tab &&
        typeof tab.id === "number" &&
        typeof tab.visible === "boolean" &&
        !!VIEW_DEFINITIONS[tab.id as FeedViewType],
    )
    const ids = new Set(valid.map((tab) => tab.id))
    for (const tab of fallback) {
      if (!ids.has(tab.id)) valid.push(tab)
    }
    return valid.length > 0 ? valid : fallback
  }, [rawViewTabs])
  const language = useSettingsStore((s) => s.settings.general.language)
  const { isPanelOpen, setPanelOpen } = useAIChatStore()
  const { isOpen: isDiscoverOpen, setOpen: setDiscoverOpen } = useDiscoverStore()
  const toggleSearch = useQuickSearchStore((s) => s.toggle)
  const toggleShortcutHelp = useShortcutHelpStore((s) => s.toggle)
  const [isImporting, setIsImporting] = useState(false)
  const [showImportProgress, setShowImportProgress] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [refreshHint, setRefreshHint] = useState<{ msg: string; ok: boolean } | null>(null)
  const refreshHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const viewSwitchRafRef = useRef<number | null>(null)
  const [uiActiveView, setUiActiveView] = useState<FeedViewType | null>(activeView)
  const [contextMenu, setContextMenu] = useState<{ feedId: string; x: number; y: number; isRecommended?: boolean } | null>(null)
  const [categoryContextMenu, setCategoryContextMenu] = useState<{ category: string; feedIds: string[]; x: number; y: number } | null>(null)
  const [editingFeed, setEditingFeed] = useState<{ id: string; title: string; url: string; category: string; view: FeedViewType; showInAll: boolean } | null>(null)
  // Folder creation / renaming
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [emptyFolders, setEmptyFolders] = useState<Array<{ name: string; view: FeedViewType | null }>>(
    () => loadPersistedEmptyFolders(),
  )
  const [renamingCategory, setRenamingCategory] = useState<{ oldName: string; newName: string } | null>(null)
  // Drag-and-drop state (persistent window-level listeners for reliability)
  const [dragFeedId, setDragFeedId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const dropTargetRef = useRef<string | null>(null) // Track drop target in ref for immediate access
  const dragNodeRef = useRef<HTMLDivElement | null>(null)
  const [dragOverlay, setDragOverlay] = useState<{ label: string; x: number; y: number } | null>(null)
  const dragOverlayRef = useRef<{ feedId: string; startY: number; pointerId: number } | null>(null)

  // Keep latest values in refs so the persistent window listener can access them
  const updateFeedRef = useRef(updateFeed)
  updateFeedRef.current = updateFeed
  const tRef = useRef(t)
  tRef.current = t
  const getViewFolderName = useCallback(
    (view: FeedViewType) => t(VIEW_TYPE_I18N_KEYS[view] || "viewTypes.articles"),
    [t],
  )
  const i18nDefault = useCallback(
    (zh: string, en: string) => (language || "zh-CN").toLowerCase().startsWith("zh") ? zh : en,
    [language],
  )
  const tWithDefault = useCallback(
    (key: string, zh: string, en: string, options?: Record<string, unknown>) => {
      const interpolation = { ...(options || {}) } as Record<string, unknown>
      for (const [k, v] of Object.entries(options || {})) {
        const upper = k.toUpperCase()
        if (!(upper in interpolation)) interpolation[upper] = v
      }
      const translated = t(key, { ...interpolation, defaultValue: i18nDefault(zh, en) })
      if (typeof translated !== "string") return translated
      const optionEntries = Object.entries(interpolation).map(([k, v]) => [k.toLowerCase(), String(v)] as const)
      const optionMap = new Map(optionEntries)
      const firstValue = optionEntries[0]?.[1] || ""
      return translated.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (_m, rawName: string) => {
        const name = rawName.toLowerCase()
        if (optionMap.has(name)) return optionMap.get(name) || ""
        // Compatibility: handle common typo in some locale strings.
        if (name === "channer" && optionMap.has("channel")) return optionMap.get("channel") || ""
        return firstValue || ""
      })
    },
    [t, i18nDefault],
  )
  const visibleViewIds = useMemo(() => {
    if (activeView !== null) return [activeView]
    return viewTabs.filter((tab) => tab.visible).map((tab) => tab.id)
  }, [activeView, viewTabs])
  const viewDefaultFolderNames = useMemo(
    () => new Set(visibleViewIds.map((viewId) => getViewFolderName(viewId))),
    [visibleViewIds, getViewFolderName],
  )
  const isDefaultFolderName = useCallback(
    (category: string) => viewDefaultFolderNames.has(category),
    [viewDefaultFolderNames],
  )
  const isDefaultFolderNameRef = useRef(isDefaultFolderName)
  isDefaultFolderNameRef.current = isDefaultFolderName
  const syncFeedAvatarFromCandidate = useCallback(async (feedUrl: string, imageUrl?: string) => {
    const image = (imageUrl || "").trim()
    if (!image) return
    let target = feeds.find((f) => f.url === feedUrl)
    if (!target) {
      await loadFeeds()
      target = useFeedStore.getState().feeds.find((f) => f.url === feedUrl)
    }
    if (!target) return
    if (target.imageUrl === image) return
    await updateFeed(target.id, { imageUrl: image })
  }, [feeds, loadFeeds, updateFeed])
  const getFeedFolderName = useCallback(
    (feed: { category?: string; view?: FeedViewType }) => {
      if (feed.category?.trim()) return feed.category
      return getViewFolderName(feed.view ?? FeedViewType.Articles)
    },
    [getViewFolderName],
  )

  const feedsRef = useRef(feeds)
  feedsRef.current = feeds
  const getFeedFolderNameRef = useRef(getFeedFolderName)
  getFeedFolderNameRef.current = getFeedFolderName

  // Get default folder name for new folders
  const getDefaultFolderName = () => {
    return t("sidebar.newFolderName")
  }

  // Global window-level listeners 闂?added once, check ref to see if drag is active
  useEffect(() => {
    const onMove = (ev: PointerEvent) => {
      if (!dragOverlayRef.current) return
      setDragOverlay((prev) => prev ? { ...prev, x: ev.clientX, y: ev.clientY } : null)
      // Hit-test for drop targets (category headers with data-drop-category)
      // Use visibility to hide overlay temporarily (preserves layout)
      const overlayEl = document.getElementById("feed-drag-overlay")
      if (overlayEl) overlayEl.style.visibility = "hidden"
      const elements = document.elementsFromPoint(ev.clientX, ev.clientY)
      if (overlayEl) overlayEl.style.visibility = "visible"

      // Find the closest data-drop-category element
      let foundCategory: string | null = null
      for (const el of elements) {
        const catAttr = (el as HTMLElement).getAttribute?.("data-drop-category")
        if (catAttr) {
          foundCategory = catAttr
          break
        }
      }
      dropTargetRef.current = foundCategory
      setDropTarget(foundCategory)
    }

    const onUp = () => {
      if (!dragOverlayRef.current) return
      const { feedId } = dragOverlayRef.current

      // Get current drop target from ref (immediate access)
      const currentTarget = dropTargetRef.current
      const draggedFeed = feedsRef.current.find((f) => f.id === feedId)
      const sourceFolder = draggedFeed ? getFeedFolderNameRef.current(draggedFeed) : null

      // Clear all drag state first
      dropTargetRef.current = null
      setDropTarget(null)
      setDragFeedId(null)
      setDragOverlay(null)
      dragOverlayRef.current = null

      // Perform drop if we have a valid target
      if (currentTarget) {
        const actualCat = currentTarget === tRef.current("common.uncategorized") || isDefaultFolderNameRef.current(currentTarget)
          ? ""
          : currentTarget
        updateFeedRef.current(feedId, { category: actualCat })
        setEmptyFolders((prev) => {
          let next = prev
          if (
            sourceFolder &&
            sourceFolder !== currentTarget &&
            !isDefaultFolderNameRef.current(sourceFolder)
          ) {
            next = [
              ...next.filter((f) => f.name !== sourceFolder),
              { name: sourceFolder, view: draggedFeed?.view ?? FeedViewType.Articles },
            ]
          }
          return next.filter((f) => f.name !== currentTarget)
        })
      }
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Start drag 闂?just sets state; window listeners handle move/up
  const handleDragPointerStart = useCallback((feedId: string, label: string, e: React.PointerEvent) => {
    e.preventDefault()
    setDragFeedId(feedId)
    setDragOverlay({ label, x: e.clientX, y: e.clientY })
    dragOverlayRef.current = { feedId, startY: e.clientY, pointerId: e.pointerId }
  }, [])
  // Twitter user search state
  const [twitterSearch, setTwitterSearch] = useState("")
  const [twitterSearching, setTwitterSearching] = useState(false)
  const [twitterSearchResult, setTwitterSearchResult] = useState<{ msg: string; ok: boolean } | null>(null)
  const [twitterCandidate, setTwitterCandidate] = useState<{ username: string; title: string; description: string; image: string; valid: boolean; loading: boolean; alreadyFollowed: boolean; hasSpaces?: boolean; feedUrl?: string } | null>(null)
  const [socialBiliCandidates, setSocialBiliCandidates] = useState<Array<{ uid: string; title: string; description: string; image: string; feedUrl: string; alreadyFollowed: boolean }>>([])
  const [twitterInputFocused, setTwitterInputFocused] = useState(false)
  const twitterDropdownRef = useRef<HTMLDivElement | null>(null)
  const rsshubInstance = useSettingsStore((s) => s.settings.general.rsshubInstance) || "https://rsshub.pseudoyu.com"
  const { addFeed } = useFeedStore()

  // YouTube channel search state
  const [youtubeSearch, setYoutubeSearch] = useState("")
  const [youtubeSearching, setYoutubeSearching] = useState(false)
  const [youtubeSearchResult, setYoutubeSearchResult] = useState<{ msg: string; ok: boolean } | null>(null)
  const [youtubeCandidate, setYoutubeCandidate] = useState<{ query: string; title: string; description: string; image: string; valid: boolean; loading: boolean; alreadySubscribed: boolean; feedRoute?: string; feedUrl?: string } | null>(null)
  const [videoCandidates, setVideoCandidates] = useState<Array<{
    platform: "youtube" | "bilibili"
    title: string
    description: string
    image: string
    feedUrl: string
    alreadySubscribed: boolean
  }>>([])
  const [youtubeInputFocused, setYoutubeInputFocused] = useState(false)
  const youtubeDropdownRef = useRef<HTMLDivElement | null>(null)

  // Instagram user search state
  const [instagramSearch, setInstagramSearch] = useState("")
  const [instagramSearching, setInstagramSearching] = useState(false)
  const [instagramSearchResult, setInstagramSearchResult] = useState<{ msg: string; ok: boolean } | null>(null)
  const [instagramCandidate, setInstagramCandidate] = useState<{ username: string; title: string; description: string; image: string; valid: boolean; loading: boolean; alreadySubscribed: boolean; feedUrl?: string; isDirectUrl?: boolean } | null>(null)
  const [instagramInputFocused, setInstagramInputFocused] = useState(false)
  const instagramDropdownRef = useRef<HTMLDivElement | null>(null)
  const getTwitterUsernameFromUrl = useCallback((value: string): string | null => {
    try {
      const parsed = new URL(value)
      const host = parsed.hostname.toLowerCase()
      if (!(host === "x.com" || host === "www.x.com" || host === "twitter.com" || host === "www.twitter.com")) return null
      const segment = parsed.pathname.split("/").filter(Boolean)[0] || ""
      if (!segment) return null
      return segment.replace(/^@/, "")
    } catch {
      return null
    }
  }, [])
  const isTwitterProfileUrl = useCallback((value: string): boolean => {
    const user = getTwitterUsernameFromUrl(value)
    if (!user) return false
    const reserved = new Set(["home", "explore", "search", "i", "messages", "settings", "compose", "notifications", "login", "signup", "tos", "privacy", "about", "intent", "hashtag"])
    return !reserved.has(user.toLowerCase())
  }, [getTwitterUsernameFromUrl])
  const getTwitterUsernameFromFeedUrl = useCallback((value: string): string | null => {
    try {
      const parsed = new URL(value)
      const host = parsed.hostname.toLowerCase()
      const pathLike = getPathLikeFromFeedUrl(value)

      // RSSHub route: /twitter/user/{username}
      const rsshubMatch = pathLike.match(/\/twitter\/user\/([^/?#]+)/i)
      if (rsshubMatch?.[1]) return decodeURIComponent(rsshubMatch[1]).replace(/^@/, "")

      // Nitter RSS route: /{username}/rss
      if (host.includes("nitter")) {
        const parts = parsed.pathname.split("/").filter(Boolean)
        if (parts.length >= 2 && parts[1].toLowerCase() === "rss") {
          return decodeURIComponent(parts[0]).replace(/^@/, "")
        }
      }
    } catch {
      // Ignore parse failures.
    }
    return null
  }, [])
  const getInstagramUsernameFromUrl = useCallback((value: string): string | null => {
    try {
      const parsed = new URL(value)
      if (!/^(www\.)?instagram\.com$/i.test(parsed.hostname)) return null
      const segment = parsed.pathname.split("/").filter(Boolean)[0] || ""
      if (!segment) return null
      return segment.replace(/^@/, "")
    } catch {
      return null
    }
  }, [])
  const isInstagramProfileUrl = useCallback((value: string): boolean => {
    const username = getInstagramUsernameFromUrl(value)
    if (!username) return false
    const reserved = new Set(["p", "reel", "reels", "tv", "explore", "accounts", "stories", "direct", "about", "developer"])
    return !reserved.has(username.toLowerCase())
  }, [getInstagramUsernameFromUrl])
  const normalizeRsshubProtocolInput = useCallback((value: string): string => {
    const trimmed = (value || "").trim()
    const m = trimmed.match(/^rsshub:\/\/+(.+)$/i)
    if (m?.[1]) {
      const route = m[1].replace(/^\/+/, "")
      return `rsshub://${route}`
    }
    try {
      const parsed = new URL(trimmed)
      if (/^https?:$/i.test(parsed.protocol)) {
        const route = parsed.pathname.replace(/^\/+/, "")
        if (route && /^(?:twitter|instagram|picnob(?:\.info)?|youtube|bilibili|github|weibo|zhihu)\//i.test(route)) {
          return `rsshub://${route}${parsed.search || ""}`
        }
      }
    } catch {
      // Ignore.
    }
    return trimmed
  }, [])
  const buildPicnobProtocolRoute = useCallback((username: string): string => {
    const clean = (username || "").trim().replace(/^@/, "")
    return `rsshub://instagram/user/${encodeURIComponent(clean)}`
  }, [])
  const isFeedSubscribedInTargetView = useCallback((feed: { category?: string; view?: FeedViewType }, targetView: FeedViewType): boolean => {
    if (feed.category === RECOMMENDED_CATEGORY) return false
    return (feed.view ?? FeedViewType.Articles) === targetView
  }, [])
  const twitterMatchedFeeds = useMemo(() => {
    if (!twitterInputFocused) return []
    const q = twitterSearch.trim().toLowerCase()
    if (!q) return []
    return displayFeeds
      .filter((f) => f.category !== RECOMMENDED_CATEGORY)
      .filter((f) => f.title.toLowerCase().includes(q))
      .slice(0, 6)
  }, [displayFeeds, twitterInputFocused, twitterSearch])
  const youtubeMatchedFeeds = useMemo(() => {
    if (!youtubeInputFocused) return []
    const q = youtubeSearch.trim().toLowerCase()
    if (!q) return []
    return displayFeeds
      .filter((f) => f.category !== RECOMMENDED_CATEGORY)
      .filter((f) => {
        const title = f.title.toLowerCase()
        const url = (f.url || "").toLowerCase()
        return title.includes(q) || url.includes(q)
      })
      .slice(0, 6)
  }, [displayFeeds, youtubeInputFocused, youtubeSearch])
  const videoSearchCandidates = useMemo(
    () => videoCandidates.filter((c) => !c.alreadySubscribed),
    [videoCandidates],
  )
  const instagramMatchedFeeds = useMemo(() => {
    if (!instagramInputFocused) return []
    const q = instagramSearch.trim().toLowerCase()
    if (!q) return []
    return displayFeeds
      .filter((f) => f.category !== RECOMMENDED_CATEGORY)
      .filter((f) => f.title.toLowerCase().includes(q))
      .slice(0, 6)
  }, [displayFeeds, instagramInputFocused, instagramSearch])

  const recommendedUrls = useMemo(() => {
    const base = (rsshubInstance || DEFAULT_RSSHUB_INSTANCE).replace(/\/+$/, "")
    const all = [
      ...RECOMMENDED_ARTICLE_FEEDS,
      ...RECOMMENDED_SOCIAL_FEEDS,
      ...RECOMMENDED_VIDEO_FEEDS,
    ]
    const urls = new Set<string>()
    for (const feed of all) {
      const url = feed.isRSSHub ? `${base}${feed.url}` : feed.url
      urls.add(url)
    }
    return urls
  }, [rsshubInstance])

  useEffect(() => {
    try {
      localStorage.setItem(EMPTY_FOLDERS_STORAGE_KEY, JSON.stringify(emptyFolders))
    } catch {
      // Ignore storage errors
    }
  }, [emptyFolders])

  // Debounced validation of Twitter username
  useEffect(() => {
    const input = twitterSearch.trim()
    if (!input) {
      setTwitterCandidate(null)
      return
    }
    const isUrlInput = /^https?:\/\/\S+$/i.test(input)
    if (isUrlInput && isTwitterProfileUrl(input)) {
      const urlUser = getTwitterUsernameFromUrl(input) || input
      setTwitterCandidate({ username: urlUser, title: `@${urlUser}`, description: "", image: "", valid: false, loading: true, alreadyFollowed: false })
      const timer = setTimeout(async () => {
        try {
          const resolved = await window.api.discover.resolveProfileUrl(input)
          if (!resolved.candidates.length) {
            setTwitterCandidate((prev) => {
              if (!prev || prev.username !== urlUser) return prev
              return { username: urlUser, title: `@${urlUser}`, description: tWithDefault("sidebar.twitterUserNotFound", "User not found", "User not found"), image: "", valid: false, loading: false, alreadyFollowed: false }
            })
            return
          }
          let picked = resolved.candidates[0]
          let pickedValid = false
          for (const candidate of resolved.candidates) {
            const probe = await window.api.discover.validateFeed(candidate.feedUrl)
            if (probe.valid) {
              picked = candidate
              pickedValid = true
              break
            }
          }
          setTwitterCandidate((prev) => {
            if (!prev || prev.username !== urlUser) return prev
            const lowerUser = urlUser.toLowerCase()
            const followed = feeds.some((f) => {
              if (f.url === picked.feedUrl && f.category !== RECOMMENDED_CATEGORY) return true
              const feedUser = getTwitterUsernameFromFeedUrl(f.url)
              return !!(feedUser && feedUser.toLowerCase() === lowerUser && f.category !== RECOMMENDED_CATEGORY)
            })
            return {
              username: urlUser,
              title: formatTwitterFeedTitle(picked.title, urlUser),
              description: pickedValid ? (picked.description || "") : tWithDefault("sidebar.twitterFollowFailed", "Follow failed, check username or network", "Follow failed, check username or network"),
              image: `https://unavatar.io/x/${encodeURIComponent(urlUser)}`,
              valid: pickedValid,
              loading: false,
              alreadyFollowed: followed,
              feedUrl: picked.feedUrl,
            }
          })
        } catch {
          setTwitterCandidate((prev) => {
            if (!prev || prev.username !== urlUser) return prev
            return { ...prev, loading: false, valid: false, description: tWithDefault("sidebar.twitterValidationError", "Validation failed, try again", "Validation failed, try again") }
          })
        }
      }, 500)
      return () => clearTimeout(timer)
    }

    const raw = input.replace(/^@/, "")
    if (!/^[a-zA-Z0-9_ ]{1,30}$/.test(raw)) {
      setTwitterCandidate(null)
      return
    }
    // Support searching by display name (e.g. "sam altman") via built-in X recommendations.
    const normalizedRaw = raw.trim().toLowerCase()
    const recommendedTwitter = RECOMMENDED_SOCIAL_FEEDS.find((feed) => {
      if (!feed.isRSSHub) return false
      const user = extractTwitterUsernameFromRoute(feed.url)
      if (!user) return false
      const haystack = `${feed.title} ${feed.description} ${user}`.toLowerCase()
      return !!normalizedRaw && haystack.includes(normalizedRaw)
    })
    const recommendedUsername = extractTwitterUsernameFromRoute(recommendedTwitter?.url || "")

    // Extract clean username (no spaces) for RSSHub, keep original for display
    const cleanUsername = raw.replace(/\s+/g, "")
    const inputHasSpaces = raw !== cleanUsername
    // Prioritize display-name match over raw compacted username.
    const finalUsername = recommendedUsername || (/^[a-zA-Z0-9_]{1,15}$/.test(cleanUsername) ? cleanUsername : "")
    if (!finalUsername) {
      setTwitterCandidate(null)
      return
    }
    // Show loading candidate immediately
    setTwitterCandidate({
      username: finalUsername,
      title: recommendedTwitter?.title || `@${finalUsername}`,
      description: "",
      image: "",
      valid: false,
      loading: true,
      alreadyFollowed: false,
      hasSpaces: inputHasSpaces,
    })
    const timer = setTimeout(async () => {
      try {
        const result = await window.api.discover.probeTwitterUser(finalUsername)
        // Only update if input hasn't changed
        setTwitterCandidate((prev) => {
          if (!prev || prev.username !== finalUsername) return prev
          if (result.valid) {
            // Case-insensitive check against existing feeds
            const lowerUser = finalUsername.toLowerCase()
            const followed = feeds.some((f) => {
              const feedUser = getTwitterUsernameFromFeedUrl(f.url)
              return !!(feedUser && feedUser.toLowerCase() === lowerUser && f.category !== RECOMMENDED_CATEGORY)
            })
            return { username: finalUsername, title: formatTwitterFeedTitle(result.title || recommendedTwitter?.title, finalUsername), description: result.description || "", image: result.image || "", valid: true, loading: false, alreadyFollowed: followed, hasSpaces: inputHasSpaces }
          }
          return {
            username: finalUsername,
            title: recommendedTwitter?.title || `@${finalUsername}`,
            description: inputHasSpaces && !recommendedUsername
              ? tWithDefault("sidebar.twitterDisplayNameHint", "This looks like a display name. Enter the exact @username", "This looks like a display name. Enter the exact @username")
              : tWithDefault("sidebar.twitterUserNotFound", "User not found", "User not found"),
            image: "",
            valid: false,
            loading: false,
            alreadyFollowed: false,
            hasSpaces: inputHasSpaces,
          }
        })
      } catch {
        setTwitterCandidate((prev) => {
          if (!prev || prev.username !== finalUsername) return prev
          return {
            ...prev,
            loading: false,
            valid: false,
            description: tWithDefault("sidebar.twitterValidationError", "Validation failed, try again", "Validation failed, try again"),
          }
        })
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [twitterSearch, rsshubInstance, t, feeds, tWithDefault, isTwitterProfileUrl, getTwitterUsernameFromUrl, getTwitterUsernameFromFeedUrl])

  // Debounced Bilibili candidate probe in Social view (UID / profile URL / keyword)
  useEffect(() => {
    const input = twitterSearch.trim()
    if (activeView !== FeedViewType.SocialMedia || !input) {
      setSocialBiliCandidates([])
      return
    }

    const timer = setTimeout(async () => {
      const candidates: Array<{ uid: string; title: string; description: string; image: string; feedUrl: string; alreadyFollowed: boolean }> = []
      const seen = new Set<string>()
      const inputLower = input.toLowerCase()
      const base = (rsshubInstance || DEFAULT_RSSHUB_INSTANCE).replace(/\/+$/, "")
      const pushCandidate = (uid: string, title: string, description: string, image: string, force = false) => {
        if (!uid || seen.has(uid)) return
        const normalizedTitle = title || `UID ${uid} - Bilibili`
        const normalizedDescription = description || `UID ${uid}`
        const searchable = `${uid} ${normalizedTitle} ${normalizedDescription}`.toLowerCase()
        // Hard rule for keyword search: candidate must include the typed string.
        if (!force && !searchable.includes(inputLower)) return
        seen.add(uid)
        const feedUrl = `${base}/bilibili/user/dynamic/${uid}`
        const alreadyFollowed = feeds.some((f) => {
          if (f.category === RECOMMENDED_CATEGORY) return false
          if ((f.url || "") === feedUrl) return true
          const existingUid = extractBilibiliUidFromInput(f.url || "")
          if (existingUid !== uid) return false
          return (f.view ?? FeedViewType.Articles) === FeedViewType.SocialMedia
        })
        candidates.push({
          uid,
          title: normalizedTitle,
          description: normalizedDescription,
          image: image || "",
          feedUrl,
          alreadyFollowed,
        })
      }

      try {
        const maybeUid = extractBilibiliUidFromInput(input)
        if (maybeUid) {
          const probe = await window.api.discover.probeBilibiliUid(maybeUid)
          if (probe.valid) {
            pushCandidate(
              probe.uid,
              probe.title || `${probe.uid} - Bilibili`,
              probe.description || `UID ${probe.uid}`,
              probe.image || "",
              true,
            )
          } else {
            pushCandidate(maybeUid, `${maybeUid} - Bilibili`, `UID ${maybeUid}`, "", true)
          }
        } else if (/^https?:\/\/(?:www\.)?space\.bilibili\.com\/\d+/i.test(input)) {
          const resolved = await window.api.discover.resolveProfileUrl(input)
          const bilibiliCandidates = (resolved.candidates || [])
            .filter((c) => /\/bilibili\/user\/(?:video|dynamic)\/\d+/i.test(c.feedUrl))
          for (const c of bilibiliCandidates) {
            const uid = extractBilibiliUidFromInput(c.feedUrl || "")
            if (!uid) continue
            pushCandidate(uid, c.title || `${uid} - Bilibili`, c.description || "", "", true)
          }
        } else if (input.length >= 2) {
          const probed = await window.api.discover.probeBilibiliUsers(input)
          for (const c of probed.candidates || []) {
            const uid = c.uid || extractBilibiliUidFromInput(c.feedUrl || "") || extractBilibiliUidFromInput(c.description || "")
            if (!uid) continue
            pushCandidate(uid, c.title || `${uid} - Bilibili`, c.description || "", c.image || "")
          }
        }
      } catch {
        // Ignore probe errors and keep existing candidates.
      }

      setSocialBiliCandidates(candidates.slice(0, 6))
    }, 420)

    return () => clearTimeout(timer)
  }, [activeView, twitterSearch, rsshubInstance, feeds])

  // Debounced validation of YouTube channel/username
  useEffect(() => {
    const input = youtubeSearch.trim()
    if (!input) {
      setYoutubeCandidate(null)
      setVideoCandidates([])
      return
    }

    const isRsshubProtocolUrl = /^rsshub:\/\/\S+/i.test(input)
    const isHttpUrl = /^https?:\/\/\S+$/i.test(input)
    const isDirectFeedUrl = isHttpUrl || isRsshubProtocolUrl
    const isYouTubeUrl = /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i.test(input)
    const raw = input.replace(/^@/, "")
    const bilibiliUid = extractBilibiliUidFromInput(input)
    if (!isYouTubeUrl && !isDirectFeedUrl && raw.length < 2) {
      setYoutubeCandidate(null)
      setVideoCandidates([])
      return
    }

    // Local fast-path for Bilibili UID / RSSHub bilibili routes to avoid "no match".
    if (!isDirectFeedUrl && bilibiliUid) {
      const feedUrl = `${(rsshubInstance || DEFAULT_RSSHUB_INSTANCE).replace(/\/+$/, "")}/bilibili/user/video/${bilibiliUid}`
      setVideoCandidates([])
      setYoutubeCandidate({ query: input, title: input, description: "", image: "", valid: false, loading: true, alreadySubscribed: false })
      void (async () => {
        let title = `UID ${bilibiliUid} - Bilibili`
        let description = `UID ${bilibiliUid}`
        let image = ""
        let resolvedFeedUrl = feedUrl
        try {
          const probe = await window.api.discover.probeBilibiliUid(bilibiliUid)
          if (probe.valid) {
            title = probe.title || title
            description = probe.description || description
            image = probe.image || image
            resolvedFeedUrl = probe.feedUrl || resolvedFeedUrl
          }
        } catch {
          // Fall back to UID candidate.
        }
        const alreadySubscribed = feedsRef.current.some((f) => f.url === resolvedFeedUrl && f.category !== RECOMMENDED_CATEGORY)
        setYoutubeCandidate((prev) => (prev && prev.query === input ? null : prev))
        setVideoCandidates([{
          platform: "bilibili",
          title,
          description,
          image,
          feedUrl: resolvedFeedUrl,
          alreadySubscribed,
        }])
      })()
      return
    }

    // Show loading immediately
    setYoutubeCandidate({ query: input, title: input, description: "", image: "", valid: false, loading: true, alreadySubscribed: false })
    setVideoCandidates([])
    const timer = setTimeout(async () => {
      const validateFeedWithTimeout = async (url: string, timeoutMs = 4500) => {
        return await Promise.race([
          window.api.discover.validateFeed(url),
          new Promise<{ valid: false; error: string }>((resolve) =>
            setTimeout(() => resolve({ valid: false, error: "validate timeout" }), timeoutMs),
          ),
        ])
      }

      try {
        if (isDirectFeedUrl) {
          setVideoCandidates([])
          const resolvedTarget = await resolveUrlSubscriptionTarget(input, FeedViewType.Videos, input)
          if (!resolvedTarget.ok) {
            setYoutubeCandidate((prev) => {
              if (!prev || prev.query !== input) return prev
              return {
                query: input,
                title: input,
                description: resolvedTarget.error,
                image: "",
                valid: false,
                loading: false,
                alreadySubscribed: false,
              }
            })
            return
          }

          const subscribed = feedsRef.current.some((f) => f.url === resolvedTarget.targetUrl && f.category !== RECOMMENDED_CATEGORY)
          const fallbackTitle = normalizeCandidateTitle(resolvedTarget.targetTitle, resolvedTarget.targetUrl)
          const directUid = extractBilibiliUidFromInput(resolvedTarget.targetUrl)
          if (directUid) {
            let title = fallbackTitle
            let description = resolvedTarget.targetUrl
            let image = ""
            let targetUrl = resolvedTarget.targetUrl
            try {
              const probe = await window.api.discover.probeBilibiliUid(directUid)
              if (probe.valid) {
                title = probe.title || title
                description = probe.description || description
                image = probe.image || image
                targetUrl = probe.feedUrl || targetUrl
              }
            } catch {
              // Keep fallback candidate.
            }
            setYoutubeCandidate((prev) => {
              if (!prev || prev.query !== input) return prev
              return {
                query: input,
                title,
                description,
                image,
                valid: true,
                loading: false,
                alreadySubscribed: subscribed,
                feedUrl: targetUrl,
              }
            })
            return
          }
          // Do not block UI on generic feed probing; render candidate immediately.
          setYoutubeCandidate((prev) => {
            if (!prev || prev.query !== input) return prev
            return {
              query: input,
              title: fallbackTitle,
              description: resolvedTarget.targetUrl,
              image: "",
              valid: true,
              loading: false,
              alreadySubscribed: subscribed,
              feedUrl: resolvedTarget.targetUrl,
            }
          })
          void (async () => {
            try {
              const probe = await window.api.discover.validateFeed(resolvedTarget.targetUrl)
              if (!probe.valid) return
              const finalTitle = normalizeCandidateTitle(probe.title || fallbackTitle, resolvedTarget.targetUrl)
              setYoutubeCandidate((prev) => {
                if (!prev || prev.query !== input || prev.feedUrl !== resolvedTarget.targetUrl) return prev
                return {
                  ...prev,
                  title: finalTitle,
                  image: probe.image || prev.image,
                }
              })
            } catch {
              // Keep optimistic candidate if probe fails.
            }
          })()
          return
        }

        if (isYouTubeUrl) {
          setVideoCandidates([])
          const resolved = await window.api.discover.resolveProfileUrl(input)
          if (!resolved.candidates.length) {
            setYoutubeCandidate((prev) => {
              if (!prev || prev.query !== input) return prev
              return {
                query: input,
                title: input,
                description: tWithDefault("sidebar.youtubeChannelNotFound", "Channel not found", "Channel not found"),
                image: "",
                valid: false,
                loading: false,
                alreadySubscribed: false,
              }
            })
            return
          }

          let picked = resolved.candidates[0]
          let pickedImage = ""
          let pickedValid = false
          for (const candidate of resolved.candidates) {
            const probe = await validateFeedWithTimeout(candidate.feedUrl)
            if (probe.valid) {
              picked = candidate
              pickedImage = probe.image || ""
              pickedValid = true
              break
            }
          }

          setYoutubeCandidate((prev) => {
            if (!prev || prev.query !== input) return prev
            const subscribed = feedsRef.current.some((f) => f.url === picked.feedUrl && f.category !== RECOMMENDED_CATEGORY)
            return {
              query: input,
              title: picked.title || input,
              description: pickedValid
                ? (picked.description || "")
                : tWithDefault("sidebar.youtubeSubscribeFailed", "Subscribe failed, check channel name or network", "Subscribe failed, check channel name or network"),
              image: pickedImage,
              valid: pickedValid,
              loading: false,
              alreadySubscribed: subscribed,
              feedUrl: picked.feedUrl,
            }
          })
          return
        }

        const result = await window.api.discover.probeVideoSources(raw)
        if (!result.valid || !result.candidates.length) {
          setYoutubeCandidate((prev) => {
            if (!prev || prev.query !== input) return prev
            return {
              query: input,
              title: raw,
              description: tWithDefault("sidebar.youtubeChannelNotFound", "Channel not found", "Channel not found"),
              image: "",
              valid: false,
              loading: false,
              alreadySubscribed: false,
            }
          })
          return
        }
        setYoutubeCandidate(null)
        setVideoCandidates(
          result.candidates
            .map((c: {
              platform: "youtube" | "bilibili"
              title: string
              description: string
              image: string
              feedUrl: string
            }) => ({
              ...c,
              alreadySubscribed: feedsRef.current.some((f) => f.url === c.feedUrl && f.category !== RECOMMENDED_CATEGORY),
            }))
            .sort(
              (a: { title: string }, b: { title: string }) =>
                scoreVideoCandidateMatch(raw, b.title) - scoreVideoCandidateMatch(raw, a.title),
            ),
        )
      } catch {
        setVideoCandidates([])
        setYoutubeCandidate((prev) => {
          if (!prev || prev.query !== input) return prev
          return {
            ...prev,
            loading: false,
            valid: false,
            description: tWithDefault("sidebar.youtubeValidationError", "Validation failed, try again", "Validation failed, try again"),
          }
        })
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [youtubeSearch, rsshubInstance, t, tWithDefault])

  // Debounced validation of Instagram username
  useEffect(() => {
    const input = instagramSearch.trim()
    const targetView = FeedViewType.SocialMedia
    if (!input) {
      setInstagramCandidate(null)
      return
    }
    const isHttpUrlInput = /^https?:\/\/\S+$/i.test(input)
    const isRsshubProtocolInput = /^rsshub:\/\/\S+/i.test(input)
    const normalizedInput = normalizeRsshubProtocolInput(input)
    const isDirectFeedInput = isHttpUrlInput || isRsshubProtocolInput
    if (isHttpUrlInput && isInstagramProfileUrl(input)) {
      const urlUsername = getInstagramUsernameFromUrl(input) || input
      setInstagramCandidate({
        username: urlUsername,
        title: formatInstagramFeedTitle(undefined, urlUsername),
        description: "",
        image: `https://unavatar.io/instagram/${encodeURIComponent(urlUsername.replace(/^@/, ""))}`,
        valid: false,
        loading: true,
        alreadySubscribed: false,
        isDirectUrl: false,
      })
      const timer = setTimeout(async () => {
        try {
          const resolved = await window.api.discover.resolveProfileUrl(input)
          if (!resolved.candidates.length) {
            setInstagramCandidate((prev) => {
              if (!prev || prev.username !== urlUsername) return prev
              return {
                username: urlUsername,
                title: `@${urlUsername}`,
                description: t("sidebar.instagramUserNotFound", { defaultValue: i18nDefault("User not found, or current instance is blocked", "User not found, or current instance is blocked") }),
                image: "",
                valid: false,
                loading: false,
                alreadySubscribed: false,
                isDirectUrl: false,
              }
            })
            return
          }
          let picked = resolved.candidates[0]
          let pickedValid = false
          let pickedImage = ""
          for (const candidate of resolved.candidates) {
            const probe = await window.api.discover.validateFeed(candidate.feedUrl)
            if (probe.valid) {
              picked = candidate
              pickedImage = probe.image || ""
              pickedValid = true
              break
            }
          }
          setInstagramCandidate((prev) => {
            if (!prev || prev.username !== urlUsername) return prev
            const subscribed = feeds.some((f) => f.url === picked.feedUrl && isFeedSubscribedInTargetView(f, targetView))
            return {
              username: urlUsername,
              title: formatInstagramFeedTitle(picked.title, urlUsername),
              description: pickedValid
                ? (picked.description || "")
                : t("sidebar.instagramSubscribeFailed", { defaultValue: i18nDefault("Subscribe failed, check URL or network", "Subscribe failed, check URL or network") }),
              image: pickedImage || `https://unavatar.io/instagram/${encodeURIComponent(urlUsername.replace(/^@/, ""))}`,
              valid: pickedValid,
              loading: false,
              alreadySubscribed: subscribed,
              feedUrl: picked.feedUrl,
              isDirectUrl: false,
            }
          })
        } catch {
          setInstagramCandidate((prev) => {
            if (!prev || prev.username !== urlUsername) return prev
            return {
              ...prev,
              loading: false,
              valid: false,
              description: t("sidebar.instagramValidationError", {
                defaultValue: i18nDefault("Validation failed, try again", "Validation failed, try again"),
              }),
            }
          })
        }
      }, 600)
      return () => clearTimeout(timer)
    }

    // Allow direct RSS URL subscription in the Instagram search box
    if (isDirectFeedInput) {
      const subscribed = feeds.some((f) => f.url === normalizedInput && isFeedSubscribedInTargetView(f, targetView))
      const directName = extractInstagramNameFromUrl(normalizedInput)
      setInstagramCandidate({
        username: normalizedInput,
        title: formatInstagramFeedTitle(undefined, directName || normalizedInput),
        description: t("sidebar.instagramDirectUrlHint", {
          defaultValue: i18nDefault("Detected RSS URL, you can subscribe directly", "Detected RSS URL, you can subscribe directly"),
        }),
        image: directName ? `https://unavatar.io/instagram/${encodeURIComponent(directName)}` : "",
        valid: true,
        loading: false,
        alreadySubscribed: subscribed,
        feedUrl: normalizedInput,
        isDirectUrl: true,
      })
      return
    }
    const raw = input.replace(/^@/, "")
    if (!/^[a-zA-Z0-9._]{1,30}$/.test(raw)) {
      setInstagramCandidate({
        username: raw,
        title: `@${raw}`,
        description: t("sidebar.instagramInvalidUser", {
          defaultValue: i18nDefault("Please enter a valid Instagram username", "Please enter a valid Instagram username"),
        }),
        image: "",
        valid: false,
        loading: false,
        alreadySubscribed: false,
        isDirectUrl: false,
      })
      return
    }
    // For plain usernames, subscribe via Picnob route, but still probe profile
    // so candidate can show a better display name/avatar.
    const picnobFeedUrl = normalizeRsshubProtocolInput(buildPicnobProtocolRoute(raw))
    const lowerUser = raw.toLowerCase()
    const subscribed = feeds.some((f) => {
      if (!isFeedSubscribedInTargetView(f, targetView)) return false
      if ((f.url || "") === picnobFeedUrl) return true
      const user = extractInstagramUsernameFromFeedRoute(f.url || "")
      return !!(user && user.toLowerCase() === lowerUser)
    })
    setInstagramCandidate({
      username: raw,
      title: formatInstagramFeedTitle(undefined, raw),
      description: "",
      image: `https://unavatar.io/instagram/${encodeURIComponent(raw)}`,
      valid: false,
      loading: true,
      alreadySubscribed: subscribed,
      feedUrl: picnobFeedUrl,
      isDirectUrl: true,
    })
    const timer = setTimeout(async () => {
      try {
        const result = await window.api.discover.probeInstagramUser(raw)
        setInstagramCandidate((prev) => {
          if (!prev || prev.username !== raw) return prev
          const title = formatInstagramFeedTitle(result.valid ? result.title : undefined, raw)
          return {
            ...prev,
            title,
            description: result.valid
              ? (result.description || "")
              : "Will subscribe via rsshub://instagram/user route",
            image: result.valid
              ? (result.image || `https://unavatar.io/instagram/${encodeURIComponent(raw)}`)
              : `https://unavatar.io/instagram/${encodeURIComponent(raw)}`,
            valid: true,
            loading: false,
            feedUrl: picnobFeedUrl,
            isDirectUrl: true,
          }
        })
      } catch {
        setInstagramCandidate((prev) => {
          if (!prev || prev.username !== raw) return prev
          return {
            ...prev,
            valid: true,
            loading: false,
            description: "Will subscribe via rsshub://instagram/user route",
            feedUrl: picnobFeedUrl,
            isDirectUrl: true,
          }
        })
      }
    }, 450)
    return () => clearTimeout(timer)
  }, [instagramSearch, activeView, t, feeds, i18nDefault, isInstagramProfileUrl, getInstagramUsernameFromUrl, normalizeRsshubProtocolInput, buildPicnobProtocolRoute, isFeedSubscribedInTargetView])

  // Track which default folders should be visible (regardless of being empty)
  const defaultFolderNames = useMemo(() => {
    const names = new Set<string>()
    // Add user-created empty folders
    for (const folder of emptyFolders) {
      if (activeView === null || folder.view === null || folder.view === activeView) {
        names.add(folder.name)
      }
    }
    // Add default folders for visible view tabs.
    for (const folderName of viewDefaultFolderNames) {
      names.add(folderName)
    }
    return names
  }, [emptyFolders, activeView, viewDefaultFolderNames])
  const { userCategories, recommendedFeeds, totalUnread } = useMemo(() => {
    const groupedUserCategories = new Map<string, typeof filteredFeeds>()
    const groupedRecommendedFeeds: typeof filteredFeeds = []

    for (const feed of displayFeeds) {
      if (feed.category === RECOMMENDED_CATEGORY) {
        groupedRecommendedFeeds.push(feed)
      } else {
        const cat = getFeedFolderName(feed)
        if (!groupedUserCategories.has(cat)) groupedUserCategories.set(cat, [])
        groupedUserCategories.get(cat)!.push(feed)
      }
    }

    // Include empty folders created by the user.
    for (const folder of emptyFolders) {
      const matchesView = activeView === null || folder.view === null || folder.view === activeView
      if (matchesView && !groupedUserCategories.has(folder.name)) {
        groupedUserCategories.set(folder.name, [])
      }
    }

    // Ensure default folders are visible even when empty.
    for (const name of defaultFolderNames) {
      if (!groupedUserCategories.has(name)) {
        groupedUserCategories.set(name, [])
      }
    }

    const unread = displayFeeds
      .filter((f) => f.category !== RECOMMENDED_CATEGORY && f.showInAll !== false)
      .reduce((sum, f) => sum + f.unreadCount, 0)

    return {
      userCategories: groupedUserCategories,
      recommendedFeeds: groupedRecommendedFeeds,
      totalUnread: unread,
    }
  }, [activeView, defaultFolderNames, displayFeeds, emptyFolders, filteredFeeds, getFeedFolderName])

  const viewCounts = useMemo(() => {
    // Count feeds per view type for badges; exclude recommended feeds.
    const counts = new Map<FeedViewType, number>()
    for (const feed of feeds) {
      if (feed.category === RECOMMENDED_CATEGORY) continue
      if (feed.showInAll === false) continue
      const v = feed.view ?? FeedViewType.Articles
      const count = counts.get(v) || 0
      counts.set(v, count + feed.unreadCount)
    }
    return counts
  }, [feeds])
  const categoryEntries = useMemo(() => Array.from(userCategories.entries()), [userCategories])
  const userVisibleFeedCount = useMemo(
    () => displayFeeds.filter((f) => f.category !== RECOMMENDED_CATEGORY).length,
    [displayFeeds],
  )

  const handleImportOPML = async () => {
    setIsImporting(true)
    setImportResult(null)
    setShowImportProgress(true)
    try {
      const result = await importOPML()
      if (result.canceled) {
        setShowImportProgress(false)
      } else if (result.success) {
        const msg = t("sidebar.importSuccess", { imported: result.imported, skipped: result.skipped }) + (result.errors?.length ? t("sidebar.importErrors", { errors: result.errors.length }) : "")
        setImportResult(msg)
        setTimeout(() => setImportResult(null), 4000)
      } else {
        setShowImportProgress(false)
        setImportResult(result.error || t("sidebar.importFailed"))
        setTimeout(() => setImportResult(null), 4000)
      }
    } catch (err) {
      setShowImportProgress(false)
      setImportResult(String(err))
      setTimeout(() => setImportResult(null), 4000)
    }
    setIsImporting(false)
  }

  const handleImportProgressDone = useCallback(() => {
    setShowImportProgress(false)
  }, [])

  const showRefreshHint = useCallback((msg: string, ok: boolean, ttl = 2200) => {
    setRefreshHint({ msg, ok })
    if (refreshHintTimerRef.current) clearTimeout(refreshHintTimerRef.current)
    refreshHintTimerRef.current = setTimeout(() => setRefreshHint(null), ttl)
  }, [])

  useEffect(() => {
    return () => {
      if (refreshHintTimerRef.current) clearTimeout(refreshHintTimerRef.current)
    }
  }, [])

  useEffect(() => {
    setUiActiveView(activeView)
  }, [activeView])

  useEffect(() => {
    return () => {
      if (viewSwitchRafRef.current !== null) window.cancelAnimationFrame(viewSwitchRafRef.current)
    }
  }, [])

  const handleSelectFeed = useCallback((feedId: string | null) => {
    // Close discover panel when selecting a feed
    if (isDiscoverOpen) setDiscoverOpen(false)
    if (selectedFeedId === feedId) return

    // Perform scope switches in a transition to keep tab clicks responsive.
    startTransition(() => {
      setSelectedFeed(feedId)
    })
  }, [isDiscoverOpen, selectedFeedId, setDiscoverOpen, setSelectedFeed])

  const handleSelectView = useCallback((view: FeedViewType | null) => {
    // Close discover panel when switching views
    if (isDiscoverOpen) setDiscoverOpen(false)
    setUiActiveView(view)
    if (activeView === view) return

    // Let pointer feedback paint first, then switch the expensive content tree.
    if (viewSwitchRafRef.current !== null) window.cancelAnimationFrame(viewSwitchRafRef.current)
    viewSwitchRafRef.current = window.requestAnimationFrame(() => {
      startTransition(() => {
        setActiveView(view)
      })
      viewSwitchRafRef.current = null
    })
  }, [activeView, isDiscoverOpen, setActiveView, setDiscoverOpen])

  const handleContextMenu = useCallback((e: React.MouseEvent, feedId: string, isRecommended = false) => {
    e.preventDefault()
    setContextMenu({ feedId, x: e.clientX, y: e.clientY, isRecommended })
    setCategoryContextMenu(null)
  }, [])

  const unsubscribeFeed = useCallback(async (feedId: string) => {
    const feed = feeds.find((f) => f.id === feedId)
    if (!feed) return
    if (recommendedUrls.has(feed.url)) {
      await updateFeed(feedId, { category: RECOMMENDED_CATEGORY })
      return
    }
    await removeFeed(feedId)
  }, [feeds, recommendedUrls, updateFeed, removeFeed])

  const handleTwitterUnfollow = async (username: string) => {
    const lowerUser = username.toLowerCase()
    const matchedFeed = feeds.find((f) => {
      const feedUser = getTwitterUsernameFromFeedUrl(f.url)
      return !!(feedUser && feedUser.toLowerCase() === lowerUser)
    })
    if (!matchedFeed) return
    await unsubscribeFeed(matchedFeed.id)
    setTwitterSearchResult({
      msg: tWithDefault("sidebar.twitterUnfollowSuccess", "Unfollowed @{{user}}", "Unfollowed @{{user}}", { user: username }),
      ok: true,
    })
    // Update candidate to reflect unfollowed state
    setTwitterCandidate((prev) => prev ? { ...prev, alreadyFollowed: false } : null)
    setTimeout(() => setTwitterSearchResult(null), 3000)
  }

  const resolveUrlSubscriptionTarget = useCallback(
    async (
      inputUrl: string,
      fallbackView: FeedViewType,
      fallbackTitle?: string,
    ): Promise<
      | { ok: true; targetUrl: string; targetTitle?: string; targetView: FeedViewType }
      | { ok: false; error: string }
    > => {
      const normalizeFeedUrl = (rawUrl: string): string => {
        const trimmed = rawUrl.trim()
        const rsshubMatch = trimmed.match(/^rsshub:\/\/+(.+)$/i)
        if (rsshubMatch?.[1]) {
          const path = rsshubMatch[1].replace(/^\/+/, "")
          return `rsshub://${path}`
        }
        try {
          const parsed = new URL(trimmed)
          if (/^https?:$/i.test(parsed.protocol)) {
            const path = parsed.pathname.replace(/^\/+/, "")
            if (path && /^(?:twitter|instagram|picnob(?:\.info)?|youtube|bilibili|github|weibo|zhihu)\//i.test(path)) {
              return `rsshub://${path}${parsed.search || ""}`
            }
          }
        } catch {
          // Ignore parse failures.
        }
        return trimmed
      }

      let targetUrl = normalizeFeedUrl(inputUrl)
      let targetTitle = fallbackTitle
      let targetView = fallbackView

      try {
        const resolved = await window.api.discover.resolveProfileUrl(inputUrl)
        const firstCandidate = resolved.candidates[0]
        if (resolved.matched && firstCandidate) {
          const chosenCandidate = firstCandidate

          targetUrl = chosenCandidate.feedUrl
          targetTitle = chosenCandidate.title || targetTitle
          if (typeof chosenCandidate.view === "number") {
            targetView = chosenCandidate.view as FeedViewType
          }
        }
      } catch {
        return {
          ok: true as const,
          targetUrl,
          targetTitle,
          targetView,
        }
      }

      return {
        ok: true as const,
        targetUrl,
        targetTitle,
        targetView,
      }
    },
    [rsshubInstance],
  )

  const handleTwitterFollow = async (username?: string) => {
    const input = (username || twitterSearch.trim()).trim()
    const isUrlInput = /^https?:\/\/\S+$/i.test(input)
    const isTwitterUrl = /^https?:\/\/\S+$/i.test(input) && isTwitterProfileUrl(input)
    const raw = (isTwitterUrl ? (getTwitterUsernameFromUrl(input) || input) : input).replace(/^@/, "").replace(/\s+/g, "")
    if (!isUrlInput && (!raw || !/^[a-zA-Z0-9_]{1,15}$/.test(raw))) {
      setTwitterSearchResult({
        msg: tWithDefault("sidebar.twitterInvalidUser", "Please enter a valid Twitter username", "Please enter a valid Twitter username"),
        ok: false,
      })
      setTimeout(() => setTwitterSearchResult(null), 3000)
      return
    }
    // Check if already subscribed (case-insensitive)
    const lowerRaw = raw.toLowerCase()
    const alreadyExists = feeds.some((f) => {
      const feedUser = getTwitterUsernameFromFeedUrl(f.url)
      return !!(feedUser && feedUser.toLowerCase() === lowerRaw && f.category !== RECOMMENDED_CATEGORY)
    })
    if (alreadyExists) {
      setTwitterSearchResult({
        msg: tWithDefault("sidebar.twitterAlreadyFollowed", "Already following this user", "Already following this user"),
        ok: false,
      })
      setTimeout(() => setTwitterSearchResult(null), 3000)
      return
    }
    setTwitterSearching(true)
    setTwitterSearchResult(null)
    setTwitterCandidate(null)
    try {
      let feedUrl = twitterCandidate?.feedUrl || `rsshub://twitter/user/${encodeURIComponent(raw)}`
      let title = twitterCandidate?.valid ? twitterCandidate.title : raw
      let targetView = FeedViewType.SocialMedia
      if (isUrlInput) {
        const resolvedTarget = await resolveUrlSubscriptionTarget(input, FeedViewType.SocialMedia, title)
        if (!resolvedTarget.ok) {
          setTwitterSearchResult({ msg: resolvedTarget.error, ok: false })
          setTwitterSearching(false)
          setTimeout(() => setTwitterSearchResult(null), 3000)
          return
        }
        feedUrl = resolvedTarget.targetUrl
        title = resolvedTarget.targetTitle || title
        targetView = resolvedTarget.targetView
      } else if (isTwitterUrl) {
        const resolvedTarget = await resolveUrlSubscriptionTarget(input, FeedViewType.SocialMedia, title)
        if (resolvedTarget.ok) {
          feedUrl = resolvedTarget.targetUrl
          title = resolvedTarget.targetTitle || title
          targetView = resolvedTarget.targetView
        }
      }
      title = formatTwitterFeedTitle(title, raw)
      const existing = feeds.find((f) => f.url === feedUrl)
      if (existing && existing.category === RECOMMENDED_CATEGORY) {
        await updateFeed(existing.id, { category: "", folder: "", view: targetView, title })
        setTwitterSearchResult({
          msg: tWithDefault("sidebar.twitterFollowSuccess", "Now following @{{user}}", "Now following @{{user}}", { user: raw }),
          ok: true,
        })
        setTwitterSearch("")
        setTwitterSearching(false)
        setTimeout(() => setTwitterSearchResult(null), 3000)
        return
      }
      const result = await addFeed(feedUrl, undefined, targetView, title)
      if (result.success) {
        setTwitterSearchResult({
          msg: tWithDefault("sidebar.twitterFollowSuccess", "Now following @{{user}}", "Now following @{{user}}", { user: raw }),
          ok: true,
        })
        setTwitterSearch("")
      } else {
        setTwitterSearchResult({
          msg: result.error || tWithDefault("sidebar.twitterFollowFailed", "Follow failed, check username or network", "Follow failed, check username or network"),
          ok: false,
        })
      }
    } catch {
      setTwitterSearchResult({
        msg: tWithDefault("sidebar.twitterFollowFailed", "Follow failed, check username or network", "Follow failed, check username or network"),
        ok: false,
      })
    }
    setTwitterSearching(false)
    setTimeout(() => setTwitterSearchResult(null), 3000)
  }

  const handleSocialBilibiliFollow = async (candidate: { uid: string; title: string; description: string; image: string; feedUrl: string; alreadyFollowed: boolean }) => {
    if (candidate.alreadyFollowed) return
    try {
      const existingSameRoute = feeds.find((f) =>
        f.url === candidate.feedUrl && f.category !== RECOMMENDED_CATEGORY,
      )
      if (existingSameRoute) {
        await updateFeed(existingSameRoute.id, {
          title: candidate.title,
          view: FeedViewType.SocialMedia,
          imageUrl: candidate.image || existingSameRoute.imageUrl,
        })
      } else {
        const recommendedSameRoute = feeds.find((f) =>
          f.url === candidate.feedUrl && f.category === RECOMMENDED_CATEGORY,
        )
        if (recommendedSameRoute) {
          await updateFeed(recommendedSameRoute.id, {
            category: "",
            title: candidate.title,
            view: FeedViewType.SocialMedia,
            imageUrl: candidate.image || recommendedSameRoute.imageUrl,
          })
        } else {
          const result = await addFeed(candidate.feedUrl, undefined, FeedViewType.SocialMedia, candidate.title)
          if (!result.success) {
            setTwitterSearchResult({
              msg: result.error || tWithDefault("sidebar.twitterFollowFailed", "Follow failed, check username or network", "Follow failed, check username or network"),
              ok: false,
            })
            setTimeout(() => setTwitterSearchResult(null), 3000)
            return
          }
        }
      }
      setTwitterSearchResult({
        msg: tWithDefault("sidebar.twitterFollowSuccess", "Now following {{user}}", "Now following {{user}}", { user: candidate.title }),
        ok: true,
      })
      setSocialBiliCandidates((prev) => prev.map((c) => c.uid === candidate.uid ? { ...c, alreadyFollowed: true } : c))
      setTwitterSearch("")
      setTimeout(() => setTwitterSearchResult(null), 3000)
    } catch {
      setTwitterSearchResult({
        msg: tWithDefault("sidebar.twitterFollowFailed", "Follow failed, check username or network", "Follow failed, check username or network"),
        ok: false,
      })
      setTimeout(() => setTwitterSearchResult(null), 3000)
    }
  }

  const handleVideoCandidateSubscribe = async (candidate: {
    platform: "youtube" | "bilibili"
    title: string
    description: string
    image: string
    feedUrl: string
    alreadySubscribed: boolean
  }) => {
    if (candidate.alreadySubscribed) return
    const existing = feeds.find((f) => f.url === candidate.feedUrl)
    if (existing && existing.category === RECOMMENDED_CATEGORY) {
      await updateFeed(existing.id, { category: "", imageUrl: candidate.image || existing.imageUrl })
      setYoutubeSearchResult({ msg: tWithDefault("sidebar.youtubeSubscribeSuccess", "Subscribed to {{channel}}", "Subscribed to {{channel}}", { channel: candidate.title }), ok: true })
    } else if (!existing) {
      const result = await addFeed(candidate.feedUrl, undefined, FeedViewType.Videos, candidate.title)
      if (result.success) {
        await syncFeedAvatarFromCandidate(candidate.feedUrl, candidate.image)
      }
      setYoutubeSearchResult({
        msg: result.success
          ? tWithDefault("sidebar.youtubeSubscribeSuccess", "Subscribed to {{channel}}", "Subscribed to {{channel}}", { channel: candidate.title })
          : (result.error || tWithDefault("sidebar.youtubeSubscribeFailed", "Subscribe failed, check channel name or network", "Subscribe failed, check channel name or network")),
        ok: !!result.success,
      })
    } else if (candidate.image && existing.imageUrl !== candidate.image) {
      await updateFeed(existing.id, { imageUrl: candidate.image })
    }
    setVideoCandidates((prev) => prev.map((c) => c.feedUrl === candidate.feedUrl ? { ...c, alreadySubscribed: true } : c))
    setTimeout(() => setYoutubeSearchResult(null), 3000)
  }

  const handleYouTubeUnsubscribe = async (query: string, candidateFeedUrl?: string) => {
    let matchedFeed = candidateFeedUrl
      ? feeds.find((f) => f.url === candidateFeedUrl && f.category !== RECOMMENDED_CATEGORY)
      : undefined

    if (!matchedFeed) {
      const lowerQuery = query.toLowerCase().replace(/^@/, "")
      matchedFeed = feeds.find((f) => {
        const m = f.url.match(/\/youtube\/(user|channel)\/([^/?#]+)/i)
        return !!(m && m[2].toLowerCase().replace(/^@/, "") === lowerQuery && f.category !== RECOMMENDED_CATEGORY)
      })
    }

    if (!matchedFeed) return
    await unsubscribeFeed(matchedFeed.id)
    setYoutubeSearchResult({
      msg: tWithDefault("sidebar.youtubeUnsubscribeSuccess", "Unsubscribed from {{channel}}", "Unsubscribed from {{channel}}", { channel: query }),
      ok: true,
    })
    setYoutubeCandidate((prev) => prev ? { ...prev, alreadySubscribed: false } : null)
    setTimeout(() => setYoutubeSearchResult(null), 3000)
  }

  const handleYouTubeSubscribe = async (query?: string) => {
    const input = (query || youtubeSearch.trim()).trim()
    const isRsshubProtocolUrl = /^rsshub:\/\/\S+/i.test(input)
    const isHttpUrl = /^https?:\/\/\S+$/i.test(input)
    const isDirectFeedUrl = isHttpUrl || isRsshubProtocolUrl
    const isYouTubeUrl = /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i.test(input)
    const raw = input.replace(/^@/, "")
    if (!isYouTubeUrl && !isDirectFeedUrl && (!raw || raw.length < 2)) {
      setYoutubeSearchResult({
        msg: tWithDefault("sidebar.youtubeInvalidChannel", "Please enter a valid YouTube channel name", "Please enter a valid YouTube channel name"),
        ok: false,
      })
      setTimeout(() => setYoutubeSearchResult(null), 3000)
      return
    }
    setYoutubeSearching(true)
    setYoutubeSearchResult(null)
    const candidateImage = youtubeCandidate?.image || ""
    setYoutubeCandidate(null)
    try {
      let feedUrl = youtubeCandidate?.feedUrl || ""
      let title = youtubeCandidate?.valid ? youtubeCandidate.title : raw

      if (isDirectFeedUrl) {
        const resolvedTarget = await resolveUrlSubscriptionTarget(input, FeedViewType.Videos, title)
        if (!resolvedTarget.ok) {
          setYoutubeSearchResult({
            msg: resolvedTarget.error,
            ok: false,
          })
          setYoutubeSearching(false)
          setTimeout(() => setYoutubeSearchResult(null), 3000)
          return
        }
        feedUrl = resolvedTarget.targetUrl
        title = resolvedTarget.targetTitle || title
      } else if (isYouTubeUrl) {
        const resolved = await window.api.discover.resolveProfileUrl(input)
        let picked = resolved.candidates[0]
        for (const c of resolved.candidates) {
          const probe = await window.api.discover.validateFeed(c.feedUrl)
          if (probe.valid) {
            picked = c
            break
          }
        }
        if (!picked) {
          setYoutubeSearchResult({
            msg: "Detected YouTube profile URL, but no reachable feed source is available right now.",
            ok: false,
          })
          setYoutubeSearching(false)
          setTimeout(() => setYoutubeSearchResult(null), 3000)
          return
        }
        feedUrl = picked.feedUrl
        title = picked.title || raw
      } else {
        const route = youtubeCandidate?.feedRoute || `/youtube/user/@${raw}`
        feedUrl = youtubeCandidate?.feedUrl || `${rsshubInstance}${route}`
      }

      const lowerRaw = raw.toLowerCase()
      const alreadyExists = feeds.some((f) => {
        if (f.url === feedUrl && f.category !== RECOMMENDED_CATEGORY) return true
        const m = f.url.match(/\/youtube\/(user|channel)\/([^/?#]+)/i)
        return !!(m && m[2].toLowerCase().replace(/^@/, "") === lowerRaw && f.category !== RECOMMENDED_CATEGORY)
      })
      if (alreadyExists) {
        setYoutubeSearchResult({
          msg: t("sidebar.youtubeAlreadySubscribed"),
          ok: false,
        })
        setYoutubeSearching(false)
        setTimeout(() => setYoutubeSearchResult(null), 3000)
        return
      }

      const existing = feeds.find((f) => f.url === feedUrl)
      if (existing && existing.category === RECOMMENDED_CATEGORY) {
        await updateFeed(existing.id, { category: "", imageUrl: candidateImage || existing.imageUrl })
        setYoutubeSearchResult({
          msg: tWithDefault("sidebar.youtubeSubscribeSuccess", "Subscribed to {{channel}}", "Subscribed to {{channel}}", { channel: raw }),
          ok: true,
        })
        setYoutubeSearch("")
        setYoutubeSearching(false)
        setTimeout(() => setYoutubeSearchResult(null), 3000)
        return
      }
      if (!existing) {
        // If a recommended source exists with a different instance URL, move/update it instead of creating duplicates.
        const existingRecommended = feeds.find((f) => {
          if (f.category !== RECOMMENDED_CATEGORY) return false
          const m = f.url.match(/\/youtube\/(user|channel)\/([^/?#]+)/i)
          return !!(m && decodeURIComponent(m[2]).toLowerCase().replace(/^@/, "") === lowerRaw)
        })
        if (existingRecommended) {
          await updateFeed(existingRecommended.id, { url: feedUrl, category: "", imageUrl: candidateImage || existingRecommended.imageUrl })
          setYoutubeSearchResult({
            msg: tWithDefault("sidebar.youtubeSubscribeSuccess", "Subscribed to {{channel}}", "Subscribed to {{channel}}", { channel: raw }),
            ok: true,
          })
          setYoutubeSearch("")
          setYoutubeSearching(false)
          setTimeout(() => setYoutubeSearchResult(null), 3000)
          return
        }
      }
      const result = await addFeed(feedUrl, undefined, FeedViewType.Videos, title)
      if (result.success) {
        await syncFeedAvatarFromCandidate(feedUrl, candidateImage)
        setYoutubeSearchResult({
          msg: tWithDefault("sidebar.youtubeSubscribeSuccess", "Subscribed to {{channel}}", "Subscribed to {{channel}}", { channel: raw }),
          ok: true,
        })
        setYoutubeSearch("")
      } else {
        setYoutubeSearchResult({
          msg: result.error || tWithDefault("sidebar.youtubeSubscribeFailed", "Subscribe failed, check channel name or network", "Subscribe failed, check channel name or network"),
          ok: false,
        })
      }
    } catch {
      setYoutubeSearchResult({
        msg: tWithDefault("sidebar.youtubeSubscribeFailed", "Subscribe failed, check channel name or network", "Subscribe failed, check channel name or network"),
        ok: false,
      })
    }
    setYoutubeSearching(false)
    setTimeout(() => setYoutubeSearchResult(null), 3000)
  }

  const handleInstagramUnsubscribe = async (username: string) => {
    if (/^(?:https?:\/\/|rsshub:\/\/)\S+/i.test(username)) {
      const normalized = normalizeRsshubProtocolInput(username)
      const matchedByUrl = feeds.find((f) => f.url === normalized)
      if (!matchedByUrl) return
      await unsubscribeFeed(matchedByUrl.id)
      setInstagramSearchResult({
        msg: t("sidebar.instagramUnsubscribeSuccess", {
          user: normalized,
          defaultValue: i18nDefault("Unsubscribed from this RSS source", "Unsubscribed from this RSS source"),
        }),
        ok: true,
      })
      setInstagramCandidate((prev) => prev ? { ...prev, alreadySubscribed: false } : null)
      setTimeout(() => setInstagramSearchResult(null), 3000)
      return
    }
    const lowerUser = username.toLowerCase().replace(/^@/, "")
    const matchedFeed = feeds.find((f) => {
      const m = f.url.match(/\/instagram\/user\/([^/?#]+)/i)
      return m && decodeURIComponent(m[1]).toLowerCase().replace(/^@/, "") === lowerUser
    })
    if (!matchedFeed) return
    await unsubscribeFeed(matchedFeed.id)
    setInstagramSearchResult({
      msg: t("sidebar.instagramUnsubscribeSuccess", {
        user: username,
        defaultValue: i18nDefault("Unsubscribed from @{{user}}", "Unsubscribed from @{{user}}"),
      }),
      ok: true,
    })
    setInstagramCandidate((prev) => prev ? { ...prev, alreadySubscribed: false } : null)
    setTimeout(() => setInstagramSearchResult(null), 3000)
  }

  const handleInstagramSubscribe = async (username?: string, preferredView: FeedViewType = FeedViewType.SocialMedia) => {
    const input = (username || instagramSearch.trim()).trim()
    const candidateImage = (instagramCandidate?.image || "").trim()
    const isHttpUrlInput = /^https?:\/\/\S+$/i.test(input)
    const isRsshubProtocolInput = /^rsshub:\/\/\S+/i.test(input)
    const isDirectFeedInput = isHttpUrlInput || isRsshubProtocolInput
    const normalizedInput = normalizeRsshubProtocolInput(input)
    const isProfileUrlInput = isHttpUrlInput && isInstagramProfileUrl(input)
    if (isDirectFeedInput) {
      const resolvedTarget = await resolveUrlSubscriptionTarget(normalizedInput, preferredView, "Instagram RSS")
      if (!resolvedTarget.ok) {
        setInstagramSearchResult({ msg: resolvedTarget.error, ok: false })
        setTimeout(() => setInstagramSearchResult(null), 3000)
        return
      }
      const feedUrl = resolvedTarget.targetUrl
      const targetTitle = formatInstagramFeedTitle(resolvedTarget.targetTitle || "Instagram", feedUrl)
      const targetView = /\/picnob(?:\.info)?\/user\//i.test(feedUrl) ? preferredView : resolvedTarget.targetView
      const existingNormal = feeds.find((f) => f.url === feedUrl && f.category !== RECOMMENDED_CATEGORY)
      if (existingNormal) {
        const existingView = existingNormal.view ?? FeedViewType.Articles
        if (existingView !== targetView) {
          await updateFeed(existingNormal.id, { view: targetView, title: targetTitle })
          setInstagramSearchResult({
            msg: t("sidebar.instagramSubscribeSuccess", {
              user: input,
              defaultValue: i18nDefault("Subscribed to this RSS source", "Subscribed to this RSS source"),
            }),
            ok: true,
          })
          setInstagramSearch("")
          setTimeout(() => setInstagramSearchResult(null), 3000)
          return
        }
        setInstagramSearchResult({
          msg: t("sidebar.instagramAlreadySubscribed", {
            defaultValue: i18nDefault("Subscribed", "Subscribed"),
          }),
          ok: false,
        })
        setTimeout(() => setInstagramSearchResult(null), 3000)
        return
      }
      const existingRecommended = feeds.find((f) => f.url === feedUrl && f.category === RECOMMENDED_CATEGORY)
      if (existingRecommended) {
        await updateFeed(existingRecommended.id, {
          category: "",
          title: targetTitle,
          imageUrl: candidateImage || existingRecommended.imageUrl,
        })
        setInstagramSearchResult({
          msg: t("sidebar.instagramSubscribeSuccess", {
            user: input,
            defaultValue: i18nDefault("Subscribed to this RSS source", "Subscribed to this RSS source"),
          }),
          ok: true,
        })
        setInstagramSearch("")
        setTimeout(() => setInstagramSearchResult(null), 3000)
        return
      }
      setInstagramSearching(true)
      setInstagramSearchResult(null)
      setInstagramCandidate(null)
      try {
        const result = await addFeed(feedUrl, undefined, targetView, targetTitle)
        if (result.success) {
          await syncFeedAvatarFromCandidate(feedUrl, candidateImage)
          setInstagramSearchResult({
            msg: t("sidebar.instagramSubscribeSuccess", {
              user: input,
              defaultValue: i18nDefault("Subscribed to this RSS source", "Subscribed to this RSS source"),
            }),
            ok: true,
          })
          setInstagramSearch("")
        } else {
          setInstagramSearchResult({
            msg: result.error || t("sidebar.instagramSubscribeFailed", {
              defaultValue: i18nDefault("Subscribe failed, check URL or network", "Subscribe failed, check URL or network"),
            }),
            ok: false,
          })
        }
      } catch {
        setInstagramSearchResult({
          msg: t("sidebar.instagramSubscribeFailed", {
            defaultValue: i18nDefault("Subscribe failed, check URL or network", "Subscribe failed, check URL or network"),
          }),
          ok: false,
        })
      }
      setInstagramSearching(false)
      setTimeout(() => setInstagramSearchResult(null), 3000)
      return
    }
    const raw = isProfileUrlInput
      ? (getInstagramUsernameFromUrl(input) || input).replace(/^@/, "")
      : input.replace(/^@/, "")
    if (!raw || !/^[a-zA-Z0-9._]{1,30}$/.test(raw)) {
      setInstagramSearchResult({
        msg: t("sidebar.instagramInvalidUser", {
          defaultValue: i18nDefault("Please enter a valid Instagram username", "Please enter a valid Instagram username"),
        }),
        ok: false,
      })
      setTimeout(() => setInstagramSearchResult(null), 3000)
      return
    }
    const lowerRaw = raw.toLowerCase()
    const picnobFeedUrl = normalizeRsshubProtocolInput(buildPicnobProtocolRoute(raw))
    const existingInTargetView = feeds.find((f) => {
      if (!isFeedSubscribedInTargetView(f, preferredView)) return false
      if ((f.url || "") === picnobFeedUrl) return true
      const user = extractInstagramUsernameFromFeedRoute(f.url || "")
      return !!(user && user.toLowerCase() === lowerRaw)
    })
    if (existingInTargetView) {
      setInstagramSearchResult({
        msg: t("sidebar.instagramAlreadySubscribed", {
          defaultValue: i18nDefault("Subscribed", "Subscribed"),
        }),
        ok: false,
      })
      setTimeout(() => setInstagramSearchResult(null), 3000)
      return
    }
    setInstagramSearching(true)
    setInstagramSearchResult(null)
    setInstagramCandidate(null)
    try {
      let feedUrl = instagramCandidate?.feedUrl || picnobFeedUrl
      if (isProfileUrlInput) {
        const resolved = await window.api.discover.resolveProfileUrl(input)
        let picked = resolved.candidates[0]
        for (const candidate of resolved.candidates) {
          const probe = await window.api.discover.validateFeed(candidate.feedUrl)
          if (probe.valid) {
            picked = candidate
            break
          }
        }
        if (!picked) {
          setInstagramSearchResult({
            msg: "Detected Instagram profile URL, but no reachable feed source is available right now.",
            ok: false,
          })
          setInstagramSearching(false)
          setTimeout(() => setInstagramSearchResult(null), 3000)
          return
        }
        feedUrl = picked.feedUrl
      }
      const existingInOtherView = feeds.find((f) => {
        if (f.category === RECOMMENDED_CATEGORY) return false
        if (!isFeedSubscribedInTargetView(f, preferredView) && (f.url || "") === feedUrl) return true
        const user = extractInstagramUsernameFromFeedRoute(f.url || "")
        return !!(user && user.toLowerCase() === lowerRaw && !isFeedSubscribedInTargetView(f, preferredView))
      })
      if (existingInOtherView) {
        const finalTitle = formatInstagramFeedTitle(instagramCandidate?.title, raw || feedUrl)
        await updateFeed(existingInOtherView.id, {
          view: preferredView,
          url: feedUrl,
          title: finalTitle,
          imageUrl: candidateImage || existingInOtherView.imageUrl,
        })
        setInstagramSearchResult({
          msg: t("sidebar.instagramSubscribeSuccess", {
            user: raw,
            defaultValue: i18nDefault("Subscribed to @{{user}}", "Subscribed to @{{user}}"),
          }),
          ok: true,
        })
        setInstagramSearch("")
        setInstagramSearching(false)
        setTimeout(() => setInstagramSearchResult(null), 3000)
        return
      }
      const existing = feeds.find((f) => f.url === feedUrl)
      const finalTitle = formatInstagramFeedTitle(instagramCandidate?.title, raw || feedUrl)
      if (existing && existing.category === RECOMMENDED_CATEGORY) {
        await updateFeed(existing.id, {
          category: "",
          title: finalTitle,
          imageUrl: candidateImage || existing.imageUrl,
        })
        setInstagramSearchResult({
          msg: t("sidebar.instagramSubscribeSuccess", {
            user: raw,
            defaultValue: i18nDefault("Subscribed to @{{user}}", "Subscribed to @{{user}}"),
          }),
          ok: true,
        })
        setInstagramSearch("")
        setInstagramSearching(false)
        setTimeout(() => setInstagramSearchResult(null), 3000)
        return
      }
      if (!existing) {
        // If a recommended source exists with a different instance URL, move/update it instead of creating duplicates.
        const existingRecommended = feeds.find((f) => {
          if (f.category !== RECOMMENDED_CATEGORY) return false
          const user = extractInstagramUsernameFromFeedRoute(f.url || "")
          return !!(user && user.toLowerCase() === lowerRaw)
        })
        if (existingRecommended) {
          await updateFeed(existingRecommended.id, {
            url: feedUrl,
            category: "",
            title: finalTitle,
            imageUrl: candidateImage || existingRecommended.imageUrl,
          })
          setInstagramSearchResult({
            msg: t("sidebar.instagramSubscribeSuccess", {
              user: raw,
              defaultValue: i18nDefault("Subscribed to @{{user}}", "Subscribed to @{{user}}"),
            }),
            ok: true,
          })
          setInstagramSearch("")
          setInstagramSearching(false)
          setTimeout(() => setInstagramSearchResult(null), 3000)
          return
        }
      }
      const title = formatInstagramFeedTitle(instagramCandidate?.valid ? instagramCandidate.title : raw, raw || feedUrl)
      const result = await addFeed(feedUrl, undefined, preferredView, title)
      if (result.success) {
        await syncFeedAvatarFromCandidate(feedUrl, candidateImage)
        setInstagramSearchResult({
          msg: t("sidebar.instagramSubscribeSuccess", {
            user: raw,
            defaultValue: i18nDefault("Subscribed to @{{user}}", "Subscribed to @{{user}}"),
          }),
          ok: true,
        })
        setInstagramSearch("")
      } else {
        setInstagramSearchResult({
          msg: result.error || t("sidebar.instagramSubscribeFailed", {
            defaultValue: i18nDefault("Subscribe failed, check username or network", "Subscribe failed, check username or network"),
          }),
          ok: false,
        })
      }
    } catch {
      setInstagramSearchResult({
        msg: t("sidebar.instagramSubscribeFailed", {
          defaultValue: i18nDefault("Subscribe failed, check username or network", "Subscribe failed, check username or network"),
        }),
        ok: false,
      })
    }
    setInstagramSearching(false)
    setTimeout(() => setInstagramSearchResult(null), 3000)
  }

  const handleCategoryContextMenu = useCallback((e: React.MouseEvent, category: string, feedIds: string[]) => {
    e.preventDefault()
    setCategoryContextMenu({ category, feedIds, x: e.clientX, y: e.clientY })
    setContextMenu(null)
  }, [])
  const isDefaultCategoryMenu = categoryContextMenu ? isDefaultFolderName(categoryContextMenu.category) : false

  return (
    <>
      <aside
        className={`flex flex-col border-r overflow-hidden flex-shrink-0 ${
          opaqueSidebar
            ? "bg-sidebar dark:bg-sidebar-dark"
            : "bg-white/72 dark:bg-surface-dark/72 backdrop-blur-xl"
        }`}
        style={{ width: width ?? 260 }}
      >
        {/* Drag region for titlebar */}
        <div className="drag-region h-12 flex items-end px-4 pb-1">
          <span className="no-drag text-base font-bold text-accent">Livo</span>
        </div>

        {/* View type tabs */}
        <div className="px-2 pt-1 pb-1">
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-secondary dark:bg-surface-dark-secondary">
            {/* All */}
            <button
              onMouseDown={() => setUiActiveView(null)}
              onClick={() => handleSelectView(null)}
              className={`flex items-center justify-center p-1.5 rounded-md flex-1 transition-[background-color,color,transform] duration-120 active:scale-95 ${
                uiActiveView === null
                  ? "bg-white dark:bg-surface-dark shadow-sm text-accent"
                  : "text-text-secondary dark:text-text-dark-secondary hover:text-text-primary dark:hover:text-text-dark-primary"
              }`}
              title={t("common.all")}
            >
              <LayoutGrid size={16} />
            </button>
            {settingsLoaded && viewTabs
              .filter((tab) => tab.visible)
              .map((tab) => {
                const viewType = tab.id
                const def = VIEW_DEFINITIONS[viewType]
                if (!def) return null
                const unread = viewCounts.get(viewType) || 0
                return (
                  <button
                    key={viewType}
                    onMouseDown={() => setUiActiveView(viewType)}
                    onClick={() => handleSelectView(viewType)}
                    className={`relative flex items-center justify-center p-1.5 rounded-md flex-1 transition-[background-color,color,transform] duration-120 active:scale-95 ${
                      uiActiveView === viewType
                        ? `bg-white dark:bg-surface-dark shadow-sm ${def.color}`
                        : "text-text-secondary dark:text-text-dark-secondary hover:text-text-primary dark:hover:text-text-dark-primary"
                    }`}
                    title={t(VIEW_TYPE_I18N_KEYS[viewType] || def.name)}
                  >
                    {VIEW_ICONS[viewType]}
                    {unread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent" />
                    )}
                  </button>
                )
              })}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {/* All feeds in current view */}
          <button
            onClick={() => handleSelectFeed(null)}
            className={`sidebar-item w-full ${selectedFeedId === null ? "sidebar-item-active" : ""}`}
          >
            <Rss size={18} />
            <span className="flex-1 text-left truncate">
              {activeView !== null ? t(VIEW_TYPE_I18N_KEYS[activeView] || "common.all") : t("common.all")}
            </span>
            {totalUnread > 0 && (
              <span className="text-xs text-text-secondary dark:text-text-dark-secondary bg-surface-tertiary dark:bg-surface-dark-tertiary rounded-full px-2 py-0.5">
                {totalUnread}
              </span>
            )}
          </button>

          {/* Starred */}
          <button
            onClick={() => handleSelectFeed("starred")}
            className={`sidebar-item w-full ${selectedFeedId === "starred" ? "sidebar-item-active" : ""}`}
          >
            <Star size={18} />
            <span className="flex-1 text-left truncate">{t("sidebar.starred")}</span>
          </button>

          {activeView === null && (
            <div className="mt-1 px-1">
              <div className="relative">
                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary dark:text-text-dark-tertiary pointer-events-none" />
                <input
                  value={allFeedsSearch}
                  onChange={(e) => setAllFeedsSearch(e.target.value)}
                  placeholder={t("sidebar.searchFeeds", {
                    defaultValue: i18nDefault("Search subscriptions", "Search subscriptions"),
                  })}
                  className="w-full text-xs pl-7 pr-2 py-1.5 border rounded-lg bg-white dark:bg-surface-dark dark:border-border-dark focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-text-tertiary dark:placeholder:text-text-dark-tertiary"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setAllFeedsSearch("")
                  }}
                />
              </div>
            </div>
          )}

          {/* Twitter user search - only in Social Media view */}
          {activeView === FeedViewType.SocialMedia && (
            <div className="mt-1 px-1" ref={twitterDropdownRef}>
              <div className="relative">
                <div className="relative">
                  <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary dark:text-text-dark-tertiary pointer-events-none" />
                  <input
                    value={twitterSearch}
                    onChange={(e) => setTwitterSearch(e.target.value)}
                    placeholder={tWithDefault("sidebar.twitterSearchPlaceholder", "Enter X @username / Bilibili UID", "Enter X @username / Bilibili UID")}
                    className="w-full text-xs pl-7 pr-2 py-1.5 border rounded-lg bg-white dark:bg-surface-dark dark:border-border-dark focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-text-tertiary dark:placeholder:text-text-dark-tertiary"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (twitterCandidate?.valid) {
                          handleTwitterFollow(twitterCandidate.username)
                        } else if (socialBiliCandidates.length > 0) {
                          void handleSocialBilibiliFollow(socialBiliCandidates[0])
                        } else {
                          handleTwitterFollow()
                        }
                      } else if (e.key === "Escape") {
                        setTwitterSearch("")
                        setTwitterCandidate(null)
                        setSocialBiliCandidates([])
                      }
                    }}
                    onFocus={() => setTwitterInputFocused(true)}
                    onBlur={() => { setTimeout(() => setTwitterInputFocused(false), 200) }}
                    disabled={twitterSearching}
                  />
                </div>
                {/* Candidate dropdown */}
                {twitterInputFocused && (twitterCandidate || twitterMatchedFeeds.length > 0 || socialBiliCandidates.length > 0) && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border bg-white dark:bg-surface-dark dark:border-border-dark shadow-lg overflow-hidden">
                    {twitterMatchedFeeds.length > 0 && (
                      <div className="border-b border-border dark:border-border-dark">
                        <div className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                          {t("common.subscribed")}
                        </div>
                        {twitterMatchedFeeds.map((feed) => (
                          <button
                            key={feed.id}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary transition-colors"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleSelectFeed(feed.id)
                              setTwitterInputFocused(false)
                            }}
                          >
                            <FeedIcon imageUrl={feed.imageUrl} siteUrl={feed.siteUrl} feedUrl={feed.url} title={feed.title} size={18} />
                            <span className="flex-1 text-xs truncate">{getSidebarFeedDisplayTitle(feed)}</span>
                            <span className="text-[11px] text-text-tertiary">{feed.unreadCount}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {socialBiliCandidates.length > 0 && (
                      <div className="border-b border-border dark:border-border-dark">
                        <div className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                          {tWithDefault("sidebar.youtubeSearching", "Candidates", "Candidates")}
                        </div>
                        {socialBiliCandidates.map((candidate) => (
                          <div key={`social-bili:${candidate.uid}`} className="flex items-center gap-2.5 w-full px-3 py-2.5 text-left hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary transition-colors">
                            <FeedIcon
                              imageUrl={candidate.image}
                              feedUrl={candidate.feedUrl}
                              title={candidate.title}
                              size={32}
                              accentClass="bg-blue-500/10 text-blue-500"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium truncate">{candidate.title}</div>
                              <div className="text-[11px] text-text-tertiary dark:text-text-dark-tertiary truncate">
                                Bilibili · {candidate.description?.slice(0, 48)}
                              </div>
                            </div>
                            {candidate.alreadyFollowed ? (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex-shrink-0">
                                {t("common.subscribed")}
                              </span>
                            ) : (
                              <button
                                className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-accent text-white hover:bg-accent/80 flex-shrink-0 transition-colors"
                                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); void handleSocialBilibiliFollow(candidate) }}
                              >
                                <Plus size={11} />
                                {tWithDefault("sidebar.twitterFollow", "Follow", "Follow")}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {twitterCandidate && (
                      twitterCandidate.loading ? (
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          <RefreshCw size={14} className="animate-spin text-text-tertiary" />
                          <span className="text-xs text-text-secondary dark:text-text-dark-secondary">
                            {(() => {
                              const q = (twitterSearch || twitterCandidate.username || "").trim().replace(/^@+/, "")
                              return i18nDefault(
                                `正在查找 @${q || "user"}...`,
                                `Looking up @${q || "user"}...`,
                              )
                            })()}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2.5 w-full px-3 py-2.5 text-left">
                          {twitterCandidate.image ? (
                            <img
                              src={twitterCandidate.image}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover flex-shrink-0 bg-surface-tertiary"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                            />
                          ) : (
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/10 text-accent flex-shrink-0">
                              <MessageCircle size={15} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">{formatTwitterFeedTitle(twitterCandidate.title, twitterCandidate.username)}</div>
                            <div className="text-[11px] text-text-tertiary dark:text-text-dark-tertiary truncate">@{twitterCandidate.username}</div>
                          </div>
                          {twitterCandidate.alreadyFollowed ? (
                            <button
                              className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-red-100 hover:dark:bg-red-900/30 hover:text-red-600 hover:dark:text-red-400 flex-shrink-0 transition-colors"
                              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleTwitterUnfollow(twitterCandidate.username) }}
                            >
                              <XIcon size={11} />
                              {tWithDefault("sidebar.twitterUnfollow", "Unfollow", "Unfollow")}
                            </button>
                          ) : (
                            <button
                              className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-accent text-white hover:bg-accent/80 flex-shrink-0 transition-colors"
                              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleTwitterFollow(twitterCandidate.username) }}
                            >
                              <Plus size={11} />
                              {tWithDefault("sidebar.twitterFollow", "Follow", "Follow")}
                            </button>
                          )}
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
              {/* Subscribing spinner */}
              {twitterSearching && (
                <div className="flex items-center gap-1.5 mt-1 px-1">
                  <RefreshCw size={12} className="animate-spin text-accent" />
                  <span className="text-[11px] text-text-secondary dark:text-text-dark-secondary">{tWithDefault("sidebar.twitterSubscribing", "Subscribing...", "Subscribing...")}</span>
                </div>
              )}
              {twitterSearchResult && (
                <p className={`mt-1 px-1 text-[11px] ${twitterSearchResult.ok ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
                  {twitterSearchResult.msg}
                </p>
              )}
            </div>
          )}

          {/* YouTube channel search 闂?only in Videos view */}
          {activeView === FeedViewType.Videos && (
            <div className="mt-1 px-1" ref={youtubeDropdownRef}>
              <div className="relative">
                <div className="relative">
                  <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary dark:text-text-dark-tertiary pointer-events-none" />
                  <input
                    value={youtubeSearch}
                    onChange={(e) => setYoutubeSearch(e.target.value)}
                    placeholder={tWithDefault("sidebar.youtubeSearchPlaceholder", "Enter YouTube channel or @handle", "Enter YouTube channel or @handle")}
                    className="w-full text-xs pl-7 pr-2 py-1.5 border rounded-lg bg-white dark:bg-surface-dark dark:border-border-dark focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-text-tertiary dark:placeholder:text-text-dark-tertiary"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (youtubeCandidate?.valid) {
                          handleYouTubeSubscribe(youtubeCandidate.query)
                        } else if (videoSearchCandidates.length > 0) {
                          void handleVideoCandidateSubscribe(videoSearchCandidates[0])
                        } else {
                          handleYouTubeSubscribe()
                        }
                      } else if (e.key === "Escape") {
                        setYoutubeSearch("")
                        setYoutubeCandidate(null)
                        setVideoCandidates([])
                      }
                    }}
                    onFocus={() => setYoutubeInputFocused(true)}
                    onBlur={() => { setTimeout(() => setYoutubeInputFocused(false), 200) }}
                    disabled={youtubeSearching}
                  />
                </div>
                {/* Candidate dropdown */}
                {youtubeInputFocused && ((youtubeCandidate && !youtubeCandidate.alreadySubscribed) || youtubeMatchedFeeds.length > 0 || videoSearchCandidates.length > 0) && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border bg-white dark:bg-surface-dark dark:border-border-dark shadow-lg overflow-hidden">
                    {youtubeMatchedFeeds.length > 0 && (
                      <div className="border-b border-border dark:border-border-dark">
                        <div className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                          {t("common.subscribed")}
                        </div>
                        {youtubeMatchedFeeds.map((feed) => (
                          <button
                            key={feed.id}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary transition-colors"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleSelectFeed(feed.id)
                              setYoutubeInputFocused(false)
                            }}
                          >
                            <FeedIcon imageUrl={feed.imageUrl} siteUrl={feed.siteUrl} feedUrl={feed.url} title={feed.title} size={18} />
                            <span className="flex-1 text-xs truncate">{getSidebarFeedDisplayTitle(feed)}</span>
                            <span className="text-[11px] text-text-tertiary">{feed.unreadCount}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {videoSearchCandidates.length > 0 && (
                      <div className="border-b border-border dark:border-border-dark">
                        <div className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                          {tWithDefault("sidebar.youtubeSearching", "Candidates", "Candidates")}
                        </div>
                        {videoSearchCandidates.map((candidate) => (
                          <div key={`${candidate.platform}:${candidate.feedUrl}`} className="flex items-center gap-2.5 w-full px-3 py-2.5 text-left hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary transition-colors">
                            <FeedIcon
                              imageUrl={candidate.image}
                              feedUrl={candidate.feedUrl}
                              title={candidate.title}
                              size={32}
                              accentClass={candidate.platform === "youtube" ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500"}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium truncate">{candidate.title}</div>
                              <div className="text-[11px] text-text-tertiary dark:text-text-dark-tertiary truncate">
                                {candidate.platform === "youtube" ? "YouTube" : "Bilibili"} · {candidate.description?.slice(0, 48)}
                              </div>
                            </div>
                            <button
                              className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-accent text-white hover:bg-accent/80 flex-shrink-0 transition-colors"
                              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); void handleVideoCandidateSubscribe(candidate) }}
                            >
                              <Plus size={11} />
                              {tWithDefault("sidebar.youtubeSubscribe", "Subscribe", "Subscribe")}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {youtubeCandidate && !youtubeCandidate.alreadySubscribed && (
                      youtubeCandidate.loading ? (
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          <RefreshCw size={14} className="animate-spin text-text-tertiary" />
                          <span className="text-xs text-text-secondary dark:text-text-dark-secondary">
                            {(() => {
                              const q = (youtubeCandidate.query || youtubeSearch || "").trim()
                              return i18nDefault(
                                `Looking up ${q || "channel"}...`,
                                `Looking up ${q || "channel"}...`,
                              )
                            })()}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2.5 w-full px-3 py-2.5 text-left">
                          <FeedIcon
                            imageUrl={youtubeCandidate.image}
                            feedUrl={youtubeCandidate.feedUrl}
                            title={youtubeCandidate.title || youtubeCandidate.query}
                            size={32}
                            accentClass="bg-red-500/10 text-red-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">{youtubeCandidate.title}</div>
                            <div className="text-[11px] text-text-tertiary dark:text-text-dark-tertiary truncate">{youtubeCandidate.description?.slice(0, 60)}</div>
                          </div>
                          {youtubeCandidate.alreadySubscribed ? (
                            <button
                              className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-red-100 hover:dark:bg-red-900/30 hover:text-red-600 hover:dark:text-red-400 flex-shrink-0 transition-colors"
                              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleYouTubeUnsubscribe(youtubeCandidate.query, youtubeCandidate.feedUrl) }}
                            >
                              <XIcon size={11} />
                              {tWithDefault("sidebar.youtubeUnsubscribe", "Unsubscribe", "Unsubscribe")}
                            </button>
                          ) : (
                            <button
                              className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-accent text-white hover:bg-accent/80 flex-shrink-0 transition-colors"
                              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleYouTubeSubscribe(youtubeCandidate.query) }}
                            >
                              <Plus size={11} />
                              {tWithDefault("sidebar.youtubeSubscribe", "Subscribe", "Subscribe")}
                            </button>
                          )}
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
              {youtubeSearching && (
                <div className="flex items-center gap-1.5 mt-1 px-1">
                  <RefreshCw size={12} className="animate-spin text-accent" />
                  <span className="text-[11px] text-text-secondary dark:text-text-dark-secondary">{tWithDefault("sidebar.youtubeSubscribing", "Subscribing...", "Subscribing...")}</span>
                </div>
              )}
              {youtubeSearchResult && (
                <p className={`mt-1 px-1 text-[11px] ${youtubeSearchResult.ok ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
                  {youtubeSearchResult.msg}
                </p>
              )}
            </div>
          )}

          {/* Feed list by category */}
          <div className="pt-2">
            {/* New folder button */}
            {!showNewFolder ? (
              <button
                onClick={() => { setShowNewFolder(true); setNewFolderName(getDefaultFolderName()) }}
                className="flex items-center gap-1.5 w-full px-3 py-1 text-xs font-medium text-text-tertiary hover:text-accent transition-colors mb-1"
              >
                <FolderPlus size={13} />
                <span>{t("sidebar.newFolder")}</span>
              </button>
            ) : (
              <div className="flex items-center gap-1 px-3 py-1 mb-1">
                <FolderPlus size={13} className="text-accent flex-shrink-0" />
                <input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder={getDefaultFolderName()}
                  className="flex-1 min-w-0 text-xs px-2 py-0.5 border rounded bg-white dark:bg-surface-dark dark:border-border-dark focus:outline-none focus:ring-1 focus:ring-accent"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newFolderName.trim()) {
                      const name = newFolderName.trim()
                      if (!userCategories.has(name)) {
                        setEmptyFolders((prev) => [...prev.filter((f) => f.name !== name), { name, view: activeView }])
                      }
                      setShowNewFolder(false)
                    } else if (e.key === "Escape") {
                      setShowNewFolder(false)
                    }
                  }}
                  onBlur={() => {
                    const name = newFolderName.trim()
                    if (name && !userCategories.has(name)) {
                      setEmptyFolders((prev) => [...prev.filter((f) => f.name !== name), { name, view: activeView }])
                    }
                    setShowNewFolder(false)
                  }}
                />
              </div>
            )}

            {/* User feed categories */}
            {categoryEntries.map(([category, categoryFeeds]) => (
              <FeedCategory
                key={category}
                category={category}
                feeds={categoryFeeds}
                selectedFeedId={selectedFeedId}
                onSelect={handleSelectFeed}
                onContextMenu={handleContextMenu}
                onCategoryContextMenu={handleCategoryContextMenu}
                dragFeedId={dragFeedId}
                dropTarget={dropTarget}
                onDragStart={handleDragPointerStart}
              />
            ))}

            {/* Recommended feeds section 闂?only shown when enabled in settings */}
            {showRecommended && recommendedFeeds.length > 0 && (
              <RecommendedSection
                feeds={recommendedFeeds}
                selectedFeedId={selectedFeedId}
                onSelect={handleSelectFeed}
                onContextMenu={handleContextMenu}
              />
            )}

            {userVisibleFeedCount === 0 && activeView !== null && (
              <div className="text-center py-6 text-text-secondary dark:text-text-dark-secondary text-xs">
                <p>{t("sidebar.noFeedsInCategory")}</p>
                <p className="mt-1">{t("sidebar.addFeedHint")}</p>
              </div>
            )}
            {userVisibleFeedCount === 0 && activeView === null && allFeedsSearchLower && (
              <div className="text-center py-6 text-text-secondary dark:text-text-dark-secondary text-xs">
                <p>{t("common.noResults", { defaultValue: i18nDefault("No matching subscriptions", "No matching subscriptions") })}</p>
              </div>
            )}
          </div>
        </nav>

        {/* Bottom actions */}
        <div className="border-t p-2 space-y-1">
          <button
            onClick={() => setPanelOpen(!isPanelOpen)}
            className="sidebar-item w-full text-text-secondary dark:text-text-dark-secondary"
          >
            <MessageSquare size={18} />
            <span className="flex-1 text-left">{t("sidebar.aiAssistant")}</span>
          </button>

          <button
            onClick={() => setDiscoverOpen(!isDiscoverOpen)}
            className={`sidebar-item w-full ${isDiscoverOpen ? "sidebar-item-active" : "text-text-secondary dark:text-text-dark-secondary"}`}
          >
            <Compass size={18} />
            <span className="flex-1 text-left">{t("sidebar.discover")}</span>
          </button>

          <button
            onClick={toggleSearch}
            className="sidebar-item w-full text-text-secondary dark:text-text-dark-secondary"
          >
            <Search size={18} />
            <span className="flex-1 text-left">{t("sidebar.search")}</span>
            <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-surface-tertiary dark:bg-surface-dark-tertiary text-text-tertiary">Ctrl+K</kbd>
          </button>

          {/* Import result notification */}
          {importResult && (
            <div className="px-3 py-1.5 text-xs rounded-lg bg-accent/10 text-accent truncate">
              {importResult}
            </div>
          )}
          {refreshHint && (
            <div
              className={`px-3 py-1.5 text-xs rounded-lg truncate ${
                refreshHint.ok
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-red-500/10 text-red-600 dark:text-red-400"
              }`}
            >
              {refreshHint.msg}
            </div>
          )}

          <div className="flex gap-1">
            <button
              onClick={() => setDiscoverOpen(true)}
              className="sidebar-item flex-1 justify-center text-text-secondary dark:text-text-dark-secondary"
              title={t("sidebar.addFeed")}
            >
              <Plus size={18} />
            </button>
            <button
              onClick={handleImportOPML}
              disabled={isImporting}
              className="sidebar-item flex-1 justify-center text-text-secondary dark:text-text-dark-secondary disabled:opacity-50"
              title={t("sidebar.importOPML")}
            >
              <Upload size={18} className={isImporting ? "animate-pulse" : ""} />
            </button>
            <button
              onClick={() => exportOPML()}
              className="sidebar-item flex-1 justify-center text-text-secondary dark:text-text-dark-secondary"
              title={t("sidebar.exportOPML")}
            >
              <Download size={18} />
            </button>
            <button
              onClick={refreshAll}
              disabled={isRefreshing}
              className="sidebar-item flex-1 justify-center text-text-secondary dark:text-text-dark-secondary disabled:opacity-50"
              title={t("sidebar.refreshAll")}
            >
              <RefreshCw size={18} className={isRefreshing ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="sidebar-item flex-1 justify-center text-text-secondary dark:text-text-dark-secondary"
              title={t("sidebar.settings")}
            >
              <Settings size={18} />
            </button>
            <button
              onClick={toggleShortcutHelp}
              className="sidebar-item flex-1 justify-center text-text-secondary dark:text-text-dark-secondary"
              title={t("sidebar.shortcuts")}
            >
              <Keyboard size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Import progress */}
      <ImportProgressModal open={showImportProgress} onDone={handleImportProgressDone} />

      {/* Feed context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-surface-dark-secondary border rounded-lg shadow-lg py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseLeave={() => setContextMenu(null)}
        >
          {contextMenu.isRecommended ? (
            /* Recommended feed 闂?subscribe or read actions only (built-in, cannot delete) */
            <>
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary flex items-center gap-2 text-accent"
                onClick={async () => {
                  // "Subscribe" here means move from Recommended to normal subscriptions.
                  const feed = feeds.find((f) => f.id === contextMenu.feedId)
                  if (!feed) {
                    setContextMenu(null)
                    return
                  }
                  const instagramMatch = feed.url.match(/\/instagram\/user\/([^/?#]+)/i)
                  if (instagramMatch) {
                    try {
                      const username = decodeURIComponent(instagramMatch[1])
                      const result = await window.api.discover.probeInstagramUser(username)
                      if (result.valid && result.feedUrl) {
                        await updateFeed(contextMenu.feedId, { url: result.feedUrl, category: "" })
                        setContextMenu(null)
                        return
                      }
                    } catch {
                      // Fallback: keep current URL and only move folder.
                    }
                  }
                  await updateFeed(contextMenu.feedId, { category: "" })
                  setContextMenu(null)
                }}
              >
                <Plus size={14} />
                {t("sidebar.subscribe")}
              </button>
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary flex items-center gap-2"
                onClick={() => {
                  const feed = feeds.find((f) => f.id === contextMenu.feedId)
                  if (feed) setEditingFeed({ id: feed.id, title: feed.title, url: feed.url, category: feed.category || "", view: feed.view ?? FeedViewType.Articles, showInAll: feed.showInAll !== false })
                  setContextMenu(null)
                }}
              >
                <Edit3 size={14} />
                {t("sidebar.editFeed")}
              </button>
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary flex items-center gap-2"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const feedId = contextMenu.feedId
                  const feedTitle = feeds.find((f) => f.id === feedId)?.title || ""
                  setContextMenu(null)
                  showRefreshHint(
                    tWithDefault("sidebar.refreshingFeed", "Refreshing feed...", "Refreshing feed..."),
                    true,
                    1200,
                  )
                  void refreshFeed(feedId)
                    .then(() => {
                      showRefreshHint(
                        tWithDefault("sidebar.refreshFeedDone", "Refresh complete: {{title}}", "Refresh complete: {{title}}", { title: feedTitle || feedId }),
                        true,
                      )
                    })
                    .catch(() => {
                      showRefreshHint(
                        tWithDefault("sidebar.refreshFeedFailed", "Refresh failed. Please try again.", "Refresh failed. Please try again."),
                        false,
                        3000,
                      )
                    })
                }}
              >
                <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
                {t("sidebar.refreshFeed")}
              </button>
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary flex items-center gap-2"
                onClick={() => {
                  markAllRead(contextMenu.feedId)
                  setContextMenu(null)
                }}
              >
                <CheckCheck size={14} />
                {t("sidebar.markAllRead")}
              </button>
            </>
          ) : (
            /* User feed 闂?normal actions */
            <>
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary flex items-center gap-2"
                onClick={() => {
                  const feed = feeds.find((f) => f.id === contextMenu.feedId)
                  if (feed) setEditingFeed({ id: feed.id, title: feed.title, url: feed.url, category: feed.category || "", view: feed.view ?? FeedViewType.Articles, showInAll: feed.showInAll !== false })
                  setContextMenu(null)
                }}
              >
                <Edit3 size={14} />
                {t("sidebar.editFeed")}
              </button>
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary flex items-center gap-2"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const feedId = contextMenu.feedId
                  const feedTitle = feeds.find((f) => f.id === feedId)?.title || ""
                  setContextMenu(null)
                  showRefreshHint(
                    tWithDefault("sidebar.refreshingFeed", "Refreshing feed...", "Refreshing feed..."),
                    true,
                    1200,
                  )
                  void refreshFeed(feedId)
                    .then(() => {
                      showRefreshHint(
                        tWithDefault("sidebar.refreshFeedDone", "Refresh complete: {{title}}", "Refresh complete: {{title}}", { title: feedTitle || feedId }),
                        true,
                      )
                    })
                    .catch(() => {
                      showRefreshHint(
                        tWithDefault("sidebar.refreshFeedFailed", "Refresh failed. Please try again.", "Refresh failed. Please try again."),
                        false,
                        3000,
                      )
                    })
                }}
              >
                <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
                {t("sidebar.refreshFeed")}
              </button>
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary flex items-center gap-2"
                onClick={() => {
                  markAllRead(contextMenu.feedId)
                  setContextMenu(null)
                }}
              >
                <CheckCheck size={14} />
                {t("sidebar.markAllRead")}
              </button>
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary flex items-center gap-2 text-red-500"
                onClick={() => {
                  unsubscribeFeed(contextMenu.feedId)
                  setContextMenu(null)
                }}
              >
                <Trash2 size={14} />
                {t("sidebar.unsubscribe")}
              </button>
            </>
          )}
        </div>
      )}

      {/* Category context menu */}
      {categoryContextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-surface-dark-secondary border rounded-lg shadow-lg py-1 min-w-[180px]"
          style={{ left: categoryContextMenu.x, top: categoryContextMenu.y }}
          onMouseLeave={() => setCategoryContextMenu(null)}
        >
          {!isDefaultCategoryMenu && (
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary flex items-center gap-2"
              onClick={() => {
                setRenamingCategory({ oldName: categoryContextMenu.category, newName: categoryContextMenu.category })
                setCategoryContextMenu(null)
              }}
            >
              <Pencil size={14} />
              {t("sidebar.renameFolder")}
            </button>
          )}
          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary flex items-center gap-2"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              const feedIds = [...categoryContextMenu.feedIds]
              setCategoryContextMenu(null)
              showRefreshHint(
                tWithDefault("sidebar.refreshingCategory", "Refreshing category feeds...", "Refreshing category feeds..."),
                true,
                1200,
              )
              void refreshMultiple(feedIds)
                .then(() => {
                  showRefreshHint(
                    tWithDefault("sidebar.refreshCategoryDone", "Category refresh complete", "Category refresh complete"),
                    true,
                  )
                })
                .catch(() => {
                  showRefreshHint(
                    tWithDefault("sidebar.refreshFeedFailed", "Refresh failed. Please try again.", "Refresh failed. Please try again."),
                    false,
                    3000,
                  )
                })
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
            {t("sidebar.refreshCategory")}
          </button>
          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary flex items-center gap-2"
            onClick={() => {
              for (const fid of categoryContextMenu.feedIds) markAllRead(fid)
              setCategoryContextMenu(null)
            }}
          >
            <CheckCheck size={14} />
            {t("sidebar.markAllRead")}
          </button>
          {!isDefaultCategoryMenu && (
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary flex items-center gap-2 text-red-500"
              onClick={() => {
                if (categoryContextMenu.feedIds.length === 0 || window.confirm(t("sidebar.deleteFolderConfirm"))) {
                  for (const fid of categoryContextMenu.feedIds) {
                    updateFeed(fid, { category: "" })
                  }
                  setEmptyFolders((prev) => prev.filter((f) => f.name !== categoryContextMenu.category))
                }
                setCategoryContextMenu(null)
              }}
            >
              <Trash2 size={14} />
              {t("sidebar.deleteFolder")}
            </button>
          )}
        </div>
      )}

      {/* Rename folder dialog */}
      {renamingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setRenamingCategory(null)}>
          <div
            className="bg-white dark:bg-surface-dark-secondary rounded-xl shadow-2xl w-[340px] p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-medium text-sm">{t("sidebar.renameFolder")}</h3>
            <input
              value={renamingCategory.newName}
              onChange={(e) => setRenamingCategory({ ...renamingCategory, newName: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-surface-dark dark:border-border-dark focus:outline-none focus:ring-1 focus:ring-accent"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const trimmed = renamingCategory.newName.trim()
                  if (trimmed && trimmed !== renamingCategory.oldName) {
                    const toMove = feeds.filter((f) => getFeedFolderName(f) === renamingCategory.oldName)
                    for (const f of toMove) updateFeed(f.id, { category: trimmed })
                  }
                  setRenamingCategory(null)
                } else if (e.key === "Escape") {
                  setRenamingCategory(null)
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setRenamingCategory(null)} className="px-3 py-1.5 text-sm rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary">
                {t("common.cancel")}
              </button>
              <button
                onClick={() => {
                  const trimmed = renamingCategory.newName.trim()
                  if (trimmed && trimmed !== renamingCategory.oldName) {
                    const toMove = feeds.filter((f) => getFeedFolderName(f) === renamingCategory.oldName)
                    for (const f of toMove) updateFeed(f.id, { category: trimmed })
                  }
                  setRenamingCategory(null)
                }}
                className="px-3 py-1.5 text-sm rounded-lg bg-accent text-white hover:bg-accent/90"
              >
                {t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit feed dialog */}
      {editingFeed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditingFeed(null)}>
          <div
            className="bg-white dark:bg-surface-dark-secondary rounded-xl shadow-2xl w-[400px] p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">{t("sidebar.editFeed")}</h3>
              <button onClick={() => setEditingFeed(null)} className="p-1 rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary">
                <XIcon size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-text-secondary dark:text-text-dark-secondary mb-1 block">{t("sidebar.editFeedTitle")}</label>
                <input
                  value={editingFeed.title}
                  onChange={(e) => setEditingFeed({ ...editingFeed, title: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-surface-dark dark:border-border-dark focus:outline-none focus:ring-1 focus:ring-accent"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary dark:text-text-dark-secondary mb-1 flex items-center gap-1">
                  <Link size={12} />
                  {t("sidebar.editFeedUrl")}
                </label>
                <input
                  value={editingFeed.url}
                  onChange={(e) => setEditingFeed({ ...editingFeed, url: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-surface-dark dark:border-border-dark focus:outline-none focus:ring-1 focus:ring-accent font-mono text-xs"
                  placeholder="https://example.com/feed.xml"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary dark:text-text-dark-secondary mb-1 block">{t("sidebar.editFeedCategory")}</label>
                <input
                  value={editingFeed.category}
                  onChange={(e) => setEditingFeed({ ...editingFeed, category: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-surface-dark dark:border-border-dark focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder={t("common.uncategorized")}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary dark:text-text-dark-secondary mb-1 block">{t("sidebar.editFeedView")}</label>
                <select
                  value={editingFeed.view}
                  onChange={(e) => setEditingFeed({ ...editingFeed, view: Number(e.target.value) as FeedViewType })}
                  className="w-full px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-surface-dark dark:border-border-dark focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  {Object.entries(VIEW_DEFINITIONS).map(([k]) => (
                    <option key={k} value={k}>
                      {t(VIEW_TYPE_I18N_KEYS[Number(k) as FeedViewType] || "viewTypes.articles")}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm bg-surface-secondary/50 dark:bg-surface-dark-tertiary/50 dark:border-border-dark">
                <span className="text-text-primary dark:text-text-dark-primary">
                  {t("sidebar.editFeedShowInAll", { defaultValue: i18nDefault("Show in All", "Show in All") })}
                </span>
                <input
                  type="checkbox"
                  checked={editingFeed.showInAll}
                  onChange={(e) => setEditingFeed({ ...editingFeed, showInAll: e.target.checked })}
                  className="h-4 w-4 accent-accent"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setEditingFeed(null)}
                className="px-3 py-1.5 text-sm rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={() => {
                  updateFeed(editingFeed.id, {
                    title: editingFeed.title.trim() || undefined,
                    url: editingFeed.url.trim() || undefined,
                    category: editingFeed.category.trim(),
                    view: editingFeed.view,
                    showInAll: editingFeed.showInAll,
                  })
                  setEditingFeed(null)
                }}
                className="px-3 py-1.5 text-sm rounded-lg bg-accent text-white hover:bg-accent/90"
              >
                {t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drag overlay 闂?follows mouse exactly */}
      {dragOverlay && (
        <div
          id="feed-drag-overlay"
          className="fixed z-[9999] pointer-events-none -translate-x-1/2 -translate-y-1/2"
          style={{ left: dragOverlay.x, top: dragOverlay.y }}
        >
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-surface-dark shadow-xl ring-1 ring-black/10 dark:ring-white/10 text-sm font-medium text-text dark:text-text-dark whitespace-nowrap">
            <GripVertical size={12} className="text-text-tertiary" />
            {dragOverlay.label}
          </div>
        </div>
      )}
    </>
  )
}

type FeedCategoryProps = {
  category: string
  feeds: Array<{ id: string; title: string; url?: string; imageUrl?: string; siteUrl?: string; unreadCount: number }>
  selectedFeedId: string | null
  onSelect: (id: string) => void
  onContextMenu: (e: React.MouseEvent, id: string) => void
  onCategoryContextMenu: (e: React.MouseEvent, category: string, feedIds: string[]) => void
  dragFeedId: string | null
  dropTarget: string | null
  onDragStart: (feedId: string, label: string, e: React.PointerEvent) => void
}

const FeedCategory = memo(function FeedCategory({
  category,
  feeds,
  selectedFeedId,
  onSelect,
  onContextMenu,
  onCategoryContextMenu,
  dragFeedId,
  dropTarget,
  onDragStart,
}: FeedCategoryProps) {
  const [expanded, setExpanded] = useState(true)
  const isDropHover = dropTarget === category && dragFeedId !== null
  const shouldVirtualizeFeeds = feeds.length > 80
  const listRef = useRef<HTMLDivElement | null>(null)
  const feedVirtualizer = useVirtualizer({
    count: expanded && shouldVirtualizeFeeds ? feeds.length : 0,
    getScrollElement: () => listRef.current,
    estimateSize: () => 36,
    overscan: 8,
    getItemKey: (index) => feeds[index]?.id ?? index,
  })
  const virtualFeedItems = feedVirtualizer.getVirtualItems()
  const expandedHeight = expanded
    ? shouldVirtualizeFeeds
      ? Math.min(420, feeds.length * 36 + 8)
      : feeds.length * 40 + 8
    : 0
  // Auto-expand when dragging over a collapsed folder
  const wasDropHover = useRef(false)
  if (isDropHover && !expanded && !wasDropHover.current) {
    wasDropHover.current = true
    setTimeout(() => setExpanded(true), 400)
  }
  if (!isDropHover) wasDropHover.current = false

  return (
    <div
      data-drop-category={category}
      className={`mb-1 rounded-lg transition-all duration-300 ${
        isDropHover
          ? "bg-accent/10 ring-2 ring-accent/40 ring-inset scale-[1.01]"
          : ""
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        onContextMenu={(e) => onCategoryContextMenu(e, category, feeds.map((f) => f.id))}
        className={`flex items-center gap-1 w-full px-3 py-1 text-xs font-medium uppercase tracking-wider transition-colors ${
          isDropHover
            ? "text-accent"
            : "text-text-secondary dark:text-text-dark-secondary"
        }`}
      >
        <ChevronRight
          size={12}
          className={`transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
        />
        {category}
        <span className="ml-auto text-text-tertiary">{feeds.length}</span>
      </button>
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: `${expandedHeight}px`,
          opacity: expanded ? 1 : 0,
        }}
      >
        <div
          ref={listRef}
          className={shouldVirtualizeFeeds ? "overflow-y-auto pr-1" : undefined}
          style={shouldVirtualizeFeeds ? { maxHeight: `${expandedHeight}px` } : undefined}
        >
          {shouldVirtualizeFeeds ? (
            <div className="relative" style={{ height: `${feedVirtualizer.getTotalSize()}px` }}>
              {virtualFeedItems.map((item) => {
                const feed = feeds[item.index]
                if (!feed) return null
                return (
                  <div
                    key={feed.id}
                    data-index={item.index}
                    ref={feedVirtualizer.measureElement}
                    className={`absolute left-0 top-0 w-full transition-all duration-200 ${
                      dragFeedId === feed.id ? "opacity-40 scale-95" : "opacity-100"
                    }`}
                    style={{ transform: `translateY(${item.start}px)` }}
                  >
                    <button
                      onClick={() => onSelect(feed.id)}
                      onContextMenu={(e) => onContextMenu(e, feed.id)}
                      className={`sidebar-item w-full group ${selectedFeedId === feed.id ? "sidebar-item-active" : ""}`}
                    >
                      <GripVertical
                        size={12}
                        className="flex-shrink-0 opacity-0 group-hover:opacity-40 transition-opacity cursor-grab active:cursor-grabbing -ml-1 mr-0 touch-none"
                        onPointerDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          onDragStart(feed.id, feed.title, e)
                        }}
                      />
                      <FeedIcon imageUrl={feed.imageUrl} siteUrl={feed.siteUrl} feedUrl={feed.url} title={feed.title} size={20} />
                      <span className="flex-1 text-left truncate">{getSidebarFeedDisplayTitle(feed)}</span>
                      <span className="text-xs text-text-secondary dark:text-text-dark-secondary">
                        {feed.unreadCount}
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="space-y-0.5">
              {feeds.map((feed) => (
                <div
                  key={feed.id}
                  className={`transition-all duration-200 ${
                    dragFeedId === feed.id ? "opacity-40 scale-95" : "opacity-100"
                  }`}
                >
                  <button
                    onClick={() => onSelect(feed.id)}
                    onContextMenu={(e) => onContextMenu(e, feed.id)}
                    className={`sidebar-item w-full group ${selectedFeedId === feed.id ? "sidebar-item-active" : ""}`}
                  >
                    {/* Drag grip 闂?pointer-based drag for smooth following */}
                    <GripVertical
                      size={12}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-40 transition-opacity cursor-grab active:cursor-grabbing -ml-1 mr-0 touch-none"
                      onPointerDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        onDragStart(feed.id, feed.title, e)
                      }}
                    />
                    <FeedIcon imageUrl={feed.imageUrl} siteUrl={feed.siteUrl} feedUrl={feed.url} title={feed.title} size={20} />
                    <span className="flex-1 text-left truncate">{getSidebarFeedDisplayTitle(feed)}</span>
                    <span className="text-xs text-text-secondary dark:text-text-dark-secondary">
                      {feed.unreadCount}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

/** Recommended feeds section with a sparkle icon. */
type RecommendedSectionProps = {
  feeds: Array<{ id: string; title: string; url?: string; imageUrl?: string; siteUrl?: string; unreadCount: number }>
  selectedFeedId: string | null
  onSelect: (id: string) => void
  onContextMenu: (e: React.MouseEvent, id: string, isRecommended?: boolean) => void
}

const RecommendedSection = memo(function RecommendedSection({
  feeds,
  selectedFeedId,
  onSelect,
  onContextMenu,
}: RecommendedSectionProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(true)
  const totalUnread = feeds.reduce((sum, f) => sum + f.unreadCount, 0)

  return (
    <div className="mb-1 mt-2 border-t border-border dark:border-border-dark pt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 w-full px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400 tracking-wider"
      >
        <ChevronRight
          size={12}
          className={`transition-transform ${expanded ? "rotate-90" : ""}`}
        />
        <Sparkles size={12} />
        <span>{t("sidebar.recommended")}</span>
        {totalUnread > 0 && (
          <span className="ml-auto text-xs text-amber-500/70">{totalUnread}</span>
        )}
        {totalUnread === 0 && (
          <span className="ml-auto text-text-tertiary">{feeds.length}</span>
        )}
      </button>
      {expanded && (
        <div className="space-y-0.5">
          {feeds.map((feed) => (
            <button
              key={feed.id}
              onClick={() => onSelect(feed.id)}
              onContextMenu={(e) => onContextMenu(e, feed.id, true)}
              className={`sidebar-item w-full ${selectedFeedId === feed.id ? "sidebar-item-active" : ""}`}
            >
              <FeedIcon imageUrl={feed.imageUrl} siteUrl={feed.siteUrl} feedUrl={feed.url} title={feed.title} size={20} accentClass="bg-amber-500/20 text-amber-500" />
              <span className="flex-1 text-left truncate">{getSidebarFeedDisplayTitle(feed)}</span>
              <span className="text-xs text-text-secondary dark:text-text-dark-secondary">
                {feed.unreadCount}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
})

/** Smart feed icon with fallback chain: imageUrl 闂?favicon from siteUrl 闂?initials 闂?RSS icon */
type FeedIconProps = {
  imageUrl?: string
  siteUrl?: string
  feedUrl?: string
  title?: string
  size?: number
  accentClass?: string
}

const FeedIcon = memo(function FeedIcon({ imageUrl, siteUrl, feedUrl, title, size = 20, accentClass }: FeedIconProps) {
  const extractMirrorOrigin = useCallback((url: string): string => {
    const raw = (url || "").trim()
    if (!raw) return ""
    try {
      const parsed = new URL(raw)
      if (/^media\.(picnob|pixnoy)\./i.test(parsed.hostname) && parsed.pathname === "/get") {
        const marker = "url="
        const q = raw.split("?")[1] || ""
        const idx = q.indexOf(marker)
        if (idx < 0) return ""
        const nestedRaw = q.slice(idx + marker.length).trim()
        if (!nestedRaw) return ""
        try {
          const decoded = decodeURIComponent(nestedRaw)
          return /^https?:\/\//i.test(decoded) ? decoded : ""
        } catch {
          return /^https?:\/\//i.test(nestedRaw) ? nestedRaw : ""
        }
      }
      if ((parsed.hostname.includes("pixnoy") || parsed.hostname.includes("picnob")) && parsed.searchParams.has("o")) {
        const encoded = parsed.searchParams.get("o") || ""
        if (!encoded) return ""
        const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/")
        const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4)
        try {
          const decoded = atob(padded)
          return /^https?:\/\//i.test(decoded) ? decoded : ""
        } catch {
          return ""
        }
      }
    } catch {
      return ""
    }
    return ""
  }, [])
  const [imgFailed, setImgFailed] = useState(false)
  const [faviconFailed, setFaviconFailed] = useState(false)
  const [twitterFailed, setTwitterFailed] = useState(false)
  const [instagramFailed, setInstagramFailed] = useState(false)

  const instagramUsername = useMemo(() => {
    const extract = (value?: string): string | null => {
      if (!value) return null
      const raw = value.trim()
      if (!raw) return null
      try {
        const parsed = new URL(raw)
        const host = parsed.hostname.toLowerCase()
        if (host === "instagram.com" || host === "www.instagram.com") {
          const username = parsed.pathname.split("/").filter(Boolean)[0]
          if (username && /^[a-zA-Z0-9._]+$/.test(username)) return username.replace(/^@/, "")
        }
      } catch {}
      const rsshub = raw.match(/\/instagram\/user\/([^/?#]+)/i)
      if (rsshub?.[1]) return decodeURIComponent(rsshub[1]).replace(/^@/, "")
      const picnob = raw.match(/\/picnob(?:\.info)?\/user\/([^/?#]+)/i)
      if (picnob?.[1]) return decodeURIComponent(picnob[1]).replace(/^@/, "")
      const unavatar = raw.match(/unavatar\.io\/instagram\/([^/?#]+)/i)
      if (unavatar?.[1]) return decodeURIComponent(unavatar[1]).replace(/^@/, "")
      return null
    }

    const fromUrls = extract(siteUrl) || extract(feedUrl) || extract(imageUrl)
    if (fromUrls) return fromUrls
    const cleanedTitle = (title || "")
      .replace(/\s*-\s*ins(?:tagram)?\s*$/i, "")
      .replace(/^@/, "")
      .trim()
    if (cleanedTitle && /^[a-zA-Z0-9._]{1,30}$/.test(cleanedTitle)) return cleanedTitle
    return null
  }, [siteUrl, feedUrl, imageUrl, title])

  // For Twitter/X feeds, use unavatar.io for always-fresh profile pictures
  // Detect from siteUrl (x.com/user), RSSHub (/twitter/user/xxx), or Nitter (/{user}/rss)
  const twitterAvatarUrl = useMemo(() => {
    // Try siteUrl first (e.g. https://x.com/elonmusk)
    if (siteUrl) {
      try {
        const { hostname, pathname } = new URL(siteUrl)
        if (hostname === "x.com" || hostname === "twitter.com" || hostname === "www.x.com" || hostname === "www.twitter.com") {
          const username = pathname.split("/").filter(Boolean)[0]
          if (username && /^[a-zA-Z0-9_]+$/.test(username)) {
            return `https://unavatar.io/x/${username}`
          }
        }
      } catch {}
    }
    // Try feedUrl (e.g. RSSHub or Nitter RSS URL)
    if (feedUrl) {
      const m = feedUrl.match(/\/twitter\/user\/([a-zA-Z0-9_]+)/i)
      if (m) {
        return `https://unavatar.io/x/${m[1]}`
      }
      try {
        const parsed = new URL(feedUrl)
        if (parsed.hostname.toLowerCase().includes("nitter")) {
          const parts = parsed.pathname.split("/").filter(Boolean)
          if (parts.length >= 2 && parts[1].toLowerCase() === "rss" && /^[a-zA-Z0-9_]+$/.test(parts[0])) {
            return `https://unavatar.io/x/${parts[0]}`
          }
        }
      } catch {}
    }
    return null
  }, [siteUrl, feedUrl])

  const instagramAvatarUrl = useMemo(() => {
    if (!instagramUsername) return null
    return `https://unavatar.io/instagram/${encodeURIComponent(instagramUsername)}?fallback=false`
  }, [instagramUsername])

  const isInstagramUnavatarImage = useMemo(() => {
    const src = (imageUrl || "").toLowerCase()
    return src.includes("unavatar.io/instagram/")
  }, [imageUrl])

  const isGenericInstagramIcon = useMemo(() => {
    const src = (imageUrl || "").toLowerCase()
    if (!src) return false
    // Common app/logo assets rather than user profile avatars.
    return (
      src.includes("instagram.com/static/images/ico") ||
      src.includes("instagram_static/images/ico") ||
      src.includes("instagram_logo") ||
      src.includes("instagram-logo") ||
      src.includes("/logo.") ||
      src.includes("iconfinder") ||
      src.includes("picnob") && src.includes("logo")
    )
  }, [imageUrl])

  const faviconUrl = useMemo(() => {
    if (!siteUrl) return null
    try {
      const { host } = new URL(siteUrl)
      return `https://icons.folo.is/${host}`
    } catch {
      return null
    }
  }, [siteUrl])

  const initialsUrl = useMemo(() => {
    if (!siteUrl && !title) return null
    try {
      let domain = ""
      if (siteUrl) {
        const { hostname } = new URL(siteUrl)
        // Strip www. and get the main domain part
        domain = hostname.replace(/^www\./, "").split(".")[0]
      } else if (title) {
        domain = title.replace(/^@/, "")
      }
      if (!domain) return null
      return `https://avatar.vercel.sh/${encodeURIComponent(domain)}.svg?text=${encodeURIComponent(domain.slice(0, 2).toUpperCase())}`
    } catch {
      return null
    }
  }, [siteUrl, title])

  const px = `${size}px`
  const iconSize = Math.round(size * 0.6)
  const accent = accentClass || "bg-accent/20 text-accent"

  // 0. For Twitter/X feeds, use unavatar.io for always-fresh avatar
  if (twitterAvatarUrl && !twitterFailed) {
    return (
      <img
        src={twitterAvatarUrl}
        alt=""
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: px, height: px }}
        onError={() => setTwitterFailed(true)}
      />
    )
  }

  // 1. Try imageUrl, except generic Instagram app icons.
  if (imageUrl && !imgFailed && !isInstagramUnavatarImage && !(instagramAvatarUrl && isGenericInstagramIcon)) {
    return (
      <img
        src={imageUrl}
        alt=""
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: px, height: px }}
        referrerPolicy="no-referrer-when-downgrade"
        onError={(e) => {
          const img = e.currentTarget
          const origin = extractMirrorOrigin(imageUrl)
          if (origin && !img.dataset.originTried) {
            img.dataset.originTried = "1"
            img.src = origin
            return
          }
          setImgFailed(true)
        }}
      />
    )
  }

  // 1.5 For Instagram feeds, skip unavatar fallback here to avoid showing generic default avatars.
  // Let favicon/initials act as temporary fallback until a real feed avatar is refreshed.

  // 2. Try favicon from siteUrl
  if (faviconUrl && !faviconFailed) {
    return (
      <img
        src={faviconUrl}
        alt=""
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: px, height: px }}
        onError={() => setFaviconFailed(true)}
      />
    )
  }

  // 3. Try initials avatar
  if (initialsUrl) {
    return (
      <img
        src={initialsUrl}
        alt=""
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: px, height: px }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
      />
    )
  }

  // 4. Fallback RSS icon
  return (
    <div className={`rounded-full flex items-center justify-center flex-shrink-0 ${accent}`} style={{ width: px, height: px }}>
      <Rss size={iconSize} />
    </div>
  )
})



