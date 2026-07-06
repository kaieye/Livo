import { memo } from 'react'

import { ScrollArea } from '../ui/ScrollArea'
import { OverlayMediaGallery } from './OverlayMediaGallery'
import { SocialAuthorHeader } from './SocialAuthorHeader'
import { SocialContentBody } from './SocialContentBody'
import { SocialOverlayHeader } from './SocialOverlayHeader'
import { SocialSummaryCard } from './SocialSummaryCard'

type OverlayPhoto = {
  url?: string
  previewUrl?: string
}

type OverlayVideo = {
  url: string
  previewUrl?: string
}

export const SocialOverlayView = memo(function SocialOverlayView({
  onClose,
  contentWidthClass,
  contentWidthStyle,
  plainContent,
  isTranslating,
  showTranslation,
  translatedParagraphCount,
  isSummarizing,
  showSummary,
  summary,
  browserOpenUrl,
  onTranslate,
  onSummarize,
  lineHeight,
  fontFamily,
  avatarUrl,
  avatarImageFailed,
  avatarLetter,
  authorName,
  timeAgo,
  onAvatarError,
  translatedParagraphs,
  paragraphs,
  fullContent,
  fontSize,
  displayPhotos,
  videos,
  previewIdx,
  lightboxOpen,
  failedPhotoTokens,
  getPhotoToken,
  getPhotoInitialSrc,
  onPhotoError,
  onSetPreviewIdx,
  onSetLightboxOpen,
  photoFrameHeight,
}: {
  onClose: () => void
  contentWidthClass: string
  contentWidthStyle?: React.CSSProperties
  plainContent: string
  isTranslating: boolean
  showTranslation: boolean
  translatedParagraphCount: number
  isSummarizing: boolean
  showSummary: boolean
  summary: string | null
  browserOpenUrl: string
  onTranslate: () => void
  onSummarize: () => void
  lineHeight?: number
  fontFamily?: string
  avatarUrl: string
  avatarImageFailed: boolean
  avatarLetter: string
  authorName: string
  timeAgo: string
  onAvatarError: () => void
  translatedParagraphs: string[]
  paragraphs: string[]
  fullContent: string
  fontSize: number
  displayPhotos: OverlayPhoto[]
  videos: OverlayVideo[]
  previewIdx: number | null
  lightboxOpen: boolean
  failedPhotoTokens: Set<string>
  getPhotoToken: (photo?: OverlayPhoto) => string
  getPhotoInitialSrc: (photo?: OverlayPhoto) => string
  onPhotoError: (
    photo: OverlayPhoto | undefined,
    e: React.SyntheticEvent<HTMLImageElement>,
  ) => void
  onSetPreviewIdx: (index: number) => void
  onSetLightboxOpen: (open: boolean) => void
  photoFrameHeight?: string
}) {
  return (
    <div className="absolute inset-0 z-[50] flex flex-col overflow-hidden">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      <ScrollArea
        rootClassName="relative z-10 min-h-0 flex-1"
        viewportClassName="h-full min-h-0 overflow-y-auto bg-white dark:bg-surface-dark"
      >
        <SocialOverlayHeader
          contentWidthClass={contentWidthClass}
          contentWidthStyle={contentWidthStyle}
          plainContent={plainContent}
          isTranslating={isTranslating}
          showTranslation={showTranslation}
          translatedParagraphCount={translatedParagraphCount}
          isSummarizing={isSummarizing}
          showSummary={showSummary}
          summary={summary}
          browserOpenUrl={browserOpenUrl}
          onClose={onClose}
          onTranslate={onTranslate}
          onSummarize={onSummarize}
        />

        <div
          data-context-select-scope="article"
          className={`${contentWidthClass} mx-auto space-y-5 px-4 pb-12 pt-4`}
          style={{ lineHeight, fontFamily, ...contentWidthStyle }}
        >
          <SocialSummaryCard
            visible={showSummary}
            isSummarizing={isSummarizing}
            summary={summary}
          />

          <SocialAuthorHeader
            avatarUrl={avatarUrl}
            avatarImageFailed={avatarImageFailed}
            avatarLetter={avatarLetter}
            authorName={authorName}
            timeAgo={timeAgo}
            onAvatarError={onAvatarError}
          />

          <SocialContentBody
            showTranslation={showTranslation}
            translatedParagraphs={translatedParagraphs}
            isTranslating={isTranslating}
            paragraphs={paragraphs}
            fullContent={fullContent}
            plainContent={plainContent}
            fontSize={fontSize}
          />

          <OverlayMediaGallery
            displayPhotos={displayPhotos}
            videos={videos}
            previewIdx={previewIdx}
            lightboxOpen={lightboxOpen}
            failedPhotoTokens={failedPhotoTokens}
            getPhotoToken={getPhotoToken}
            getPhotoInitialSrc={getPhotoInitialSrc}
            onPhotoError={onPhotoError}
            onSetPreviewIdx={onSetPreviewIdx}
            onSetLightboxOpen={onSetLightboxOpen}
            photoFrameHeight={photoFrameHeight}
          />
        </div>
      </ScrollArea>
    </div>
  )
})
