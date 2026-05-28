import type { TranslationErrorMap } from '../../hooks/useAITranslation'
import { AISummaryPanel } from './AISummaryPanel'
import { BilingualContent } from './BilingualContent'

export interface AIAssistContentProps {
  // --- Summary state ---
  /** Generated summary text; null = not yet requested */
  summary: string | null
  /** Error message from last summarize attempt; null = no error */
  summaryError: string | null
  /** Whether a summarize request is in flight */
  isSummarizing: boolean
  /** Callback to retry summarization (shown in error state) */
  onRetrySummary: () => void

  // --- Translation state ---
  /** Whether bilingual view is currently active */
  showTranslation: boolean
  /** Original HTML paragraphs (from splitHtmlIntoParagraphs) */
  paragraphs: string[]
  /** Translated HTML per paragraph; same length as paragraphs after translate() */
  translatedParagraphs: string[]
  /** Whether a translation request is in flight */
  isTranslating: boolean
  /** Per-paragraph error map; empty object when no errors */
  errorMap: TranslationErrorMap

  // --- Rendering ---
  /** Font size in px for content body */
  fontSize: number
  /** Line height multiplier for content body */
  lineHeight: number
  /** Font family CSS value for content body */
  fontFamily: string

  /** Optional additional CSS classes for the root wrapper */
  className?: string
}

/**
 * Composable AI result content for entry reader views.
 *
 * Conditionally renders:
 * 1. AISummaryPanel — when summary is available/loading/errored
 * 2. BilingualContent — when showTranslation is true (bilingual view)
 *
 * The parent component owns the hooks (useAISummary / useAITranslation)
 * and passes state as props. This component is purely presentational.
 *
 * Extracted from EntryContent.tsx (lines ~1085-1090, ~1170-1187) as a
 * standalone seam so ArticleDetailPage and other reader views can reuse
 * the same AI content rendering without duplicating conditional logic.
 */
export function AIAssistContent({
  summary,
  summaryError,
  isSummarizing,
  onRetrySummary,
  showTranslation,
  paragraphs,
  translatedParagraphs,
  isTranslating,
  errorMap,
  fontSize,
  lineHeight,
  fontFamily,
  className = '',
}: AIAssistContentProps) {
  // When neither AI assist is active, render nothing
  if (!isSummarizing && !summary && !summaryError && !showTranslation) {
    return null
  }

  return (
    <div className={className}>
      {/* AI Summary panel — shown above content when available */}
      <AISummaryPanel
        summary={summary}
        error={summaryError}
        isLoading={isSummarizing}
        onRetry={onRetrySummary}
      />

      {/* Bilingual translation view — replaces plain content when active */}
      {showTranslation && paragraphs.length > 0 && (
        <BilingualContent
          paragraphs={paragraphs}
          translations={translatedParagraphs}
          isTranslating={isTranslating}
          errorMap={errorMap}
          fontSize={fontSize}
          lineHeight={lineHeight}
          fontFamily={fontFamily}
        />
      )}
    </div>
  )
}
