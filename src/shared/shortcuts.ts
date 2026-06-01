/**
 * Keyboard shortcuts system.
 * Centralized shortcut definitions with categories, configurable keys,
 * and command dispatching.
 */

export interface ShortcutDefinition {
  id: string
  label: string
  keys: string
  category: ShortcutCategory
  description?: string
}

export type ShortcutCategory =
  | 'global'
  | 'navigation'
  | 'entry'
  | 'reading'
  | 'subscription'

export const SHORTCUT_CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  global: '全局',
  navigation: '导航',
  entry: '文章操作',
  reading: '阅读',
  subscription: '订阅管理',
}

export const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  {
    id: 'quick-search',
    label: '快速搜索',
    keys: 'Ctrl+K',
    category: 'global',
    description: '打开全局搜索面板',
  },
  {
    id: 'quick-add',
    label: '快速添加',
    keys: 'Ctrl+N',
    category: 'global',
    description: '添加新订阅',
  },
  {
    id: 'show-shortcuts',
    label: '快捷键列表',
    keys: 'Shift+?',
    category: 'global',
    description: '显示快捷键帮助',
  },
  {
    id: 'toggle-sidebar',
    label: '切换侧边栏',
    keys: 'Ctrl+B',
    category: 'global',
    description: '显示/隐藏侧边栏',
  },
  {
    id: 'open-settings',
    label: '打开设置',
    keys: 'Ctrl+,',
    category: 'global',
    description: '打开设置面板',
  },
  {
    id: 'toggle-theme',
    label: '切换主题',
    keys: 'Ctrl+Shift+T',
    category: 'global',
    description: '亮色/暗色模式切换',
  },
  {
    id: 'next-entry',
    label: '下一篇',
    keys: 'J',
    category: 'navigation',
    description: '选择下一篇文章',
  },
  {
    id: 'prev-entry',
    label: '上一篇',
    keys: 'K',
    category: 'navigation',
    description: '选择上一篇文章',
  },
  {
    id: 'next-feed',
    label: '下一个订阅源',
    keys: 'Alt+J',
    category: 'navigation',
    description: '切换到下一个订阅源',
  },
  {
    id: 'prev-feed',
    label: '上一个订阅源',
    keys: 'Alt+K',
    category: 'navigation',
    description: '切换到上一个订阅源',
  },
  {
    id: 'go-all',
    label: '查看全部',
    keys: 'G A',
    category: 'navigation',
    description: '切换到全部文章视图',
  },
  {
    id: 'go-starred',
    label: '查看收藏',
    keys: 'G S',
    category: 'navigation',
    description: '切换到收藏视图',
  },
  {
    id: 'focus-sidebar',
    label: '聚焦侧边栏',
    keys: 'Alt+1',
    category: 'navigation',
    description: '将焦点移动到订阅侧边栏',
  },
  {
    id: 'focus-content',
    label: '聚焦内容区',
    keys: 'Alt+2',
    category: 'navigation',
    description: '将焦点移动到主内容区',
  },
  {
    id: 'toggle-star',
    label: '收藏/取消收藏',
    keys: 'S',
    category: 'entry',
    description: '切换当前文章的收藏状态',
  },
  {
    id: 'open-browser',
    label: '在浏览器中打开',
    keys: 'O',
    category: 'entry',
    description: '在外部浏览器中打开文章',
  },
  {
    id: 'copy-link',
    label: '复制链接',
    keys: 'Ctrl+Shift+C',
    category: 'entry',
    description: '复制文章链接到剪贴板',
  },
  {
    id: 'toggle-read',
    label: '标记已读/未读',
    keys: 'M',
    category: 'entry',
    description: '切换当前文章已读状态',
  },
  {
    id: 'mark-all-read',
    label: '全部标为已读',
    keys: 'Shift+A',
    category: 'entry',
    description: '将当前列表全部标为已读',
  },
  {
    id: 'ai-summarize',
    label: 'AI 摘要',
    keys: 'Alt+S',
    category: 'reading',
    description: '生成当前文章的 AI 摘要',
  },
  {
    id: 'ai-translate',
    label: '翻译',
    keys: 'Alt+T',
    category: 'reading',
    description: '翻译当前文章',
  },
  {
    id: 'ai-chat',
    label: 'AI 对话',
    keys: 'Alt+C',
    category: 'reading',
    description: '打开 AI 对话面板',
  },
  {
    id: 'toggle-readability',
    label: 'Readability',
    keys: 'Alt+R',
    category: 'reading',
    description: '切换 Readability 模式',
  },
  {
    id: 'scroll-top',
    label: '回到顶部',
    keys: 'Home',
    category: 'reading',
    description: '滚动到文章顶部',
  },
  {
    id: 'scroll-down-reading',
    label: '向下滚动',
    keys: 'PageDown',
    category: 'reading',
    description: '平滑向下滚动当前内容',
  },
  {
    id: 'scroll-up-reading',
    label: '向上滚动',
    keys: 'PageUp',
    category: 'reading',
    description: '平滑向上滚动当前内容',
  },
  {
    id: 'refresh-all',
    label: '刷新全部',
    keys: 'Ctrl+R',
    category: 'subscription',
    description: '刷新所有订阅源',
  },
  {
    id: 'toggle-discover',
    label: '打开发现',
    keys: 'Ctrl+D',
    category: 'subscription',
    description: '切换发现面板',
  },
  {
    id: 'import-opml',
    label: '导入 OPML',
    keys: 'Ctrl+I',
    category: 'subscription',
    description: '导入 OPML 文件',
  },
  {
    id: 'export-opml',
    label: '导出 OPML',
    keys: 'Ctrl+E',
    category: 'subscription',
    description: '导出 OPML 文件',
  },
]

export function parseKeyCombo(keys: string): {
  ctrl: boolean
  shift: boolean
  alt: boolean
  meta: boolean
  key: string
  isSequence: boolean
} {
  if (keys.includes(' ')) {
    return {
      ctrl: false,
      shift: false,
      alt: false,
      meta: false,
      key: keys,
      isSequence: true,
    }
  }

  const parts = keys.split('+')
  const ctrl = parts.includes('Ctrl') || parts.includes('Cmd')
  const shift = parts.includes('Shift')
  const alt = parts.includes('Alt')
  const meta = parts.includes('Meta') || parts.includes('Cmd')
  const key = parts[parts.length - 1]

  return { ctrl, shift, alt, meta, key, isSequence: false }
}

export function matchesShortcut(
  e: KeyboardEvent,
  shortcut: ShortcutDefinition,
): boolean {
  const combo = parseKeyCombo(shortcut.keys)

  if (combo.isSequence) return false

  const matchCtrl = combo.ctrl === (e.ctrlKey || e.metaKey)
  const matchShift = combo.shift === e.shiftKey
  const matchAlt = combo.alt === e.altKey

  let matchKey = false
  if (combo.key === '?') {
    matchKey = e.key === '?'
  } else if (combo.key === ',') {
    matchKey = e.key === ','
  } else {
    matchKey =
      e.key.toLowerCase() === combo.key.toLowerCase() ||
      e.code === `Key${combo.key.toUpperCase()}`
  }

  return matchCtrl && matchShift && matchAlt && matchKey
}
