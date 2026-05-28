import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, BookOpen, Loader2 } from 'lucide-react'

import { EntryContent } from '../components/entry/EntryContent'
import { useDeepLinkEntry } from '../hooks/useDeepLinkEntry'

// Page shell for `/entry/:entryId`. EntryContent is store-driven and renders
// its own toolbar + body, so this page's only job is: drive `selectEntry`
// from the URL (deep-link or in-store), provide back-nav chrome, and show a
// page-level splash while the store transitions to the requested entry —
// otherwise the previous entry's UI flashes during navigation.
export default function ArticleDetailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { entryId } = useParams<{ entryId: string }>()

  const { activeEntry, state: fetchState } = useDeepLinkEntry(entryId)

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
  // Splash until the requested entry is in the store — otherwise EntryContent
  // would briefly render the previous selection during navigation.
  const showLoading =
    !showNotFound && (fetchState === 'loading' || !activeEntry)

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
          // EntryContent itself shows a hydration spinner when fully selected
          // but still fetching content. Show this page-level splash only
          // while the store does not yet hold the requested entry — otherwise
          // we would flash the previous entry's UI during navigation.
          <div className="flex flex-1 items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              <span>{t('articleDetail.loading')}</span>
            </div>
          </div>
        ) : (
          // EntryContent reads `selectedEntry` directly from the store and
          // owns its own toolbar (star, AI summarize, translate, chat,
          // readability, copy link, prev/next, external link) and body
          // (sanitized content, social overlay, image gallery, video player).
          <EntryContent />
        )}
      </main>
    </div>
  )
}
