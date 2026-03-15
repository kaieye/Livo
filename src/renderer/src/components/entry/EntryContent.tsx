import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useEntryStore } from "../../store/entry-store"
import { useFeedStore } from "../../store/feed-store"
import { useSettingsStore } from "../../store/settings-store"
import { useAIChatStore } from "../../store/ai-chat-store"
import { usePlayerStore } from "../media/MediaPlayer"
import { VideoPlayer, transformVideoUrl } from "../media/MediaPlayer"
import { sanitizeHTML, isExternalUrl, createExternalLinkWarning } from "../../utils/sanitize"
import {
  Star,
  ExternalLink,
  BookOpen,
  BookType,
  Languages,
  Sparkles,
  MessageSquare,
  Loader2,
  CheckCircle2,
  Circle,
  ChevronUp,
  ChevronDown,
  Copy,
  Check,
  Clock,
  User,
  Calendar,
  Play,
  AlertTriangle,
  X,
  CheckSquare,
} from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"
import { getDateLocale } from "../../lib/date-locale"
import { ContextMenu, type ContextMenuAction } from "../ui/ContextMenu"

/** Estimate reading time in minutes */
function estimateReadingTime(html: string): number {
  const text = html.replace(/<[^>]*>/g, "").trim()
  // CJK: ~400 chars/min, Latin: ~200 words/min
  const cjkCount = (text.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length
  const wordCount = text.replace(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, "").split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(cjkCount / 400 + wordCount / 200))
}

/** Split HTML content into paragraph blocks for bilingual display */
function splitIntoParagraphs(html: string): string[] {
  // Split by block-level tags
  const blocks = html
    .split(/(<\/(?:p|div|h[1-6]|li|blockquote|pre|table|tr|section|article|figure)>)/i)
    .reduce<string[]>((acc, part, i, arr) => {
      if (i % 2 === 0 && i + 1 < arr.length) {
        acc.push(part + arr[i + 1])
      } else if (i % 2 === 0 && i === arr.length - 1 && part.trim()) {
        acc.push(part)
      }
      return acc
    }, [])
    .map((b) => b.trim())
    .filter((b) => b.length > 0 && b.replace(/<[^>]*>/g, "").trim().length > 0)

  return blocks.length > 0 ? blocks : [html]
}

