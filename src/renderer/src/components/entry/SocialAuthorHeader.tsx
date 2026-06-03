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
        <div className="bg-surface-tertiary text-text-secondary dark:bg-surface-dark-tertiary flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold">
          {avatarLetter}
        </div>
      )}
      <div>
        <div className="text-base font-semibold">{authorName}</div>
        <div className="text-text-secondary dark:text-text-dark-secondary text-xs">
          {timeAgo}
        </div>
      </div>
    </div>
  )
})
