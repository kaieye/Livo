import { ChevronDown, ChevronUp } from 'lucide-react'

export function EntryEndNavigation({
  hasPrev,
  hasNext,
  currentIndex,
  total,
  prevLabel,
  nextLabel,
  onPrev,
  onNext,
}: {
  hasPrev: boolean
  hasNext: boolean
  currentIndex: number
  total: number
  prevLabel: string
  nextLabel: string
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div className="text-text-secondary dark:text-text-dark-secondary mt-16 flex items-center justify-between border-t pt-8 text-sm">
      <button
        disabled={!hasPrev}
        onClick={onPrev}
        className="hover:text-accent flex items-center gap-1 transition-colors disabled:cursor-default disabled:opacity-30"
      >
        <ChevronUp size={16} />
        {prevLabel}
      </button>
      <span className="text-text-tertiary text-xs">
        {currentIndex + 1} / {total}
      </span>
      <button
        disabled={!hasNext}
        onClick={onNext}
        className="hover:text-accent flex items-center gap-1 transition-colors disabled:cursor-default disabled:opacity-30"
      >
        {nextLabel}
        <ChevronDown size={16} />
      </button>
    </div>
  )
}
