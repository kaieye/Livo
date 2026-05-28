import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useEntryStore } from '../../store/entry-store'
import { useFeedStore } from '../../store/feed-store'
import {
  useAISettingKey,
  useGeneralSettingsShallowSelector,
  useTranslationSettingKey,
} from '../../store/settings-store'
import { useAIChatStore } from '../../store/ai-chat-store'
import { useStoreShallow } from '../../store/helpers'
import { useRegisterCommand } from '../../hooks/useRegisterCommand'
import { useEntryScrollNavigation } from '../../hooks/useEntryScrollNavigation'
import { usePlayerStore } from '../media/MediaPlayer'
import { VideoPlayer, transformVideoUrl } from '../media/MediaPlayer'
import {
  sanitizeHTML,
  isExternalUrl,
  createExternalLinkWarning,
} from '../../utils/sanitize'
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
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { getDateLocale } from '../../lib/date-locale'
import { ContextMenu, type ContextMenuAction } from '../ui/ContextMenu'
import { FeedViewType } from '../../../../shared/types'
import { HOTKEY_OVERLAY_SCOPES } from '../../lib/hotkey-scope'
import { splitHtmlIntoParagraphs } from '../../lib/entry-text'
import { resolvePreferredEntryVideo } from '../../lib/entry-video-source'
import { ROUTES } from '../../router/route-paths'
import { Maximize2 } from 'lucide-react'

/** Estimate reading time in minutes */
function estimateReadingTime(html: string): number {
  const text = html.replace(/<[^>]*>/g, '').trim()
  // CJK: ~400 chars/min, Latin: ~200 words/min
  const cjkCount = (
    text.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []
  ).length
  const wordCount = text
    .replace(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, '')
    .split(/\s+/)
    .filter(Boolean).length
  return Math.max(1, Math.round(cjkCount / 400 + wordCount / 200))
}

