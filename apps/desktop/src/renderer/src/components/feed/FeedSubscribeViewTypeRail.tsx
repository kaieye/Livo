import { useRef, useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, MessageCircle, Play, Image as ImageIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { FeedViewType } from '../../../../shared/types'
import { VIEW_TYPE_I18N_KEYS } from '../../lib/view-type-keys'

interface ViewOption {
  view: FeedViewType
  label: string
  icon: ReactNode
}

const VIEW_OPTIONS: ViewOption[] = [
  { view: FeedViewType.Articles, label: '', icon: <FileText size={16} /> },
  {
    view: FeedViewType.SocialMedia,
    label: '',
    icon: <MessageCircle size={16} />,
  },
  { view: FeedViewType.Videos, label: '', icon: <Play size={16} /> },
  { view: FeedViewType.Pictures, label: '', icon: <ImageIcon size={16} /> },
]

interface FeedSubscribeViewTypeRailProps {
  selectedView: FeedViewType
  onSelect: (view: FeedViewType) => void
}

/**
 * Segment-control pill rail for selecting a feed view type during subscription.
 * Mirrors Harmony's `FeedSubscribeViewTypeRail` with a sliding indicator pill
 * that animates to the selected option.
 */
export function FeedSubscribeViewTypeRail({
  selectedView,
  onSelect,
}: FeedSubscribeViewTypeRailProps) {
  const { t } = useTranslation()
  const railRef = useRef<HTMLDivElement>(null)
  const [railWidth, setRailWidth] = useState(0)

  const options = VIEW_OPTIONS.map((opt) => ({
    ...opt,
    label: t(VIEW_TYPE_I18N_KEYS[opt.view]),
  }))

  const selectedIndex = options.findIndex((o) => o.view === selectedView)
  const slotWidth = railWidth > 0 ? (railWidth - 8) / options.length : 0
  const indicatorOffset = slotWidth * Math.max(0, selectedIndex)

  useEffect(() => {
    const el = railRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width
        if (w > 0) setRailWidth(w)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, view: FeedViewType) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onSelect(view)
      }
    },
    [onSelect],
  )

  return (
    <div
      ref={railRef}
      role="radiogroup"
      aria-label={t('discoverSubscribeConfig.viewLabel')}
      className="relative flex h-[46px] w-full items-center rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-bg-elevated)] p-1"
    >
      {/* Sliding indicator pill */}
      {slotWidth > 0 && selectedIndex >= 0 && (
        <div
          className="absolute top-1 h-[38px] rounded-lg border border-black/5 bg-white/90 shadow-sm transition-transform duration-150 ease-out dark:border-white/10 dark:bg-white/10"
          style={{
            width: slotWidth,
            transform: `translateX(${indicatorOffset}px)`,
          }}
          aria-hidden="true"
        />
      )}

      {/* Option buttons */}
      {options.map((option) => {
        const isSelected = option.view === selectedView
        return (
          <button
            key={option.view}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(option.view)}
            onKeyDown={(e) => handleKeyDown(e, option.view)}
            className="relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{ height: 38 }}
          >
            <span
              className={
                isSelected
                  ? 'text-[var(--color-accent)]'
                  : 'text-[var(--color-text-secondary)]'
              }
            >
              {option.icon}
            </span>
            <span
              className={
                isSelected
                  ? 'text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-secondary)]'
              }
            >
              {option.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
