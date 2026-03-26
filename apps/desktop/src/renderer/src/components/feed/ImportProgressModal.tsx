import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, CheckCircle2 } from "lucide-react"

interface ImportProgress {
  current: number
  total: number
  title: string
  status: string
}

export function ImportProgressModal({ open, onDone }: { open: boolean; onDone: () => void }) {
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const { t } = useTranslation()

  useEffect(() => {
    if (!open) {
      setProgress(null)
      return
    }

    const cleanup = window.api.on("import:progress", (...args: unknown[]) => {
      const data = args[0] as ImportProgress
      setProgress(data)
      if (data.status === "done") {
        setTimeout(onDone, 600)
      }
    })

    return cleanup
  }, [open, onDone])

  if (!open) return null

  const pct = progress ? Math.round((progress.current / progress.total) * 100) : 0
  const isDone = progress?.status === "done"

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-surface-dark-secondary rounded-xl shadow-2xl w-[420px] p-6 space-y-4">
        <div className="flex items-center gap-3">
          {isDone ? (
            <CheckCircle2 size={22} className="text-green-500 flex-shrink-0" />
          ) : (
            <Loader2 size={22} className="text-accent animate-spin flex-shrink-0" />
          )}
          <h3 className="font-semibold text-base">
            {isDone ? t("importProgress.done") : t("importProgress.importing")}
          </h3>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="w-full h-2.5 bg-surface-secondary dark:bg-surface-dark rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-text-secondary dark:text-text-dark-secondary">
            <span className="truncate max-w-[280px]">
              {isDone
                ? t("importProgress.allDone")
                : progress
                  ? progress.title
                  : t("importProgress.preparing")}
            </span>
            <span className="flex-shrink-0 ml-2">
              {progress ? `${progress.current}/${progress.total}` : "0/0"}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
