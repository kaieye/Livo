import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, Loader2 } from 'lucide-react'

interface SocialAISummaryProps {
  isSummarizing: boolean
  tweetSummary: string | null
}

/**
 * AI Summary display component for social media entries
 * Shows AI-generated summary of the tweet content
 */
export const SocialAISummary = memo(function SocialAISummary({
  isSummarizing,
  tweetSummary,
}: SocialAISummaryProps) {
  const { t } = useTranslation()

  return (
    <div
      className="mt-2 rounded-lg border border-amber-300/30 bg-amber-50/50 p-2.5 dark:bg-amber-900/10"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
        <Sparkles size={12} />
        {t('social.aiSummary')}
      </div>
      {isSummarizing ? (
        <div className="text-text-secondary flex items-center gap-1.5 text-xs">
          <Loader2 size={12} className="animate-spin" />
          {t('entry.generatingSummary')}
        </div>
      ) : (
        <p className="whitespace-pre-line text-sm leading-relaxed">
          {tweetSummary}
        </p>
      )}
    </div>
  )
})
