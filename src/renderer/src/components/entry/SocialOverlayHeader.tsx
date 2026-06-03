import {
  ChevronLeft,
  ExternalLink,
  Languages,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { openExternalUrlSafe } from '../../services/external-url'

export const SocialOverlayHeader = memo(function SocialOverlayHeader({
  contentWidthClass,
  contentWidthStyle,
  plainContent,
  isTranslating,
  showTranslation,
  translatedParagraphCount,
  isSummarizing,
  showSummary,
  summary,
  browserOpenUrl,
  onClose,
  onTranslate,
  onSummarize,
}: {
  contentWidthClass: string
  contentWidthStyle?: React.CSSProperties
  plainContent: string
  isTranslating: boolean
  showTranslation: boolean
  translatedParagraphCount: number
  isSummarizing: boolean
  showSummary: boolean
  summary: string | null
  browserOpenUrl: string
  onClose: () => void
  onTranslate: () => void
  onSummarize: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="border-border/10 dark:border-border-dark/10 dark:bg-surface-dark/95 sticky top-0 z-20 border-b bg-white/95 backdrop-blur-sm">
      <div
        className={`${contentWidthClass} mx-auto flex items-center justify-between px-4 py-2`}
        style={contentWidthStyle}
      >
        <button
          onClick={onClose}
          className="text-text-secondary hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary -ml-2 flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors"
        >
          <ChevronLeft size={18} />
          <span className="text-sm">{t('common.back')}</span>
        </button>
        <div className="flex items-center gap-2">
          {plainContent && (
            <>
              <button
                onClick={onTranslate}
                disabled={isTranslating}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                  showTranslation && translatedParagraphCount > 0
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-secondary hover:bg-accent/5 hover:text-accent'
                }`}
                title={t('social.translateTweet')}
              >
                {isTranslating ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Languages size={14} />
                )}
                <span>{t('social.translateTweet')}</span>
              </button>
              <button
                onClick={onSummarize}
                disabled={isSummarizing}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                  showSummary && summary
                    ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                    : 'text-text-secondary hover:bg-amber-50/50 hover:text-amber-600 dark:hover:bg-amber-900/10 dark:hover:text-amber-400'
                }`}
                title={t('social.summarizeTweet')}
              >
                {isSummarizing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                <span>{t('social.summarizeTweet')}</span>
              </button>
            </>
          )}
          <button
            onClick={() => {
              if (!browserOpenUrl) return
              void openExternalUrlSafe(browserOpenUrl)
            }}
            disabled={!browserOpenUrl}
            className="text-accent disabled:text-text-tertiary flex items-center gap-1 text-xs hover:underline disabled:cursor-not-allowed disabled:no-underline"
            title={t('common.openInBrowser', {
              defaultValue: '在浏览器中打开',
            })}
          >
            <ExternalLink size={12} />
            {t('common.openInBrowser', { defaultValue: '在浏览器中打开' })}
          </button>
        </div>
      </div>
    </div>
  )
})
