import { AlertTriangle } from 'lucide-react'

export function FeedRefreshIssueBadge({ label }: { label: string | null }) {
  if (!label) return null
  return (
    <span
      className="ml-1 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center text-amber-600 dark:text-amber-400"
      aria-hidden="true"
    >
      <AlertTriangle size={13} strokeWidth={2.4} />
    </span>
  )
}
