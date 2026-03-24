import { memo } from 'react'

import { CachedImage } from '../ui/CachedImage'

export const SocialAuthorHeader = memo(function SocialAuthorHeader({
  avatarUrl,
  avatarImageFailed,
  avatarLetter,
  authorName,
  timeAgo,
  onAvatarError,
}: {
  avatarUrl: string
  avatarImageFailed: boolean
  avatarLetter: string
  authorName: string
  timeAgo: string
  onAvatarError: () => void
}) {
  return (
    <div className="flex items-center gap-3">
      {avatarUrl && !avatarImageFailed ? (
        <CachedImage
          src={avatarUrl}
          alt=""
          className="h-10 w-10 rounded-full object-cover"
          onError={onAvatarError}
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-tertiary text-sm font-bold text-text-secondary dark:bg-surface-dark-tertiary">
          {avatarLetter}
        </div>
      )}
      <div>
        <div className="text-base font-semibold">{authorName}</div>
        <div className="text-xs text-text-secondary dark:text-text-dark-secondary">
          {timeAgo}
        </div>
      </div>
    </div>
  )
})