function normalizeMediaKey(url: string): string {
  const decoded = url
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim()
  if (!decoded) return ""
  try {
    const u = new URL(decoded, window.location.href)
    const host = u.hostname.toLowerCase().replace(/^www\./, "")
    const path = u.pathname.replace(/\/+$/, "")
    return `${host}${path}`
  } catch {
    return decoded
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/[?#].*$/, "")
      .replace(/\/+$/, "")
  }
}

function stripDuplicateMediaFromHtml(
  html: string,
  options: {
    duplicateImageKeys?: string[]
    removeEmbeddedVideos?: boolean
  },
): string {
  if (!html) return html
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div id="__root__">${html}</div>`, "text/html")
  const root = doc.getElementById("__root__")
  if (!root) return html

  const imageKeySet = new Set(
    (options.duplicateImageKeys || []).map(normalizeMediaKey).filter(Boolean),
  )

  if (imageKeySet.size > 0) {
    const imgs = Array.from(root.querySelectorAll("img"))
    for (const img of imgs) {
      const src =
        img.getAttribute("src") ||
        img.getAttribute("data-src") ||
        img.getAttribute("data-original") ||
        ""
      if (!src) continue
      const key = normalizeMediaKey(src)
      if (imageKeySet.has(key)) {
        img.remove()
      }
    }
  }

  if (options.removeEmbeddedVideos) {
    const mediaNodes = root.querySelectorAll("video, iframe, embed, object, audio, source, picture")
    mediaNodes.forEach((node) => node.remove())
  }

  return root.innerHTML
}

export function EntryContent() {
  const { selectedEntry, toggleStar, entries, selectEntry } = useEntryStore()
  const feeds = useFeedStore((s) => s.feeds)
  const settings = useSettingsStore((s) => s.settings)
  const { setPanelOpen } = useAIChatStore()
  const playerPlay = usePlayerStore((s) => s.play)
  const { t } = useTranslation()

  // Content width mapping — supports custom px value
  const contentWidthClasses = useMemo(() => ({
    narrow: "max-w-[500px]",
    normal: "max-w-[680px]",
    wide: "max-w-[900px]",
    custom: "", // handled via inline style
  }), [])

  const contentWidthClass = settings.general.contentWidth === "custom"
    ? ""
    : (contentWidthClasses[settings.general.contentWidth] || contentWidthClasses.normal)

  const contentWidthStyle = settings.general.contentWidth === "custom"
    ? { maxWidth: `${settings.general.contentMaxWidth || 680}px` }
    : undefined

  // Per-entry state — keyed by entry ID, reset on switch
  const [summary, setSummary] = useState<string | null>(null)
  const [translatedParagraphs, setTranslatedParagraphs] = useState<string[]>([])
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [readableContent, setReadableContent] = useState<string | null>(null)
  const [isReadabilityMode, setIsReadabilityMode] = useState(false)
  const [isFetchingReadable, setIsFetchingReadable] = useState(false)
  const [readabilityError, setReadabilityError] = useState<string | null>(null)
  const [externalLinkWarning, setExternalLinkWarning] = useState<{url: string; hostname: string; isSuspicious: boolean} | null>(null)
  const [articleMenu, setArticleMenu] = useState<{ visible: boolean; x: number; y: number }>({
    visible: false,
    x: 0,
    y: 0,
  })

  // Reading progress
  const [readPercent, setReadPercent] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Content transition
  const [isTransitioning, setIsTransitioning] = useState(false)
  const prevEntryIdRef = useRef<string | null>(null)

  // Reset per-entry state when article changes
  useEffect(() => {
    const entryChanged = selectedEntry?.id !== prevEntryIdRef.current

    if (entryChanged) {
      // Trigger transition animation
      if (prevEntryIdRef.current && selectedEntry) {
        setIsTransitioning(true)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setIsTransitioning(false))
        })
      }
      prevEntryIdRef.current = selectedEntry?.id ?? null

      // Reset ALL article-specific state
      setSummary(null)
      setTranslatedParagraphs([])
      setShowTranslation(false)
      setIsSummarizing(false)
      setIsTranslating(false)
      setReadPercent(0)
      setLinkCopied(false)
      setReadableContent(null)
      setIsReadabilityMode(false)
      setIsFetchingReadable(false)
      setReadabilityError(null)

      // Scroll to top
      scrollRef.current?.scrollTo({ top: 0 })

    }
  }, [selectedEntry?.id])

  // Reading progress tracking
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      const max = scrollHeight - clientHeight
      setReadPercent(max > 0 ? Math.round((scrollTop / max) * 100) : 0)
    }

    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => el.removeEventListener("scroll", handleScroll)
  }, [selectedEntry?.id])

  // Intercept external link clicks with warning
  useEffect(() => {
    const container = contentRef.current
    if (!container) return

    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute("href")
      if (!href) return
      if (isExternalUrl(href)) {
        e.preventDefault()
        e.stopPropagation()
        const info = createExternalLinkWarning(href)
        if (info.isSuspicious) {
          setExternalLinkWarning(info)
        } else {
          window.open(href, "_blank")
        }
      }
    }

    container.addEventListener("click", handleClick)
    return () => container.removeEventListener("click", handleClick)
  }, [selectedEntry?.id])

  // Keyboard shortcuts
  useEffect(() => {
    if (!selectedEntry) return

    const handleKey = (e: KeyboardEvent) => {
      // Don't capture when focusing input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return

      const currentIndex = entries.findIndex((e) => e.id === selectedEntry.id)

      switch (e.key) {
        case "j":
        case "ArrowDown":
          if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            // Next entry (only j without modifier)
            if (e.key === "j" && currentIndex < entries.length - 1) {
              e.preventDefault()
              selectEntry(entries[currentIndex + 1])
            }
          }
          break
        case "k":
        case "ArrowUp":
          if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            if (e.key === "k" && currentIndex > 0) {
              e.preventDefault()
              selectEntry(entries[currentIndex - 1])
            }
          }
          break
        case "s":
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            toggleStar(selectedEntry.id)
          }
          break
        case "o":
          if (!e.ctrlKey && !e.metaKey && selectedEntry.url) {
            e.preventDefault()
            window.open(selectedEntry.url, "_blank")
          }
          break
        case "Escape":
          setPanelOpen(false)
          break
      }
    }

    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [selectedEntry, entries, selectEntry, toggleStar, setPanelOpen])

  // Content paragraphs (memoized)
  const paragraphs = useMemo(() => {
    if (!selectedEntry?.content) return []
    return splitIntoParagraphs(selectedEntry.content)
  }, [selectedEntry?.content])

  const handleSummarize = useCallback(async () => {
    if (!selectedEntry?.content) return
    setIsSummarizing(true)
    setSummary(null)
    const result = await window.api.ai.summarize(
      selectedEntry.content,
      settings.general.language
    )
    setIsSummarizing(false)
    if (result.success) {
      setSummary(result.summary)
    } else {
      setSummary(`${t("common.error")}: ${result.error}`)
    }
  }, [selectedEntry?.content, selectedEntry?.id, settings.general.language])

  const handleTranslate = useCallback(async () => {
    if (!selectedEntry?.content) return

    // Toggle off
    if (showTranslation && translatedParagraphs.length > 0) {
      setShowTranslation(false)
      return
    }
    // Toggle on if already translated
    if (translatedParagraphs.length > 0) {
      setShowTranslation(true)
      return
    }

    // Do translation paragraph by paragraph
    setIsTranslating(true)
    setShowTranslation(true)
    const targetLang = settings.translation.targetLanguage || "zh-CN"
    const results: string[] = []

    for (let i = 0; i < paragraphs.length; i++) {
      const plainText = paragraphs[i].replace(/<[^>]*>/g, "").trim()
      if (!plainText || plainText.length < 5) {
        results.push("") // skip very short/empty blocks
        continue
      }
      try {
        const result = await window.api.ai.translate(paragraphs[i], targetLang)
        if (result.success) {
          results.push(result.translation)
        } else {
          results.push(`<span class="text-red-400 text-xs">${t("entry.translateFailed")}</span>`)
        }
      } catch {
        results.push(`<span class="text-red-400 text-xs">${t("entry.translateFailed")}</span>`)
      }
      // Update progressively
      setTranslatedParagraphs([...results])
    }

    setIsTranslating(false)
  }, [selectedEntry?.content, selectedEntry?.id, showTranslation, translatedParagraphs.length, paragraphs, settings.translation.targetLanguage])

  const handleCopyLink = useCallback(async () => {
    if (!selectedEntry?.url) return
    await navigator.clipboard.writeText(selectedEntry.url)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }, [selectedEntry?.url])

  const handleOpenAIChat = useCallback(() => {
    setPanelOpen(true)
  }, [setPanelOpen])

  const handleReadability = useCallback(async () => {
    if (!selectedEntry?.url) return
    window.open(selectedEntry.url, "_blank")
  }, [selectedEntry?.url])

  const handleSelectCurrentArticle = useCallback(() => {
    const el = contentRef.current
    if (!el) return
    const selection = window.getSelection()
    if (!selection) return
    selection.removeAllRanges()
    const range = document.createRange()
    range.selectNodeContents(el)
    selection.addRange(range)
  }, [])

  const articleMenuActions = useMemo<ContextMenuAction[]>(() => {
    if (!selectedEntry) return []
    return [
      {
        id: "select-all",
        label: t("contextMenu.selectAll", { defaultValue: "全选" }),
        icon: <CheckSquare size={14} />,
        onClick: handleSelectCurrentArticle,
      },
      {
        id: "ai-translate",
        label: t("entry.translate", { defaultValue: "AI 翻译" }),
        icon: <Languages size={14} />,
        onClick: () => { void handleTranslate() },
        disabled: !selectedEntry.content,
      },
      {
        id: "ai-summary",
        label: t("entry.summarize", { defaultValue: "AI 摘要" }),
        icon: <Sparkles size={14} />,
        onClick: () => { void handleSummarize() },
        disabled: !selectedEntry.content,
      },
      {
        id: "fetch-original",
        label: t("entry.readability", { defaultValue: "获取原文" }),
        icon: <BookType size={14} />,
        onClick: () => { void handleReadability() },
        disabled: isFetchingReadable || !selectedEntry.url,
        separator: true,
      },
      {
        id: "toggle-star",
        label: selectedEntry.isStarred
          ? t("entry.unstar", { defaultValue: "取消收藏" })
          : t("entry.star", { defaultValue: "收藏" }),
        icon: <Star size={14} className={selectedEntry.isStarred ? "text-yellow-500 fill-yellow-500" : ""} />,
        onClick: () => { void toggleStar(selectedEntry.id) },
      },
    ]
  }, [
    selectedEntry,
    t,
    handleSelectCurrentArticle,
    handleTranslate,
    handleSummarize,
    handleReadability,
    isFetchingReadable,
    toggleStar,
  ])

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  // Audio media detection
  const audioMedia = useMemo(() => {
    if (!selectedEntry) return null
    const audio = selectedEntry.media?.find((m) => m.type === "audio")
    if (audio) return audio
    return null
  }, [selectedEntry])

  // Video media detection — check URL and media attachments (like Folo-dev)
  const videoMedia = useMemo(() => {
    if (!selectedEntry) return null
    // Check if entry URL itself is a video platform link
    if (selectedEntry.url && transformVideoUrl(selectedEntry.url)) {
      return { url: selectedEntry.url, type: "video" as const }
    }
    // Check media attachments
    const video = selectedEntry.media?.find((m) => m.type === "video")
    if (video) return video
    return null
  }, [selectedEntry])

  // Memoize sanitized HTML so scroll-triggered re-renders don't recreate DOM
  // (which would destroy playing <video> and <iframe> elements)
  const sanitizedContent = useMemo(() => {
    if (!selectedEntry?.content) return ""
    const imageKeys = [
      selectedEntry.imageUrl || "",
      ...(selectedEntry.media || [])
        .filter((m) => m.type === "photo")
        .flatMap((m) => [m.url || "", m.previewUrl || ""]),
    ].filter(Boolean)

    const dedupedHtml = stripDuplicateMediaFromHtml(selectedEntry.content, {
      duplicateImageKeys: !videoMedia ? imageKeys : [],
      removeEmbeddedVideos: !!videoMedia,
    })

    return sanitizeHTML(dedupedHtml)
  }, [selectedEntry?.content, selectedEntry?.imageUrl, selectedEntry?.media, videoMedia])

  const sanitizedReadable = useMemo(() => {
    if (!readableContent) return ""
    return sanitizeHTML(readableContent)
  }, [readableContent])

  const currentFeed = useMemo(
    () => selectedEntry ? feeds.find((f) => f.id === selectedEntry.feedId) : null,
    [selectedEntry, feeds]
  )
  const authorAvatarUrl = selectedEntry?.authorAvatar || currentFeed?.imageUrl || ""

  const handlePlayAudio = useCallback(() => {
    if (!audioMedia || !selectedEntry) return
    playerPlay({
      url: audioMedia.url,
      title: selectedEntry.title,
      artist: currentFeed?.title,
      cover: selectedEntry.imageUrl || currentFeed?.imageUrl,
    })
  }, [audioMedia, selectedEntry, currentFeed, playerPlay])

  // Navigate to next/prev entry
  const currentIndex = selectedEntry
    ? entries.findIndex((e) => e.id === selectedEntry.id)
    : -1
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < entries.length - 1

  const goToEntry = useCallback(
    (dir: "prev" | "next") => {
      if (dir === "prev" && hasPrev) selectEntry(entries[currentIndex - 1])
      if (dir === "next" && hasNext) selectEntry(entries[currentIndex + 1])
    },
    [currentIndex, entries, hasPrev, hasNext, selectEntry]
  )

  // Empty state
  if (!selectedEntry) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-secondary dark:bg-surface-dark">
        <div className="text-center text-text-secondary dark:text-text-dark-secondary">
          <BookOpen size={48} className="mx-auto mb-4 text-text-tertiary" strokeWidth={1.5} />
          <p className="text-lg font-medium">{t("entry.selectArticle")}</p>
          <p className="text-sm mt-1 text-text-tertiary">{t("entry.selectArticleHint")}</p>
          <div className="mt-6 text-xs text-text-tertiary space-y-1">
            <p><kbd className="px-1.5 py-0.5 rounded bg-surface-tertiary dark:bg-surface-dark-tertiary text-[10px]">J</kbd> / <kbd className="px-1.5 py-0.5 rounded bg-surface-tertiary dark:bg-surface-dark-tertiary text-[10px]">K</kbd> {t("entry.navUpDown")}</p>
            <p><kbd className="px-1.5 py-0.5 rounded bg-surface-tertiary dark:bg-surface-dark-tertiary text-[10px]">S</kbd> {t("entry.starHint")}  <kbd className="px-1.5 py-0.5 rounded bg-surface-tertiary dark:bg-surface-dark-tertiary text-[10px]">O</kbd> {t("entry.browserOpenHint")}</p>
          </div>
        </div>
      </div>
    )
  }

  const timeAgo = formatDistanceToNow(new Date(selectedEntry.publishedAt), {
    addSuffix: true,
    locale: getDateLocale(),
  })
  const fullDate = format(new Date(selectedEntry.publishedAt), t("entry.dateFormat"), {
    locale: getDateLocale(),
  })
  const readingTime = selectedEntry.content
    ? estimateReadingTime(selectedEntry.content)
    : 0

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-surface-dark relative">
      {/* Reading progress bar */}
      <div className="absolute top-0 left-0 right-0 h-[2px] z-20">
        <div
          className="h-full bg-accent transition-all duration-150 ease-out"
          style={{ width: `${readPercent}%` }}
        />
      </div>

      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center gap-0.5 px-3 py-1.5 border-b bg-white/80 dark:bg-surface-dark/80 backdrop-blur-sm sticky top-0 z-10">
        <ToolbarButton
          onClick={() => toggleStar(selectedEntry.id)}
          title={selectedEntry.isStarred ? t("entry.unstar") : t("entry.star")}
          active={selectedEntry.isStarred}
        >
          <Star
            size={16}
            className={selectedEntry.isStarred ? "text-yellow-500 fill-yellow-500" : ""}
          />
        </ToolbarButton>

        <ToolbarButton
          onClick={handleSummarize}
          disabled={isSummarizing || !settings.ai.apiKey}
          title={settings.ai.apiKey ? t("entry.summarize") : t("entry.configureAIKey")}
        >
          {isSummarizing ? (
            <Loader2 size={16} className="animate-spin text-accent" />
          ) : (
            <Sparkles size={16} />
          )}
        </ToolbarButton>

        <ToolbarButton
          onClick={handleTranslate}
          disabled={isTranslating || !settings.ai.apiKey}
          active={showTranslation}
          title={settings.ai.apiKey ? t("entry.translate") : t("entry.configureAIKey")}
        >
          {isTranslating ? (
            <Loader2 size={16} className="animate-spin text-accent" />
          ) : (
            <Languages size={16} />
          )}
        </ToolbarButton>

        <ToolbarButton
          onClick={handleOpenAIChat}
          disabled={!settings.ai.apiKey}
          title="AI Chat"
        >
          <MessageSquare size={16} />
        </ToolbarButton>

        <ToolbarButton
          onClick={handleReadability}
          disabled={isFetchingReadable || !selectedEntry.url}
          active={isReadabilityMode}
          title={isReadabilityMode ? t("entry.readabilityBack") : t("entry.readability")}
        >
          {isFetchingReadable ? (
            <Loader2 size={16} className="animate-spin text-accent" />
          ) : (
            <BookType size={16} />
          )}
        </ToolbarButton>

        {audioMedia && (
          <ToolbarButton onClick={handlePlayAudio} title={t("entry.playAudio")}>
            <Play size={16} className="text-purple-500" />
          </ToolbarButton>
        )}

        <ToolbarButton onClick={handleCopyLink} title={t("entry.copyLink")}>
          {linkCopied ? (
            <Check size={16} className="text-green-500" />
          ) : (
            <Copy size={16} />
          )}
        </ToolbarButton>

        {/* Separator */}
        <div className="w-px h-4 bg-border dark:bg-border-dark mx-1" />

        {/* Nav buttons */}
        <ToolbarButton onClick={() => goToEntry("prev")} disabled={!hasPrev} title={t("entry.prevArticleShortcut")}>
          <ChevronUp size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => goToEntry("next")} disabled={!hasNext} title={t("entry.nextArticleShortcut")}>
          <ChevronDown size={16} />
        </ToolbarButton>

        <div className="flex-1" />

        {/* Read progress */}
        {readPercent > 0 && (
          <button
            onClick={scrollToTop}
            className="flex items-center gap-1 text-[11px] text-text-tertiary hover:text-accent transition-colors px-1.5 py-0.5 rounded"
            title={t("entry.scrollToTop")}
          >
            <ReadProgressCircle percent={readPercent} />
            <span>{readPercent}%</span>
          </button>
        )}

        {selectedEntry.url && (
          <ToolbarButton
            onClick={() => window.open(selectedEntry.url, "_blank")}
            title={t("entry.openInBrowser")}
          >
            <ExternalLink size={16} />
          </ToolbarButton>
        )}

        {/* Read status */}
        <div className="flex items-center gap-1 text-xs text-text-tertiary ml-1">
          {selectedEntry.isRead ? (
            <CheckCircle2 size={14} className="text-green-500" />
          ) : (
            <Circle size={14} />
          )}
        </div>
      </div>

      {/* Content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scroll-smooth"
        onContextMenu={(e) => {
          const selectedText = window.getSelection?.()?.toString().trim() || ""
          // If text is selected, let text context menu handle copy actions.
          if (selectedText) return
          e.preventDefault()
          e.stopPropagation()
          setArticleMenu({ visible: true, x: e.clientX, y: e.clientY })
        }}
      >
        <article
          ref={contentRef}
          data-context-select-scope="article"
          className={`${contentWidthClass} mx-auto px-8 py-6 mb-32 transition-all duration-300 ${
            isTransitioning ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
          }`}
          style={{
            lineHeight: settings.general.contentLineHeight,
            fontFamily: settings.general.contentFontFamily,
            ...contentWidthStyle,
          }}
        >
          {/* Title */}
          <h1 className="text-[1.7rem] font-bold leading-normal mb-4">{selectedEntry.title}</h1>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-text-secondary dark:text-text-dark-secondary mb-8">
            {selectedEntry.author && (
              <span className="flex items-center gap-1">
                {authorAvatarUrl ? (
                  <img
                    src={authorAvatarUrl}
                    alt=""
                    className="w-4 h-4 rounded-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).style.display = "none"
                    }}
                  />
                ) : (
                  <User size={12} className="text-text-tertiary" />
                )}
                {selectedEntry.author}
              </span>
            )}
            <span className="flex items-center gap-1" title={fullDate}>
              <Calendar size={12} className="text-text-tertiary" />
              {timeAgo}
            </span>
            {readingTime > 0 && (
              <span className="flex items-center gap-1">
                <Clock size={12} className="text-text-tertiary" />
                {t("entry.readingTime", { minutes: readingTime })}
              </span>
            )}
          </div>

          {/* AI Summary */}
          {(isSummarizing || summary) && (
            <div className="mb-8 p-4 rounded-xl bg-gradient-to-br from-accent/5 to-accent/10 border border-accent/15 transition-all duration-300 animate-in fade-in-0 slide-in-from-top-2">
              <div className="flex items-center gap-2 text-sm font-medium text-accent mb-2">
                <Sparkles size={16} />
                {t("entry.aiSummaryTitle")}
              </div>
              {isSummarizing ? (
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <Loader2 size={14} className="animate-spin" />
                  {t("entry.generatingSummary")}
                </div>
              ) : (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{summary}</p>
              )}
            </div>
          )}

          {readabilityError && !isReadabilityMode && (
            <div className="mb-6 rounded-lg border border-amber-300/40 bg-amber-50/60 dark:bg-amber-900/15 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              {readabilityError}
            </div>
          )}

          {/* Featured image */}
          {selectedEntry.imageUrl && !videoMedia && (
            <div className="mb-8 -mx-2 overflow-hidden rounded-xl">
              <img
                src={selectedEntry.imageUrl}
                alt=""
                className="w-full object-cover max-h-[400px] transition-transform duration-500 hover:scale-[1.02]"
                loading="lazy"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = "none"
                }}
              />
            </div>
          )}

          {/* Video player — prioritized like Folo-dev MediaLayout */}
          {videoMedia && (
            <div className="mb-8 -mx-2">
              <VideoPlayer
                url={videoMedia.url}
                poster={selectedEntry.imageUrl}
                title={selectedEntry.title}
              />
            </div>
          )}

          {/* Article content — readability / bilingual / plain */}
          {isReadabilityMode && readableContent ? (
            <div>
              <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs">
                <BookType size={14} />
                <span>{t("entry.readabilityMode")}</span>
                <button
                  onClick={() => setIsReadabilityMode(false)}
                  className="ml-auto hover:underline"
                >
                  {t("entry.readabilityBack2")}
                </button>
              </div>
              <div
                className="entry-content"
                style={{ fontSize: `${settings.general.fontSize}px` }}
                dangerouslySetInnerHTML={{ __html: sanitizedReadable }}
              />
            </div>
          ) : selectedEntry.content ? (
            showTranslation ? (
              <BilingualContent
                paragraphs={paragraphs}
                translations={translatedParagraphs}
                isTranslating={isTranslating}
                fontSize={settings.general.fontSize}
                lineHeight={settings.general.contentLineHeight}
                fontFamily={settings.general.contentFontFamily}
              />
            ) : (
              <div
                className="entry-content"
                style={{ fontSize: `${settings.general.fontSize}px` }}
                dangerouslySetInnerHTML={{ __html: sanitizedContent }}
              />
            )
          ) : (
            <div className="text-text-secondary dark:text-text-dark-secondary text-center py-12">
              {isFetchingReadable ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={24} className="animate-spin text-accent" />
                  <p className="text-sm">{t("entry.fetchingContent")}</p>
                </div>
              ) : (
                <>
                  <p>{t("entry.noContent")}</p>
                  {selectedEntry.url && (
                    <div className="mt-3 space-y-2">
                      <button
                        onClick={handleReadability}
                        className="text-accent hover:underline text-sm inline-flex items-center gap-1"
                      >
                        <BookType size={14} />
                        {t("entry.tryFetchContent")}
                      </button>
                      <br />
                      <a
                        href={selectedEntry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline text-sm inline-block"
                        onClick={(e) => {
                          e.preventDefault()
                          window.open(selectedEntry.url, "_blank")
                        }}
                      >
                        {t("entry.readInBrowser")}
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* End of article — navigate */}
          <div className="mt-16 pt-8 border-t flex items-center justify-between text-sm text-text-secondary dark:text-text-dark-secondary">
            <button
              disabled={!hasPrev}
              onClick={() => goToEntry("prev")}
              className="flex items-center gap-1 hover:text-accent transition-colors disabled:opacity-30 disabled:cursor-default"
            >
              <ChevronUp size={16} />
              {t("entry.prevArticle")}
            </button>
            <span className="text-xs text-text-tertiary">
              {currentIndex + 1} / {entries.length}
            </span>
            <button
              disabled={!hasNext}
              onClick={() => goToEntry("next")}
              className="flex items-center gap-1 hover:text-accent transition-colors disabled:opacity-30 disabled:cursor-default"
            >
              {t("entry.nextArticle")}
              <ChevronDown size={16} />
            </button>
          </div>
        </article>
      </div>

      {/* External link warning modal */}
      {externalLinkWarning && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-surface-dark-secondary rounded-xl shadow-2xl p-5 mx-4 max-w-sm w-full animate-in">
            <div className="flex items-center gap-2 text-amber-500 mb-3">
              <AlertTriangle size={20} />
              <h3 className="font-semibold">{t("entry.externalLinkWarning")}</h3>
              <button onClick={() => setExternalLinkWarning(null)} className="ml-auto p-1 rounded hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary">
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-text-secondary dark:text-text-dark-secondary mb-1">
              {t("entry.externalLinkDesc")}
            </p>
            <p className="text-xs font-mono bg-surface-secondary dark:bg-surface-dark-tertiary rounded px-2 py-1.5 mb-3 break-all text-red-500">
              {externalLinkWarning.hostname}
            </p>
            {externalLinkWarning.isSuspicious && (
              <p className="text-xs text-red-500 mb-3 flex items-center gap-1">
                <AlertTriangle size={12} />
                {t("entry.suspiciousLink")}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setExternalLinkWarning(null)}
                className="flex-1 px-3 py-2 text-sm rounded-lg border hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={() => {
                  window.open(externalLinkWarning.url, "_blank")
                  setExternalLinkWarning(null)
                }}
                className="flex-1 px-3 py-2 text-sm rounded-lg bg-accent text-white hover:bg-accent/90"
              >
                {t("common.continueAccess")}
              </button>
            </div>
          </div>
        </div>
      )}

      {articleMenu.visible && (
        <ContextMenu
          x={articleMenu.x}
          y={articleMenu.y}
          onClose={() => setArticleMenu({ visible: false, x: 0, y: 0 })}
          actions={articleMenuActions}
        />
      )}
    </div>
  )
}

/** ====== Bilingual content component ====== */
function BilingualContent({
  paragraphs,
  translations,
  isTranslating,
  fontSize,
  lineHeight,
  fontFamily,
}: {
  paragraphs: string[]
  translations: string[]
  isTranslating: boolean
  fontSize: number
  lineHeight: number
  fontFamily: string
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-0" style={{ fontSize: `${fontSize}px`, lineHeight, fontFamily }}>
      {paragraphs.map((para, i) => {
        const translated = translations[i]
        const isLoading = isTranslating && i === translations.length
        const plainText = para.replace(/<[^>]*>/g, "").trim()
        if (!plainText) return null

        return (
          <div
            key={i}
            className="group border-l-2 border-transparent hover:border-accent/30 transition-colors pl-0 hover:pl-3"
          >
            {/* Original */}
            <div
              className="entry-content !mb-0"
              dangerouslySetInnerHTML={{ __html: para }}
            />

            {/* Translation */}
            {translated ? (
              <div className="relative mt-1 mb-4">
                <div className="flex items-start gap-2">
                  <Languages size={12} className="text-accent/50 mt-1 flex-shrink-0" />
                  <div
                    className="entry-content !mb-0 text-accent/80 dark:text-orange-300/80"
                    style={{ fontSize: `${fontSize - 1}px` }}
                    dangerouslySetInnerHTML={{ __html: translated }}
                  />
                </div>
              </div>
            ) : isLoading ? (
              <div className="flex items-center gap-2 mt-1 mb-4 text-xs text-text-tertiary">
                <Loader2 size={12} className="animate-spin" />
                {t("entry.translating")}
              </div>
            ) : (
              <div className="mb-4" />
            )}
          </div>
        )
      })}
    </div>
  )
}

/** ====== Toolbar button component ====== */
function ToolbarButton({
  children,
  onClick,
  disabled,
  active,
  title,
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-1.5 rounded-lg transition-all duration-150 text-text-secondary dark:text-text-dark-secondary
        hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary hover:text-text dark:hover:text-text-dark-primary
        disabled:opacity-30 disabled:cursor-default
        ${active ? "bg-accent/10 !text-accent" : ""}
      `}
      title={title}
    >
      {children}
    </button>
  )
}

/** ====== Reading progress circle SVG ====== */
function ReadProgressCircle({ percent }: { percent: number }) {
  const r = 5
  const c = 2 * Math.PI * r
  const offset = c - (percent / 100) * c

  return (
    <svg width="14" height="14" viewBox="0 0 14 14" className="rotate-[-90deg]">
      <circle cx="7" cy="7" r={r} fill="none" stroke="currentColor" strokeWidth="1.5" opacity={0.15} />
      <circle
        cx="7"
        cy="7"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="text-accent transition-all duration-300"
      />
    </svg>
  )
}
