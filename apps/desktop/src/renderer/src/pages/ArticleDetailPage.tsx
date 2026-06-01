import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  BookOpen,
  Copy,
  ExternalLink,
  Loader2,
  Star,
  Video,
  VideoOff,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { EntryContent } from '../components/entry/EntryContent'
import { EntryAIToolbar } from '../components/entry/EntryAIToolbar'
import { AIAssistContent } from '../components/entry/AIAssistContent'
import { SocialDetailView } from '../components/entry/SocialDetailView'
import { VideoPlayer } from '../components/ui/VideoPlayer'
import {
  ContextMenu,
  type ContextMenuAction,
} from '../components/ui/ContextMenu'
import { ResizeHandle } from '../components/ui/ResizeHandle'
import { useDeepLinkEntry } from '../hooks/useDeepLinkEntry'
import { useArticleAIAssist } from '../hooks/useArticleAIAssist'
import { resolvePreferredEntryVideo } from '../lib/entry-video-source'
import {
  buildYoutubeIframeUrl,
  extractYoutubeVideoId,
  resolveYoutubePlayback,
} from '../lib/youtube-playback'
import { isDirectVideoUrl } from '@livo/utils'
import { useEntryStore } from '../store/entry-store'
import { useFeedStore } from '../store/feed-store'
import {
  useGeneralSettingsShallowSelector,
  useTranslationSettingKey,
  useAISettingKey,
  useSettingsActions,
  useSettingSection,
} from '../store/settings-store'
import { splitHtmlIntoParagraphs } from '../lib/entry-text'
import { getDateLocale } from '../lib/date-locale'
import { ROUTES } from '../router/route-paths'
import { FeedViewType } from '../../../shared/types'

// 18.3 — Resizable reading panel constants
const READING_MIN = 360
const READING_MAX = 900
const READING_DEFAULT = 680

function loadReadingWidth(): number {
  try {
    const raw = localStorage.getItem('livo-reading-width')
    if (raw) {
      const n = Number(raw)
      if (n >= READING_MIN && n <= READING_MAX) return n
    }
  } catch {
    /* ignore */
  }
  return READING_DEFAULT
}

function saveReadingWidth(width: number): void {
  try {
    localStorage.setItem('livo-reading-width', String(width))
  } catch {
    /* ignore */
  }
}

