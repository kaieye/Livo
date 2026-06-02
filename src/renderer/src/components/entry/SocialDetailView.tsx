import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import { SocialAuthorHeader } from './SocialAuthorHeader'
import { SocialContentBody } from './SocialContentBody'
import { SocialSummaryCard } from './SocialSummaryCard'
import { OverlayMediaGallery } from './OverlayMediaGallery'
import { useEntryStore } from '../../store/entry-store'

export interface SocialDetailViewProps {
  /** The entry ID for the social media post to display */
  entryId: string
  /** Original social content HTML paragraphs */
  paragraphs: string[]
  /** Full original HTML content (fallback) */
  fullContent: string
  /** Plain text content for AI operations */
  plainContent: string
  /** Author avatar URL */
  avatarUrl: string
  /** Whether avatar image failed to load */
  avatarImageFailed: boolean
  /** Fallback letter for avatar */
  avatarLetter: string
  /** Author display name */
  authorName: string
  /** Human-readable relative time label */
  timeAgo: string
  /** Callback when avatar image errors */
  onAvatarError: () => void

  // --- AI state (mirrors AIAssistContent shape) ---
  showTranslation: boolean
  translatedParagraphs: string[]
  isTranslating: boolean
  isSummarizing: boolean
  showSummary: boolean
  summary: string | null

  /** Font size in px */
  fontSize: number

  /** Optional additional CSS classes */
  className?: string
}

/**
 * Social media content detail view.
 *
 * Composes existing social sub-components (SocialAuthorHeader, SocialContentBody,
 * SocialSummaryCard, OverlayMediaGallery) into a page-level detail layout for
 * social media entries (FeedViewType.SocialMedia).
 *
 * Used by ArticleDetailPage when the selected entry is detected as social content.
 * Mirrors the layout pattern from SocialOverlayView but without the overlay chrome
 * (backdrop, close button, sticky header) — page chrome is owned by ArticleDetailPage.
 *
 * One adapter = hypothetical seam. Used by one page. If a second consumer appears,
 * consider promoting shared layout logic to a more generic SocialContentLayout.
 */
export const SocialDetailView = memo(function SocialDetailView({
  entryId: _entryId,
  paragraphs,
  fullContent,
  plainContent,
  avatarUrl,
  avatarImageFailed,
  avatarLetter,
  authorName,
  timeAgo,
  onAvatarError,
  showTranslation,
  translatedParagraphs,
  isTranslating,
  isSummarizing,
  showSummary,
  summary,
  fontSize,
  className = '',
}: SocialDetailViewProps) {
  const { t } = useTranslation()
  const selectedEntry = useEntryStore((s) => s.selectedEntry)

  // Resolve display photos/videos from entry media (mirror WideViewContent logic)
  const displayPhotos =
    selectedEntry?.media
      ?.filter((m) => m.type === 'photo')
      .map((m) => ({ url: m.url, previewUrl: m.previewUrl })) ?? []

  const videos =
    selectedEntry?.media
      ?.filter((m) => m.type === 'video')
      .map((m) => ({ url: m.url, previewUrl: m.previewUrl })) ?? []

  return (
    <div className={`space-y-5 ${className}`}>
      {/* AI summary card — shown above author when active */}
      <SocialSummaryCard
        visible={showSummary}
        isSummarizing={isSummarizing}
        summary={summary}
      />

      {/* Author header: avatar + name + time */}
      <SocialAuthorHeader
        avatarUrl={avatarUrl}
        avatarImageFailed={avatarImageFailed}
        avatarLetter={avatarLetter}
        authorName={authorName}
        timeAgo={timeAgo}
        onAvatarError={onAvatarError}
      />

      {/* Social content body with optional bilingual translation */}
      <SocialContentBody
        showTranslation={showTranslation}
        translatedParagraphs={translatedParagraphs}
        isTranslating={isTranslating}
        paragraphs={paragraphs}
        fullContent={fullContent}
        plainContent={plainContent}
        fontSize={fontSize}
      />

      {/* Media gallery: photos + videos */}
      {(displayPhotos.length > 0 || videos.length > 0) && (
        <OverlayMediaGallery
          displayPhotos={displayPhotos}
          videos={videos}
          previewIdx={null}
          lightboxOpen={false}
          failedPhotoTokens={new Set()}
          getPhotoToken={(p) => p?.url ?? ''}
          getPhotoInitialSrc={(p) => p?.previewUrl ?? p?.url ?? ''}
          onPhotoError={() => {}}
          onSetPreviewIdx={() => {}}
          onSetLightboxOpen={() => {}}
        />
      )}

      {/* Empty state when no content and no translation */}
      {!fullContent && !plainContent && !showTranslation && (
        <p className="py-12 text-center text-sm text-[var(--color-text-secondary)]">
          {t('entry.noContent')}
        </p>
      )}
    </div>
  )
})
