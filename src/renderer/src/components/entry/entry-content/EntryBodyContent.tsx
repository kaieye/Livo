import { BookType, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TranslationErrorMap } from '../../../hooks/useAITranslation'
import { BilingualContent } from '../BilingualContent'
import { EntryDetailFallback } from './EntryDetailFallback'
import { getEntryContentLayout } from './entry-content-layout'
import { openExternalUrlSafe } from '../../../services/external-url'

export function EntryBodyContent({
  isReadabilityMode,
  readableContent,
  sanitizedReadable,
  articleContent,
  showTranslation,
  paragraphs,
  translatedParagraphs,
  isTranslating,
  errorMap,
  onRetrySegment,
  sanitizedContent,
  fontSize,
  lineHeight,
  fontFamily,
  hasAudio,
  showEntryDetailFallback,
  fallbackTitle,
  isFetchingReadable,
  entryUrl,
  onExitReadability,
  onFetchReadable,
}: {
  isReadabilityMode: boolean
  readableContent: string | null
  sanitizedReadable: string
  articleContent: string
  showTranslation: boolean
  paragraphs: string[]
  translatedParagraphs: string[]
  isTranslating: boolean
  errorMap: TranslationErrorMap
  onRetrySegment: (index: number) => void
  sanitizedContent: string
  fontSize: number
  lineHeight: number
  fontFamily: string
  hasAudio: boolean
  showEntryDetailFallback: boolean
  fallbackTitle: string
  isFetchingReadable: boolean
  entryUrl?: string
  onExitReadability: () => void
  onFetchReadable: () => void
}) {
  const { t } = useTranslation()
  const layout = getEntryContentLayout({
    isReadabilityMode,
    hasReadableContent: !!readableContent,
    hasArticleContent: !!articleContent,
    showTranslation,
    hasAudio,
    showEntryDetailFallback,
  })

  if (layout === 'readability') {
    return (
      <div>
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
          <BookType size={14} />
          <span>{t('entry.readabilityMode')}</span>
          <button
            onClick={onExitReadability}
            className="ml-auto hover:underline"
          >
            {t('entry.readabilityBack2')}
          </button>
        </div>
        <div
          className="entry-content"
          style={{
            fontSize: `${fontSize}px`,
            lineHeight,
          }}
          dangerouslySetInnerHTML={{ __html: sanitizedReadable }}
        />
      </div>
    )
  }

  if (layout === 'bilingual') {
    return (
      <BilingualContent
        paragraphs={paragraphs}
        translations={translatedParagraphs}
        isTranslating={isTranslating}
        errorMap={errorMap}
        onRetrySegment={onRetrySegment}
        fontSize={fontSize}
        lineHeight={lineHeight}
        fontFamily={fontFamily}
      />
    )
  }

  if (layout === 'html') {
    return (
      <div
        className="entry-content"
        style={{
          fontSize: `${fontSize}px`,
          lineHeight,
        }}
        dangerouslySetInnerHTML={{ __html: sanitizedContent }}
      />
    )
  }

  if (layout === 'audio-only') return null

  if (layout === 'detail-fallback') {
    return <EntryDetailFallback title={fallbackTitle} />
  }

  return (
    <div className="text-text-secondary dark:text-text-dark-secondary py-12 text-center">
      {isFetchingReadable ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="text-accent animate-spin" />
          <p className="text-sm">{t('entry.fetchingContent')}</p>
        </div>
      ) : (
        <>
          <p>{t('entry.noContent')}</p>
          {entryUrl && (
            <div className="mt-3 space-y-2">
              <button
                onClick={onFetchReadable}
                className="text-accent inline-flex items-center gap-1 text-sm hover:underline"
              >
                <BookType size={14} />
                {t('entry.tryFetchContent')}
              </button>
              <br />
              <a
                href={entryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent inline-block text-sm hover:underline"
                onClick={(e) => {
                  e.preventDefault()
                  void openExternalUrlSafe(entryUrl)
                }}
              >
                {t('entry.readInBrowser')}
              </a>
            </div>
          )}
        </>
      )}
    </div>
  )
}
