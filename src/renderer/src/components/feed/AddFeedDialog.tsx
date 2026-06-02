import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFeedStore } from '../../store/feed-store'
import { useSettingsStore } from '../../store/settings-store'
import { FeedViewType, VIEW_DEFINITIONS } from '../../../../shared/types'
import { remapBilibiliFeedUrlToView } from '../../../../shared/bilibili-feed-url'
import { resolveSubscriptionTarget } from '../../../../shared/subscription-intake'
import { isInstagramFeedUrl } from '../../../../shared/url-detect'
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

    // Resolve profile URL via IPC, then use shared intake pipeline
    let ipcCandidates: Array<{
      feedUrl: string
      title: string
      view?: FeedViewType | number
      requiresAccount?: string[]
      note?: string
    }> = []
    let accountStates: Array<{ provider: string; linked: boolean }> = []
    try {
      const resolved = await window.api.discover.resolveProfileUrl(inputUrl)
      ipcCandidates = resolved.candidates
      accountStates = resolved.accountStates ?? []
    } catch {
      // Ignore resolver errors — fall back to direct URL subscribe
    }

    const resolved = resolveSubscriptionTarget(inputUrl, {
      rsshubInstance,
      preferredView: viewTouched ? view : undefined,
      resolvedCandidates: ipcCandidates,
    })
    const {
      feedUrl,
      title: resolvedTitle,
      view: resolvedView,
    } = resolved.target
    let targetUrl = feedUrl
    let targetTitle = resolvedTitle || undefined
    let targetView = resolvedView

    // Show resolve notes for special platforms
    if (ipcCandidates.length > 0) {
      const chosen =
        ipcCandidates.find((c) => c.feedUrl === feedUrl) ?? ipcCandidates[0]
      const youtubeState = accountStates.find((s) => s.provider === 'youtube')
      if (
        chosen.requiresAccount?.includes('youtube') &&
        youtubeState &&
        !youtubeState.linked
      ) {
        setResolveNote(
          'Detected YouTube profile. Link YouTube account in Settings -> Accounts for better compatibility.',
        )
      } else if (chosen.note === 'instagram_carousel_tip') {
        setResolveNote(t('settings.instagramCarouselTip'))
      } else {
        setResolveNote(`Resolved: ${feedUrl}`)
      }
    }

    targetUrl = remapBilibiliFeedUrlToView(targetUrl, targetView)
    const result = await addFeed(
      targetUrl,
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
        className="dark:bg-surface-dark-secondary w-[480px] max-w-[90vw] overflow-hidden rounded-xl bg-white shadow-2xl"
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
            className="hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary rounded-lg p-1"
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
              className="bg-surface-secondary focus:ring-accent/50 dark:bg-surface-dark-tertiary w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
              autoFocus
              disabled={isLoading}
            />
            <p className="text-text-secondary dark:text-text-dark-secondary mt-1 text-xs">
              {t('settings.feedUrlHint')}
            </p>
            {resolveNote && (
              <p className="text-accent mt-1 text-xs">{resolveNote}</p>
            )}
            {isInstagramFeedUrl(url) && (
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
                          : 'bg-surface-secondary text-text-secondary hover:border-border dark:bg-surface-dark-tertiary dark:text-text-dark-secondary border-transparent'
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
              className="bg-surface-secondary focus:ring-accent/50 dark:bg-surface-dark-tertiary w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
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
              className="hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary rounded-lg px-4 py-2 text-sm transition-colors"
              disabled={isLoading}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isLoading || !url.trim()}
              className="bg-accent hover:bg-accent-hover flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-white transition-colors disabled:opacity-50"
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
