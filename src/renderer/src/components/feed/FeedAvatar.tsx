import { useState } from 'react'
import { Rss } from 'lucide-react'
import { getSafeImageSrc } from '../../lib/safe-image-source'

// Shared feed avatar: render `imageUrl` as <img> and gracefully degrade to an
// Rss glyph when missing or load-failed. Shadow / decoration are caller-owned
// via `className` so this primitive stays neutral across hero vs list contexts.
export interface FeedAvatarProps {
  imageUrl?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
  alt?: string
}

const SIZE_CLASSES: Record<NonNullable<FeedAvatarProps['size']>, string> = {
  xs: 'h-5 w-5 rounded',
  sm: 'h-8 w-8 rounded-md',
  md: 'h-10 w-10 rounded-lg',
  lg: 'h-16 w-16 rounded-xl',
}

const ICON_SIZE: Record<NonNullable<FeedAvatarProps['size']>, number> = {
  xs: 11,
  sm: 14,
  md: 18,
  lg: 24,
}

export function FeedAvatar({
  imageUrl,
  size = 'lg',
  className = '',
  alt = '',
}: FeedAvatarProps) {
  const [errored, setErrored] = useState(false)
  const safeImageUrl = getSafeImageSrc(imageUrl)
  const sizeCls = SIZE_CLASSES[size]
  const wrapperCls =
    `${sizeCls} flex-shrink-0 bg-[var(--color-bg-tertiary)] ${className}`.trim()

  if (safeImageUrl && !errored) {
    return (
      <img
        src={safeImageUrl}
        alt={alt}
        loading="lazy"
        onError={() => setErrored(true)}
        className={`${wrapperCls} object-cover`}
      />
    )
  }
  return (
    <div
      aria-hidden="true"
      className={`${wrapperCls} flex items-center justify-center`}
    >
      <Rss
        size={ICON_SIZE[size]}
        className="text-[var(--color-text-tertiary)]"
      />
    </div>
  )
}