function normalizeMediaKey(url: string): string {
  const decoded = url
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim()
  if (!decoded) return ''
  try {
    const u = new URL(decoded, window.location.href)
    const host = u.hostname.toLowerCase().replace(/^www\./, '')
    const path = u.pathname.replace(/\/+$/, '')
    return `${host}${path}`
  } catch {
    return decoded
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/[?#].*$/, '')
      .replace(/\/+$/, '')
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
  const doc = parser.parseFromString(
    `<div id="__root__">${html}</div>`,
    'text/html',
  )
  const root = doc.getElementById('__root__')
  if (!root) return html

  const imageKeySet = new Set(
    (options.duplicateImageKeys || []).map(normalizeMediaKey).filter(Boolean),
  )

  if (imageKeySet.size > 0) {
    const imgs = Array.from(root.querySelectorAll('img'))
    for (const img of imgs) {
      const src =
        img.getAttribute('src') ||
        img.getAttribute('data-src') ||
        img.getAttribute('data-original') ||
        ''
      if (!src) continue
      const key = normalizeMediaKey(src)
      if (imageKeySet.has(key)) {
        img.remove()
      }
    }
  }

  if (options.removeEmbeddedVideos) {
    const mediaNodes = root.querySelectorAll(
      'video, iframe, embed, object, audio, source, picture',
    )
    mediaNodes.forEach((node) => node.remove())
  }

  return root.innerHTML
}

function htmlContainsImage(html: string, imageUrl: string): boolean {
  if (!html || !imageUrl) return false
  const parser = new DOMParser()
  const doc = parser.parseFromString(
    `<div id="__root__">${html}</div>`,
    'text/html',
  )
  const root = doc.getElementById('__root__')
  if (!root) return false

  const targetKey = normalizeMediaKey(imageUrl)
  if (!targetKey) return false

  return Array.from(root.querySelectorAll('img')).some((img) => {
    const src =
      img.getAttribute('src') ||
      img.getAttribute('data-src') ||
      img.getAttribute('data-original') ||
      ''
    return !!src && normalizeMediaKey(src) === targetKey
  })
}

export function EntryContent() {
  const {
    selectedEntry,
    isSelectedEntryHydrating,
    toggleStar,
    markRead,
    entries,
    selectEntry,
    prefetchEntryDetails,
  } = useStoreShallow(useEntryStore, (s) => ({
    selectedEntry: s.selectedEntry,
    isSelectedEntryHydrating: s.isSelectedEntryHydrating,
    toggleStar: s.toggleStar,
    markRead: s.markRead,
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
  const [embeddedPageUrl, setEmbeddedPageUrl] = useState<string | null>(null)
  const [externalLinkWarning, setExternalLinkWarning] = useState<{
    url: string
    hostname: string
    isSuspicious: boolean
  } | null>(null)
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
      setEmbeddedPageUrl(null)

      // Scroll to top
      scrollRef.current?.scrollTo({ top: 0 })
    }
  }, [selectedEntry])

  // Reading progress tracking
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      const max = scrollHeight - clientHeight
      setReadPercent(max > 0 ? Math.round((scrollTop / max) * 100) : 0)
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [selectedEntry])

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

  // Content paragraphs (memoized)
  const paragraphs = useMemo(() => {
    if (!selectedEntry?.content) return []
    return splitHtmlIntoParagraphs(selectedEntry.content)
  }, [selectedEntry?.content])

  const handleSummarize = useCallback(async () => {
    if (!selectedEntry?.content) return
    setIsSummarizing(true)
    setSummary(null)
    const result = await window.api.ai.summarize(
      selectedEntry.content,
      general.language,
    )
    setIsSummarizing(false)
    if (result.success) {
      setSummary(result.summary)
    } else {
      setSummary(`${t('common.error')}: ${result.error}`)
    }
  }, [general.language, selectedEntry?.content, t])

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
    const targetLang = translationTargetLanguage || 'zh-CN'
    const results: string[] = []

    for (let i = 0; i < paragraphs.length; i++) {
      const plainText = paragraphs[i].replace(/<[^>]*>/g, '').trim()
      if (!plainText || plainText.length < 5) {
        results.push('') // skip very short/empty blocks
        continue
      }
      try {
        const result = await window.api.ai.translate(paragraphs[i], targetLang)
        if (result.success) {
          results.push(result.translation)
        } else {
          results.push(
            `<span class="text-red-400 text-xs">${t('entry.translateFailed')}</span>`,
          )
        }
      } catch {
        results.push(
          `<span class="text-red-400 text-xs">${t('entry.translateFailed')}</span>`,
        )
      }
      // Update progressively
      setTranslatedParagraphs([...results])
    }

    setIsTranslating(false)
  }, [
    paragraphs,
    selectedEntry?.content,
    translationTargetLanguage,
    showTranslation,
    t,
    translatedParagraphs.length,
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
    window.open(selectedEntry.url, '_blank')
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
        disabled: !selectedEntry.content,
      },
      {
        id: 'ai-summary',
        label: t('entry.summarize', { defaultValue: 'AI 摘要' }),
        icon: <Sparkles size={14} />,
        onClick: () => {
          void handleSummarize()
        },
        disabled: !selectedEntry.content,
      },
      {
        id: 'fetch-original',
        label: t('entry.readability', { defaultValue: '获取原文' }),
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
    t,
    handleSelectCurrentArticle,
    handleTranslate,
    handleSummarize,
    handleReadability,
    isFetchingReadable,
    toggleStar,
  ])

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

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
    if (!selectedEntry?.content) return ''
    const imageKeys = [
      selectedEntry.imageUrl || '',
      ...(selectedEntry.media || [])
        .filter(
          (m) =>
            m.type === 'photo' || (videoMedia ? m.type === 'video' : false),
        )
        .flatMap((m) => [m.url || '', m.previewUrl || '']),
    ].filter(Boolean)

    const dedupedHtml = stripDuplicateMediaFromHtml(selectedEntry.content, {
      duplicateImageKeys:
        videoMedia || currentFeed?.view !== FeedViewType.Articles
          ? imageKeys
          : [],
      removeEmbeddedVideos: !!videoMedia,
    })

    return sanitizeHTML(dedupedHtml)
  }, [
    currentFeed?.view,
    selectedEntry?.content,
    selectedEntry?.imageUrl,
    selectedEntry?.media,
    videoMedia,
  ])

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
    !selectedEntry?.content &&
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
      window.open(selectedEntry.url, '_blank')
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
    return (
      <div className="flex flex-1 items-center justify-center bg-surface-secondary dark:bg-surface-dark">
        <div className="text-center text-text-secondary dark:text-text-dark-secondary">
          <BookOpen
            size={48}
            className="mx-auto mb-4 text-text-tertiary"
            strokeWidth={1.5}
          />
          <p className="text-lg font-medium">{t('entry.selectArticle')}</p>
          <p className="mt-1 text-sm text-text-tertiary">
            {t('entry.selectArticleHint')}
          </p>
          <div className="mt-6 space-y-1 text-xs text-text-tertiary">
            <p>
              <kbd className="rounded bg-surface-tertiary px-1.5 py-0.5 text-[10px] dark:bg-surface-dark-tertiary">
                J
              </kbd>{' '}
              /{' '}
              <kbd className="rounded bg-surface-tertiary px-1.5 py-0.5 text-[10px] dark:bg-surface-dark-tertiary">
                K
              </kbd>{' '}
              {t('entry.navUpDown')}
            </p>
            <p>
              <kbd className="rounded bg-surface-tertiary px-1.5 py-0.5 text-[10px] dark:bg-surface-dark-tertiary">
                S
              </kbd>{' '}
              {t('entry.starHint')}{' '}
              <kbd className="rounded bg-surface-tertiary px-1.5 py-0.5 text-[10px] dark:bg-surface-dark-tertiary">
                O
              </kbd>{' '}
              {t('entry.browserOpenHint')}
            </p>
          </div>
        </div>
      </div>
    )
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
  const readingTime = selectedEntry.content
    ? estimateReadingTime(selectedEntry.content)
    : 0

  return (
    <div className="relative flex min-w-0 flex-1 flex-col bg-white dark:bg-surface-dark">
      {/* Reading progress bar */}
      <div className="absolute left-0 right-0 top-0 z-20 h-[2px]">
        <div
          className="h-full bg-accent transition-all duration-150 ease-out"
          style={{ width: `${readPercent}%` }}
        />
      </div>

      {/* Toolbar */}
      <div className="sticky top-0 z-10 flex flex-shrink-0 items-center gap-0.5 border-b bg-white/80 px-3 py-1.5 backdrop-blur-sm dark:bg-surface-dark/80">
        {embeddedPageUrl && (
          <>
            <ToolbarButton
              onClick={() => setEmbeddedPageUrl(null)}
              title={t('common.back', { defaultValue: '返回' })}
            >
              <X size={16} />
            </ToolbarButton>
            <div className="mx-1 h-4 w-px bg-border dark:bg-border-dark" />
          </>
        )}

        <ToolbarButton
          onClick={() => toggleStar(selectedEntry.id)}
          title={selectedEntry.isStarred ? t('entry.unstar') : t('entry.star')}
          active={selectedEntry.isStarred}
        >
          <Star
            size={16}
            className={
              selectedEntry.isStarred ? 'fill-yellow-500 text-yellow-500' : ''
            }
          />
        </ToolbarButton>

        <ToolbarButton
          onClick={handleSummarize}
          disabled={isSummarizing || !aiApiKey}
          title={aiApiKey ? t('entry.summarize') : t('entry.configureAIKey')}
        >
          {isSummarizing ? (
            <Loader2 size={16} className="animate-spin text-accent" />
          ) : (
            <Sparkles size={16} />
          )}
        </ToolbarButton>

        <ToolbarButton
          onClick={handleTranslate}
          disabled={isTranslating || !aiApiKey}
          active={showTranslation}
          title={aiApiKey ? t('entry.translate') : t('entry.configureAIKey')}
        >
          {isTranslating ? (
            <Loader2 size={16} className="animate-spin text-accent" />
          ) : (
            <Languages size={16} />
          )}
        </ToolbarButton>

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
            <Loader2 size={16} className="animate-spin text-accent" />
          ) : (
            <BookType size={16} />
          )}
        </ToolbarButton>

        {audioMedia && (
          <ToolbarButton onClick={handlePlayAudio} title={t('entry.playAudio')}>
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
        <div className="mx-1 h-4 w-px bg-border dark:bg-border-dark" />

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

        {/* Read progress */}
        {readPercent > 0 && (
          <button
            onClick={scrollToTop}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-text-tertiary transition-colors hover:text-accent"
            title={t('entry.scrollToTop')}
          >
            <ReadProgressCircle percent={readPercent} />
            <span>{readPercent}%</span>
          </button>
        )}

        {selectedEntry.url && (
          <ToolbarButton
            onClick={() => window.open(selectedEntry.url, '_blank')}
            title={t('entry.openInBrowser')}
          >
            <ExternalLink size={16} />
          </ToolbarButton>
        )}

        {/* Read status */}
        <div className="ml-1 flex items-center gap-1 text-xs text-text-tertiary">
          {selectedEntry.isRead ? (
            <CheckCircle2 size={14} className="text-green-500" />
          ) : (
            <Circle size={14} />
          )}
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
                className="pointer-events-auto rounded-full border border-border/40 bg-white/90 px-4 py-2 text-xs text-text-secondary shadow-sm backdrop-blur-sm hover:text-text dark:bg-surface-dark/90"
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
            {/* Title */}
            <h1 className="mb-4 text-[1.7rem] font-bold leading-normal">
              {selectedEntry.title}
            </h1>

            {/* Meta */}
            <div className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-text-secondary dark:text-text-dark-secondary">
              {selectedEntry.author && (
                <span className="flex items-center gap-1">
                  {authorAvatarUrl ? (
                    <img
                      src={authorAvatarUrl}
                      alt=""
                      className="h-4 w-4 rounded-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
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
                  {t('entry.readingTime', { minutes: readingTime })}
                </span>
              )}
            </div>

            {/* AI Summary */}
            {(isSummarizing || summary) && (
              <div className="animate-in fade-in-0 slide-in-from-top-2 mb-8 rounded-xl border border-accent/15 bg-gradient-to-br from-accent/5 to-accent/10 p-4 transition-all duration-300">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-accent">
                  <Sparkles size={16} />
                  {t('entry.aiSummaryTitle')}
                </div>
                {isSummarizing ? (
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Loader2 size={14} className="animate-spin" />
                    {t('entry.generatingSummary')}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {summary}
                  </p>
                )}
              </div>
            )}

            {readabilityError && !isReadabilityMode && (
              <div className="mb-6 rounded-lg border border-amber-300/40 bg-amber-50/60 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/15 dark:text-amber-300">
                {readabilityError}
              </div>
            )}

            {/* Featured image */}
            {shouldShowFeaturedImage && (
              <div className="group/featured relative -mx-2 mb-8 overflow-hidden rounded-xl">
                <img
                  src={selectedEntry.imageUrl}
                  alt=""
                  className="max-h-[400px] w-full object-cover transition-transform duration-500 hover:scale-[1.02]"
                  loading="lazy"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
                {/* Sole entry point to the ImageViewer page (1.5). Mirrors the
                    Maximize2 hover button 1.4 added to the inline VideoPlayer. */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(ROUTES.image(selectedEntry.id))
                  }}
                  title={t('imageViewer.pageTitle')}
                  aria-label={t('imageViewer.pageTitle')}
                  className="absolute right-3 top-3 z-10 rounded-full bg-black/55 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/75 group-hover/featured:opacity-100"
                >
                  <Maximize2 size={14} />
                </button>
              </div>
            )}

            {/* Video player — prioritized like Folo-dev MediaLayout */}
            {videoMedia && (
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

            {/* Article content — readability / bilingual / plain */}
            {isReadabilityMode && readableContent ? (
              <div>
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                  <BookType size={14} />
                  <span>{t('entry.readabilityMode')}</span>
                  <button
                    onClick={() => setIsReadabilityMode(false)}
                    className="ml-auto hover:underline"
                  >
                    {t('entry.readabilityBack2')}
                  </button>
                </div>
                <div
                  className="entry-content"
                  style={{ fontSize: `${general.fontSize}px` }}
                  dangerouslySetInnerHTML={{ __html: sanitizedReadable }}
                />
              </div>
            ) : selectedEntry.content ? (
              showTranslation ? (
                <BilingualContent
                  paragraphs={paragraphs}
                  translations={translatedParagraphs}
                  isTranslating={isTranslating}
                  fontSize={general.fontSize}
                  lineHeight={general.contentLineHeight}
                  fontFamily={general.contentFontFamily}
                />
              ) : (
                <div
                  className="entry-content"
                  style={{ fontSize: `${general.fontSize}px` }}
                  dangerouslySetInnerHTML={{ __html: sanitizedContent }}
                />
              )
            ) : showEntryDetailFallback ? (
              <EntryDetailFallback title={selectedEntry.title} />
            ) : (
              <div className="py-12 text-center text-text-secondary dark:text-text-dark-secondary">
                {isFetchingReadable ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 size={24} className="animate-spin text-accent" />
                    <p className="text-sm">{t('entry.fetchingContent')}</p>
                  </div>
                ) : (
                  <>
                    <p>{t('entry.noContent')}</p>
                    {selectedEntry.url && (
                      <div className="mt-3 space-y-2">
                        <button
                          onClick={handleReadability}
                          className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
                        >
                          <BookType size={14} />
                          {t('entry.tryFetchContent')}
                        </button>
                        <br />
                        <a
                          href={selectedEntry.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block text-sm text-accent hover:underline"
                          onClick={(e) => {
                            e.preventDefault()
                            window.open(selectedEntry.url, '_blank')
                          }}
                        >
                          {t('entry.readInBrowser')}
                        </a>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* End of article — navigate */}
            <div className="mt-16 flex items-center justify-between border-t pt-8 text-sm text-text-secondary dark:text-text-dark-secondary">
              <button
                disabled={!hasPrev}
                onClick={() => goToEntry('prev')}
                className="flex items-center gap-1 transition-colors hover:text-accent disabled:cursor-default disabled:opacity-30"
              >
                <ChevronUp size={16} />
                {t('entry.prevArticle')}
              </button>
              <span className="text-xs text-text-tertiary">
                {currentIndex + 1} / {entries.length}
              </span>
              <button
                disabled={!hasNext}
                onClick={() => goToEntry('next')}
                className="flex items-center gap-1 transition-colors hover:text-accent disabled:cursor-default disabled:opacity-30"
              >
                {t('entry.nextArticle')}
                <ChevronDown size={16} />
              </button>
            </div>
          </article>
        </div>
      )}

      {/* External link warning modal */}
      {externalLinkWarning && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40">
          <div className="animate-in mx-4 w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl dark:bg-surface-dark-secondary">
            <div className="mb-3 flex items-center gap-2 text-amber-500">
              <AlertTriangle size={20} />
              <h3 className="font-semibold">
                {t('entry.externalLinkWarning')}
              </h3>
              <button
                onClick={() => setExternalLinkWarning(null)}
                className="ml-auto rounded p-1 hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mb-1 text-sm text-text-secondary dark:text-text-dark-secondary">
              {t('entry.externalLinkDesc')}
            </p>
            <p className="mb-3 break-all rounded bg-surface-secondary px-2 py-1.5 font-mono text-xs text-red-500 dark:bg-surface-dark-tertiary">
              {externalLinkWarning.hostname}
            </p>
            {externalLinkWarning.isSuspicious && (
              <p className="mb-3 flex items-center gap-1 text-xs text-red-500">
                <AlertTriangle size={12} />
                {t('entry.suspiciousLink')}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setExternalLinkWarning(null)}
                className="flex-1 rounded-lg border px-3 py-2 text-sm hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => {
                  window.open(externalLinkWarning.url, '_blank')
                  setExternalLinkWarning(null)
                }}
                className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm text-white hover:bg-accent/90"
              >
                {t('common.continueAccess')}
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

function EntryDetailFallback({ title }: { title: string }) {
  return (
    <div className="animate-in fade-in-0 space-y-5 duration-200">
      <div className="rounded-xl border border-border/60 bg-surface-secondary/70 px-4 py-3 text-sm text-text-secondary dark:bg-surface-dark-secondary/70 dark:text-text-dark-secondary">
        正在准备完整内容…
      </div>
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-40 rounded bg-surface-tertiary dark:bg-surface-dark-tertiary" />
        <div className="h-3.5 w-full rounded bg-surface-tertiary dark:bg-surface-dark-tertiary" />
        <div className="h-3.5 w-[92%] rounded bg-surface-tertiary dark:bg-surface-dark-tertiary" />
        <div className="h-3.5 w-[84%] rounded bg-surface-tertiary dark:bg-surface-dark-tertiary" />
        <div className="h-40 w-full rounded-2xl bg-surface-tertiary dark:bg-surface-dark-tertiary" />
        <div className="h-3.5 w-full rounded bg-surface-tertiary dark:bg-surface-dark-tertiary" />
        <div className="h-3.5 w-[88%] rounded bg-surface-tertiary dark:bg-surface-dark-tertiary" />
      </div>
      <p className="dark:text-text-dark-tertiary text-xs text-text-tertiary">
        {title}
      </p>
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
    <div
      className="space-y-0"
      style={{ fontSize: `${fontSize}px`, lineHeight, fontFamily }}
    >
      {paragraphs.map((para, i) => {
        const translated = translations[i]
        const isLoading = isTranslating && i === translations.length
        const plainText = para.replace(/<[^>]*>/g, '').trim()
        if (!plainText) return null

        return (
          <div
            key={i}
            className="group border-l-2 border-transparent pl-0 transition-colors hover:border-accent/30 hover:pl-3"
          >
            {/* Original */}
            <div
              className="entry-content !mb-0"
              dangerouslySetInnerHTML={{ __html: para }}
            />

            {/* Translation */}
            {translated ? (
              <div className="relative mb-4 mt-1">
                <div className="flex items-start gap-2">
                  <Languages
                    size={12}
                    className="mt-1 flex-shrink-0 text-accent/50"
                  />
                  <div
                    className="entry-content !mb-0 text-accent/80 dark:text-orange-300/80"
                    style={{ fontSize: `${fontSize - 1}px` }}
                    dangerouslySetInnerHTML={{ __html: translated }}
                  />
                </div>
              </div>
            ) : isLoading ? (
              <div className="mb-4 mt-1 flex items-center gap-2 text-xs text-text-tertiary">
                <Loader2 size={12} className="animate-spin" />
                {t('entry.translating')}
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
      className={`rounded-lg p-1.5 text-text-secondary transition-all duration-150 hover:bg-surface-secondary hover:text-text disabled:cursor-default disabled:opacity-30 dark:text-text-dark-secondary dark:hover:bg-surface-dark-secondary dark:hover:text-text-dark-primary ${active ? 'bg-accent/10 !text-accent' : ''} `}
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
      <circle
        cx="7"
        cy="7"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity={0.15}
      />
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
