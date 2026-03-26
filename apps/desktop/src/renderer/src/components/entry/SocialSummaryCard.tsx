import { Loader2, Sparkles } from "lucide-react"
import { memo } from "react"
import { useTranslation } from "react-i18next"

export const SocialSummaryCard = memo(function SocialSummaryCard({
  visible,
  isSummarizing,
  summary,
}: {
  visible: boolean
  isSummarizing: boolean
  summary: string | null
}) {
  const { t } = useTranslation()

  if (!visible) return null

  return (
    <div className="rounded-xl border border-amber-300/30 bg-amber-50/50 dark:bg-amber-900/10 p-4">
      <div className="flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400 mb-2">
        <Sparkles size={14} />
        {t("social.aiSummary")}
      </div>
      {isSummarizing ? (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Loader2 size={14} className="animate-spin" />
          {t("entry.generatingSummary")}
        </div>
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-line">{summary}</p>
      )}
    </div>
  )
})
