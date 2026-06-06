import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, CheckCircle2 } from 'lucide-react'
import type { ImportProgressPayload } from '../../../../shared/renderer-events'

export function ImportProgressModal({
  open,
  onDone,
}: {
  open: boolean
  onDone: () => void
}) {
  const [progress, setProgress] = useState<ImportProgressPayload | null>(null)
  const { t } = useTranslation()

  useEffect(() => {
    if (!open) {
      setProgress(null)
      return
    }

    const cleanup = window.api.on('import:progress', (data) => {
      setProgress(data)
      if (data.status === 'done') {
        setTimeout(onDone, 600)
      }
    })

    return cleanup
  }, [open, onDone])

  if (!open) return null

  const pct = progress
    ? Math.round((progress.current / progress.total) * 100)
    : 0
  const isDone = progress?.status === 'done'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="dark:bg-surface-dark-secondary w-[420px] space-y-4 rounded-xl bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          {isDone ? (
            <CheckCircle2 size={22} className="flex-shrink-0 text-green-500" />
          ) : (
            <Loader2
              size={22}
              className="text-accent flex-shrink-0 animate-spin"
            />
          )}
          <h3 className="text-base font-semibold">
            {isDone ? t('importProgress.done') : t('importProgress.importing')}
          </h3>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="bg-surface-secondary dark:bg-surface-dark h-2.5 w-full overflow-hidden rounded-full">
            <div
              className="bg-accent h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-text-secondary dark:text-text-dark-secondary flex items-center justify-between text-xs">
            <span className="max-w-[280px] truncate">
              {isDone
                ? t('importProgress.allDone')
                : progress
                  ? progress.title
                  : t('importProgress.preparing')}
            </span>
            <span className="ml-2 flex-shrink-0">
              {progress ? `${progress.current}/${progress.total}` : '0/0'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
