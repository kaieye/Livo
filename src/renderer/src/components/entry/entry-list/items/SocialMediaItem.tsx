import {
  memo,
  useMemo,
  useRef,
  useLayoutEffect,
  useState,
  useCallback,
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  Star,
  ChevronDown,
  ChevronUp,
  Loader2,
  Languages,
  Sparkles,
} from 'lucide-react'
import { useEntryStore } from '../../../../store/entry-store'
import {
  useGeneralSettingKey,
  useTranslationSettingKey,
} from '../../../../store/settings-store'
import { EntryAvatar } from '../components/EntryAvatar'
import { SocialAITranslation } from '../components/SocialAITranslation'
import { SocialAISummary } from '../components/SocialAISummary'
import { SocialActionBar } from '../components/SocialActionBar'
import { SocialMediaGallery } from '../../SocialMediaGallery'
import { VideoPlayer, pauseInlineVideos } from '../../../ui/VideoPlayer'
import { useEntryAvatar } from '../hooks/useEntryAvatar'
import { useEntryExpanded } from '../hooks/useEntryExpanded'
import { useEntryMediaState } from '../hooks/useEntryMediaState'
import { useEntryAI } from '../hooks/useEntryAI'
import { cleanRelativeTime } from '../utils/entry-text'
import {
  parseSocialHandle,
  extractTwitterDisplayNameFromFeedTitle,
} from '../utils/entry-social'
import {
  canonicalizeSocialUrl,
  normalizeSocialHandle,
} from '../../../../lib/social-url'
import {
  cleanSocialTextHtml,
  cleanSocialPlainText,
  extractPixnoyOriginUrl,
  isGenericInstagramIconUrl,
  normalizeInstagramUnavatar,
  resolveEntryBrowserOpenUrl,
  findRelatedSocialEntryFallback,
  resolveSocialEntryMediaDecision,
} from '../utils/entry-media'
import type { Entry } from '../../../../../../shared/types'
import { measureStartupRender } from '../../../../lib/startup-block-diagnostics'

