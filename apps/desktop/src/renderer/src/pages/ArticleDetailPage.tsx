import { useState, useCallback, useMemo, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, BookOpen, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { EntryContent } from '../components/entry/EntryContent'
import { EntryAIToolbar } from '../components/entry/EntryAIToolbar'
import { AIAssistContent } from '../components/entry/AIAssistContent'
import { SocialDetailView } from '../components/entry/SocialDetailView'
import { useDeepLinkEntry } from '../hooks/useDeepLinkEntry'
import { useAISummary } from '../hooks/useAISummary'
import { useAITranslation } from '../hooks/useAITranslation'
import { useFeedStore } from '../store/feed-store'
import {
  useGeneralSettingsShallowSelector,
  useTranslationSettingKey,
  useAISettingKey,
  useSettingsActions,
} from '../store/settings-store'
import { splitHtmlIntoParagraphs } from '../lib/entry-text'
import { getDateLocale } from '../lib/date-locale'
import { FeedViewType } from '../../../shared/types'

// Page shell for `/entry/:entryId`.
//
// Owns AI assist state (useAISummary / useAITranslation) at page level so
// AI capabilities are available to any reader view — not just EntryContent.
// Detects social entries via feed viewType and delegates to SocialDetailView
// for social-specific rendering (author header, quoted tweets, media gallery).
export default function ArticleDetailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { entryId } = useParams<{ entryId: string }>()

  const { activeEntry, state: fetchState } = useDeepLinkEntry(entryId)

  // Settings — font/line/family drive AIAssistContent rendering
  const general = useGeneralSettingsShallowSelector((s) => ({
    fontSize: s.fontSize,
    contentLineHeight: s.contentLineHeight,
    contentFontFamily: s.contentFontFamily,
    language: s.language,
  }))
  const translationTargetLanguage = useTranslationSettingKey('targetLanguage')
  const aiApiKey = useAISettingKey('apiKey')
  const { updateSettingsSection } = useSettingsActions()

  // Social entry detection — look up the parent feed's viewType
  const feed = useFeedStore((s) =>
    activeEntry ? s.feeds.find((f) => f.id === activeEntry.feedId) : null,
  )
  const isSocial = feed?.view === FeedViewType.SocialMedia

  // --- AI assist hooks (owned at page level for composability) ---
  const {
    summary,
    error: summaryError,
    isLoading: isSummarizing,
    summarize,
    reset: resetSummary,
  } = useAISummary()
  const {
    translatedParagraphs,
    isTranslating,
    showTranslation,
    errorMap,
    translate,
    toggle: toggleTranslation,
    reset: resetTranslation,
  } = useAITranslation()

  // Reset AI state on entry change
  useEffect(() => {
    resetSummary()
    resetTranslation()
  }, [entryId, resetSummary, resetTranslation])

  // Paragraphs for paragraph-by-paragraph translation
  const paragraphs = useMemo(() => {
    if (!activeEntry?.content) return []
    return splitHtmlIntoParagraphs(activeEntry.content)
  }, [activeEntry?.content])

  // --- AI action handlers ---
  const handleSummarize = useCallback(() => {
    if (!activeEntry?.content) return
    void summarize(activeEntry.content, general.language)
  }, [activeEntry?.content, general.language, summarize])

  const handleTranslate = useCallback(() => {
    if (!activeEntry?.content) return
    // Toggle off if currently showing
    if (showTranslation && translatedParagraphs.length > 0) {
      toggleTranslation()
      return
    }
    // Toggle on if already translated (cached)
    if (translatedParagraphs.length > 0) {
      toggleTranslation()
      return
    }
    // Start fresh translation
    const targetLang = translationTargetLanguage || 'zh-CN'
    void translate(paragraphs, targetLang)
  }, [
    activeEntry?.content,
    paragraphs,
    translationTargetLanguage,
    translate,
    showTranslation,
    translatedParagraphs.length,
    toggleTranslation,
  ])

  // --- Header ---
  const handleBack = useCallback(() => {
    navigate(-1)
  }, [navigate])

  const headerTitle = useMemo(() => {
    if (activeEntry) {
      return (
        activeEntry.title?.trim() ||
        activeEntry.author?.trim() ||
        t('articleDetail.pageTitle')
      )
    }
    return t('articleDetail.pageTitle')
  }, [activeEntry, t])

  const showNotFound = fetchState === 'missing'
  const showLoading =
    !showNotFound && (fetchState === 'loading' || !activeEntry)

  // --- Social avatar / author info (for SocialDetailView) ---
  const socialAvatarUrl = activeEntry?.authorAvatar ?? ''
  const socialAuthorName = activeEntry?.author ?? ''
  const [avatarFailed, setAvatarFailed] = useState(false)
  const avatarLetter = socialAuthorName
    ? socialAuthorName.charAt(0).toUpperCase()
    : '?'
  const timeAgo = useMemo(() => {
    if (!activeEntry?.publishedAt) return ''
    try {
      return formatDistanceToNow(activeEntry.publishedAt, {
        addSuffix: true,
        locale: getDateLocale(),
      })
    } catch {
      return ''
    }
  }, [activeEntry?.publishedAt, general.language])

  // Plain text (for social AI ops)
  const plainContent = useMemo(
    () => (activeEntry?.content ?? '').replace(/<[^>]*>/g, '').trim(),
    [activeEntry?.content],
  )

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[var(--color-bg-primary)]">
      <header className="flex flex-shrink-0 items-center gap-3 border-b border-[var(--color-border-secondary)] px-4 py-2">
        <button
          type="button"
          onClick={handleBack}
          aria-label={t('articleDetail.back')}
          title={t('articleDetail.back')}
          className="rounded-md p-1 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-text-primary)]">
          {headerTitle}
        </h1>

        {/* AI toolbar — composable in any reader page header */}
        {!showNotFound && !showLoading && (
          <EntryAIToolbar
            onSummarize={handleSummarize}
            onTranslate={handleTranslate}
            isSummarizing={isSummarizing}
            isTranslating={isTranslating}
            showTranslation={showTranslation}
            translationTargetLanguage={translationTargetLanguage}
            onLanguageChange={(lang) =>
              updateSettingsSection('translation', {
                targetLanguage: lang,
              })
            }
            disabled={!aiApiKey}
          />
        )}
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {showNotFound ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="px-6 text-center">
              <BookOpen
                size={48}
                aria-hidden="true"
                className="mx-auto mb-4 text-[var(--color-text-tertiary)] opacity-40"
              />
              <p className="text-sm text-[var(--color-text-secondary)]">
                {t('articleDetail.notFound')}
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                {t('articleDetail.notFoundHint')}
              </p>
              <button
                type="button"
                onClick={handleBack}
                className="mt-4 text-sm text-[var(--color-accent)] hover:underline"
              >
                {t('articleDetail.back')}
              </button>
            </div>
          </div>
        ) : showLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              <span>{t('articleDetail.loading')}</span>
            </div>
          </div>
        ) : isSocial ? (
          // Social content detail — renders social-specific layout with author,
          // tweet body, translation, and media gallery
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[680px] px-4 py-6">
              <AIAssistContent
                summary={summary}
                summaryError={summaryError}
                isSummarizing={isSummarizing}
                onRetrySummary={handleSummarize}
                showTranslation={showTranslation}
                paragraphs={paragraphs}
                translatedParagraphs={translatedParagraphs}
                isTranslating={isTranslating}
                errorMap={errorMap}
                fontSize={general.fontSize}
                lineHeight={general.contentLineHeight}
                fontFamily={general.contentFontFamily}
              />

              <SocialDetailView
                entryId={activeEntry!.id}
                paragraphs={paragraphs}
                fullContent={activeEntry!.content ?? ''}
                plainContent={plainContent}
                avatarUrl={socialAvatarUrl}
                avatarImageFailed={avatarFailed}
                avatarLetter={avatarLetter}
                authorName={socialAuthorName}
                timeAgo={timeAgo}
                onAvatarError={() => setAvatarFailed(true)}
                showTranslation={showTranslation}
                translatedParagraphs={translatedParagraphs}
                isTranslating={isTranslating}
                isSummarizing={isSummarizing}
                showSummary={!!summary}
                summary={summary}
                fontSize={general.fontSize}
              />
            </div>
          </div>
        ) : (
          // Standard article content — EntryContent owns its own toolbar
          // and rendering; AIAssistContent provides page-level AI panels
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <AIAssistContent
              summary={summary}
              summaryError={summaryError}
              isSummarizing={isSummarizing}
              onRetrySummary={handleSummarize}
              showTranslation={showTranslation}
              paragraphs={paragraphs}
              translatedParagraphs={translatedParagraphs}
              isTranslating={isTranslating}
              errorMap={errorMap}
              fontSize={general.fontSize}
              lineHeight={general.contentLineHeight}
              fontFamily={general.contentFontFamily}
            />
            <EntryContent />
          </div>
        )}
      </main>
    </div>
  )
}
