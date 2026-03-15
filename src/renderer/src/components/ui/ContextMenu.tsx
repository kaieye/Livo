/**
 * Context Menu — Right-click context menu for entry items.
 * Rich context menu with mark read/unread, star, copy, share, and integrations.
 */
import { useState, useEffect, useCallback, useRef } from "react"
import { useTranslation } from "react-i18next"
import {
  Eye,
  EyeOff,
  Star,
  ExternalLink,
  Copy,
  ArrowUp,
  ArrowDown,
  Share2,
  Image as ImageIcon,
  FileText,
  BookmarkPlus,
  Bookmark,
  X,
} from "lucide-react"
import type { Entry } from "../../../../shared/types"

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

interface ContextMenuProps {
  x: number
  y: number
  onClose: () => void
  actions: ContextMenuAction[]
}

export function ContextMenu({ x, y, onClose, actions }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Adjust position if menu overflows viewport
  const [pos, setPos] = useState({ x, y })

  useEffect(() => {
    const el = menuRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const newX = x + rect.width > window.innerWidth ? window.innerWidth - rect.width - 8 : x
    const newY = y + rect.height > window.innerHeight ? window.innerHeight - rect.height - 8 : y
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
      if (e.key === "Escape") onClose()
    }
    // Use setTimeout to avoid immediately closing on the right-click event
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick)
      document.addEventListener("keydown", handleKey)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleKey)
    }
  }, [onClose])

  const visibleActions = actions.filter((a) => !a.hidden)

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[200px] rounded-xl border bg-white dark:bg-surface-dark shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="py-1">
        {visibleActions.map((action, i) => (
          <div key={action.id}>
            {action.separator && i > 0 && (
              <div className="h-px bg-border dark:bg-surface-dark-tertiary my-1" />
            )}
            <button
              onClick={() => {
                action.onClick()
                onClose()
              }}
              disabled={action.disabled}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                action.danger
                  ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  : "hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
              } ${action.disabled ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
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
    const selectedText = window.getSelection?.()?.toString().trim() || ""
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
  onShare?: () => void
  onSharePoster?: () => void
}): ContextMenuAction[] {
  const { t } = useTranslation()
  const fallbackExternalUrl = /^https?:\/\//i.test((entry.url || "").trim()) ? (entry.url || "").trim() : ""

  const actions: ContextMenuAction[] = [
    {
      id: "mark-read",
      label: entry.isRead ? t("contextMenu.markUnread") : t("contextMenu.markRead"),
      icon: entry.isRead ? <EyeOff size={14} /> : <Eye size={14} />,
      onClick: () => onMarkRead(entry.id, !entry.isRead),
    },
    {
      id: "mark-above",
      label: t("contextMenu.markAboveRead"),
      icon: <ArrowUp size={14} />,
      onClick: () => onMarkAboveRead?.(),
      disabled: entryIndex === undefined || entryIndex <= 0,
      hidden: entryIndex === undefined,
    },
    {
      id: "mark-below",
      label: t("contextMenu.markBelowRead"),
      icon: <ArrowDown size={14} />,
      onClick: () => onMarkBelowRead?.(),
      disabled: entryIndex === undefined || totalEntries === undefined || entryIndex >= totalEntries - 1,
      hidden: entryIndex === undefined,
    },
    {
      id: "star",
      label: entry.isStarred ? t("contextMenu.unstar") : t("contextMenu.star"),
      icon: <Star size={14} className={entry.isStarred ? "fill-yellow-500 text-yellow-500" : ""} />,
      onClick: () => onToggleStar(entry.id),
      separator: true,
    },
    {
      id: "open-browser",
      label: t("contextMenu.openInBrowser"),
      icon: <ExternalLink size={14} />,
      onClick: () => {
        if (onOpenInBrowser) {
          onOpenInBrowser()
          return
        }
        if (fallbackExternalUrl) {
          if (window.api?.app?.openExternal) {
            void window.api.app.openExternal(fallbackExternalUrl)
          } else {
            window.open(fallbackExternalUrl, "_blank")
          }
        }
      },
      separator: true,
      disabled: !onOpenInBrowser && !fallbackExternalUrl,
    },
    {
      id: "copy-link",
      label: t("contextMenu.copyLink"),
      icon: <Copy size={14} />,
      onClick: () => {
        onCopyLink?.()
        if (entry.url) navigator.clipboard.writeText(entry.url)
      },
    },
    {
      id: "copy-title",
      label: t("contextMenu.copyTitle"),
      icon: <FileText size={14} />,
      onClick: () => {
        onCopyTitle?.()
        if (entry.title) navigator.clipboard.writeText(entry.title)
      },
    },
    {
      id: "share",
      label: t("contextMenu.share"),
      icon: <Share2 size={14} />,
      onClick: () => onShare?.(),
      separator: true,
      hidden: typeof navigator.share !== "function" && !onShare,
    },
    {
      id: "share-poster",
      label: t("contextMenu.sharePoster"),
      icon: <ImageIcon size={14} />,
      onClick: () => onSharePoster?.(),
      hidden: !onSharePoster,
    },
  ]

  return actions
}
