import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, Inbox } from 'lucide-react'
import { EntryAvatar } from '../components/EntryAvatar'
import { useEntryAvatar } from '../hooks/useEntryAvatar'
import { cleanRelativeTime } from '../utils/entry-text'
import {
  resolveGridCardMedia,
  advanceCardImageFallback,
  normalizeInstagramUnavatar,
  isGenericInstagramIconUrl,
} from '../utils/entry-media'
import { cleanSocialPlainText } from '../utils/entry-media'
import { isSummaryRedundant } from '../utils/entry-text'
import type { Entry } from '../../../../../../shared/types'

/** Grid card for media/video view */
export const GridCard = memo(function GridCard({
  entry,
  isActive,
  onSelect,
  onContextMenu,
  feedTitle,
  feedImage,
  isVideo,
  showSummary = true,
}: {
  entry: Entry
  isActive: boolean
  onSelect: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  feedTitle?: string
  feedImage?: string
  isVideo?: boolean
  showSummary?: boolean
}) {
  const { t } = useTranslation()
  const { photoCovers, coverUrl, photoCount } = useMemo(
    () => resolveGridCardMedia(entry),
    [entry],
  )
  const cleanFeedAvatar = useMemo(() => {
    const candidate = normalizeInstagramUnavatar(feedImage || '')
    return candidate && !isGenericInstagramIconUrl(candidate) ? candidate : ''
  }, [feedImage])

  // Use avatar hook for fallback management
  const { avatarUrl, avatarImageFailed, handleAvatarError } = useEntryAvatar(
    entry.id,
    cleanFeedAvatar,
  )
  const avatarLetter = (feedTitle || '?')[0]

  return (
    <button
      onClick={onSelect}
      onContextMenu={onContextMenu}
      className={`w-full overflow-hidden rounded-xl border text-left transition-all ${
        isActive
          ? 'border-accent ring-accent/30 ring-2'
          : 'hover:border-border dark:hover:border-surface-dark-tertiary border-transparent'
      } bg-surface-secondary dark:bg-surface-dark-secondary`}
    >
      {/* Cover image */}
      <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary relative aspect-[4/3]">
        {!isVideo && photoCovers.length > 1 ? (
          <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-[1px] bg-black/10">
            {photoCovers.map((src, idx) => (
              <img
                key={`${entry.id}:photo:${idx}`}
                src={src}
                alt=""
                className="h-full w-full object-cover"
                loading={idx === 0 ? 'eager' : 'lazy'}
                onError={(e) => {
                  advanceCardImageFallback(e, src, (img) => {
                    img.style.display = 'none'
                  })
                }}
              />
            ))}
          </div>
        ) : coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              advanceCardImageFallback(e, coverUrl, (img) => {
                const root = img.closest('button') as HTMLElement | null
                if (root) {
                  root.style.display = 'none'
                } else {
                  img.style.display = 'none'
                }
              })
            }}
          />
        ) : (
          <div className="text-text-tertiary flex h-full w-full items-center justify-center">
            {isVideo ? <Play size={32} /> : <Inbox size={32} />}
          </div>
        )}
        {isVideo && coverUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60">
              <Play size={18} className="ml-0.5 text-white" fill="white" />
            </div>
          </div>
        )}
        {/* Video duration badge */}
        {isVideo &&
          (() => {
            const videoMedia = entry.media?.find((m) => m.type === 'video')
            if (videoMedia?.duration && videoMedia.duration > 0) {
              const d = videoMedia.duration
              const h = Math.floor(d / 3600)
              const m = Math.floor((d % 3600) / 60)
              const s = Math.floor(d % 60)
              const formatted =
                h > 0
                  ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
                  : `${m}:${String(s).padStart(2, '0')}`
              return (
                <div className="absolute bottom-2 left-2 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  {formatted}
                </div>
              )
            }
            return null
          })()}
        {!entry.isRead && (
          <div className="bg-accent absolute right-2 top-2 h-2.5 w-2.5 rounded-full" />
        )}
        {photoCount > 1 && (
          <div className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
            {photoCount} {t('entryList.images')}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2">
        {(() => {
          const displayTitle =
            entry.title ||
            (entry.summary || entry.content || '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
          return displayTitle ? (
            <h3
              className={`truncate whitespace-nowrap text-xs leading-snug ${entry.isRead ? 'text-text-secondary dark:text-text-dark-secondary' : 'font-medium'}`}
            >
              {displayTitle}
            </h3>
          ) : null
        })()}
        {isVideo &&
          showSummary &&
          (() => {
            const cleanSummary = cleanSocialPlainText(
              entry.summary || entry.content || '',
            )
              .replace(/\s+/g, ' ')
              .trim()
            if (
              !cleanSummary ||
              isSummaryRedundant(entry.title || '', cleanSummary)
            ) {
              return null
            }
            return (
              <p className="text-text-secondary dark:text-text-dark-secondary mt-1 line-clamp-2 text-[11px] leading-snug">
                {cleanSummary}
              </p>
            )
          })()}
        <div className="text-text-tertiary mt-1 flex items-center justify-between text-[10px]">
          <div className="flex min-w-0 items-center gap-1">
            <span className="bg-surface-tertiary text-text-secondary dark:bg-surface-dark-tertiary dark:text-text-dark-secondary flex h-4 w-4 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-[9px] uppercase">
              <EntryAvatar
                avatarUrl={avatarUrl}
                avatarImageFailed={avatarImageFailed}
                avatarLetter={avatarLetter}
                onError={handleAvatarError}
                size="small"
              />
            </span>
            {feedTitle && (
              <span className="min-w-0 truncate text-[11px] font-medium">
                {feedTitle}
              </span>
            )}
          </div>
          {entry.publishedAt && (
            <span className="ml-2 flex-shrink-0 whitespace-nowrap text-[10px]">
              {cleanRelativeTime(entry.publishedAt)}
            </span>
          )}
        </div>
      </div>
    </button>
  )
})
