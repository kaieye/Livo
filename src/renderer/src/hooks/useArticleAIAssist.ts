import { useCallback, useEffect, useMemo } from 'react'

import { useAISummary } from './useAISummary'
import { useAITranslation, type TranslationErrorMap } from './useAITranslation'

/**
 * Article-level AI assist ViewModel — the desktop equivalent of Harmony's
 * `ArticleAIAssistViewModel`.
 *
 * Composes the lower-level {@link useAISummary} and {@link useAITranslation}
 * state machines into a single source of truth for an article's AI features so
 * reader views (ArticleDetailPage, EntryContent, ...) don't each re-implement
 * the summarize/translate/toggle/reset orchestration. It also derives a
 * combined run status (idle/processing/done/partial/error) and resets when the
 * active entry changes.
 */

export type AIAssistRunStatus =
  | 'idle'
  | 'processing'
  | 'done'
  | 'partial'
  | 'error'

const LANGUAGE_LABELS: Record<string, string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  ru: 'Русский',
  ar: 'العربية',
}

/** Human-readable label for an AI target language code. */
export function aiLanguageLabel(language: string): string {
  return LANGUAGE_LABELS[language] ?? language
}

export interface ArticleAIAssistInput {
  /** Active entry id — when it changes, all AI state resets. */
  entryId?: string
  /** Persisted summary generated before opening the article. */
  initialSummary?: string | null
  /** Full article HTML (used for summarization). */
  content?: string
  /** Paragraphs for paragraph-by-paragraph translation. */
  paragraphs: string[]
  /** Output language for summaries (defaults to UI language). */
  summaryLanguage?: string
  /** Target language for translation. */
  targetLanguage?: string
}

export interface ArticleAIAssist {
  // Summary
  summary: string | null
  summaryError: string | null
  isSummarizing: boolean
  // Translation
  translatedParagraphs: string[]
  isTranslating: boolean
  showTranslation: boolean
  translationErrorMap: TranslationErrorMap
  // Combined
  isBusy: boolean
  status: AIAssistRunStatus
  /** Generate a summary for the current article content. */
  summarize: () => void
  /** Translate the article. Toggles the bilingual view when already translated. */
  translate: () => void
  /** Show/hide the bilingual view without re-fetching. */
  toggleTranslation: () => void
  /** Retry one failed translation segment. */
  retryTranslationSegment: (index: number) => void
  /** Run summary and/or translation together (Harmony's `run`). */
  runBoth: (which: { summary: boolean; translation: boolean }) => Promise<void>
  /** Reset all AI state. */
  reset: () => void
}

export function useArticleAIAssist(
  input: ArticleAIAssistInput,
): ArticleAIAssist {
  const {
    entryId,
    initialSummary,
    content,
    paragraphs,
    summaryLanguage,
    targetLanguage,
  } = input

  const {
    summary,
    error: summaryError,
    isLoading: isSummarizing,
    summarize: summarizeRaw,
    reset: resetSummary,
  } = useAISummary({ initialSummary, entryId })

  const {
    translatedParagraphs,
    isTranslating,
    showTranslation,
    errorMap: translationErrorMap,
    translate: translateRaw,
    retrySegment: retryTranslationSegmentRaw,
    toggle: toggleTranslation,
    reset: resetTranslation,
  } = useAITranslation({ entryId })

  // Reset all AI state whenever the active entry changes.
  useEffect(() => {
    resetSummary()
    resetTranslation()
  }, [entryId, resetSummary, resetTranslation])

  const summarize = useCallback(() => {
    if (!content) return
    void summarizeRaw(content, summaryLanguage)
  }, [content, summaryLanguage, summarizeRaw])

  const runTranslation = useCallback(() => {
    if (paragraphs.length === 0) return
    void translateRaw(paragraphs, targetLanguage || 'zh-CN')
  }, [paragraphs, targetLanguage, translateRaw])

  const translate = useCallback(() => {
    // Already have a translation cached → just toggle visibility.
    if (translatedParagraphs.some((paragraph) => paragraph.length > 0)) {
      toggleTranslation()
      return
    }
    runTranslation()
  }, [translatedParagraphs, toggleTranslation, runTranslation])

  const retryTranslationSegment = useCallback(
    (index: number) => {
      void retryTranslationSegmentRaw(index)
    },
    [retryTranslationSegmentRaw],
  )

  const runBoth = useCallback(
    async (which: { summary: boolean; translation: boolean }) => {
      const tasks: Array<Promise<void>> = []
      if (which.summary && content) {
        tasks.push(summarizeRaw(content, summaryLanguage))
      }
      if (which.translation && paragraphs.length > 0) {
        tasks.push(translateRaw(paragraphs, targetLanguage || 'zh-CN'))
      }
      await Promise.all(tasks)
    },
    [
      content,
      paragraphs,
      summaryLanguage,
      targetLanguage,
      summarizeRaw,
      translateRaw,
    ],
  )

  const reset = useCallback(() => {
    resetSummary()
    resetTranslation()
  }, [resetSummary, resetTranslation])

  const isBusy = isSummarizing || isTranslating

  const status = useMemo<AIAssistRunStatus>(() => {
    if (isBusy) return 'processing'

    const hasTranslationError = Object.keys(translationErrorMap).length > 0
    const hasAnyError = !!summaryError || hasTranslationError
    const hasSummary = !!summary
    const hasTranslation = translatedParagraphs.some((p) => p.length > 0)
    const hasAnySuccess = hasSummary || hasTranslation

    if (hasAnyError) {
      return hasAnySuccess ? 'partial' : 'error'
    }
    if (hasAnySuccess) return 'done'
    return 'idle'
  }, [isBusy, summary, summaryError, translatedParagraphs, translationErrorMap])

  return {
    summary,
    summaryError,
    isSummarizing,
    translatedParagraphs,
    isTranslating,
    showTranslation,
    translationErrorMap,
    isBusy,
    status,
    summarize,
    translate,
    toggleTranslation,
    retryTranslationSegment,
    runBoth,
    reset,
  }
}
