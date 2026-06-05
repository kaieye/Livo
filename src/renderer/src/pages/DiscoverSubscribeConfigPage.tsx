import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { openExternalUrlSafe } from '../services/external-url'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ExternalLink,
  Loader2,
  Rss,
} from 'lucide-react'

import { FeedViewType } from '../../../shared/types'
import { FeedAvatar } from '../components/feed/FeedAvatar'
import { FeedSubscribeViewTypeRail } from '../components/feed/FeedSubscribeViewTypeRail'
import {
  buildDiscoverCategoryOptions,
  findDiscoverSubscribeFeed,
  hostOfDiscoverTarget,
  normalizeDiscoverCategory,
  parseDiscoverSubscribeTarget,
  resolveDiscoverSubscribeCategory,
  resolveDiscoverSubscribeTitle,
  resolveDiscoverSubscribeUrl,
  resolveDiscoverSubscribeView,
} from '../lib/discover-subscribe-config'
import { shouldPreserveExplicitDiscoverView } from '../lib/discover-search'
import { ROUTES } from '../router/route-paths'
import { useFeedStore } from '../store/feed-store'

export default function DiscoverSubscribeConfigPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()

  const feeds = useFeedStore((state) => state.feeds)
  const isLoadingFeeds = useFeedStore((state) => state.isLoading)
  const loadFeeds = useFeedStore((state) => state.loadFeeds)
  const addFeed = useFeedStore((state) => state.addFeed)
  const updateFeed = useFeedStore((state) => state.updateFeed)

  const target = useMemo(
    () => parseDiscoverSubscribeTarget(location.search),
    [location.search],
  )
  const existingFeed = useMemo(
    () => findDiscoverSubscribeFeed(feeds, target),
    [feeds, target],
  )

  const [titleValue, setTitleValue] = useState('')
  const [categoryValue, setCategoryValue] = useState('')
  const [selectedView, setSelectedView] = useState<FeedViewType>(
    FeedViewType.Articles,
  )
  const [seedKey, setSeedKey] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const effectiveUrl = existingFeed?.url || target.url
  const effectiveTarget = useMemo(
    () => ({
      ...target,
      url: effectiveUrl,
      title: target.title || existingFeed?.title,
      siteUrl: target.siteUrl || existingFeed?.siteUrl,
      imageUrl: target.imageUrl || existingFeed?.imageUrl,
      description: target.description || existingFeed?.description,
      category:
        target.category || existingFeed?.folder || existingFeed?.category,
      view: target.view ?? existingFeed?.view,
    }),
    [effectiveUrl, existingFeed, target],
  )

  const formSeedKey = [
    location.search,
    existingFeed?.id || '',
    existingFeed?.title || '',
    existingFeed?.category || '',
    existingFeed?.folder || '',
    existingFeed?.view ?? '',
  ].join('|')

  const isEditMode = !!existingFeed
  const displayTitle = resolveDiscoverSubscribeTitle(target, existingFeed)
  const displayHost = hostOfDiscoverTarget(effectiveTarget)
  const categoryOptions = useMemo(
    () => buildDiscoverCategoryOptions(feeds),
    [feeds],
  )
  const submitLabel = isEditMode
    ? t('discoverSubscribeConfig.save')
    : t('discoverSubscribeConfig.subscribe')
  const submittingLabel = isEditMode
    ? t('discoverSubscribeConfig.saving')
    : t('discoverSubscribeConfig.subscribing')
  const pageTitle = isEditMode
    ? t('discoverSubscribeConfig.editTitle')
    : t('discoverSubscribeConfig.pageTitle')

  useEffect(() => {
    if (feeds.length > 0 || isLoadingFeeds) return
    void loadFeeds()
  }, [feeds.length, isLoadingFeeds, loadFeeds])

  useEffect(() => {
    if (seedKey === formSeedKey) return
    setTitleValue(resolveDiscoverSubscribeTitle(target, existingFeed))
    setCategoryValue(resolveDiscoverSubscribeCategory(target, existingFeed))
    setSelectedView(resolveDiscoverSubscribeView(target, existingFeed))
    setSubmitError('')
    setSeedKey(formSeedKey)
  }, [existingFeed, formSeedKey, seedKey, target])

  const handleBack = useCallback(() => navigate(-1), [navigate])

  const handleOpenExternal = useCallback(() => {
    const url = effectiveTarget.siteUrl || effectiveTarget.url
    if (!url) return
    void openExternalUrlSafe(url)
  }, [effectiveTarget])

  const handleSubmit = useCallback(async () => {
    const targetUrl = effectiveTarget.url.trim()
    if (!targetUrl || isSubmitting) return

    setIsSubmitting(true)
    setSubmitError('')
    const nextTitle = titleValue.trim() || displayTitle || targetUrl
    const nextCategory = normalizeDiscoverCategory(categoryValue)
    const nextUrl = resolveDiscoverSubscribeUrl(
      effectiveTarget,
      selectedView,
      existingFeed,
    )

    try {
      if (existingFeed) {
        await updateFeed(existingFeed.id, {
          title: nextTitle,
          url: nextUrl,
          category: nextCategory,
          folder: nextCategory,
          view: selectedView,
          imageUrl: effectiveTarget.imageUrl || existingFeed.imageUrl,
        })
        navigate(ROUTES.feedDetail(existingFeed.id), { replace: true })
        return
      }

      const result = await addFeed(
        nextUrl,
        nextCategory || undefined,
        selectedView,
        nextTitle,
      )
      if (!result.success) {
        throw new Error(
          result.error || t('discoverSubscribeConfig.subscribeFailed'),
        )
      }

      const feedId = result.feed?.id
      if (feedId) {
        const updates: Parameters<typeof updateFeed>[1] = {}
        if (
          shouldPreserveExplicitDiscoverView({
            requestedView: selectedView,
            persistedView:
              typeof result.feed?.view === 'number'
                ? (result.feed.view as number)
                : undefined,
          })
        ) {
          updates.view = selectedView
        }
        if (effectiveTarget.imageUrl && !result.feed?.imageUrl) {
          updates.imageUrl = effectiveTarget.imageUrl
        }
        if (Object.keys(updates).length > 0) {
          await updateFeed(feedId, updates)
        }
      }

      navigate(ROUTES.discover, { replace: true })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : String(error))
    } finally {
      setIsSubmitting(false)
    }
  }, [
    addFeed,
    categoryValue,
    displayTitle,
    effectiveTarget,
    existingFeed,
    isSubmitting,
    navigate,
    selectedView,
    t,
    titleValue,
    updateFeed,
  ])

  const isWaitingForFeed =
    !!target.feedId && !effectiveUrl && isLoadingFeeds && !existingFeed
  const isMissingTarget = !effectiveUrl && !isWaitingForFeed
  const isSubmitDisabled = isSubmitting || isMissingTarget

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[var(--color-bg-primary)]">
      <header className="flex flex-shrink-0 items-center gap-3 border-b border-[var(--color-border-secondary)] px-6 py-3">
        <button
          type="button"
          onClick={handleBack}
          aria-label={t('discoverSubscribeConfig.back')}
          title={t('discoverSubscribeConfig.back')}
          className="rounded-md p-1 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-[var(--color-text-primary)]">
            {pageTitle}
          </h1>
        </div>
        {(effectiveTarget.siteUrl || effectiveTarget.url) && (
          <button
            type="button"
            onClick={handleOpenExternal}
            aria-label={t('discoverSubscribeConfig.openSource')}
            title={t('discoverSubscribeConfig.openSource')}
            className="rounded-md p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <ExternalLink size={16} aria-hidden="true" />
          </button>
        )}
      </header>

      {isWaitingForFeed ? (
        <CenteredState
          icon={<Loader2 size={34} className="animate-spin" />}
          title={t('discoverSubscribeConfig.loadingTitle')}
          hint={t('discoverSubscribeConfig.loadingHint')}
        />
      ) : isMissingTarget ? (
        <CenteredState
          icon={<AlertTriangle size={36} />}
          title={t('discoverSubscribeConfig.missingUrl')}
          hint={t('discoverSubscribeConfig.missingUrlHint')}
        />
      ) : (
        <>
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-6">
              <section className="bg-[var(--color-bg-secondary)]/45 rounded-md border border-[var(--color-border-secondary)] p-4">
                <div className="flex items-start gap-4">
                  <FeedAvatar
                    imageUrl={effectiveTarget.imageUrl}
                    size="lg"
                    className="shadow-sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-[var(--color-text-primary)]">
                        {displayTitle}
                      </h2>
                      {isEditMode && (
                        <span className="inline-flex rounded-md bg-[var(--color-bg-tertiary)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
                          {t('discoverSubscribeConfig.editBadge')}
                        </span>
                      )}
                    </div>
                    {displayHost && (
                      <p className="mt-1 truncate text-xs text-[var(--color-text-tertiary)]">
                        {displayHost}
                      </p>
                    )}
                    {effectiveTarget.description && (
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--color-text-tertiary)]">
                        {effectiveTarget.description}
                      </p>
                    )}
                    <div className="mt-3 flex min-w-0 items-center gap-1.5">
                      <Rss
                        size={12}
                        aria-hidden="true"
                        className="flex-shrink-0 text-[var(--color-text-tertiary)]"
                      />
                      <span className="truncate text-xs text-[var(--color-text-tertiary)]">
                        {effectiveTarget.url}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]">
                    {t('discoverSubscribeConfig.nameLabel')}
                  </label>
                  <input
                    value={titleValue}
                    onChange={(event) => setTitleValue(event.target.value)}
                    placeholder={displayTitle}
                    className="focus:ring-[var(--color-accent)]/30 h-10 w-full rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-bg-primary)] px-3 text-sm text-[var(--color-text-primary)] outline-none transition-shadow placeholder:text-[var(--color-text-tertiary)] focus:ring-2"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]">
                    {t('discoverSubscribeConfig.categoryLabel')}
                  </label>
                  <input
                    value={categoryValue}
                    list="discover-subscribe-categories"
                    onChange={(event) => setCategoryValue(event.target.value)}
                    placeholder={t(
                      'discoverSubscribeConfig.categoryPlaceholder',
                    )}
                    className="focus:ring-[var(--color-accent)]/30 h-10 w-full rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-bg-primary)] px-3 text-sm text-[var(--color-text-primary)] outline-none transition-shadow placeholder:text-[var(--color-text-tertiary)] focus:ring-2"
                  />
                  <datalist id="discover-subscribe-categories">
                    {categoryOptions.map((category) => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                </div>

                <fieldset>
                  <legend className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">
                    {t('discoverSubscribeConfig.viewLabel')}
                  </legend>
                  <FeedSubscribeViewTypeRail
                    selectedView={selectedView}
                    onSelect={setSelectedView}
                  />
                </fieldset>

                {submitError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/35 dark:text-red-300">
                    {submitError}
                  </div>
                )}
              </section>
            </div>
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
              onClick={handleSubmit}
              disabled={isSubmitDisabled}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3.5 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2
                  size={15}
                  className="animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Check size={15} aria-hidden="true" />
              )}
              {isSubmitting ? submittingLabel : submitLabel}
            </button>
          </footer>
        </>
      )}
    </div>
  )
}

function CenteredState({
  icon,
  title,
  hint,
}: {
  icon: ReactNode
  title: string
  hint: string
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)]">
          {icon}
        </div>
        <p className="text-sm font-medium text-[var(--color-text-primary)]">
          {title}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-tertiary)]">
          {hint}
        </p>
      </div>
    </main>
  )
}
