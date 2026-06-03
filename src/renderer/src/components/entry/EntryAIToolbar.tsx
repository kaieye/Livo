import { useTranslation } from 'react-i18next'
import { Sparkles, Languages, Loader2 } from 'lucide-react'
import { LanguageSelector } from './LanguageSelector'

export interface EntryAIToolbarProps {
  /** Trigger AI summarization */
  onSummarize: () => void
  /** Trigger AI translation (or toggle bilingual view) */
  onTranslate: () => void
  /** Whether a summarize request is in flight */
  isSummarizing: boolean
  /** Whether a translation request is in flight */
  isTranslating: boolean
  /** Whether bilingual translation view is currently shown */
  showTranslation: boolean
  /** Currently selected translation target language code */
  translationTargetLanguage: string
  /** Callback when user changes target language */
  onLanguageChange: (lang: string) => void
  /** Disable all AI toolbar buttons (e.g. no API key configured) */
  disabled: boolean
  /** Optional additional CSS classes for the toolbar row */
  className?: string
}

/**
 * Composable AI toolbar for entry reader views.
 *
 * Renders: Summarize button | Translate button | Language selector.
 *
 * Extracted from EntryContent.tsx (lines ~872-903) as a standalone seam
 * so ArticleDetailPage and future reader views can reuse the same AI
 * interaction bar without duplicating toolbar wiring.
 *
 * States handled:
 * - disabled: all buttons greyed out with "Configure AI Key" tooltip
 * - loading: spinner replaces icon
 * - active (translate): accent-highlighted when bilingual view is on
 */
export function EntryAIToolbar({
  onSummarize,
  onTranslate,
  isSummarizing,
  isTranslating,
  showTranslation,
  translationTargetLanguage,
  onLanguageChange,
  disabled,
  className = '',
}: EntryAIToolbarProps) {
  const { t } = useTranslation()

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      <button
        type="button"
        onClick={onSummarize}
        disabled={isSummarizing || disabled}
        title={disabled ? t('entry.configureAIKey') : t('entry.summarize')}
        className={`text-text-secondary hover:bg-surface-secondary hover:text-text dark:text-text-dark-secondary dark:hover:bg-surface-dark-secondary dark:hover:text-text-dark-primary rounded-lg p-1.5 transition-all duration-150 ${disabled ? 'cursor-default opacity-30' : ''}`}
      >
        {isSummarizing ? (
          <Loader2 size={16} className="text-accent animate-spin" />
        ) : (
          <Sparkles size={16} />
        )}
      </button>

      <button
        type="button"
        onClick={onTranslate}
        disabled={isTranslating || disabled}
        title={disabled ? t('entry.configureAIKey') : t('entry.translate')}
        className={`rounded-lg p-1.5 transition-all duration-150 ${
          showTranslation
            ? 'bg-accent/10 text-accent'
            : 'text-text-secondary hover:bg-surface-secondary hover:text-text dark:text-text-dark-secondary dark:hover:bg-surface-dark-secondary dark:hover:text-text-dark-primary'
        } ${disabled ? 'cursor-default opacity-30' : ''}`}
      >
        {isTranslating ? (
          <Loader2 size={16} className="text-accent animate-spin" />
        ) : (
          <Languages size={16} />
        )}
      </button>

      <LanguageSelector
        value={translationTargetLanguage}
        onChange={onLanguageChange}
        disabled={isTranslating || disabled}
      />
    </div>
  )
}
