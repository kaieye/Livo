import { useTranslation } from 'react-i18next'
import { Languages, Loader2, AlertCircle } from 'lucide-react'
import type { TranslationErrorMap } from '../../hooks/useAITranslation'

interface BilingualContentProps {
  paragraphs: string[]
  translations: string[]
  isTranslating: boolean
  errorMap: TranslationErrorMap
  onRetrySegment?: (index: number) => void
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
  onRetrySegment,
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
        const error = errorMap[i]
        const plainText = para.replace(/<[^>]*>/g, '').trim()
        if (!plainText) return null
        const canTranslate = plainText.length >= 5
        const isLoading = isTranslating && canTranslate && !translated && !error

        return (
          <div
            key={i}
            className="hover:border-accent/30 group border-l-2 border-transparent pl-0 transition-colors hover:pl-3"
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
                    className="text-accent/50 mt-1 flex-shrink-0"
                  />
                  <div
                    className="entry-content text-accent/80 !mb-0 dark:text-orange-300/80"
                    style={{ fontSize: `${fontSize - 1}px` }}
                    dangerouslySetInnerHTML={{ __html: translated }}
                  />
                </div>
              </div>
            ) : error ? (
              <div className="mb-4 mt-1 flex flex-wrap items-center gap-2 text-xs text-red-500 dark:text-red-400">
                <div className="flex min-w-0 items-center gap-1.5">
                  <AlertCircle size={12} className="flex-shrink-0" />
                  <span className="break-words">{error}</span>
                </div>
                {onRetrySegment && (
                  <button
                    type="button"
                    onClick={() => onRetrySegment(i)}
                    disabled={isTranslating}
                    className="rounded border border-red-200 px-2 py-0.5 text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/30"
                  >
                    {t('entry.retry')}
                  </button>
                )}
              </div>
            ) : isLoading ? (
              <div className="text-text-tertiary mb-4 mt-1 flex items-center gap-2 text-xs">
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
