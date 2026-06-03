import { useEffect, useMemo, useRef, useState } from 'react'
import { Command, Search, Sparkles, X } from 'lucide-react'
import { DEFAULT_SHORTCUTS } from '../../../../shared/shortcuts'
import { useSettingsStore } from '../../store/settings-store'
import { useQuickSearchStore } from '../search/QuickSearch'
import { useShortcutHelpStore } from '../shortcuts/shortcut-help-store'
import { useDiscoverStore } from '../../store/discover-store'
import { useFeedStore } from '../../store/feed-store'
import { useAIChatStore } from '../../store/ai-chat-store'
import { useUpdateStore } from '../../store/update-store'
import { useOverlayHotkeyScope } from '../../hooks/useHotkeyScope'
import {
  useOverlayStackItem,
  useOverlayStackStore,
} from '../../store/overlay-stack-store'
import { runLayoutCommand } from '../../lib/layout-commands'

import { create } from 'zustand'

type CommandAction = {
  id: string
  title: string
  section: string
  keywords: string[]
  shortcutId?: string
  run: () => void
  isAiFallback?: boolean
}

interface CommandPaletteState {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

export const useCommandPaletteStore = create<CommandPaletteState>(
  (set, get) => ({
    isOpen: false,
    open: () => {
      useOverlayStackStore.getState().open('command-palette')
      set({ isOpen: true })
    },
    close: () => {
      useOverlayStackStore.getState().close('command-palette')
      set({ isOpen: false })
    },
    toggle: () => {
      const next = !get().isOpen
      if (next) {
        useOverlayStackStore.getState().open('command-palette')
      } else {
        useOverlayStackStore.getState().close('command-palette')
      }
      set({ isOpen: next })
    },
  }),
)

export function CommandPalette() {
  const { isOpen, close } = useCommandPaletteStore()
  const { zIndex, isTop } = useOverlayStackItem('command-palette', isOpen)
  useOverlayHotkeyScope('command-palette', isOpen)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const actions = useMemo<CommandAction[]>(
    () => [
      {
        id: 'open-settings',
        title: '打开设置',
        section: '界面',
        keywords: ['settings', 'preferences'],
        shortcutId: 'open-settings',
        run: () => useSettingsStore.getState().setOpen(true),
      },
      {
        id: 'open-data-settings',
        title: '打开数据设置',
        section: '界面',
        keywords: ['data', 'cache', 'diagnostics'],
        run: () => {
          const store = useSettingsStore.getState()
          store.setActiveTab('data')
          store.setOpen(true)
        },
      },
      {
        id: 'open-search',
        title: '打开快速搜索',
        section: '搜索',
        keywords: ['search', 'find'],
        shortcutId: 'quick-search',
        run: () => useQuickSearchStore.getState().open(),
      },
      {
        id: 'open-discover',
        title: '打开发现',
        section: '订阅',
        keywords: ['discover', 'feeds'],
        shortcutId: 'toggle-discover',
        run: () => useDiscoverStore.getState().setOpen(true),
      },
      {
        id: 'refresh-all',
        title: '刷新全部订阅',
        section: '订阅',
        keywords: ['refresh', 'sync'],
        shortcutId: 'refresh-all',
        run: () => {
          void useFeedStore.getState().refreshAll()
        },
      },
      {
        id: 'check-updates',
        title: '检查更新',
        section: '系统',
        keywords: ['update', 'release', 'version'],
        run: () => {
          const store = useSettingsStore.getState()
          store.setActiveTab('about')
          store.setOpen(true)
          void useUpdateStore.getState().checkForUpdates(true)
        },
      },
      {
        id: 'open-ai-chat',
        title: '打开 AI 助手',
        section: '界面',
        keywords: ['ai', 'chat'],
        run: () => useAIChatStore.getState().setPanelOpen(true),
      },
      {
        id: 'show-shortcuts',
        title: '显示快捷键帮助',
        section: '界面',
        keywords: ['shortcut', 'help', 'keyboard'],
        shortcutId: 'show-shortcuts',
        run: () => useShortcutHelpStore.getState().open(),
      },
      {
        id: 'focus-sidebar',
        title: '聚焦侧边栏',
        section: '导航',
        keywords: ['sidebar', 'focus'],
        shortcutId: 'focus-sidebar',
        run: () => runLayoutCommand('focus-sidebar'),
      },
      {
        id: 'focus-content',
        title: '聚焦内容区',
        section: '导航',
        keywords: ['content', 'focus'],
        shortcutId: 'focus-content',
        run: () => runLayoutCommand('focus-content'),
      },
      {
        id: 'open-data-directory',
        title: '打开数据目录',
        section: '系统',
        keywords: ['data directory', 'folder', 'storage'],
        run: () => {
          void window.api.app.openDataDirectory()
        },
      },
      {
        id: 'open-cache-directory',
        title: '打开缓存目录',
        section: '系统',
        keywords: ['cache directory', 'folder'],
        run: () => {
          void window.api.app.openCacheDirectory()
        },
      },
      {
        id: 'open-logs-directory',
        title: '打开日志目录',
        section: '系统',
        keywords: ['logs directory', 'folder'],
        run: () => {
          void window.api.app.openLogsDirectory()
        },
      },
    ],
    [],
  )

  const shortcutLabelMap = useMemo(
    () =>
      new Map(
        DEFAULT_SHORTCUTS.map((shortcut) => [shortcut.id, shortcut.keys]),
      ),
    [],
  )

  const normalizedQuery = query.trim().toLowerCase()
  const filteredActions = useMemo(() => {
    if (!normalizedQuery) return actions
    return actions.filter((action) => {
      const haystack = [action.title, ...action.keywords]
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [actions, normalizedQuery])

  // AI fallback action: when the query doesn't match any known command,
  // offer to send it to the AI agent as a natural-language instruction.
  const aiFallback: CommandAction | null = useMemo(() => {
    const trimmed = query.trim()
    if (!trimmed || filteredActions.length > 0) return null
    return {
      id: 'ai-agent-fallback',
      title: `AI 执行: "${trimmed}"`,
      section: 'AI 助手',
      keywords: ['ai', 'agent', '执行'],
      isAiFallback: true,
      run: () => {
        const chatStore = useAIChatStore.getState()
        if (!chatStore.isPanelOpen) {
          chatStore.setPanelOpen(true)
        }
        // Send the message after a short delay so the panel has time to mount
        setTimeout(() => {
          void useAIChatStore.getState().sendMessage(trimmed)
        }, 150)
      },
    }
  }, [query, filteredActions.length])

  const groupedActions = useMemo(() => {
    const groups = new Map<string, CommandAction[]>()
    const source = aiFallback
      ? [aiFallback, ...filteredActions]
      : filteredActions
    for (const action of source) {
      const existing = groups.get(action.section)
      if (existing) {
        existing.push(action)
      } else {
        groups.set(action.section, [action])
      }
    }
    return Array.from(groups.entries())
  }, [filteredActions, aiFallback])

  const sourceActions = useMemo(
    () => (aiFallback ? [aiFallback, ...filteredActions] : filteredActions),
    [aiFallback, filteredActions],
  )

  useEffect(() => {
    if (!isOpen) return
    setQuery('')
    setSelectedIndex(0)
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30)
    return () => window.clearTimeout(timer)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!isTop) return
        event.preventDefault()
        close()
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedIndex((index) =>
          Math.min(index + 1, Math.max(sourceActions.length - 1, 0)),
        )
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedIndex((index) => Math.max(index - 1, 0))
      }
      if (event.key === 'Enter') {
        const target = sourceActions[selectedIndex]
        if (!target) return
        event.preventDefault()
        target.run()
        close()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [close, sourceActions, isOpen, isTop, selectedIndex])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 flex items-start justify-center bg-black/35 pt-[12vh]"
      style={{ zIndex }}
      onClick={close}
    >
      <div
        className="dark:bg-surface-dark-secondary w-[560px] max-w-[92vw] overflow-hidden rounded-2xl border bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Command size={18} className="text-accent" />
          <Search size={16} className="text-text-tertiary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setSelectedIndex(0)
            }}
            placeholder="搜索动作..."
            className="placeholder:text-text-tertiary flex-1 bg-transparent text-sm outline-none"
          />
          <button
            onClick={close}
            className="hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary rounded-lg p-1"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[52vh] overflow-y-auto py-2">
          {groupedActions.length === 0 ? (
            <div className="text-text-tertiary px-4 py-8 text-center text-sm">
              没有匹配的命令
            </div>
          ) : (
            groupedActions.map(([section, sectionActions]) => (
              <div key={section} className="pb-2">
                <div className="text-text-tertiary px-4 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[0.08em]">
                  {section}
                </div>
                {sectionActions.map((action) => {
                  const index = sourceActions.findIndex(
                    (item) => item.id === action.id,
                  )
                  const shortcutLabel = action.shortcutId
                    ? shortcutLabelMap.get(action.shortcutId)
                    : null
                  return (
                    <button
                      key={action.id}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => {
                        action.run()
                        close()
                      }}
                      className={`flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left text-sm transition-colors ${
                        selectedIndex === index
                          ? 'bg-accent/10 text-accent'
                          : action.isAiFallback
                            ? 'bg-accent/5 hover:bg-accent/10'
                            : 'hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {action.isAiFallback && (
                          <Sparkles
                            size={14}
                            className="text-accent shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <div className="truncate">{action.title}</div>
                          <div className="text-text-tertiary truncate text-xs">
                            {action.keywords[0]}
                          </div>
                        </div>
                      </div>
                      {shortcutLabel ? (
                        <span className="border-border text-text-tertiary dark:border-surface-dark-tertiary shrink-0 rounded-md border px-2 py-0.5 text-[11px]">
                          {shortcutLabel}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        <div className="text-text-tertiary border-t px-4 py-2 text-xs">
          使用上下方向键选择，回车执行，Esc 关闭
        </div>
      </div>
    </div>
  )
}