// Page shell for `/entry/:entryId`.
//
// Owns AI assist state (useAISummary / useAITranslation) at page level so
// AI capabilities are available to any reader view — not just EntryContent.
// Detects social entries via feed viewType and delegates to SocialDetailView
// for social-specific rendering (author header, quoted tweets, media gallery).
// Detects picture entries via feed viewType and redirects to ImageViewerPage
// (/image/:entryId) for a dedicated full-screen image browsing experience.
export default function ArticleDetailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { entryId } = useParams<{ entryId: string }>()

  const { activeEntry, state: fetchState } = useDeepLinkEntry(entryId)

  // Settings — font/line/family drive AIAssistContent rendering
  const general = useGeneralSettingsShallowSelector((s) => ({
    fontSize: s.fontSize,
    contentLineHeight: s.contentLineHeight,
    contentFontFamily: s.contentFontFamily,
    language: s.language,
  }))
  const translationTargetLanguage = useTranslationSettingKey('targetLanguage')
  const aiApiKey = useAISettingKey('apiKey')
  const { updateSettingsSection } = useSettingsActions()

  // Social entry detection — look up the parent feed's viewType
  const feed = useFeedStore((s) =>
    activeEntry ? s.feeds.find((f) => f.id === activeEntry.feedId) : null,
  )
  const isSocial = feed?.view === FeedViewType.SocialMedia
  const isPictures = feed?.view === FeedViewType.Pictures
  const isVideos = feed?.view === FeedViewType.Videos

  // Redirect picture entries to ImageViewerPage for full-screen image browsing.
  // Uses replace so "back" returns to the previous page, not this redirect.
  useEffect(() => {
    if (entryId && isPictures) {
      navigate(ROUTES.image(entryId), { replace: true })
    }
  }, [entryId, isPictures, navigate])

  // --- Video entry support ---
  const videoMedia = useMemo(
    () => (activeEntry ? resolvePreferredEntryVideo(activeEntry) : null),
    [activeEntry],
  )

  const youtubeVideoId = videoMedia
    ? extractYoutubeVideoId(videoMedia.url)
    : null
  const isYouTubeVideo = !!youtubeVideoId

  type YoutubePlayback = { kind: 'direct' | 'iframe'; url: string }
  const [youtubePlayback, setYoutubePlayback] =
    useState<YoutubePlayback | null>(null)
  const [isResolvingYoutube, setIsResolvingYoutube] = useState(false)

  useEffect(() => {
    if (!isYouTubeVideo || !videoMedia) {
      setYoutubePlayback(null)
      return
    }

    const fallbackIframe = youtubeVideoId
      ? buildYoutubeIframeUrl(youtubeVideoId)
      : null

    let cancelled = false
    setIsResolvingYoutube(true)
    setYoutubePlayback(null)

    void resolveYoutubePlayback(window.api.video, videoMedia.url)
      .then((result) => {
        if (cancelled) return
        setYoutubePlayback(result)
      })
      .catch(() => {
        if (cancelled || !fallbackIframe) return
        setYoutubePlayback({ kind: 'iframe', url: fallbackIframe })
      })
      .finally(() => {
        if (cancelled) return
        setIsResolvingYoutube(false)
      })

    return () => {
      cancelled = true
    }
  }, [isYouTubeVideo, videoMedia, youtubeVideoId])

  const isDirectVideo = !!videoMedia && isDirectVideoUrl(videoMedia.url)
  const isBilibiliVideo =
    !!videoMedia && /(?:^|\.)(?:bilibili\.com|b23\.tv)\//i.test(videoMedia.url)
  const shouldUseInlineVideoPlayer = isDirectVideo || isBilibiliVideo
  const videoExternalUrl = activeEntry?.url || videoMedia?.url || ''

  // --- AI assist ViewModel (8.1) — unified summary + translation state ---
  const summarySettings = useSettingSection('summary')
  const translationSettings = useSettingSection('translation')

  // Paragraphs for paragraph-by-paragraph translation
  const paragraphs = useMemo(() => {
    if (!activeEntry?.content) return []
    return splitHtmlIntoParagraphs(activeEntry.content)
  }, [activeEntry?.content])

  const {
    summary,
    summaryError,
    isSummarizing,
    translatedParagraphs,
    isTranslating,
    showTranslation,
    translationErrorMap: errorMap,
    summarize: handleSummarize,
    translate: handleTranslate,
  } = useArticleAIAssist({
    entryId,
    content: activeEntry?.content ?? undefined,
    paragraphs,
    summaryLanguage: summarySettings.language || general.language,
    targetLanguage: translationTargetLanguage,
  })

  // Auto-trigger on entry load when enabled in settings (Harmony parity).
  const autoTriggeredEntryRef = useRef<string | null>(null)
  useEffect(() => {
    if (!entryId || !activeEntry?.content || !aiApiKey) return
    if (autoTriggeredEntryRef.current === entryId) return
    autoTriggeredEntryRef.current = entryId
    if (summarySettings.enabled && summarySettings.autoTrigger) {
      handleSummarize()
    }
    if (translationSettings.enabled && translationSettings.autoTranslate) {
      handleTranslate()
    }
  }, [
    entryId,
    activeEntry?.content,
    aiApiKey,
    summarySettings.enabled,
    summarySettings.autoTrigger,
    translationSettings.enabled,
    translationSettings.autoTranslate,
    handleSummarize,
    handleTranslate,
  ])

  // --- Header ---
  const handleBack = useCallback(() => {
    navigate(-1)
  }, [navigate])

  const headerTitle = useMemo(() => {
    if (activeEntry) {
      return (
        activeEntry.title?.trim() ||
        activeEntry.author?.trim() ||
        t('articleDetail.pageTitle')
      )
    }
    return t('articleDetail.pageTitle')
  }, [activeEntry, t])

  const showNotFound = fetchState === 'missing'
  const showLoading =
    !showNotFound && (fetchState === 'loading' || !activeEntry)

  // --- Social avatar / author info (for SocialDetailView) ---
  const socialAvatarUrl = activeEntry?.authorAvatar ?? ''
  const socialAuthorName = activeEntry?.author ?? ''
  const [avatarFailed, setAvatarFailed] = useState(false)
  const avatarLetter = socialAuthorName
    ? socialAuthorName.charAt(0).toUpperCase()
    : '?'
  const timeAgo = useMemo(() => {
    if (!activeEntry?.publishedAt) return ''
    try {
      return formatDistanceToNow(activeEntry.publishedAt, {
        addSuffix: true,
        locale: getDateLocale(),
      })
    } catch {
      return ''
    }
  }, [activeEntry?.publishedAt, general.language])

  // Plain text (for social AI ops)
  const plainContent = useMemo(
    () => (activeEntry?.content ?? '').replace(/<[^>]*>/g, '').trim(),
    [activeEntry?.content],
  )

  // 18.3 — Resizable reading width for standard article view
  const [readingWidth, setReadingWidth] = useState(loadReadingWidth)
  const readingDragging = useRef(false)
  const readingDragStartX = useRef(0)
  const readingDragStartWidth = useRef(0)

  const handleReadingResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      readingDragging.current = true
      readingDragStartX.current = e.clientX
      readingDragStartWidth.current = readingWidth
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const onMove = (ev: MouseEvent) => {
        if (!readingDragging.current) return
        const delta = ev.clientX - readingDragStartX.current
        const next = Math.max(
          READING_MIN,
          Math.min(READING_MAX, readingDragStartWidth.current + delta),
        )
        setReadingWidth(next)
      }
      const onUp = () => {
        readingDragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        saveReadingWidth(readingWidth)
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
     
    [readingWidth],
  )

  // 18.4 — Article content context menu
  const [articleMenu, setArticleMenu] = useState<{
    visible: boolean
    x: number
    y: number
  }>({ visible: false, x: 0, y: 0 })

  const handleArticleContextMenu = useCallback((e: React.MouseEvent) => {
    const selectedText = window.getSelection?.()?.toString().trim() || ''
    if (selectedText.length > 0) return
    e.preventDefault()
    e.stopPropagation()
    setArticleMenu({ visible: true, x: e.clientX, y: e.clientY })
  }, [])

  const handleArticleMenuClose = useCallback(
    () => setArticleMenu((s) => ({ ...s, visible: false })),
    [],
  )

  const toggleStar = useEntryStore((s) => s.toggleStar)

  const articleMenuActions: ContextMenuAction[] = useMemo(() => {
    if (!activeEntry) return []
    const fallbackUrl = /^https?:\/\//i.test((activeEntry.url || '').trim())
      ? (activeEntry.url || '').trim()
      : ''
    return [
      {
        id: 'star',
        label: activeEntry.isStarred
          ? t('contextMenu.unstar')
          : t('contextMenu.star'),
        icon: (
          <Star
            size={14}
            className={
              activeEntry.isStarred ? 'fill-yellow-500 text-yellow-500' : ''
            }
          />
        ),
        onClick: () => {
          void toggleStar(activeEntry.id)
        },
      },
      {
        id: 'open-browser',
        label: t('contextMenu.openInBrowser'),
        icon: <ExternalLink size={14} />,
        onClick: () => {
          if (!fallbackUrl) return
          if (window.api?.app?.openExternal) {
            void window.api.app.openExternal(fallbackUrl)
          } else {
            window.open(fallbackUrl, '_blank')
          }
        },
        disabled: !fallbackUrl,
        separator: true,
      },
      {
        id: 'copy-link',
        label: t('contextMenu.copyLink'),
        icon: <Copy size={14} />,
        onClick: () => {
          if (activeEntry.url) navigator.clipboard.writeText(activeEntry.url)
        },
      },
    ]
  }, [activeEntry, t, toggleStar])

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[var(--color-bg-primary)]">
      <header className="flex flex-shrink-0 items-center gap-3 border-b border-[var(--color-border-secondary)] px-4 py-2">
        <button
          type="button"
          onClick={handleBack}
          aria-label={t('articleDetail.back')}
          title={t('articleDetail.back')}
          className="rounded-md p-1 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-text-primary)]">
          {headerTitle}
        </h1>

        {/* AI toolbar — composable in any reader page header */}
        {!showNotFound && !showLoading && (
          <EntryAIToolbar
            onSummarize={handleSummarize}
            onTranslate={handleTranslate}
            isSummarizing={isSummarizing}
            isTranslating={isTranslating}
            showTranslation={showTranslation}
            translationTargetLanguage={translationTargetLanguage}
            onLanguageChange={(lang) =>
              updateSettingsSection('translation', {
                targetLanguage: lang,
              })
            }
            disabled={!aiApiKey}
          />
        )}
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {showNotFound ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="px-6 text-center">
              <BookOpen
                size={48}
                aria-hidden="true"
                className="mx-auto mb-4 text-[var(--color-text-tertiary)] opacity-40"
              />
              <p className="text-sm text-[var(--color-text-secondary)]">
                {t('articleDetail.notFound')}
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                {t('articleDetail.notFoundHint')}
              </p>
              <button
                type="button"
                onClick={handleBack}
                className="mt-4 text-sm text-[var(--color-accent)] hover:underline"
              >
                {t('articleDetail.back')}
              </button>
            </div>
          </div>
        ) : showLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              <span>{t('articleDetail.loading')}</span>
            </div>
          </div>
        ) : isSocial ? (
          // Social content detail — renders social-specific layout with author,
          // tweet body, translation, and media gallery
          <div
            className="flex-1 overflow-y-auto"
            onContextMenu={handleArticleContextMenu}
          >
            <div className="mx-auto max-w-[680px] px-4 py-6">
              <AIAssistContent
                summary={summary}
                summaryError={summaryError}
                isSummarizing={isSummarizing}
                onRetrySummary={handleSummarize}
                showTranslation={showTranslation}
                paragraphs={paragraphs}
                translatedParagraphs={translatedParagraphs}
                isTranslating={isTranslating}
                errorMap={errorMap}
                fontSize={general.fontSize}
                lineHeight={general.contentLineHeight}
                fontFamily={general.contentFontFamily}
              />

              <SocialDetailView
                entryId={activeEntry!.id}
                paragraphs={paragraphs}
                fullContent={activeEntry!.content ?? ''}
                plainContent={plainContent}
                avatarUrl={socialAvatarUrl}
                avatarImageFailed={avatarFailed}
                avatarLetter={avatarLetter}
                authorName={socialAuthorName}
                timeAgo={timeAgo}
                onAvatarError={() => setAvatarFailed(true)}
                showTranslation={showTranslation}
                translatedParagraphs={translatedParagraphs}
                isTranslating={isTranslating}
                isSummarizing={isSummarizing}
                showSummary={!!summary}
                summary={summary}
                fontSize={general.fontSize}
              />
            </div>
          </div>
        ) : isVideos ? (
          // Video entry — inline player at top, content below
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* Inline video player */}
            <div className="flex-shrink-0 border-b border-[var(--color-border-secondary)] bg-black">
              {activeEntry && videoMedia ? (
                shouldUseInlineVideoPlayer ? (
                  <div className="mx-auto aspect-video max-w-4xl">
                    <VideoPlayer
                      src={videoMedia.url}
                      previewImage={activeEntry.imageUrl}
                      autoPlay={false}
                      className="h-full w-full rounded-none"
                    />
                  </div>
                ) : isYouTubeVideo ? (
                  <div className="mx-auto aspect-video max-w-4xl">
                    {isResolvingYoutube || !youtubePlayback ? (
                      <div className="flex h-full items-center justify-center gap-2 text-sm text-white/70">
                        <Loader2
                          size={16}
                          className="animate-spin"
                          aria-hidden="true"
                        />
                        <span>{t('videoPlayer.loading')}</span>
                      </div>
                    ) : youtubePlayback.kind === 'direct' ? (
                      <video
                        src={youtubePlayback.url}
                        className="h-full w-full object-contain"
                        controls
                        preload="metadata"
                        onError={() => {
                          const fallback = youtubeVideoId
                            ? buildYoutubeIframeUrl(youtubeVideoId)
                            : null
                          if (fallback)
                            setYoutubePlayback({
                              kind: 'iframe',
                              url: fallback,
                            })
                        }}
                      />
                    ) : (
                      <iframe
                        src={youtubePlayback.url}
                        className="h-full w-full"
                        sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
                        allowFullScreen
                        allow="autoplay; encrypted-media; accelerometer; clipboard-write; gyroscope; picture-in-picture"
                      />
                    )}
                  </div>
                ) : (
                  <div className="mx-auto flex aspect-video max-w-4xl items-center justify-center bg-black/60">
                    <div className="text-center">
                      <VideoOff
                        size={32}
                        className="mx-auto mb-2 text-white/40"
                        aria-hidden="true"
                      />
                      <p className="text-sm text-white/70">
                        {t('articleDetail.videoUnplayable')}
                      </p>
                      {videoExternalUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            window.open(videoExternalUrl, '_blank')
                          }
                          className="mt-2 text-sm text-[var(--color-accent)] hover:underline"
                        >
                          {t('articleDetail.videoOpenExternal')}
                        </button>
                      )}
                    </div>
                  </div>
                )
              ) : (
                <div className="mx-auto flex aspect-video max-w-4xl items-center justify-center bg-black/60">
                  <Loader2
                    size={16}
                    className="animate-spin text-white/70"
                    aria-hidden="true"
                  />
                </div>
              )}
            </div>

            {/* Article content below video */}
            <div
              className="flex-1 overflow-y-auto"
              onContextMenu={handleArticleContextMenu}
            >
              <div className="mx-auto max-w-[680px] px-4 py-6">
                <AIAssistContent
                  summary={summary}
                  summaryError={summaryError}
                  isSummarizing={isSummarizing}
                  onRetrySummary={handleSummarize}
                  showTranslation={showTranslation}
                  paragraphs={paragraphs}
                  translatedParagraphs={translatedParagraphs}
                  isTranslating={isTranslating}
                  errorMap={errorMap}
                  fontSize={general.fontSize}
                  lineHeight={general.contentLineHeight}
                  fontFamily={general.contentFontFamily}
                />

                {/* Use EntryContent for description/notes below the video */}
                <EntryContent hideVideo />
              </div>
            </div>
          </div>
        ) : (
          // Standard article content — resizable split: left column
          // (article body at configurable reading width) + right column
          // (AI assist panels). 18.3
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* Left — article body */}
            <div
              className="flex-shrink-0 flex-col overflow-y-auto"
              style={{ width: readingWidth }}
              onContextMenu={handleArticleContextMenu}
            >
              <AIAssistContent
                summary={summary}
                summaryError={summaryError}
                isSummarizing={isSummarizing}
                onRetrySummary={handleSummarize}
                showTranslation={showTranslation}
                paragraphs={paragraphs}
                translatedParagraphs={translatedParagraphs}
                isTranslating={isTranslating}
                errorMap={errorMap}
                fontSize={general.fontSize}
                lineHeight={general.contentLineHeight}
                fontFamily={general.contentFontFamily}
              />
              <EntryContent />
            </div>

            {/* Resize handle */}
            <ResizeHandle onMouseDown={handleReadingResize} />

            {/* Right — additional AI output / notes panel */}
            <div className="min-w-0 flex-1 overflow-y-auto border-l border-[var(--color-border-secondary)] px-4 py-4">
              {(summary || isSummarizing) && (
                <div className="mb-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    {t('articleDetail.aiSummary')}
                  </h3>
                  {isSummarizing ? (
                    <div className="flex items-center gap-2 text-sm text-[var(--color-text-tertiary)]">
                      <Loader2 size={14} className="animate-spin" />
                      <span>{t('articleDetail.summarizing')}</span>
                    </div>
                  ) : summaryError ? (
                    <p className="text-sm text-red-500">{summaryError}</p>
                  ) : (
                    <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
                      {summary}
                    </p>
                  )}
                </div>
              )}
              {showTranslation && translatedParagraphs.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    {t('articleDetail.aiTranslation')}
                  </h3>
                  <div className="space-y-3">
                    {translatedParagraphs.map((text, i) => (
                      <p
                        key={i}
                        className="text-sm leading-relaxed text-[var(--color-text-secondary)]"
                      >
                        {text}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {!summary && !isSummarizing && !showTranslation && (
                <div className="flex h-full items-center justify-center text-xs text-[var(--color-text-tertiary)]">
                  {t('articleDetail.aiPanelHint')}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {articleMenu.visible && (
        <ContextMenu
          x={articleMenu.x}
          y={articleMenu.y}
          onClose={handleArticleMenuClose}
          actions={articleMenuActions}
        />
      )}
    </div>
  )
}
