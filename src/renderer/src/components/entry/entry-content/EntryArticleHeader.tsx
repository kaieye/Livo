import { Calendar, Clock, User } from 'lucide-react'
import { getSafeImageSrc } from '../../../lib/safe-image-source'

export function EntryArticleHeader({
  title,
  author,
  authorAvatarUrl,
  timeAgo,
  fullDate,
  readingTimeLabel,
}: {
  title: string
  author?: string
  authorAvatarUrl?: string
  timeAgo: string
  fullDate: string
  readingTimeLabel?: string
}) {
  const safeAuthorAvatarUrl = getSafeImageSrc(authorAvatarUrl)

  return (
    <>
      <h1 className="mb-4 text-[1.7rem] font-bold leading-normal">{title}</h1>

      <div className="text-text-secondary dark:text-text-dark-secondary mb-8 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium">
        {author && (
          <span className="flex items-center gap-1">
            {safeAuthorAvatarUrl ? (
              <img
                src={safeAuthorAvatarUrl}
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
            {author}
          </span>
        )}
        <span className="flex items-center gap-1" title={fullDate}>
          <Calendar size={12} className="text-text-tertiary" />
          {timeAgo}
        </span>
        {readingTimeLabel && (
          <span className="flex items-center gap-1">
            <Clock size={12} className="text-text-tertiary" />
            {readingTimeLabel}
          </span>
        )}
      </div>
    </>
  )
}
