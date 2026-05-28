import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  ExternalLink,
  Loader2,
  Rss,
  User,
} from 'lucide-react'

import type {
  DiscoverFeedPreview,
  DiscoverFeedPreviewEntry,
  FeedViewType,
} from '../../../shared/types'
import { FeedAvatar } from '../components/feed/FeedAvatar'
import { inferDiscoverFeedViewFromUrl } from '../lib/discover-feed'
import { VIEW_TYPE_I18N_KEYS } from '../lib/view-type-keys'
import { ROUTES } from '../router/route-paths'

interface DiscoverPreviewTarget {
  url: string
  title?: string
  siteUrl?: string
  imageUrl?: string
  description?: string
  view?: FeedViewType
}

export default function DiscoverPreviewPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [preview, setPreview] = useState<DiscoverFeedPreview | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const target = useMemo(
    () => parseDiscoverPreviewTarget(location.search),
    [location.search],
  )

  const preferredView = useMemo(
    () => target.view ?? inferDiscoverFeedViewFromUrl(target.url),
    [target.url, target.view],
  )

  const viewLabel = t(
    VIEW_TYPE_I18N_KEYS[preferredView] || 'viewTypes.articles',
  )

  const displayTitle =
    preview?.feedTitle || target.title || t('discoverPreview.pageTitle')
  const displayDescription =
    preview?.description || target.description || preview?.siteUrl || ''
  const displayHost = hostOf(preview?.siteUrl || target.siteUrl || target.url)
  const externalUrl = preview?.siteUrl || target.siteUrl || target.url

  useEffect(() => {
    let cancelled = false

    async function loadPreview() {
      setPreview(null)
      setError('')
      if (!target.url) {
        setError(t('discoverPreview.missingUrl'))
        return
      }

      setIsLoading(true)
      try {
        const result = await window.api.discover.previewFeed(target.url)
        if (cancelled) return
        if (result.success) {
          setPreview(result.preview)
        } else {
          setError(result.error)
        }
      } catch (e) {
        if (!cancelled) setError(String(e))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadPreview()
    return () => {
      cancelled = true
    }
  }, [reloadKey, target.url, t])

  const handleBack = useCallback(() => navigate(-1), [navigate])
  const handleRetry = useCallback(() => setReloadKey((x) => x + 1), [])
  const handleOpenExternal = useCallback(() => {
    if (!externalUrl) return
    void window.api.app.openExternal(externalUrl)
  }, [externalUrl])

  const handleContinue = useCallback(() => {
    if (!target.url) return
    navigate(
      ROUTES.discoverSubscribe({
        url: preview?.targetUrl || target.url,
        title: preview?.feedTitle || target.title,
        siteUrl: preview?.siteUrl || target.siteUrl,
        imageUrl: preview?.imageUrl || target.imageUrl,
        description: preview?.description || target.description,
        view: preferredView,
      }),
    )
  }, [navigate, preferredView, preview, target])

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[var(--color-bg-primary)]">
      <header className="flex flex-shrink-0 items-center gap-3 border-b border-[var(--color-border-secondary)] px-6 py-3">
        <button
          type="button"
          onClick={handleBack}
          aria-label={t('discoverPreview.back')}
          title={t('discoverPreview.back')}
          className="rounded-md p-1 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-[var(--color-text-primary)]">
            {displayTitle}
          </h1>
        </div>
        {externalUrl && (
          <button
            type="button"
            onClick={handleOpenExternal}
            aria-label={t('discoverPreview.openSource')}
            title={t('discoverPreview.openSource')}
            className="rounded-md p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <ExternalLink size={16} aria-hidden="true" />
          </button>
        )}
      </header>

      <main className="flex flex-1 flex-col overflow-hidden">
        {isLoading ? (
          <CenteredState
            icon={<Loader2 size={34} className="animate-spin" />}
            title={t('discoverPreview.loadingTitle')}
            hint={t('discoverPreview.loadingHint')}
          />
        ) : error ? (
          <CenteredState
            icon={<AlertTriangle size={36} />}
            title={t('discoverPreview.errorTitle')}
            hint={error}
            action={
              <button
                type="button"
                onClick={handleRetry}
                className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                {t('discoverPreview.retry')}
              </button>
            }
          />
        ) : preview ? (
          <>
            <section className="bg-[var(--color-bg-secondary)]/50 flex-shrink-0 border-b border-[var(--color-border-secondary)] px-6 py-5">
              <div className="flex items-start gap-4">
                <FeedAvatar
                  imageUrl={preview.imageUrl || target.imageUrl}
                  size="lg"
                  className="shadow-sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-[var(--color-text-primary)]">
                      {preview.feedTitle || target.title || target.url}
                    </h2>
                    <span className="inline-flex items-center rounded-md bg-[var(--color-bg-tertiary)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
                      {viewLabel}
                    </span>
                  </div>
                  {displayHost && (
                    <p className="mt-1 truncate text-xs text-[var(--color-text-tertiary)]">
                      {displayHost}
                    </p>
                  )}
                  {displayDescription && (
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--color-text-tertiary)]">
                      {displayDescription}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-[var(--color-text-tertiary)]">
                    {t('discoverPreview.itemCount', {
                      count: preview.itemCount,
                    })}
                  </p>
                </div>
              </div>
            </section>

            <div className="flex-1 overflow-y-auto">
              <div className="px-6 py-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                  {t('discoverPreview.entriesTitle')}
                </h3>
                {preview.entries.length > 0 ? (
                  <ul className="divide-y divide-[var(--color-border-secondary)] overflow-hidden rounded-md border border-[var(--color-border-secondary)]">
                    {preview.entries.map((entry) => (
                      <li key={entry.id}>
                        <PreviewEntryRow entry={entry} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-[var(--color-border-secondary)] px-6 py-16 text-center">
                    <Rss
                      size={34}
                      aria-hidden="true"
                      className="mb-3 text-[var(--color-text-tertiary)] opacity-40"
                    />
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {t('discoverPreview.noEntries')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </main>

      <footer className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-[var(--color-border-secondary)] px-6 py-3">
        <button
          type="button"
          onClick={handleBack}
          className="rounded-md px-3 py-1.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={handleContinue}
          disabled={!preview || isLoading}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3.5 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('discoverPreview.continue')}
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </footer>
    </div>
  )
}

function parseDiscoverPreviewTarget(search: string): DiscoverPreviewTarget {
  const params = new URLSearchParams(search)
  const view = Number(params.get('view'))
  return {
    url: params.get('url') || params.get('targetUrl') || '',
    title: params.get('title') || params.get('targetTitle') || undefined,
    siteUrl: params.get('siteUrl') || undefined,
    imageUrl: params.get('imageUrl') || undefined,
    description: params.get('description') || undefined,
    view: Number.isFinite(view) ? (view as FeedViewType) : undefined,
  }
}

function hostOf(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}

function formatPublishedAt(value: number): string {
  if (!value) return ''
  return new Date(value).toLocaleDateString()
}

function CenteredState({
  icon,
  title,
  hint,
  action,
}: {
  icon: React.ReactNode
  title: string
  hint: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)]">
          {icon}
        </div>
        <p className="text-sm font-medium text-[var(--color-text-primary)]">
          {title}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-tertiary)]">
          {hint}
        </p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  )
}

function PreviewEntryRow({ entry }: { entry: DiscoverFeedPreviewEntry }) {
  const hasImage = !!entry.imageUrl
  const dateLabel = formatPublishedAt(entry.publishedAt)

  return (
    <div className="flex min-h-[76px] items-start gap-3 bg-[var(--color-bg-primary)] px-4 py-3">
      {hasImage ? (
        <img
          src={entry.imageUrl}
          alt=""
          loading="lazy"
          className="h-12 w-12 flex-shrink-0 rounded-lg bg-[var(--color-bg-tertiary)] object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--color-bg-tertiary)]"
        >
          <Rss size={14} className="text-[var(--color-text-tertiary)]" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <h4 className="line-clamp-2 text-sm font-medium leading-snug text-[var(--color-text-primary)]">
          {entry.title || entry.url}
        </h4>
        {entry.summary && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--color-text-tertiary)]">
            {entry.summary}
          </p>
        )}
        {(entry.author || dateLabel) && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-text-tertiary)]">
            {entry.author && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <User size={11} aria-hidden="true" />
                <span className="truncate">{entry.author}</span>
              </span>
            )}
            {dateLabel && (
              <span className="inline-flex items-center gap-1">
                <Calendar size={11} aria-hidden="true" />
                {dateLabel}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
