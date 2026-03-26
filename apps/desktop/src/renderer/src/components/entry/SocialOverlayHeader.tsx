import { ChevronLeft, ExternalLink, Languages, Loader2, Sparkles } from "lucide-react"
import { memo } from "react"
import { useTranslation } from "react-i18next"

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
    <div className="sticky top-0 z-20 bg-white/95 dark:bg-surface-dark/95 backdrop-blur-sm border-b border-border/10 dark:border-border-dark/10">
      <div className={`${contentWidthClass} mx-auto px-4 py-2 flex items-center justify-between`} style={contentWidthStyle}>
        <button
          onClick={onClose}
          className="flex items-center gap-1 px-2 py-1.5 -ml-2 rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary text-text-secondary transition-colors"
        >
          <ChevronLeft size={18} />
          <span className="text-sm">{t("common.back")}</span>
        </button>
        <div className="flex items-center gap-2">
          {plainContent && (
            <>
              <button
                onClick={onTranslate}
                disabled={isTranslating}
                className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                  showTranslation && translatedParagraphCount > 0
                    ? "text-accent bg-accent/10"
                    : "text-text-secondary hover:text-accent hover:bg-accent/5"
                }`}
                title={t("social.translateTweet")}
              >
                {isTranslating ? <Loader2 size={14} className="animate-spin" /> : <Languages size={14} />}
                <span>{t("social.translateTweet")}</span>
              </button>
              <button
                onClick={onSummarize}
                disabled={isSummarizing}
                className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                  showSummary && summary
                    ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20"
                    : "text-text-secondary hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-900/10"
                }`}
                title={t("social.summarizeTweet")}
              >
                {isSummarizing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                <span>{t("social.summarizeTweet")}</span>
              </button>
            </>
          )}
          <button
            onClick={() => {
              if (!browserOpenUrl) return
              if (window.api?.app?.openExternal) {
                void window.api.app.openExternal(browserOpenUrl)
              } else {
                window.open(browserOpenUrl, "_blank")
              }
            }}
            disabled={!browserOpenUrl}
            className="flex items-center gap-1 text-xs text-accent disabled:text-text-tertiary disabled:cursor-not-allowed hover:underline disabled:no-underline"
            title={t("common.openInBrowser", { defaultValue: "在浏览器中打开" })}
          >
            <ExternalLink size={12} />
            {t("common.openInBrowser", { defaultValue: "在浏览器中打开" })}
          </button>
        </div>
      </div>
    </div>
  )
})
