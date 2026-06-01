import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFeedStore } from '../../store/feed-store'
import { useSettingsStore } from '../../store/settings-store'
import { FeedViewType, VIEW_DEFINITIONS } from '../../../../shared/types'
import { remapBilibiliFeedUrlToView } from '../../../../shared/bilibili-feed-url'
import { VIEW_TYPE_I18N_KEYS } from '../../lib/view-type-keys'
import {
  X,
  Loader2,
  Rss,
  FileText,
  MessageCircle,
  Image,
  Play,
} from 'lucide-react'

const VIEW_ICONS: Record<FeedViewType, React.ReactNode> = {
  [FeedViewType.Articles]: <FileText size={16} />,
  [FeedViewType.SocialMedia]: <MessageCircle size={16} />,
  [FeedViewType.Videos]: <Play size={16} />,
  [FeedViewType.Pictures]: <Image size={16} />,
}

function isInstagramUrl(url: string): boolean {
  const lower = url.toLowerCase().trim()
  return (
    lower.includes('instagram.com') ||
    lower.includes('rsshub://instagram/') ||
    /\/instagram\//i.test(lower) ||
    /\/picnob\//i.test(lower) ||
    /\/pixnoy\//i.test(lower) ||
    /\/piokok\//i.test(lower)
  )
}

export function AddFeedDialog({
  onClose,
  defaultView,
}: {
  onClose: () => void
  defaultView?: FeedViewType | null
}) {
  const addFeed = useFeedStore((s) => s.addFeed)
  const rsshubInstance =
    useSettingsStore((s) => s.settings.general.rsshubInstance) ||
    'https://rsshub.pseudoyu.com'
  const { t } = useTranslation()
  const [url, setUrl] = useState('')
  const [category, setCategory] = useState('')
  const [view, setView] = useState<FeedViewType>(
    defaultView ?? FeedViewType.Articles,
  )
  const [viewTouched, setViewTouched] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [resolveNote, setResolveNote] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    setIsLoading(true)
    setError('')
    setResolveNote('')

    const inputUrl = url.trim()
    const normalizeFeedUrl = (rawUrl: string) => {
      if (!/^rsshub:\/\/\S+/i.test(rawUrl)) return rawUrl
      const route = rawUrl.replace(/^rsshub:\/\//i, '').replace(/^\/+/, '')
      const base = rsshubInstance.trim().replace(/\/+$/, '')
      return `${base}/${route}`
    }
    let targetUrl = inputUrl
    let targetTitle: string | undefined
    let targetView = view

    try {
      const resolved = await window.api.discover.resolveProfileUrl(
        normalizeFeedUrl(inputUrl),
      )
      const firstCandidate = resolved.candidates[0]
      if (resolved.matched && firstCandidate) {
        const chosenCandidate =
          resolved.platform === 'bilibili' && viewTouched
            ? resolved.candidates.find(
                (candidate) => candidate.view === view,
              ) || firstCandidate
            : firstCandidate

        targetUrl = chosenCandidate.feedUrl
        targetTitle = chosenCandidate.title
        if (typeof chosenCandidate.view === 'number') {
          targetView = chosenCandidate.view as FeedViewType
        }

        const youtubeState = resolved.accountStates?.find(
          (s) => s.provider === 'youtube',
        )
        if (
          chosenCandidate.requiresAccount?.includes('youtube') &&
          youtubeState &&
          !youtubeState.linked
        ) {
          setResolveNote(
            'Detected YouTube profile. Link YouTube account in Settings -> Accounts for better compatibility.',
          )
        } else if (chosenCandidate.note === 'instagram_carousel_tip') {
          setResolveNote(t('settings.instagramCarouselTip'))
        } else {
          setResolveNote(`Resolved: ${chosenCandidate.feedUrl}`)
        }
      }
    } catch {
      // Ignore resolver errors and fall back to direct URL subscribe.
    }

    targetUrl = remapBilibiliFeedUrlToView(
      normalizeFeedUrl(targetUrl),
      targetView,
    )
    const result = await addFeed(
      normalizeFeedUrl(targetUrl),
      category.trim() || undefined,
      targetView,
      targetTitle,
    )
    setIsLoading(false)

    if (result.success) {
      onClose()
    } else {
      setError(result.error || t('settings.addFeedFailed'))
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-[480px] max-w-[90vw] overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-surface-dark-secondary"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Rss size={20} className="text-accent" />
            {t('settings.addFeed')}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t('settings.feedUrl')}
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('settings.feedUrlPlaceholder')}
              className="w-full rounded-lg border bg-surface-secondary px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 dark:bg-surface-dark-tertiary"
              autoFocus
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-text-secondary dark:text-text-dark-secondary">
              {t('settings.feedUrlHint')}
            </p>
            {resolveNote && (
              <p className="mt-1 text-xs text-accent">{resolveNote}</p>
            )}
            {isInstagramUrl(url) && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                {t('settings.instagramCarouselTip')}
              </p>
            )}
          </div>

          {/* View type selector */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              {t('settings.viewCategory')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {Object.values(FeedViewType)
                .filter((v) => typeof v === 'number')
                .map((viewType) => {
                  const def = VIEW_DEFINITIONS[viewType as FeedViewType]
                  const isSelected = view === viewType
                  return (
                    <button
                      key={viewType}
                      type="button"
                      onClick={() => {
                        setView(viewType as FeedViewType)
                        setViewTouched(true)
                      }}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ${
                        isSelected
                          ? `border-accent bg-accent/5 ${def.color} font-medium`
                          : 'border-transparent bg-surface-secondary text-text-secondary hover:border-border dark:bg-surface-dark-tertiary dark:text-text-dark-secondary'
                      }`}
                    >
                      {VIEW_ICONS[viewType as FeedViewType]}
                      {t(
                        VIEW_TYPE_I18N_KEYS[viewType as FeedViewType] ||
                          def.name,
                      )}
                    </button>
                  )
                })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t('settings.categoryOptional')}
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={t('settings.categoryPlaceholder')}
              className="w-full rounded-lg border bg-surface-secondary px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 dark:bg-surface-dark-tertiary"
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500 dark:bg-red-900/20">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm transition-colors hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
              disabled={isLoading}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isLoading || !url.trim()}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {isLoading && <Loader2 size={14} className="animate-spin" />}
              {isLoading ? t('settings.adding') : t('common.add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
