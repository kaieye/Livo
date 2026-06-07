import { memo } from 'react'

interface EntryAvatarProps {
  avatarUrl: string
  avatarImageFailed: boolean
  avatarLetter: string
  onError: () => void
  size?: 'small' | 'medium' | 'large'
  className?: string
}

/**
 * Entry avatar component with automatic fallback to letter placeholder
 * Supports multiple sizes and custom styling
 */
export const EntryAvatar = memo(function EntryAvatar({
  avatarUrl,
  avatarImageFailed,
  avatarLetter,
  onError,
  size = 'medium',
  className = '',
}: EntryAvatarProps) {
  const sizeClasses = {
    small: 'h-4 w-4 text-[9px]',
    medium: 'h-8 w-8 text-sm',
    large: 'h-12 w-12 text-lg',
  }

  const sizeClass = sizeClasses[size]

  if (avatarUrl && !avatarImageFailed) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={`${sizeClass} rounded-full object-cover ${className}`}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={onError}
      />
    )
  }

  return (
    <div
      className={`bg-surface-tertiary text-text-secondary dark:bg-surface-dark-tertiary flex ${sizeClass} items-center justify-center rounded-full font-bold uppercase ${className}`}
    >
      {avatarLetter}
    </div>
  )
})
