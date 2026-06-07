import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Languages,
  Sparkles,
  Globe,
  Eye,
  EyeOff,
  MoreHorizontal,
  Loader2,
} from 'lucide-react'
import { openExternalUrlSafe } from '../../../../services/external-url'
import { useEntryStore } from '../../../../store/entry-store'
import { useStoreShallow } from '../../../../store/helpers'
import StarToggle from '../../../ui/StarToggle'
import { resolveEntryBrowserOpenUrl } from '../../entry-list/utils/entry-media'
import type { Entry } from '../../../../../../shared/types'

interface SocialActionBarProps {
  entry: Entry
  browserOpenUrl?: string
  onContextMenu?: (e: React.MouseEvent) => void
  onTranslate?: () => void
  onSummarize?: () => void
  isTranslating?: boolean
  isSummarizing?: boolean
  hasTranslation?: boolean
  showTranslation?: boolean
}

/**
 * Floating action bar for social media entries
 * Shows on hover with quick actions: translate, summarize, open, mark read/unread, star, more
 */
export function SocialActionBar({
  entry,
  browserOpenUrl,
  onContextMenu,
  onTranslate,
  onSummarize,
  isTranslating,
  isSummarizing,
  hasTranslation,
  showTranslation,
}: SocialActionBarProps) {
  const { markRead, toggleStar } = useStoreShallow(useEntryStore, (s) => ({
    markRead: s.markRead,
    toggleStar: s.toggleStar,
  }))
  const { t } = useTranslation()
  const resolvedBrowserOpenUrl = useMemo(
    () => browserOpenUrl || resolveEntryBrowserOpenUrl(entry),
    [browserOpenUrl, entry],
  )

  return (
    <div
      className="absolute -right-2 top-0 z-10 -translate-y-1/2 rounded-lg border border-gray-200 bg-white/90 p-1 shadow-sm backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-800/90"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-0.5">
        {/* Translate */}
        <button
          onClick={onTranslate}
          disabled={isTranslating}
          className={`rounded-md p-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-neutral-700 ${
            showTranslation && hasTranslation
              ? 'text-accent'
              : 'text-text-secondary dark:text-text-dark-secondary'
          }`}
          title={t('social.translateTweet')}
        >
          {isTranslating ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Languages size={14} />
          )}
        </button>
        {/* Summarize */}
        <button
          onClick={onSummarize}
          disabled={isSummarizing}
          className="text-text-secondary dark:text-text-dark-secondary rounded-md p-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-neutral-700"
          title={t('social.summarizeTweet')}
        >
          {isSummarizing ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
        </button>
        {/* Open in browser */}
        {resolvedBrowserOpenUrl && (
          <button
            onClick={() => {
              void openExternalUrlSafe(resolvedBrowserOpenUrl)
            }}
            className="text-text-secondary dark:text-text-dark-secondary rounded-md p-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-neutral-700"
            title={t('contextMenu.openInBrowser')}
          >
            <Globe size={14} />
          </button>
        )}
        {/* Divider */}
        <div className="mx-0.5 h-4 w-px bg-gray-200 dark:bg-neutral-600" />
        {/* Mark read/unread */}
        <button
          onClick={() => markRead(entry.id, !entry.isRead)}
          className="text-text-secondary dark:text-text-dark-secondary rounded-md p-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-neutral-700"
          title={
            entry.isRead
              ? t('contextMenu.markUnread')
              : t('contextMenu.markRead')
          }
        >
          {entry.isRead ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        {/* Star */}
        <StarToggle
          isStarred={entry.isStarred}
          onToggle={() => toggleStar(entry.id)}
          size={14}
          title={entry.isStarred ? t('common.unstar') : t('common.star')}
          className="text-text-secondary dark:text-text-dark-secondary rounded-md p-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-neutral-700"
        />
        {/* More (context menu) */}
        <button
          onClick={(e) => onContextMenu?.(e)}
          className="text-text-secondary dark:text-text-dark-secondary rounded-md p-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-neutral-700"
          title={t('contextMenu.more')}
        >
          <MoreHorizontal size={14} />
        </button>
      </div>
    </div>
  )
}
