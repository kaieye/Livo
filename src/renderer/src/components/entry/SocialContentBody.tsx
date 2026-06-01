import { Languages, Loader2 } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

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
      <div className="space-y-0" style={{ fontSize: `${fontSize}px` }}>
        {paragraphs.map((para, i) => {
          const translated = translatedParagraphs[i]
          const isLoading = isTranslating && i === translatedParagraphs.length
          const plainText = para.replace(/<[^>]*>/g, '').trim()
          if (!plainText) return null
          return (
            <div
              key={i}
              className="group border-l-2 border-transparent pl-0 transition-colors hover:border-accent/30 hover:pl-3"
            >
              {para.includes('<') ? (
                <div
                  className="entry-content prose !mb-0 max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: para }}
                />
              ) : (
                <p className="!mb-0 whitespace-pre-line">{para}</p>
              )}
              {translated ? (
                <div className="relative mb-4 mt-1">
                  <div className="flex items-start gap-2">
                    <Languages
                      size={12}
                      className="mt-1 flex-shrink-0 text-accent/50"
                    />
                    <div
                      className="entry-content !mb-0 text-accent/80 dark:text-orange-300/80"
                      style={{ fontSize: `${fontSize - 1}px` }}
                      dangerouslySetInnerHTML={{ __html: translated }}
                    />
                  </div>
                </div>
              ) : isLoading ? (
                <div className="mb-4 mt-1 flex items-center gap-2 text-xs text-text-tertiary">
                  <Loader2 size={12} className="animate-spin" />
                  {t('entry.translating')}
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
        className="prose max-w-none dark:prose-invert"
        style={{ fontSize: `${fontSize}px` }}
        dangerouslySetInnerHTML={{ __html: fullContent }}
      />
    )
  }

  if (plainContent) {
    return (
      <p className="whitespace-pre-line" style={{ fontSize: `${fontSize}px` }}>
        {plainContent}
      </p>
    )
  }

  return null
})
