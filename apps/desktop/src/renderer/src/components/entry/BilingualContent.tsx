import { useTranslation } from 'react-i18next'
import { Languages, Loader2, AlertCircle } from 'lucide-react'
import type { TranslationErrorMap } from '../../hooks/useAITranslation'

interface BilingualContentProps {
  paragraphs: string[]
  translations: string[]
  isTranslating: boolean
  errorMap: TranslationErrorMap
  fontSize: number
  lineHeight: number
  fontFamily: string
}

/**
 * Bilingual content view — renders original text alongside AI translation.
 *
 * Each paragraph shows:
 * - Original content (HTML)
 * - Translation (HTML, styled in accent color) — when available
 * - Loading spinner — when that paragraph is the next to translate
 * - Error badge — when translation failed for that paragraph
 *
 * Errors are passed via `errorMap` (keyed by paragraph index) and rendered
 * as inline badges instead of being embedded as HTML strings in `translations`.
 */
export function BilingualContent({
  paragraphs,
  translations,
  isTranslating,
  errorMap,
  fontSize,
  lineHeight,
  fontFamily,
}: BilingualContentProps) {
  const { t } = useTranslation()
  return (
    <div
      className="space-y-0"
      style={{ fontSize: `${fontSize}px`, lineHeight, fontFamily }}
    >
      {paragraphs.map((para, i) => {
        const translated = translations[i]
        const isLoading = isTranslating && i === translations.length
        const error = errorMap[i]
        const plainText = para.replace(/<[^>]*>/g, '').trim()
        if (!plainText) return null

        return (
          <div
            key={i}
            className="group border-l-2 border-transparent pl-0 transition-colors hover:border-accent/30 hover:pl-3"
          >
            {/* Original */}
            <div
              className="entry-content !mb-0"
              dangerouslySetInnerHTML={{ __html: para }}
            />

            {/* Translation */}
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
            ) : error ? (
              <div className="mb-4 mt-1 flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400">
                <AlertCircle size={12} className="flex-shrink-0" />
                <span>{error}</span>
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
