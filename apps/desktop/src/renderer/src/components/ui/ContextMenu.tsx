/**
 * Context Menu — Right-click context menu for entry items.
 * Rich context menu with mark read/unread, star, copy, share, and integrations.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { openExternalUrlSafe } from '../../services/external-url'
import {
  Eye,
  EyeOff,
  Star,
  ExternalLink,
  Copy,
  Download,
  ArrowUp,
  ArrowDown,
  Share2,
  Image as ImageIcon,
  FileText,
} from 'lucide-react'
import type { Entry } from '../../../../shared/types'
import type { NativeContextMenuItem } from '../../../../shared/types'
import { useOverlayHotkeyScope } from '../../hooks/useHotkeyScope'

export interface ContextMenuAction {
  id: string
  label: string
  icon: React.ReactNode
  onClick: () => void
  danger?: boolean
  separator?: boolean
  disabled?: boolean
  hidden?: boolean
}

function inferEntryImageUrl(entry: Entry): string {
  const mediaCandidate = (entry.media || []).find(
    (item) =>
      item.type === 'photo' && (item.previewUrl?.trim() || item.url?.trim()),
  )
  return (
    mediaCandidate?.previewUrl?.trim() ||
    mediaCandidate?.url?.trim() ||
    entry.imageUrl?.trim() ||
    ''
  )
}

function inferEntryMediaUrl(entry: Entry): string {
  const videoCandidate = (entry.media || []).find(
    (item) =>
      item.type === 'video' && (item.url?.trim() || item.previewUrl?.trim()),
  )
  if (videoCandidate) {
    return videoCandidate.url?.trim() || videoCandidate.previewUrl?.trim() || ''
  }
  return inferEntryImageUrl(entry)
}

function inferSuggestedFileName(entry: Entry, url: string): string {
  const cleanTitle = Array.from((entry.title || 'livo-media').trim())
    .map((char) => {
      const code = char.charCodeAt(0)
      if (code <= 31 || '<>:"/\\|?*'.includes(char)) {
        return '-'
      }
      return char
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
  const fallback = cleanTitle || 'livo-media'
  try {
    const parsed = new URL(url)
    const name = parsed.pathname.split('/').filter(Boolean).pop() || ''
    if (name && /\.[a-z0-9]{2,5}$/i.test(name)) {
      return `${fallback}${name.match(/\.[a-z0-9]{2,5}$/i)?.[0] || ''}`
    }
  } catch {
    // Ignore malformed URLs.
  }
  return fallback
}

interface ContextMenuProps {
  x: number
  y: number
  onClose: () => void
  actions: ContextMenuAction[]
}

export function ContextMenu({ x, y, onClose, actions }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  useOverlayHotkeyScope('context-menu', true)

  // Adjust position if menu overflows viewport
  const [pos, setPos] = useState({ x, y })

  useEffect(() => {
    const el = menuRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const newX =
      x + rect.width > window.innerWidth
        ? window.innerWidth - rect.width - 8
        : x
    const newY =
      y + rect.height > window.innerHeight
        ? window.innerHeight - rect.height - 8
        : y
    setPos({ x: Math.max(4, newX), y: Math.max(4, newY) })
  }, [x, y])

  // Close on click outside or Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    // Use setTimeout to avoid immediately closing on the right-click event
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick)
      document.addEventListener('keydown', handleKey)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const visibleActions = actions.filter((a) => !a.hidden)
  const shouldUseNativeMenu =
    typeof window !== 'undefined' && !!window.api?.menu?.showContextMenu

  useEffect(() => {
    if (!shouldUseNativeMenu) return
    let cancelled = false
    const nativeItems: NativeContextMenuItem[] = []
    visibleActions.forEach((action, index) => {
      if (action.separator && index > 0) {
        nativeItems.push({
          id: `${action.id}:separator`,
          separator: true,
        })
      }
      nativeItems.push({
        id: action.id,
        label: action.label,
        disabled: action.disabled,
      })
    })

    void window.api.menu.showContextMenu(nativeItems).then((result) => {
      if (cancelled) return
      const matched = visibleActions.find((action) => action.id === result.id)
      if (matched && !matched.disabled) {
        matched.onClick()
      }
      onClose()
    })

    return () => {
      cancelled = true
    }
  }, [onClose, shouldUseNativeMenu, visibleActions])

  if (shouldUseNativeMenu) return null

  return (
    <div
      ref={menuRef}
      className="animate-in fade-in zoom-in-95 fixed z-[100] min-w-[200px] overflow-hidden rounded-xl border bg-white shadow-xl duration-100 dark:bg-surface-dark"
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="py-1">
        {visibleActions.map((action, i) => (
          <div key={action.id}>
            {action.separator && i > 0 && (
              <div className="my-1 h-px bg-border dark:bg-surface-dark-tertiary" />
            )}
            <button
              onClick={() => {
                action.onClick()
                onClose()
              }}
              disabled={action.disabled}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                action.danger
                  ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                  : 'hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary'
              } ${action.disabled ? 'cursor-not-allowed opacity-40' : ''}`}
            >
              <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
                {action.icon}
              </span>
              <span>{action.label}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Hook to manage context menu state for entry items.
 */
