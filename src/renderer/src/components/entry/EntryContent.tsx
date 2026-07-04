import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useEntryStore } from '../../store/entry-store'
import { useFeedStore } from '../../store/feed-store'
import {
  useAISettingKey,
  useGeneralSettingsShallowSelector,
  useTranslationSettingKey,
  useSettingsActions,
} from '../../store/settings-store'
import { useAIChatStore } from '../../store/ai-chat-store'
import { useStoreShallow } from '../../store/helpers'
import { useRegisterCommand } from '../../hooks/useRegisterCommand'
import { useEntryScrollNavigation } from '../../hooks/useEntryScrollNavigation'
import { usePlayerStore } from '../media/MediaPlayer'
import { VideoPlayer } from '../media/MediaPlayer'
import {
  sanitizeHTML,
  isExternalUrl,
  createExternalLinkWarning,
} from '../../utils/sanitize'
import {
  Star,
  ExternalLink,
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
  Play,
  X,
  CheckSquare,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { getDateLocale } from '../../lib/date-locale'
import { ContextMenu, type ContextMenuAction } from '../ui/ContextMenu'
import {
  FeedViewType,
  type EntryTaskSnapshot,
  type EntryTaskState,
} from '../../../../shared/types'
import { HOTKEY_OVERLAY_SCOPES } from '../../lib/hotkey-scope'
import { splitHtmlIntoParagraphs } from '../../lib/entry-text'
import { resolvePreferredEntryVideo } from '../../lib/entry-video-source'
import { resolveEntryBrowserOpenUrl } from '../../lib/social-entry-utils'
import { ROUTES } from '../../router/route-paths'
import { Maximize2 } from 'lucide-react'
import { useAISummary } from '../../hooks/useAISummary'
import { useAITranslation } from '../../hooks/useAITranslation'
import { AISummaryPanel } from './AISummaryPanel'
import { EntryAIToolbar } from './EntryAIToolbar'
import { InlineTaskStatus } from './InlineTaskStatus'
import { AudioPlaybackPanel } from './entry-content/AudioPlaybackPanel'
import { EntryArticleHeader } from './entry-content/EntryArticleHeader'
import { EntryBodyContent } from './entry-content/EntryBodyContent'
import { EntryEmptyState } from './entry-content/EntryEmptyState'
import { EntryEndNavigation } from './entry-content/EntryEndNavigation'
import { EntryFeaturedImage } from './entry-content/EntryFeaturedImage'
import {
  ExternalLinkWarningModal,
  type ExternalLinkWarningState,
} from './entry-content/ExternalLinkWarningModal'
import { ToolbarButton } from './entry-content/ToolbarButton'
import {
  estimateReadingTime,
  htmlContainsImage,
  isAudioOnlyContentFallback,
  stripDuplicateMediaFromHtml,
} from './entry-content/entry-content-utils'

export function EntryContent({ hideVideo }: { hideVideo?: boolean }) {
  const {
    selectedEntry,
    isSelectedEntryHydrating,
    toggleStar,
    markRead,
    saveProgress,
    entries,
    selectEntry,
    prefetchEntryDetails,
  } = useStoreShallow(useEntryStore, (s) => ({
    selectedEntry: s.selectedEntry,
    isSelectedEntryHydrating: s.isSelectedEntryHydrating,
    toggleStar: s.toggleStar,
    markRead: s.markRead,
    saveProgress: s.saveProgress,
    entries: s.entries,
    selectEntry: s.selectEntry,
    prefetchEntryDetails: s.prefetchEntryDetails,
  }))
  const feeds = useFeedStore((s) => s.feeds)
  const general = useGeneralSettingsShallowSelector((settings) => ({
    contentWidth: settings.contentWidth,
    contentMaxWidth: settings.contentMaxWidth,
    contentLineHeight: settings.contentLineHeight,
    contentFontFamily: settings.contentFontFamily,
    fontSize: settings.fontSize,
    language: settings.language,
  }))
  const translationTargetLanguage = useTranslationSettingKey('targetLanguage')
  const aiApiKey = useAISettingKey('apiKey')
  const { setPanelOpen } = useAIChatStore()
  const {
    updateSettingsSection,
    setOpen: setSettingsOpen,
    setActiveTab: setSettingsActiveTab,
  } = useSettingsActions()
  const playerPlay = usePlayerStore((s) => s.play)
  const { t } = useTranslation()
  const navigate = useNavigate()

  // Content width mapping — supports custom px value
  const contentWidthClasses = useMemo(
    () => ({
      narrow: 'max-w-[500px]',
      normal: 'max-w-[680px]',
      wide: 'max-w-[900px]',
      custom: '', // handled via inline style
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

  // AI summary & translation — self-contained hooks, reset on entry change via reset()
  const {
    summary,
    error,
    isLoading: isSummarizing,
    summarize,
    reset: resetSummary,
  } = useAISummary({
    entryId: selectedEntry?.id,
    initialSummary: selectedEntry?.aiSummary ?? null,
  })
  const {
    translatedParagraphs,
    isTranslating,
    showTranslation,
    errorMap,
    translate,
    retrySegment,
    toggle: toggleTranslation,
    reset: resetTranslation,
  } = useAITranslation({ entryId: selectedEntry?.id })

  // Per-entry state — keyed by entry ID, reset on switch
  const [linkCopied, setLinkCopied] = useState(false)
  const [readableContent, setReadableContent] = useState<string | null>(null)
  const [isReadabilityMode, setIsReadabilityMode] = useState(false)
  const [isFetchingReadable, setIsFetchingReadable] = useState(false)
  const [readabilityError, setReadabilityError] = useState<string | null>(null)
  const [embeddedPageUrl, setEmbeddedPageUrl] = useState<string | null>(null)
  const [externalLinkWarning, setExternalLinkWarning] =
    useState<ExternalLinkWarningState | null>(null)
  const [articleMenu, setArticleMenu] = useState<{
    visible: boolean
    x: number
    y: number
  }>({
    visible: false,
    x: 0,
    y: 0,
  })

  // Reading progress
  const [readPercent, setReadPercent] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Star animation key — incremented to re-trigger CSS animation
  const [starAnimKey, setStarAnimKey] = useState(0)

  // Content transition
  const [isTransitioning, setIsTransitioning] = useState(false)
  const prevEntryIdRef = useRef<string | null>(null)
  const saveProgressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )

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
      resetSummary()
      resetTranslation()
      setLinkCopied(false)
      setReadableContent(selectedEntry?.readabilityContent || null)
      setIsReadabilityMode(false)
      setIsFetchingReadable(false)
      setReadabilityError(null)
      setEmbeddedPageUrl(null)

      // Restore saved reading progress or reset to top
      const savedProgress = selectedEntry?.readProgress
      if (savedProgress && savedProgress > 0) {
        setReadPercent(savedProgress)
        // Restore scroll position after content renders
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const el = scrollRef.current
            if (el) {
              const max = el.scrollHeight - el.clientHeight
              el.scrollTo({
                top: (savedProgress / 100) * max,
                behavior: 'instant' as ScrollBehavior,
              })
            }
          })
        })
      } else {
        setReadPercent(0)
        scrollRef.current?.scrollTo({ top: 0 })
      }
    }
  }, [selectedEntry, resetSummary, resetTranslation])

  // Reading progress tracking with debounced persistence
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      const max = scrollHeight - clientHeight
      const pct = max > 0 ? Math.round((scrollTop / max) * 100) : 0
      setReadPercent(pct)

      // Debounce persistence to avoid excessive writes
      if (saveProgressTimerRef.current) {
        clearTimeout(saveProgressTimerRef.current)
      }
      saveProgressTimerRef.current = setTimeout(() => {
        if (selectedEntry?.id && pct > 0) {
          saveProgress(selectedEntry.id, pct)
        }
      }, 800)
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', handleScroll)
      if (saveProgressTimerRef.current) {
        clearTimeout(saveProgressTimerRef.current)
        saveProgressTimerRef.current = null
      }
    }
  }, [selectedEntry, saveProgress])

  // Intercept external link clicks with warning
  useEffect(() => {
    const container = contentRef.current
    if (!container) return

    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest(
        'a[href]',
      ) as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href) return
      if (isExternalUrl(href)) {
        e.preventDefault()
        e.stopPropagation()
        const info = createExternalLinkWarning(href)
        if (info.isSuspicious) {
          setExternalLinkWarning(info)
        } else {
          window.open(href, '_blank')
        }
      }
    }

    container.addEventListener('click', handleClick)
    return () => container.removeEventListener('click', handleClick)
  }, [selectedEntry])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setPanelOpen(false)
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [setPanelOpen])

  const articleContent = useMemo(() => {
    if (!selectedEntry?.content) return ''
    if (
      isAudioOnlyContentFallback(selectedEntry.content, selectedEntry.media)
    ) {
      return ''
    }
    return selectedEntry.content
  }, [selectedEntry?.content, selectedEntry?.media])

  // Content paragraphs (memoized)
  const paragraphs = useMemo(() => {
    if (!articleContent) return []
    return splitHtmlIntoParagraphs(articleContent)
  }, [articleContent])

  const handleSummarize = useCallback(() => {
    if (!articleContent) return
    void summarize(articleContent, general.language)
  }, [articleContent, general.language, summarize])

  const handleTranslate = useCallback(() => {
    if (!articleContent) return
    const hasTranslatedContent = translatedParagraphs.some(
      (paragraph) => paragraph.length > 0,
    )
    // Toggle off if currently showing
    if (showTranslation && hasTranslatedContent) {
      toggleTranslation()
      return
    }
    // Toggle on if already translated (cached)
    if (hasTranslatedContent) {
      toggleTranslation()
      return
    }
    // Start fresh translation
    const targetLang = translationTargetLanguage || 'zh-CN'
    void translate(paragraphs, targetLang)
  }, [
    articleContent,
    paragraphs,
    translationTargetLanguage,
    translate,
    showTranslation,
    translatedParagraphs,
    toggleTranslation,
  ])

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

    // If already in readability mode, toggle back to original RSS content
    if (isReadabilityMode) {
      setIsReadabilityMode(false)
      return
    }

    // If we already have cached readable content, just switch to it
    if (readableContent) {
      setIsReadabilityMode(true)
      return
    }

    // Fetch readability content via IPC
    setIsFetchingReadable(true)
    setReadabilityError(null)
    try {
      const result = await window.api.readability.fetch(
        selectedEntry.url,
        selectedEntry.id,
      )
      if (result.success && result.content) {
        setReadableContent(result.content)
        setIsReadabilityMode(true)
      } else {
        setReadabilityError(result.error || t('entry.cannotFetchContent'))
      }
    } catch (err) {
      setReadabilityError(t('entry.fetchFailed', { error: String(err) }))
    } finally {
      setIsFetchingReadable(false)
    }
  }, [
    selectedEntry?.id,
    selectedEntry?.url,
    isReadabilityMode,
    readableContent,
    t,
  ])

  const handleOpenAISettings = useCallback(() => {
    setSettingsActiveTab('ai')
    setSettingsOpen(true)
  }, [setSettingsActiveTab, setSettingsOpen])

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
        id: 'select-all',
        label: t('contextMenu.selectAll', { defaultValue: '全选' }),
        icon: <CheckSquare size={14} />,
        onClick: handleSelectCurrentArticle,
      },
      {
        id: 'ai-translate',
        label: t('entry.translate', { defaultValue: 'AI 翻译' }),
        icon: <Languages size={14} />,
        onClick: () => {
          void handleTranslate()
        },
        disabled: !articleContent,
      },
      {
        id: 'ai-summary',
        label: t('entry.summarize', { defaultValue: 'AI 摘要' }),
        icon: <Sparkles size={14} />,
        onClick: () => {
          void handleSummarize()
        },
        disabled: !articleContent,
      },
      {
        id: 'fetch-original',
        label: isReadabilityMode
          ? t('entry.readabilityBack', { defaultValue: '返回原始内容' })
          : t('entry.readability', { defaultValue: '获取原文' }),
        icon: <BookType size={14} />,
        onClick: () => {
          void handleReadability()
        },
        disabled: isFetchingReadable || !selectedEntry.url,
        separator: true,
      },
      {
        id: 'toggle-star',
        label: selectedEntry.isStarred
          ? t('entry.unstar', { defaultValue: '取消收藏' })
          : t('entry.star', { defaultValue: '收藏' }),
        icon: (
          <Star
            size={14}
            className={
              selectedEntry.isStarred ? 'fill-yellow-500 text-yellow-500' : ''
            }
          />
        ),
        onClick: () => {
          void toggleStar(selectedEntry.id)
        },
      },
    ]
  }, [
    selectedEntry,
    articleContent,
    t,
    handleSelectCurrentArticle,
    handleTranslate,
    handleSummarize,
    handleReadability,
    isFetchingReadable,
    isReadabilityMode,
    toggleStar,
  ])

  // Audio media detection
  const audioMedia = useMemo(() => {
    if (!selectedEntry) return null
    const audio = selectedEntry.media?.find((m) => m.type === 'audio')
    if (audio) return audio
    return null
  }, [selectedEntry])

  // Video media detection — check URL and media attachments (like Folo-dev)
  const videoMedia = useMemo(() => {
    if (!selectedEntry) return null
    return resolvePreferredEntryVideo(selectedEntry)
  }, [selectedEntry])

  const currentFeed = useMemo(
    () =>
      selectedEntry ? feeds.find((f) => f.id === selectedEntry.feedId) : null,
    [selectedEntry, feeds],
  )
  const authorAvatarUrl =
    selectedEntry?.authorAvatar || currentFeed?.imageUrl || ''
  const shouldShowFeaturedImage = useMemo(() => {
    if (!selectedEntry?.imageUrl || videoMedia) return false
    if ((currentFeed?.view ?? FeedViewType.Articles) !== FeedViewType.Articles)
      return true
    return !htmlContainsImage(
      selectedEntry.content || '',
      selectedEntry.imageUrl,
    )
  }, [
    currentFeed?.view,
    selectedEntry?.content,
    selectedEntry?.imageUrl,
    videoMedia,
  ])

  // Memoize sanitized HTML so scroll-triggered re-renders don't recreate DOM
  // (which would destroy playing <video> and <iframe> elements)
  const sanitizedContent = useMemo(() => {
    if (!articleContent || !selectedEntry) return ''
    const imageKeys = [
      selectedEntry.imageUrl || '',
      ...(selectedEntry.media || [])
        .filter(
          (m) =>
            m.type === 'photo' || (videoMedia ? m.type === 'video' : false),
        )
        .flatMap((m) => [m.url || '', m.previewUrl || '']),
    ].filter(Boolean)

    const dedupedHtml = stripDuplicateMediaFromHtml(articleContent, {
      duplicateImageKeys:
        videoMedia || currentFeed?.view !== FeedViewType.Articles
          ? imageKeys
          : [],
      removeEmbeddedVideos: !!videoMedia,
    })

    return sanitizeHTML(dedupedHtml)
  }, [articleContent, currentFeed?.view, selectedEntry, videoMedia])

  const sanitizedReadable = useMemo(() => {
    if (!readableContent) return ''
    return sanitizeHTML(readableContent)
  }, [readableContent])

  const handlePlayAudio = useCallback(() => {
    if (!audioMedia || !selectedEntry) return
    playerPlay({
      url: audioMedia.url,
      title: selectedEntry.title,
      artist: currentFeed?.title,
      cover: selectedEntry.imageUrl || currentFeed?.imageUrl,
      entryId: selectedEntry.id,
      listenProgress: selectedEntry.listenProgress,
    })
  }, [audioMedia, selectedEntry, currentFeed, playerPlay])

  const handleOpenBilibiliInPage = useCallback((url: string) => {
    setEmbeddedPageUrl(url)
  }, [])

  // Navigate to next/prev entry
  const currentIndex = selectedEntry
    ? entries.findIndex((e) => e.id === selectedEntry.id)
    : -1
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < entries.length - 1
  const showEntryDetailFallback =
    isSelectedEntryHydrating &&
    !embeddedPageUrl &&
    !articleContent &&
    !selectedEntry?.summary &&
    !selectedEntry?.imageUrl &&
    !videoMedia

  const goToEntry = useCallback(
    (dir: 'prev' | 'next') => {
      if (dir === 'prev' && hasPrev) selectEntry(entries[currentIndex - 1])
      if (dir === 'next' && hasNext) selectEntry(entries[currentIndex + 1])
    },
    [currentIndex, entries, hasPrev, hasNext, selectEntry],
  )
  const { showKeepScrollingHint, dismissKeepScrollingHint } =
    useEntryScrollNavigation({
      enabled: !!selectedEntry && !embeddedPageUrl,
      scrollRef,
      onNextEntry: () => {
        if (hasNext) {
          goToEntry('next')
        }
      },
    })

  useRegisterCommand({
    id: 'entry:prev',
    shortcutId: 'prev-entry',
    scopes: ['content'],
    blockedScopes: HOTKEY_OVERLAY_SCOPES,
    handler: (e) => {
      if (!selectedEntry || !hasPrev) return false
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      if (isInput) return false
      e.preventDefault()
      goToEntry('prev')
    },
  })

  useRegisterCommand({
    id: 'entry:next',
    shortcutId: 'next-entry',
    scopes: ['content'],
    blockedScopes: HOTKEY_OVERLAY_SCOPES,
    handler: (e) => {
      if (!selectedEntry || !hasNext) return false
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      if (isInput) return false
      e.preventDefault()
      goToEntry('next')
    },
  })

  useRegisterCommand({
    id: 'entry:toggle-star',
    shortcutId: 'toggle-star',
    scopes: ['content'],
    blockedScopes: HOTKEY_OVERLAY_SCOPES,
    handler: (e) => {
      if (!selectedEntry) return false
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      if (isInput) return false
      e.preventDefault()
      void toggleStar(selectedEntry.id)
    },
  })

  useRegisterCommand({
    id: 'entry:toggle-read',
    shortcutId: 'toggle-read',
    scopes: ['content'],
    blockedScopes: HOTKEY_OVERLAY_SCOPES,
    handler: (e) => {
      if (!selectedEntry) return false
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      if (isInput) return false
      e.preventDefault()
      void markRead(selectedEntry.id, !selectedEntry.isRead)
    },
  })

  useRegisterCommand({
    id: 'entry:open-browser',
    shortcutId: 'open-browser',
    scopes: ['content'],
    blockedScopes: HOTKEY_OVERLAY_SCOPES,
    handler: (e) => {
      if (!selectedEntry?.url) return false
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      if (isInput) return false
      e.preventDefault()
      const browserUrl = resolveEntryBrowserOpenUrl(selectedEntry)
      window.open(browserUrl || selectedEntry.url, '_blank')
    },
  })

  useRegisterCommand({
    id: 'entry:copy-link',
    shortcutId: 'copy-link',
    scopes: ['content'],
    blockedScopes: HOTKEY_OVERLAY_SCOPES,
    handler: (e) => {
      if (!selectedEntry?.url) return false
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      if (isInput) return false
      e.preventDefault()
      void handleCopyLink()
    },
  })

  useRegisterCommand({
    id: 'reading:ai-summarize',
    shortcutId: 'ai-summarize',
    scopes: ['content'],
    blockedScopes: HOTKEY_OVERLAY_SCOPES,
    handler: (e) => {
      if (!selectedEntry?.content) return false
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      if (isInput) return false
      e.preventDefault()
      void handleSummarize()
    },
  })

  useRegisterCommand({
    id: 'reading:ai-translate',
    shortcutId: 'ai-translate',
    scopes: ['content'],
    blockedScopes: HOTKEY_OVERLAY_SCOPES,
    handler: (e) => {
      if (!selectedEntry?.content) return false
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      if (isInput) return false
      e.preventDefault()
      void handleTranslate()
    },
  })

  useRegisterCommand({
    id: 'reading:ai-chat',
    shortcutId: 'ai-chat',
    scopes: ['content'],
    blockedScopes: HOTKEY_OVERLAY_SCOPES,
    handler: (e) => {
      if (!selectedEntry) return false
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      if (isInput) return false
      e.preventDefault()
      handleOpenAIChat()
    },
  })

  useRegisterCommand({
    id: 'reading:toggle-readability',
    shortcutId: 'toggle-readability',
    scopes: ['content'],
    blockedScopes: HOTKEY_OVERLAY_SCOPES,
    handler: (e) => {
      if (!selectedEntry?.url) return false
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      if (isInput) return false
      e.preventDefault()
      void handleReadability()
    },
  })

  useEffect(() => {
    if (!selectedEntry || currentIndex < 0) return
    const nearbyIds = [
      entries[currentIndex - 1]?.id,
      entries[currentIndex + 1]?.id,
      entries[currentIndex + 2]?.id,
    ].filter(Boolean) as string[]
    if (nearbyIds.length === 0) return
    void prefetchEntryDetails(nearbyIds)
  }, [currentIndex, entries, prefetchEntryDetails, selectedEntry])

  // Empty state
  if (!selectedEntry) {
    return <EntryEmptyState />
  }

  const timeAgo = formatDistanceToNow(new Date(selectedEntry.publishedAt), {
    addSuffix: true,
    locale: getDateLocale(),
  })
  const fullDate = format(
    new Date(selectedEntry.publishedAt),
    t('entry.dateFormat'),
    {
      locale: getDateLocale(),
    },
  )
  const readingTime = articleContent ? estimateReadingTime(articleContent) : 0
  const taskSnapshot = (selectedEntry as { taskSnapshot?: EntryTaskSnapshot })
    .taskSnapshot
  const fulltextTaskState: EntryTaskState | undefined = isFetchingReadable
    ? { status: 'running' }
    : readabilityError
      ? { status: 'failed', error: readabilityError }
      : taskSnapshot?.fulltext
  const aiSummaryTaskState: EntryTaskState | undefined = isSummarizing
    ? { status: 'running' }
    : error
      ? { status: 'failed', error }
      : taskSnapshot?.aiSummary

  return (
    <div className="dark:bg-surface-dark relative flex min-w-0 flex-1 flex-col bg-white">
      {/* 工具栏由外层阅读器容器统一避开标题栏。 */}
      <div className="no-drag sticky top-0 z-10 flex flex-shrink-0 flex-col">
        <div className="dark:bg-surface-dark/80 flex h-9 items-center gap-0.5 border-b bg-white/80 px-3 backdrop-blur-sm">
          {embeddedPageUrl && (
            <>
              <ToolbarButton
                onClick={() => setEmbeddedPageUrl(null)}
                title={t('common.back', { defaultValue: '返回' })}
              >
                <X size={16} />
              </ToolbarButton>
              <div className="bg-border dark:bg-border-dark mx-1 h-4 w-px" />
            </>
          )}

          <ToolbarButton
            onClick={() => {
              setStarAnimKey((k) => k + 1)
              toggleStar(selectedEntry.id)
            }}
            title={
              selectedEntry.isStarred ? t('entry.unstar') : t('entry.star')
            }
            active={selectedEntry.isStarred}
          >
            <span key={starAnimKey} className="star-pop inline-flex">
              <Star
                size={16}
                className={
                  selectedEntry.isStarred
                    ? 'fill-yellow-500 text-yellow-500'
                    : ''
                }
              />
            </span>
          </ToolbarButton>

          <EntryAIToolbar
            onSummarize={handleSummarize}
            onTranslate={handleTranslate}
            isSummarizing={isSummarizing}
            isTranslating={isTranslating}
            showTranslation={showTranslation}
            translationTargetLanguage={translationTargetLanguage}
            onLanguageChange={(lang) =>
              updateSettingsSection('translation', { targetLanguage: lang })
            }
            disabled={!aiApiKey}
          />

          <ToolbarButton
            onClick={handleOpenAIChat}
            disabled={!aiApiKey}
            title="AI Chat"
          >
            <MessageSquare size={16} />
          </ToolbarButton>

          <ToolbarButton
            onClick={handleReadability}
            disabled={isFetchingReadable || !selectedEntry.url}
            active={isReadabilityMode}
            title={
              isReadabilityMode
                ? t('entry.readabilityBack')
                : t('entry.readability')
            }
          >
            {isFetchingReadable ? (
              <Loader2 size={16} className="text-accent animate-spin" />
            ) : (
              <BookType size={16} />
            )}
          </ToolbarButton>

          {audioMedia && (
            <ToolbarButton
              onClick={handlePlayAudio}
              title={t('entry.playAudio')}
            >
              <Play size={16} className="text-purple-500" />
            </ToolbarButton>
          )}

          <ToolbarButton onClick={handleCopyLink} title={t('entry.copyLink')}>
            {linkCopied ? (
              <Check size={16} className="text-green-500" />
            ) : (
              <Copy size={16} />
            )}
          </ToolbarButton>

          {/* Separator */}
          <div className="bg-border dark:bg-border-dark mx-1 h-4 w-px" />

          {/* Nav buttons */}
          <ToolbarButton
            onClick={() => goToEntry('prev')}
            disabled={!hasPrev}
            title={t('entry.prevArticleShortcut')}
          >
            <ChevronUp size={16} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => goToEntry('next')}
            disabled={!hasNext}
            title={t('entry.nextArticleShortcut')}
          >
            <ChevronDown size={16} />
          </ToolbarButton>

          <div className="flex-1" />

          {selectedEntry.url && (
            <ToolbarButton
              onClick={() => {
                const browserUrl = resolveEntryBrowserOpenUrl(selectedEntry)
                window.open(browserUrl || selectedEntry.url, '_blank')
              }}
              title={t('entry.openInBrowser')}
            >
              <ExternalLink size={16} />
            </ToolbarButton>
          )}

          {/* Read status */}
          <div className="text-text-tertiary ml-1 flex items-center gap-1 text-xs">
            {selectedEntry.isRead ? (
              <CheckCircle2 size={14} className="text-green-500" />
            ) : (
              <Circle size={14} />
            )}
          </div>
        </div>

        {/* 阅读进度条跟随工具栏，避免覆盖右上角操作区。 */}
        <div className="dark:bg-surface-dark/80 h-[2px] bg-white/80">
          <div
            className="bg-accent h-full transition-all duration-150 ease-out"
            style={{ width: `${readPercent}%` }}
          />
        </div>
      </div>

      {/* Content */}
      {embeddedPageUrl ? (
        <div className="min-h-0 flex-1 bg-black">
          <webview
            src={embeddedPageUrl}
            className="h-full w-full"
            useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
          />
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto scroll-smooth"
          onContextMenu={(e) => {
            const selectedText =
              window.getSelection?.()?.toString().trim() || ''
            // If text is selected, let text context menu handle copy actions.
            if (selectedText) return
            e.preventDefault()
            e.stopPropagation()
            setArticleMenu({ visible: true, x: e.clientX, y: e.clientY })
          }}
        >
          {showKeepScrollingHint && hasNext && (
            <div className="pointer-events-none sticky bottom-6 z-10 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  dismissKeepScrollingHint()
                  goToEntry('next')
                }}
                className="border-border/40 text-text-secondary hover:text-text dark:bg-surface-dark/90 pointer-events-auto rounded-full border bg-white/90 px-4 py-2 text-xs shadow-sm backdrop-blur-sm"
              >
                已到底部，再按 PageDown 或点这里跳到下一篇
              </button>
            </div>
          )}
          <article
            ref={contentRef}
            data-context-select-scope="article"
            className={`${contentWidthClass} mx-auto mb-32 px-8 py-6 transition-all duration-300 ${
              isTransitioning
                ? 'translate-y-4 opacity-0'
                : 'translate-y-0 opacity-100'
            }`}
            style={{
              lineHeight: general.contentLineHeight,
              fontFamily: general.contentFontFamily,
              ...contentWidthStyle,
            }}
          >
            <EntryArticleHeader
              title={selectedEntry.title}
              author={selectedEntry.author}
              authorAvatarUrl={authorAvatarUrl}
              timeAgo={timeAgo}
              fullDate={fullDate}
              readingTimeLabel={
                readingTime > 0
                  ? t('entry.readingTime', { minutes: readingTime })
                  : undefined
              }
            />

            <InlineTaskStatus
              fulltext={fulltextTaskState}
              aiSummary={aiSummaryTaskState}
              onRetryFulltext={handleReadability}
              onRetrySummary={handleSummarize}
              onOpenAISettings={handleOpenAISettings}
            />

            {/* AI Summary */}
            <AISummaryPanel
              summary={summary}
              error={error}
              isLoading={isSummarizing}
              onRetry={handleSummarize}
            />

            {/* Featured image */}
            {shouldShowFeaturedImage && selectedEntry.imageUrl && (
              <EntryFeaturedImage
                imageUrl={selectedEntry.imageUrl}
                title={t('imageViewer.pageTitle')}
                onOpen={() => navigate(ROUTES.image(selectedEntry.id))}
              />
            )}

            {/* Video player — prioritized like Folo-dev MediaLayout */}
            {!hideVideo && videoMedia && (
              <div className="group/video relative -mx-2 mb-8">
                <VideoPlayer
                  url={videoMedia.url}
                  poster={selectedEntry.imageUrl}
                  title={selectedEntry.title}
                  onOpenBilibiliInPage={handleOpenBilibiliInPage}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(ROUTES.video(selectedEntry.id))
                  }}
                  title={t('videoPlayer.openFullscreen')}
                  aria-label={t('videoPlayer.openFullscreen')}
                  className="absolute right-3 top-3 z-10 rounded-full bg-black/55 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/75 group-hover/video:opacity-100"
                >
                  <Maximize2 size={14} />
                </button>
              </div>
            )}

            {audioMedia && (
              <AudioPlaybackPanel
                title={selectedEntry.title}
                duration={audioMedia.duration}
                playLabel={t('entry.playAudio')}
                onPlay={handlePlayAudio}
                audioUrl={audioMedia.url}
                listenProgress={selectedEntry.listenProgress}
              />
            )}

            <EntryBodyContent
              isReadabilityMode={isReadabilityMode}
              readableContent={readableContent}
              sanitizedReadable={sanitizedReadable}
              articleContent={articleContent}
              showTranslation={showTranslation}
              paragraphs={paragraphs}
              translatedParagraphs={translatedParagraphs}
              isTranslating={isTranslating}
              errorMap={errorMap}
              onRetrySegment={retrySegment}
              sanitizedContent={sanitizedContent}
              fontSize={general.fontSize}
              lineHeight={general.contentLineHeight}
              fontFamily={general.contentFontFamily}
              hasAudio={!!audioMedia}
              showEntryDetailFallback={showEntryDetailFallback}
              fallbackTitle={selectedEntry.title}
              isFetchingReadable={isFetchingReadable}
              entryUrl={selectedEntry.url}
              onExitReadability={() => setIsReadabilityMode(false)}
              onFetchReadable={handleReadability}
            />

            <EntryEndNavigation
              hasPrev={hasPrev}
              hasNext={hasNext}
              currentIndex={currentIndex}
              total={entries.length}
              prevLabel={t('entry.prevArticle')}
              nextLabel={t('entry.nextArticle')}
              onPrev={() => goToEntry('prev')}
              onNext={() => goToEntry('next')}
            />
          </article>
        </div>
      )}

      {/* External link warning modal */}
      {externalLinkWarning && (
        <ExternalLinkWarningModal
          warning={externalLinkWarning}
          onClose={() => setExternalLinkWarning(null)}
          onContinue={() => {
            window.open(externalLinkWarning.url, '_blank')
            setExternalLinkWarning(null)
          }}
        />
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
