import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Rss, X, Check } from 'lucide-react'

import { FeedViewType } from '../../../../shared/types'
import { FeedAvatar } from '../feed/FeedAvatar'
import { FeedSubscribeViewTypeRail } from '../feed/FeedSubscribeViewTypeRail'
import {
  buildDiscoverCategoryOptions,
  findDiscoverSubscribeFeed,
  hostOfDiscoverTarget,
  normalizeDiscoverCategory,
  resolveDiscoverSubscribeCategory,
  resolveDiscoverSubscribeTitle,
  resolveDiscoverSubscribeUrl,
  resolveDiscoverSubscribeView,
  type DiscoverSubscribeTarget,
} from '../../lib/discover-subscribe-config'
import { shouldPreserveExplicitDiscoverView } from '../../lib/discover-search'
import { ROUTES } from '../../router/route-paths'
import { useFeedStore } from '../../store/feed-store'
import { useNavigate } from 'react-router-dom'

export function SubscribeConfigDialog({
  target,
  onClose,
}: {
  target: DiscoverSubscribeTarget
  onClose: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const feeds = useFeedStore((state) => state.feeds)
  const isLoadingFeeds = useFeedStore((state) => state.isLoading)
  const loadFeeds = useFeedStore((state) => state.loadFeeds)
  const addFeed = useFeedStore((state) => state.addFeed)
  const updateFeed = useFeedStore((state) => state.updateFeed)

  const existingFeed = useMemo(
    () => findDiscoverSubscribeFeed(feeds, target),
    [feeds, target],
  )

  const [titleValue, setTitleValue] = useState('')
  const [categoryValue, setCategoryValue] = useState('')
  const [selectedView, setSelectedView] = useState<FeedViewType>(
    FeedViewType.Articles,
  )
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

  useEffect(() => {
    if (feeds.length > 0 || isLoadingFeeds) return
    void loadFeeds()
  }, [feeds.length, isLoadingFeeds, loadFeeds])

  useEffect(() => {
    setTitleValue(resolveDiscoverSubscribeTitle(target, existingFeed))
    setCategoryValue(resolveDiscoverSubscribeCategory(target, existingFeed))
    setSelectedView(resolveDiscoverSubscribeView(target, existingFeed))
    setSubmitError('')
  }, [existingFeed, target])

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
        onClose()
        navigate(ROUTES.feed(existingFeed.id), { replace: true })
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

      onClose()
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
    onClose,
    selectedView,
    t,
    titleValue,
    updateFeed,
  ])

  const isSubmitDisabled = isSubmitting || !effectiveUrl

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="dark:bg-surface-dark-secondary w-[480px] max-w-[90vw] overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            {isEditMode
              ? t('discoverSubscribeConfig.editTitle')
              : t('discoverSubscribeConfig.pageTitle')}
          </h2>
          <button
            onClick={onClose}
            className="hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary rounded-lg p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Feed info */}
        <div className="border-b px-6 py-4">
          <div className="flex items-start gap-3">
            <FeedAvatar
              imageUrl={effectiveTarget.imageUrl}
              size="lg"
              className="shadow-sm"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-[var(--color-text-primary)]">
                  {displayTitle}
                </h3>
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
        </div>

        {/* Form */}
        <div className="space-y-4 px-6 py-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-primary)]">
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
            <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-primary)]">
              {t('discoverSubscribeConfig.categoryLabel')}
            </label>
            <input
              value={categoryValue}
              list="discover-subscribe-categories-dialog"
              onChange={(event) => setCategoryValue(event.target.value)}
              placeholder={t('discoverSubscribeConfig.categoryPlaceholder')}
              className="focus:ring-[var(--color-accent)]/30 h-10 w-full rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-bg-primary)] px-3 text-sm text-[var(--color-text-primary)] outline-none transition-shadow placeholder:text-[var(--color-text-tertiary)] focus:ring-2"
            />
            <datalist id="discover-subscribe-categories-dialog">
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
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t px-6 py-3">
          <button
            type="button"
            onClick={onClose}
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
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            ) : (
              <Check size={15} aria-hidden="true" />
            )}
            {isSubmitting ? submittingLabel : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