export const SocialMediaItem = memo(function SocialMediaItem({
  entry,
  isActive,
  onSelect,
  onDoubleClick,
  feedTitle,
  feedImage,
  feedSiteUrl,
  feedUrl,
  entryIndex: _entryIndex,
  totalEntries: _totalEntries,
  onMarkAboveRead: _onMarkAboveRead,
  onMarkBelowRead: _onMarkBelowRead,
  onContextMenu,
  dimRead,
  onOpenBilibiliInPage,
  onMediaAllFailed,
}: {
  entry: Entry
  isActive: boolean
  onSelect: () => void
  onDoubleClick?: () => void
  feedTitle?: string
  feedImage?: string
  feedSiteUrl?: string
  feedUrl?: string
  entryIndex?: number
  totalEntries?: number
  onMarkAboveRead?: () => void
  onMarkBelowRead?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  dimRead?: boolean
  onOpenBilibiliInPage?: (entry: Entry, url: string) => void
  onMediaAllFailed?: () => void
}) {
  const { t } = useTranslation()
  const allEntries = useEntryStore((s) => s.entries)

  // Parse the social handle. Prefer the subscription's *own* handle (from the
  // feed URL) over the entry URL: retweets carry the original author in their
  // link + dc:creator, so reading the handle off the entry URL mislabels the
  // post as the retweeted account instead of the feed owner.
  const canonicalEntryUrl = useMemo(
    () => canonicalizeSocialUrl(entry.url || ''),
    [entry.url],
  )
  const canonicalFeedUrl = useMemo(
    () => canonicalizeSocialUrl(feedUrl || ''),
    [feedUrl],
  )
  const parsed = useMemo(() => {
    const fromFeed = parseSocialHandle(canonicalFeedUrl)
    if (fromFeed.type !== 'other' && fromFeed.handle) return fromFeed
    return parseSocialHandle(canonicalEntryUrl)
  }, [canonicalFeedUrl, canonicalEntryUrl])
  const authorName = useMemo(() => {
    if (parsed.type === 'x') {
      const feedDisplayName = extractTwitterDisplayNameFromFeedTitle(
        feedTitle,
        parsed.handle,
      )
      if (feedDisplayName) return feedDisplayName
    }
    return (entry.author || feedTitle || parsed.handle || '')
      .replace(/^@+/, '')
      .trim()
  }, [entry.author, feedTitle, parsed.type, parsed.handle])

  const timeAgo = measureStartupRender(
    'SocialMediaItem.timeAgo',
    () => cleanRelativeTime(entry.publishedAt),
    `id=${entry.id}`,
  )

  // Content: prefer HTML content, fallback to summary
  const htmlContent = entry.content || entry.summary || ''
  // Sanitize HTML and strip media tags for inline display
  const sanitizedContent = useMemo(() => {
    if (!htmlContent.includes('<')) return ''
    return measureStartupRender(
      'SocialMediaItem.sanitizeHtml',
      () => cleanSocialTextHtml(htmlContent),
      `id=${entry.id} length=${htmlContent.length}`,
    )
  }, [entry.id, htmlContent])
  // Plain text fallback
  const plainContent = useMemo(() => {
    const source = sanitizedContent || htmlContent
    const cleaned = measureStartupRender(
      'SocialMediaItem.cleanText',
      () => cleanSocialPlainText(source),
      `id=${entry.id} length=${source.length}`,
    )
    if (cleaned) return cleaned
    return (entry.title || '').trim()
  }, [entry.id, sanitizedContent, htmlContent, entry.title])
  const relatedEntryFallback = useMemo(
    () =>
      measureStartupRender(
        'SocialMediaItem.relatedFallback',
        () => findRelatedSocialEntryFallback(entry, allEntries),
        `id=${entry.id} entries=${allEntries.length}`,
      ),
    [allEntries, entry],
  )
  const browserOpenUrl = useMemo(
    () =>
      resolveEntryBrowserOpenUrl(entry) ||
      resolveEntryBrowserOpenUrl(relatedEntryFallback?.candidate || entry),
    [entry, relatedEntryFallback],
  )
  const { visibleVideos, galleryPhotos, hasMirrorDerivedPhotoContent } =
    useMemo(
      () =>
        measureStartupRender(
          'SocialMediaItem.resolveMedia',
          () =>
            resolveSocialEntryMediaDecision({
              entry,
              relatedFallbackCover: relatedEntryFallback?.cover,
            }),
          `id=${entry.id} media=${entry.media?.length ?? 0}`,
        ),
      [entry, relatedEntryFallback?.cover],
    )

  // Use media state hook
  const { isMediaExpanded, setIsMediaExpanded } = useEntryMediaState(entry.id)
  const visibleGalleryPhotos =
    galleryPhotos.length > 9 && !isMediaExpanded
      ? galleryPhotos.slice(0, 9)
      : galleryPhotos

  // Collapsible content area for long social posts - use expanded hook
  const contentRef = useRef<HTMLDivElement>(null)
  const CONTENT_COLLAPSE_HEIGHT = 220
  const { isExpanded, setIsExpanded, isOverflow, setIsOverflow } =
    useEntryExpanded(entry.id)

  useLayoutEffect(() => {
    if (contentRef.current) {
      setIsOverflow(contentRef.current.scrollHeight > CONTENT_COLLAPSE_HEIGHT)
    }
  }, [sanitizedContent, plainContent, setIsOverflow])

  // Smart avatar: use unavatar.io for Twitter/X feeds (always-fresh),
  // Detect from siteUrl (x.com/user) or feedUrl (rsshub /twitter/user/xxx)
  const twitterAvatar = useMemo(() => {
    if (feedSiteUrl) {
      try {
        const { hostname, pathname } = new URL(feedSiteUrl)
        if (
          hostname === 'x.com' ||
          hostname === 'twitter.com' ||
          hostname === 'www.x.com' ||
          hostname === 'www.twitter.com'
        ) {
          const username = pathname.split('/').filter(Boolean)[0]
          if (username && /^[a-zA-Z0-9_]+$/.test(username)) {
            return `https://unavatar.io/x/${username}`
          }
        }
      } catch {}
    }
    if (feedUrl) {
      const m = feedUrl.match(/\/twitter\/user\/([a-zA-Z0-9_]+)/i)
      if (m) {
        return `https://unavatar.io/x/${m[1]}`
      }
    }
    return null
  }, [feedSiteUrl, feedUrl])

  const cleanAuthorAvatar = useMemo(() => {
    const candidate = normalizeInstagramUnavatar(entry.authorAvatar || '')
    return candidate && !isGenericInstagramIconUrl(candidate) ? candidate : ''
  }, [entry.authorAvatar])

  const cleanFeedImage = useMemo(() => {
    const candidate = normalizeInstagramUnavatar(feedImage || '')
    return candidate && !isGenericInstagramIconUrl(candidate) ? candidate : ''
  }, [feedImage])

  // Build avatar candidates array for fallback
  const avatarCandidates = useMemo(() => {
    return [
      twitterAvatar || '',
      cleanAuthorAvatar,
      extractPixnoyOriginUrl(cleanAuthorAvatar),
      cleanFeedImage,
      extractPixnoyOriginUrl(cleanFeedImage),
    ]
  }, [twitterAvatar, cleanAuthorAvatar, cleanFeedImage])

  // Use avatar hook with multiple candidates
  const { avatarUrl, avatarImageFailed, handleAvatarError } = useEntryAvatar(
    entry.id,
    avatarCandidates,
  )
  const avatarLetter = (entry.author || feedTitle || '?')[0]

  // AI translation & summary state - use AI hook
  const language = useGeneralSettingKey('language')
  const targetLanguage = useTranslationSettingKey('targetLanguage')
  const {
    tweetTranslatedParagraphs,
    isTranslatingTweet,
    showTweetTranslation,
    handleTranslateTweet,
    tweetParagraphs,
    tweetSummary,
    isSummarizingTweet,
    showTweetSummary,
    handleSummarizeTweet,
    tweetTextContent,
  } = useEntryAI(entry.id, entry, sanitizedContent, language, targetLanguage)

  // Hover action bar state
  const [showActionBar, setShowActionBar] = useState(false)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = useCallback(() => {
    hoverTimerRef.current = setTimeout(() => setShowActionBar(true), 150)
  }, [])
  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    setShowActionBar(false)
  }, [])

  const handleSelect = useCallback(() => {
    pauseInlineVideos()
    onSelect()
  }, [onSelect])

  return (
    <article
      onClick={handleSelect}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onDoubleClick?.()
      }}
      onContextMenu={onContextMenu}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`@container relative mx-auto max-w-[clamp(45ch,60vw,65ch)] cursor-pointer rounded-md pl-4 pr-3 transition-colors duration-200 ${
        isActive
          ? 'bg-accent/10'
          : 'hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40'
      } ${dimRead && entry.isRead && !isActive ? 'opacity-50' : ''}`}
    >
      {/* Floating hover action bar */}
      {showActionBar && !isActive && (
        <SocialActionBar
          entry={entry}
          browserOpenUrl={browserOpenUrl}
          onContextMenu={onContextMenu}
          onTranslate={handleTranslateTweet}
          onSummarize={handleSummarizeTweet}
          isTranslating={isTranslatingTweet}
          isSummarizing={isSummarizingTweet}
          hasTranslation={tweetTranslatedParagraphs.length > 0}
          showTranslation={showTweetTranslation}
        />
      )}

      <div
        className={`group relative flex py-4 ${
          !entry.isRead
            ? 'before:bg-accent before:absolute before:-left-3 before:top-8 before:block before:size-2 before:rounded-full'
            : ''
        }`}
      >
        {/* Avatar */}
        <div className="mt-1 flex-shrink-0">
          <EntryAvatar
            avatarUrl={avatarUrl}
            avatarImageFailed={avatarImageFailed}
            avatarLetter={avatarLetter}
            onError={handleAvatarError}
            size="medium"
          />
        </div>

        {/* Content area */}
        <div className="ml-2 min-w-0 flex-1">
          {/* Author line */}
          <div className="-mt-0.5 flex-1 text-sm">
            <div className="flex select-none flex-wrap space-x-1 leading-6">
              <span className="inline-flex min-w-0 items-center gap-1 text-base font-semibold">
                {authorName}
                {parsed.type === 'x' && (
                  <svg
                    viewBox="0 0 24 24"
                    className="inline-block h-3 w-3 text-[#4A99E9]"
                    fill="currentColor"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                )}
                {parsed.type === 'telegram' && (
                  <svg
                    viewBox="0 0 24 24"
                    className="inline-block h-3 w-3 text-[#26A5E4]"
                    fill="currentColor"
                  >
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                  </svg>
                )}
                {parsed.type === 'bluesky' && (
                  <svg
                    viewBox="0 0 24 24"
                    className="inline-block h-3 w-3 text-[#0085FF]"
                    fill="currentColor"
                  >
                    <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.785 2.627 3.588 3.476 6.182 3.21l.206-.043c-2.87.482-6.082 1.563-6.082 5.609 0 4.051 4.494 3.693 6.137 3.051 3.09-1.208 4.343-4.514 4.635-6.117l.298.052c.291 1.603 1.542 4.909 4.632 6.117 1.643.642 6.137 1 6.137-3.051 0-4.046-3.212-5.127-6.082-5.609l.206.043c2.594.266 5.397-.583 6.182-3.21.246-.828.624-5.79.624-6.479 0-.688-.139-1.86-.902-2.203-.659-.299-1.664-.621-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8" />
                  </svg>
                )}
                {parsed.type === 'threads' && (
                  <svg
                    viewBox="0 0 24 24"
                    className="inline-block h-3 w-3 text-black dark:text-white"
                    fill="currentColor"
                  >
                    <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.19.408-2.285 1.33-3.082.88-.762 2.098-1.2 3.528-1.271 1.194-.06 2.3.076 3.29.378-.064-.349-.166-.676-.31-.978-.537-1.132-1.555-1.73-2.943-1.73h-.094c-.86.013-1.593.313-2.114.868l-1.37-1.508c.855-.775 2.006-1.2 3.338-1.23h.142c2.085 0 3.674.984 4.468 2.764.366.82.576 1.758.634 2.8.598.265 1.14.59 1.62.977 1.178.948 1.91 2.21 2.078 3.658.195 1.671-.331 3.396-1.48 4.854C17.95 22.78 15.618 23.976 12.186 24m-1.638-8.758c-1.035.055-1.75.462-2.076.814-.392.432-.575.96-.547 1.53.042.782.44 1.387 1.154 1.75.596.306 1.355.395 2.079.36 1.238-.067 2.198-.55 2.774-1.382.385-.554.639-1.265.748-2.124-.736-.26-1.567-.406-2.5-.401-.551.003-1.081.12-1.632.453" />
                  </svg>
                )}
              </span>
              {parsed.handle &&
                normalizeSocialHandle(parsed.handle).toLowerCase() !==
                  normalizeSocialHandle(authorName).toLowerCase() && (
                  <a
                    href={
                      parsed.type === 'x'
                        ? `https://x.com/${normalizeSocialHandle(parsed.handle)}`
                        : parsed.type === 'telegram'
                          ? `https://t.me/${parsed.handle}`
                          : parsed.type === 'bluesky'
                            ? `https://bsky.app/profile/${parsed.handle}`
                            : parsed.type === 'threads'
                              ? `https://www.threads.net/@${normalizeSocialHandle(parsed.handle)}`
                              : parsed.type === 'truth'
                                ? `https://truthsocial.com/@${normalizeSocialHandle(parsed.handle)}`
                                : '#'
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-500 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    @{normalizeSocialHandle(parsed.handle)}
                  </a>
                )}
              <span className="text-zinc-500">·</span>
              <span className="text-zinc-500">{timeAgo}</span>
            </div>

            {/* Content area with masked collapse for long posts */}
            <div
              className={`relative mt-1 text-base ${entry.isStarred ? 'pr-5' : ''}`}
            >
              <div
                ref={contentRef}
                className={`relative ${!isExpanded && isOverflow ? 'max-h-[220px] overflow-hidden' : ''}`}
                style={
                  !isExpanded && isOverflow
                    ? {
                        WebkitMaskImage:
                          'linear-gradient(to bottom, black 72%, transparent 100%)',
                        maskImage:
                          'linear-gradient(to bottom, black 72%, transparent 100%)',
                      }
                    : undefined
                }
              >
                {sanitizedContent ? (
                  <div
                    className="prose dark:prose-invert prose-blockquote:mt-0 max-w-none cursor-pointer select-text align-middle text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: sanitizedContent }}
                  />
                ) : (
                  <p className="cursor-pointer select-text whitespace-pre-line text-sm leading-relaxed">
                    {plainContent}
                  </p>
                )}
              </div>
              {isOverflow && !isExpanded && (
                <div className="absolute inset-x-0 -bottom-2 flex select-none justify-center py-2 duration-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsExpanded(true)
                    }}
                    title={t('entryList.expandMore', {
                      defaultValue: 'Expand',
                    })}
                    className="bg-background/95 hover:text-text-primary border-border text-text-secondary inline-flex h-7 w-7 items-center justify-center rounded-full border shadow-sm transition-colors"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              )}
              {isOverflow && isExpanded && (
                <div className="mt-1 flex justify-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsExpanded(false)
                    }}
                    title={t('entryList.collapse', {
                      defaultValue: 'Collapse',
                    })}
                    className="bg-background/95 hover:text-text-primary border-border text-text-secondary inline-flex h-7 w-7 items-center justify-center rounded-full border shadow-sm transition-colors"
                  >
                    <ChevronUp size={14} />
                  </button>
                </div>
              )}
              {entry.isStarred && (
                <Star
                  size={14}
                  className="absolute right-0 top-0 fill-yellow-500 text-yellow-500"
                />
              )}
            </div>
          </div>

          {/* Media gallery */}
          {galleryPhotos.length > 0 && (
            <div>
              <div className="relative">
                <SocialMediaGallery
                  photos={visibleGalleryPhotos}
                  cacheScope={entry.id}
                  onAllFailed={onMediaAllFailed}
                  hasMirrorDerivedContent={hasMirrorDerivedPhotoContent}
                />
              </div>
              {galleryPhotos.length > 9 && !isMediaExpanded && (
                <div className="mt-1 flex justify-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsMediaExpanded(true)
                    }}
                    title={t('entryList.expandMore', {
                      defaultValue: 'Expand',
                    })}
                    className="bg-background/95 hover:text-text-primary border-border text-text-secondary inline-flex h-7 w-7 items-center justify-center rounded-full border shadow-sm transition-colors"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Video items */}
          {visibleVideos.map((video, i) => (
            <div key={`video-${i}`} className="mt-3">
              <VideoPlayer
                src={video.url}
                previewImage={video.previewUrl}
                className="aspect-video w-full rounded-lg"
                onOpenBilibiliInPage={(url) =>
                  onOpenBilibiliInPage?.(entry, url)
                }
              />
            </div>
          ))}
          {galleryPhotos.length > 9 && isMediaExpanded && (
            <div className="mt-2 flex justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsMediaExpanded(false)
                }}
                title={t('entryList.collapse', { defaultValue: 'Collapse' })}
                className="bg-background/95 hover:text-text-primary border-border text-text-secondary inline-flex h-7 w-7 items-center justify-center rounded-full border shadow-sm transition-colors"
              >
                <ChevronUp size={14} />
              </button>
            </div>
          )}

          {/* AI Translation result - bilingual paragraph-by-paragraph */}
          {showTweetTranslation && (
            <SocialAITranslation
              isTranslating={isTranslatingTweet}
              tweetParagraphs={tweetParagraphs}
              tweetTranslatedParagraphs={tweetTranslatedParagraphs}
            />
          )}

          {/* AI Summary result */}
          {showTweetSummary && (
            <SocialAISummary
              isSummarizing={isSummarizingTweet}
              tweetSummary={tweetSummary}
            />
          )}

          {/* Inline AI action buttons - below content */}
          {tweetTextContent && (
            <div
              className="mt-2 flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={handleTranslateTweet}
                disabled={isTranslatingTweet}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                  showTweetTranslation && tweetTranslatedParagraphs.length > 0
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-tertiary hover:bg-accent/5 hover:text-accent'
                }`}
                title={t('social.translateTweet')}
              >
                {isTranslatingTweet ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Languages size={12} />
                )}
                {t('social.translateTweet')}
              </button>
              <button
                onClick={handleSummarizeTweet}
                disabled={isSummarizingTweet}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                  showTweetSummary && tweetSummary
                    ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                    : 'text-text-tertiary hover:bg-amber-50/50 hover:text-amber-600 dark:hover:bg-amber-900/10 dark:hover:text-amber-400'
                }`}
                title={t('social.summarizeTweet')}
              >
                {isSummarizingTweet ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Sparkles size={12} />
                )}
                {t('social.summarizeTweet')}
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
})
