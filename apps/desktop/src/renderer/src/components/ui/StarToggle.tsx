import { useState, type FC } from 'react'
import { Star } from 'lucide-react'

interface StarToggleProps {
  isStarred: boolean
  onToggle: () => void
  size?: number
  title?: string
  className?: string
}

/**
 * Star toggle button with a scale-pop animation on each toggle.
 * Mirrors Harmony's two-phase scale pulse (1.0 → 1.3 → 1.0).
 */
const StarToggle: FC<StarToggleProps> = ({
  isStarred,
  onToggle,
  size = 16,
  title,
  className = '',
}) => {
  const [animKey, setAnimKey] = useState(0)

  return (
    <button
      onClick={() => {
        setAnimKey((k) => k + 1)
        onToggle()
      }}
      className={className}
      title={title}
      type="button"
    >
      <span key={animKey} className="star-pop inline-flex">
        <Star
          size={size}
          className={isStarred ? 'fill-yellow-500 text-yellow-500' : ''}
        />
      </span>
    </button>
  )
}

export default StarToggle
