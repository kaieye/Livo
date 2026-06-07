import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Languages, Loader2 } from 'lucide-react'

interface SocialAITranslationProps {
  isTranslating: boolean
  tweetParagraphs: string[]
  tweetTranslatedParagraphs: string[]
}

/**
 * AI Translation display component for social media entries
 * Shows bilingual paragraph-by-paragraph translation
 */
export const SocialAITranslation = memo(function SocialAITranslation({
  isTranslating,
  tweetParagraphs,
  tweetTranslatedParagraphs,
}: SocialAITranslationProps) {
  const { t } = useTranslation()

  return (
    <div
      className="border-accent/20 bg-accent/5 mt-2 rounded-lg border p-2.5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-accent mb-1.5 flex items-center gap-1.5 text-xs font-medium">
        <Languages size={12} />
        {t('social.translation')}
      </div>
      {isTranslating && tweetTranslatedParagraphs.length === 0 ? (
        <div className="text-text-secondary flex items-center gap-1.5 text-xs">
          <Loader2 size={12} className="animate-spin" />
          {t('entry.translating')}
        </div>
      ) : (
        <div className="space-y-0">
          {tweetParagraphs.map((para, i) => {
            const translated = tweetTranslatedParagraphs[i]
            const isLoading =
              isTranslating && i === tweetTranslatedParagraphs.length
            const plainText = para.replace(/<[^>]*>/g, '').trim()
            if (!plainText) return null
            return (
              <div
                key={i}
                className="hover:border-accent/30 group border-l-2 border-transparent pl-0 transition-colors hover:pl-2"
              >
                {para.includes('<') ? (
                  <div
                    className="!mb-0 text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: para }}
                  />
                ) : (
                  <p className="!mb-0 whitespace-pre-line text-sm leading-relaxed">
                    {para}
                  </p>
                )}
                {translated ? (
                  <div className="relative mb-2 mt-0.5">
                    <div className="flex items-start gap-1.5">
                      <Languages
                        size={10}
                        className="text-accent/50 mt-1 flex-shrink-0"
                      />
                      <div
                        className="text-accent/80 !mb-0 text-sm leading-relaxed dark:text-orange-300/80"
                        dangerouslySetInnerHTML={{ __html: translated }}
                      />
                    </div>
                  </div>
                ) : isLoading ? (
                  <div className="text-text-tertiary mb-2 mt-0.5 flex items-center gap-1.5 text-xs">
                    <Loader2 size={10} className="animate-spin" />
                    {t('entry.translating')}
                  </div>
                ) : (
                  <div className="mb-2" />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})