export function useEntryContextMenu() {
  const [menuState, setMenuState] = useState<{
    visible: boolean
    x: number
    y: number
    entryId: string | null
  }>({ visible: false, x: 0, y: 0, entryId: null })

  const showMenu = useCallback((e: React.MouseEvent, entryId: string) => {
    const selectedText = window.getSelection?.()?.toString().trim() || ''
    if (selectedText.length > 0) {
      // Let native context menu handle text actions (copy/search/etc.).
      return
    }
    e.preventDefault()
    e.stopPropagation()
    setMenuState({ visible: true, x: e.clientX, y: e.clientY, entryId })
  }, [])

  const hideMenu = useCallback(() => {
    setMenuState((s) => ({ ...s, visible: false, entryId: null }))
  }, [])

  return { menuState, showMenu, hideMenu }
}

/**
 * Build context menu actions for an entry.
 */
export function useEntryContextActions({
  entry,
  entryIndex,
  totalEntries,
  onMarkRead,
  onToggleStar,
  onMarkAboveRead,
  onMarkBelowRead,
  onCopyLink,
  onCopyTitle,
  onOpenInBrowser,
  feedSiteUrl,
  onShare,
  onSharePoster,
}: {
  entry: Entry
  entryIndex?: number
  totalEntries?: number
  onMarkRead: (entryId: string, isRead: boolean) => void
  onToggleStar: (entryId: string) => void
  onMarkAboveRead?: () => void
  onMarkBelowRead?: () => void
  onCopyLink?: () => void
  onCopyTitle?: () => void
  onOpenInBrowser?: () => void
  feedSiteUrl?: string
  onShare?: () => void
  onSharePoster?: () => void
}): ContextMenuAction[] {
  const { t } = useTranslation()
  const fallbackExternalUrl = /^https?:\/\//i.test((entry.url || '').trim())
    ? (entry.url || '').trim()
    : ''
  const feedSite = /^https?:\/\//i.test((feedSiteUrl || '').trim())
    ? (feedSiteUrl || '').trim()
    : ''
  const summaryText = (entry.summary || '').trim()
  const imageUrl = inferEntryImageUrl(entry)
  const mediaUrl = inferEntryMediaUrl(entry)

  const actions: ContextMenuAction[] = [
    {
      id: 'mark-read',
      label: entry.isRead
        ? t('contextMenu.markUnread')
        : t('contextMenu.markRead'),
      icon: entry.isRead ? <EyeOff size={14} /> : <Eye size={14} />,
      onClick: () => onMarkRead(entry.id, !entry.isRead),
    },
    {
      id: 'mark-above',
      label: t('contextMenu.markAboveRead'),
      icon: <ArrowUp size={14} />,
      onClick: () => onMarkAboveRead?.(),
      disabled: entryIndex === undefined || entryIndex <= 0,
      hidden: entryIndex === undefined,
    },
    {
      id: 'mark-below',
      label: t('contextMenu.markBelowRead'),
      icon: <ArrowDown size={14} />,
      onClick: () => onMarkBelowRead?.(),
      disabled:
        entryIndex === undefined ||
        totalEntries === undefined ||
        entryIndex >= totalEntries - 1,
      hidden: entryIndex === undefined,
    },
    {
      id: 'star',
      label: entry.isStarred ? t('contextMenu.unstar') : t('contextMenu.star'),
      icon: (
        <Star
          size={14}
          className={entry.isStarred ? 'fill-yellow-500 text-yellow-500' : ''}
        />
      ),
      onClick: () => onToggleStar(entry.id),
      separator: true,
    },
    {
      id: 'open-browser',
      label: t('contextMenu.openInBrowser'),
      icon: <ExternalLink size={14} />,
      onClick: () => {
        if (onOpenInBrowser) {
          onOpenInBrowser()
          return
        }
        if (fallbackExternalUrl) {
          void openExternalUrlSafe(fallbackExternalUrl)
        }
      },
      separator: true,
      disabled: !onOpenInBrowser && !fallbackExternalUrl,
    },
    {
      id: 'open-feed-site',
      label: t('contextMenu.openFeedSite', { defaultValue: '打开源站主页' }),
      icon: <ExternalLink size={14} />,
      onClick: () => {
        if (!feedSite) return
        void openExternalUrlSafe(feedSite)
      },
      disabled: !feedSite,
    },
    {
      id: 'copy-link',
      label: t('contextMenu.copyLink'),
      icon: <Copy size={14} />,
      onClick: () => {
        onCopyLink?.()
        if (entry.url) navigator.clipboard.writeText(entry.url)
      },
    },
    {
      id: 'copy-title',
      label: t('contextMenu.copyTitle'),
      icon: <FileText size={14} />,
      onClick: () => {
        onCopyTitle?.()
        if (entry.title) navigator.clipboard.writeText(entry.title)
      },
    },
    {
      id: 'copy-summary',
      label: t('contextMenu.copySummary', { defaultValue: '复制简介' }),
      icon: <FileText size={14} />,
      onClick: () => {
        if (summaryText) navigator.clipboard.writeText(summaryText)
      },
      disabled: !summaryText,
    },
    {
      id: 'copy-media-url',
      label: t('contextMenu.copyMediaUrl', { defaultValue: '复制媒体地址' }),
      icon: <ImageIcon size={14} />,
      onClick: () => {
        if (mediaUrl) navigator.clipboard.writeText(mediaUrl)
      },
      disabled: !mediaUrl,
    },
    {
      id: 'save-image',
      label: t('contextMenu.saveImage', { defaultValue: '保存图片' }),
      icon: <Download size={14} />,
      onClick: () => {
        if (!imageUrl) return
        void window.api.app.downloadUrl({
          url: imageUrl,
          suggestedFileName: inferSuggestedFileName(entry, imageUrl),
          title: t('contextMenu.saveImage', { defaultValue: '保存图片' }),
          filters: [
            {
              name: 'Images',
              extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
            },
          ],
        })
      },
      disabled: !imageUrl,
      separator: true,
    },
    {
      id: 'save-media',
      label: t('contextMenu.saveMedia', { defaultValue: '保存媒体文件' }),
      icon: <Download size={14} />,
      onClick: () => {
        if (!mediaUrl) return
        void window.api.app.downloadUrl({
          url: mediaUrl,
          suggestedFileName: inferSuggestedFileName(entry, mediaUrl),
          title: t('contextMenu.saveMedia', { defaultValue: '保存媒体文件' }),
        })
      },
      disabled: !mediaUrl,
    },
    {
      id: 'share',
      label: t('contextMenu.share'),
      icon: <Share2 size={14} />,
      onClick: () => onShare?.(),
      separator: true,
      hidden: typeof navigator.share !== 'function' && !onShare,
    },
    {
      id: 'share-poster',
      label: t('contextMenu.sharePoster'),
      icon: <ImageIcon size={14} />,
      onClick: () => onSharePoster?.(),
      hidden: !onSharePoster,
    },
  ]

  return actions
}
