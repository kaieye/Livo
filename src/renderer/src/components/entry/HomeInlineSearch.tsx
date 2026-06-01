import { memo, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Entry } from '../../../../shared/types'

const RESULT_LIMIT = 12
const SNIPPET_LEAD = 20
const SNIPPET_TRAIL = 30

/** Strip HTML tags and collapse whitespace for plain-text matching/snippets. */
function toPlainText(input?: string): string {
  if (!input) return ''
  return input
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Normalize a raw query into a lowercase, trimmed search token. */
function normalizeQuery(query: string): string {
  return query.trim().toLocaleLowerCase()
}

/** The fields an entry is matched against, in priority order for snippets. */
function entrySearchTexts(entry: Entry, feedTitle: string): string[] {
  return [
    toPlainText(entry.title),
    toPlainText(entry.summary) || toPlainText(entry.content),
    entry.author || '',
    feedTitle || '',
  ]
}

function entryMatchesQuery(
  entry: Entry,
  feedTitle: string,
  query: string,
): boolean {
  return entrySearchTexts(entry, feedTitle).some((text) =>
    text.toLocaleLowerCase().includes(query),
  )
}

/** Build a short snippet around the first match of `query` within `text`. */
function buildSnippet(text: string, query: string): string {
  if (!text || !query) return ''
  const index = text.toLocaleLowerCase().indexOf(query)
  if (index < 0) return ''
  const start = Math.max(0, index - SNIPPET_LEAD)
  const end = Math.min(text.length, index + query.length + SNIPPET_TRAIL)
  let snippet = text.slice(start, end).trim()
  if (start > 0) snippet = `…${snippet}`
  if (end < text.length) snippet = `${snippet}…`
  return snippet
}

/** Pick the best matching field to display as a result subtitle. */
function resultSnippet(entry: Entry, feedTitle: string, query: string): string {
  const candidates = [
    toPlainText(entry.summary) || toPlainText(entry.content),
    entry.author || '',
    feedTitle || '',
    toPlainText(entry.title),
  ]
  for (const candidate of candidates) {
    const snippet = buildSnippet(candidate, query)
    if (snippet) return snippet
  }
  return ''
}

/** Render `text` with case-insensitive matches of `query` highlighted. */
function HighlightedText({ text, query }: { text: string; query: string }) {
  const segments = useMemo(() => {
    if (!text || !query) return [{ text, matched: false }]
    const lower = text.toLocaleLowerCase()
    const parts: Array<{ text: string; matched: boolean }> = []
    let cursor = 0
    let index = lower.indexOf(query, cursor)
    while (index >= 0) {
      if (index > cursor) {
        parts.push({ text: text.slice(cursor, index), matched: false })
      }
      parts.push({
        text: text.slice(index, index + query.length),
        matched: true,
      })
      cursor = index + query.length
      index = lower.indexOf(query, cursor)
    }
    if (cursor < text.length) {
      parts.push({ text: text.slice(cursor), matched: false })
    }
    return parts
  }, [text, query])

  return (
    <>
      {segments.map((segment, i) =>
        segment.matched ? (
          <mark key={i} className="bg-transparent font-semibold text-accent">
            {segment.text}
          </mark>
        ) : (
          <span key={i}>{segment.text}</span>
        ),
      )}
    </>
  )
}

interface HomeInlineSearchProps {
  query: string
  onQueryChange: (value: string) => void
  /** Form submit handler — performs the full backend search. */
  onSubmit: (e: React.FormEvent) => void
  /** Entries currently loaded in the list, filtered client-side. */
  entries: Entry[]
  /** Resolve a feed title from an entry's feedId for matching/display. */
  feedTitleFor: (entry: Entry) => string
  /** Open an entry from the result dropdown. */
  onSelectEntry: (entry: Entry) => void
  placeholder?: string
}

/**
 * Home inline search overlay. Mirrors the Harmony HomeInlineSearchOverlay:
 * typing filters the currently-loaded entries client-side and shows a floating
 * result dropdown with highlighted matches. Pressing Enter still triggers the
 * full backend search (handled by the parent via `onSubmit`).
 */
export const HomeInlineSearch = memo(function HomeInlineSearch({
  query,
  onQueryChange,
  onSubmit,
  entries,
  feedTitleFor,
  onSelectEntry,
  placeholder,
}: HomeInlineSearchProps) {
  const { t } = useTranslation()
  const [focused, setFocused] = useState(false)
  const blurTimerRef = useRef<number | null>(null)

  const normalized = normalizeQuery(query)

  const results = useMemo(() => {
    if (!normalized) return []
    const matched: Entry[] = []
    for (const entry of entries) {
      if (entryMatchesQuery(entry, feedTitleFor(entry), normalized)) {
        matched.push(entry)
        if (matched.length >= RESULT_LIMIT) break
      }
    }
    return matched
  }, [entries, feedTitleFor, normalized])

  const showOverlay = focused && !!normalized
  const showEmptyState = showOverlay && results.length === 0

  const handleBlur = () => {
    // Delay so a result click registers before the overlay closes.
    blurTimerRef.current = window.setTimeout(() => setFocused(false), 120)
  }
  const handleFocus = () => {
    if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current)
    setFocused(true)
  }

  const handleSelect = (entry: Entry) => {
    if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current)
    setFocused(false)
    onSelectEntry(entry)
  }

  return (
    <div className="relative">
      <form onSubmit={onSubmit} className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && query) {
              e.preventDefault()
              onQueryChange('')
            }
          }}
          placeholder={placeholder ?? t('entryList.searchArticles')}
          className="w-full rounded-lg border bg-surface-secondary py-1.5 pl-8 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 dark:bg-surface-dark-secondary"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-text-tertiary hover:bg-surface-tertiary hover:text-text-secondary dark:hover:bg-surface-dark-tertiary"
            title={t('common.clear')}
            aria-label={t('common.clear')}
          >
            <X size={13} />
          </button>
        )}
      </form>

      {showOverlay && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-[60vh] overflow-y-auto rounded-xl border border-surface-secondary bg-white shadow-lg dark:border-surface-dark-tertiary dark:bg-surface-dark">
          {results.length > 0 ? (
            <ul className="p-1.5">
              {results.map((entry) => {
                const feedTitle = feedTitleFor(entry)
                const snippet = resultSnippet(entry, feedTitle, normalized)
                const subtitle = feedTitle || entry.author || ''
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      // Use onMouseDown so the click lands before input blur.
                      onMouseDown={(e) => {
                        e.preventDefault()
                        handleSelect(entry)
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="line-clamp-2 text-sm font-semibold leading-snug">
                          <HighlightedText
                            text={toPlainText(entry.title)}
                            query={normalized}
                          />
                        </span>
                        {subtitle && (
                          <span className="flex-shrink-0 truncate text-[11px] text-text-tertiary">
                            {subtitle}
                          </span>
                        )}
                      </div>
                      {snippet && (
                        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-text-secondary dark:text-text-dark-secondary">
                          <HighlightedText text={snippet} query={normalized} />
                        </p>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : showEmptyState ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm font-medium">
                {t('entryList.inlineSearchEmptyTitle')}
              </p>
              <p className="mt-1 text-xs text-text-secondary dark:text-text-dark-secondary">
                {t('entryList.inlineSearchEmptyHint')}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
})
