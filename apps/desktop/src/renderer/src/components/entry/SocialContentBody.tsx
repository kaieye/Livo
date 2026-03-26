import { Languages, Loader2 } from "lucide-react"
import { memo } from "react"
import { useTranslation } from "react-i18next"

export const SocialContentBody = memo(function SocialContentBody({
  showTranslation,
  translatedParagraphs,
  isTranslating,
  paragraphs,
  fullContent,
  plainContent,
  fontSize,
}: {
  showTranslation: boolean
  translatedParagraphs: string[]
  isTranslating: boolean
  paragraphs: string[]
  fullContent: string
  plainContent: string
  fontSize: number
}) {
  const { t } = useTranslation()

  if (showTranslation && translatedParagraphs.length > 0) {
    return (
      <div
        className="space-y-0"
        style={{ fontSize: `${fontSize}px` }}
      >
        {paragraphs.map((para, i) => {
          const translated = translatedParagraphs[i]
          const isLoading = isTranslating && i === translatedParagraphs.length
          const plainText = para.replace(/<[^>]*>/g, "").trim()
          if (!plainText) return null
          return (
            <div
              key={i}
              className="group border-l-2 border-transparent hover:border-accent/30 transition-colors pl-0 hover:pl-3"
            >
              {para.includes("<") ? (
                <div
                  className="entry-content !mb-0 prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: para }}
                />
              ) : (
                <p className="whitespace-pre-line !mb-0">{para}</p>
              )}
              {translated ? (
                <div className="relative mt-1 mb-4">
                  <div className="flex items-start gap-2">
                    <Languages size={12} className="text-accent/50 mt-1 flex-shrink-0" />
                    <div
                      className="entry-content !mb-0 text-accent/80 dark:text-orange-300/80"
                      style={{ fontSize: `${fontSize - 1}px` }}
                      dangerouslySetInnerHTML={{ __html: translated }}
                    />
                  </div>
                </div>
              ) : isLoading ? (
                <div className="flex items-center gap-2 mt-1 mb-4 text-xs text-text-tertiary">
                  <Loader2 size={12} className="animate-spin" />
                  {t("entry.translating")}
                </div>
              ) : (
                <div className="mb-4" />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  if (fullContent) {
    return (
      <div
        className="prose dark:prose-invert max-w-none"
        style={{ fontSize: `${fontSize}px` }}
        dangerouslySetInnerHTML={{ __html: fullContent }}
      />
    )
  }

  if (plainContent) {
    return (
      <p
        className="whitespace-pre-line"
        style={{ fontSize: `${fontSize}px` }}
      >
        {plainContent}
      </p>
    )
  }

  return null
})
