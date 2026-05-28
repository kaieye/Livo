import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, BookOpen, Loader2 } from 'lucide-react'

import { useEntryStore } from '../store/entry-store'
import { EntryContent } from '../components/entry/EntryContent'
import type { Entry } from '../../../shared/types'

// Page shell for `/entry/:entryId`. EntryContent is store-driven and renders
// its own toolbar + body, so this page's only job is: drive `selectEntry`
// from the URL (deep-link or in-store), provide back-nav chrome, and show a
// page-level splash while the store transitions to the requested entry —
// otherwise the previous entry's UI flashes during navigation.
export default function ArticleDetailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { entryId } = useParams<{ entryId: string }>()

  const storeEntries = useEntryStore((s) => s.entries)
  const selectedEntry = useEntryStore((s) => s.selectedEntry)
  const selectEntry = useEntryStore((s) => s.selectEntry)

  // Tracks an out-of-store fetch so we can render a loading state and a
  // not-found state independently of `selectEntry`'s own hydration flag.
  const [fetchState, setFetchState] = useState<'idle' | 'loading' | 'missing'>(
    'idle',
  )

  const inStoreEntry = useMemo<Entry | null>(
    () =>
      entryId ? (storeEntries.find((e) => e.id === entryId) ?? null) : null,
    [storeEntries, entryId],
  )

  useEffect(() => {
    if (!entryId) {
      setFetchState('missing')
      return
    }

    // Fast path: entry is already in the home list; selectEntry will hit its
    // detail cache or invoke `window.api.entries.get` for the full content.
    if (inStoreEntry) {
      setFetchState('idle')
      void selectEntry(inStoreEntry)
      return
    }

    // Slow path: deep-link or external nav — fetch the bare entry record
    // directly and hand it to `selectEntry` for content hydration.
    let cancelled = false
    setFetchState('loading')
    void window.api.entries
      .get(entryId)
      .then((entry) => {
        if (cancelled) return
        if (!entry) {
          setFetchState('missing')
          return
        }
        setFetchState('idle')
        void selectEntry(entry)
      })
      .catch(() => {
        if (cancelled) return
        setFetchState('missing')
      })

    return () => {
      cancelled = true
    }
  }, [entryId, inStoreEntry, selectEntry])

  const handleBack = useCallback(() => {
    navigate(-1)
  }, [navigate])

  const headerTitle = useMemo(() => {
    if (selectedEntry && selectedEntry.id === entryId) {
      return (
        selectedEntry.title?.trim() ||
        selectedEntry.author?.trim() ||
        t('articleDetail.pageTitle')
      )
    }
    return t('articleDetail.pageTitle')
  }, [selectedEntry, entryId, t])

  // The visible body depends on whether the page can resolve an entry.
  const showNotFound = fetchState === 'missing'
  // True only when there is nothing safe to render in EntryContent yet — i.e.
  // either no selection at all, or the store still holds the previous entry's
  // selection while our effect is racing to set the new one.
  const showLoading =
    !showNotFound &&
    (fetchState === 'loading' || !selectedEntry || selectedEntry.id !== entryId)

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
