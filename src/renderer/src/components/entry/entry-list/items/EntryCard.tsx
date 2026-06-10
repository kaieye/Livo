import { memo } from 'react'
import { Star } from 'lucide-react'
import { QueuedImage } from '../../../ui/QueuedImage'
import { getThumbnailUrl } from '../../../../lib/image-proxy'
import { cleanRelativeTime, isSummaryRedundant } from '../utils/entry-text'
import {
  decodeHtmlEntitiesUrl,
  decodeMediaUrl,
  advanceCardImageFallback,
} from '../utils/entry-media'
import type { Entry } from '../../../../../../shared/types'
import { measureStartupRender } from '../../../../lib/startup-block-diagnostics'

/** Standard list item card */
export const EntryCard = memo(function EntryCard({
  entry,
  isActive,
  onSelect,
  feedTitle,
  dimRead,
  imageProxy,
  onContextMenu,
}: {
  entry: Entry
  isActive: boolean
  onSelect: () => void
  feedTitle?: string
  dimRead?: boolean
  imageProxy?: boolean
  onContextMenu?: (e: React.MouseEvent) => void
}) {
  const timeAgo = measureStartupRender(
    'EntryCard.timeAgo',
    () => cleanRelativeTime(entry.publishedAt),
    `id=${entry.id}`,
  )

  // Thumbnail: prefer first media photo, then imageUrl, then extract from content.
  // Use previewUrl (stable mirror proxy) when available instead of url (expiring CDN).
  const { rawThumbnail, thumbnail } = measureStartupRender(
    'EntryCard.thumbnail',
    () => {
      const firstPhoto = entry.media?.find((m) => m.type === 'photo')
      const rawThumbnail = firstPhoto?.previewUrl
        ? decodeHtmlEntitiesUrl(firstPhoto.previewUrl)
        : decodeMediaUrl(
            firstPhoto?.url ||
              entry.media?.find((m) => m.type === 'video')?.previewUrl ||
              entry.imageUrl ||
              '',
          )
      return {
        rawThumbnail,
        thumbnail:
          rawThumbnail && imageProxy
            ? getThumbnailUrl(rawThumbnail, 80)
            : rawThumbnail,
      }
    },
    `id=${entry.id} media=${entry.media?.length ?? 0} image=${entry.imageUrl ? 1 : 0}`,
  )

  const hasThumbnail = !!thumbnail

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      onContextMenu={onContextMenu}
      className={`border-surface-secondary dark:border-surface-dark-tertiary w-full cursor-pointer border-b px-4 py-3.5 text-left transition-colors ${
        isActive
          ? '!border-l-accent bg-accent/5 border-l-2'
          : 'hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary'
      } ${dimRead && entry.isRead && !isActive ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Unread indicator */}
        {!entry.isRead && (
          <div className="bg-accent mt-1.5 h-2 w-2 flex-shrink-0 rounded-full" />
        )}

        <div
          className="min-w-0 flex-1"
          style={{ maxWidth: hasThumbnail ? 'calc(100% - 92px)' : undefined }}
        >
          {/* Feed name + time */}
          <div className="text-text-secondary dark:text-text-dark-secondary mb-0.5 flex items-center gap-1 text-[10px] font-bold">
            {feedTitle && (
              <span className="max-w-[120px] truncate">{feedTitle}</span>
            )}
            {feedTitle && <span className="text-text-tertiary">·</span>}
            <span className="text-text-tertiary flex-shrink-0">{timeAgo}</span>
            {entry.isStarred && (
              <Star
                size={10}
                className="flex-shrink-0 fill-yellow-500 text-yellow-500"
              />
            )}
          </div>

          {entry.title ? (
            <h3
              className={`line-clamp-2 text-sm leading-snug ${
                entry.isRead
                  ? 'text-text-secondary dark:text-text-dark-secondary'
                  : 'font-medium'
              }`}
            >
              {entry.title}
            </h3>
          ) : (
            (() => {
              const fallback = (entry.summary || entry.content || '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
              return fallback ? (
                <h3
                  className={`line-clamp-2 text-sm leading-snug ${
                    entry.isRead
                      ? 'text-text-secondary dark:text-text-dark-secondary'
                      : 'font-medium'
                  }`}
                >
                  {fallback}
                </h3>
              ) : null
            })()
          )}

          {entry.title &&
            entry.summary &&
            !isSummaryRedundant(entry.title, entry.summary) &&
            (() => {
              const cleanSummary = entry.summary
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
              return cleanSummary ? (
                <p className="text-text-secondary dark:text-text-dark-secondary mt-0.5 line-clamp-2 text-[13px] leading-snug">
                  {cleanSummary}
                </p>
              ) : null
            })()}
        </div>

        {/* Compact 80x80 thumbnail */}
        {hasThumbnail && (
          <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg">
            <QueuedImage
              src={thumbnail}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              onError={(e) => {
                advanceCardImageFallback(e, rawThumbnail, (img) => {
                  img.parentElement!.style.display = 'none'
                })
              }}
            />
          </div>
        )}
      </div>
    </article>
  )
})
