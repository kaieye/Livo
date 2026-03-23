import { memo } from "react"

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
        <img
          src={avatarUrl}
          alt=""
          className="w-10 h-10 rounded-full object-cover"
          onError={onAvatarError}
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-surface-tertiary dark:bg-surface-dark-tertiary flex items-center justify-center text-sm font-bold text-text-secondary">
          {avatarLetter}
        </div>
      )}
      <div>
        <div className="font-semibold text-base">{authorName}</div>
        <div className="text-xs text-text-secondary dark:text-text-dark-secondary">{timeAgo}</div>
      </div>
    </div>
  )
})
