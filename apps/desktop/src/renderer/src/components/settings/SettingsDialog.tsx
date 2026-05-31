import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { SettingsTabId } from '../../../../shared/types'
import { useSettingsStore } from '../../store/settings-store'
import { useTranslation } from 'react-i18next'
import {
  X,
  Settings,
  Bot,
  Languages,
  Info,
  Zap,
  Rss,
  Database,
  Link2,
  Palette,
  Shield,
  ShieldCheck,
  Clock,
  Star,
} from 'lucide-react'
import { useOverlayHotkeyScope } from '../../hooks/useHotkeyScope'
import { LocalErrorBoundary } from '../LocalErrorBoundary'
import { useOverlayStackItem } from '../../store/overlay-stack-store'

const settingsTabImporters = {
  general: () => import('./GeneralSettings'),
  appearance: () => import('./AppearanceSettings'),
  reading: () => import('./ReadingSettings'),
  subscriptions: () => import('./FeedsSettings'),
  ai: () => import('./AISettings'),
  translation: () => import('./TranslationSettings'),
  actions: () => import('./ActionsSettings'),
  accounts: () => import('./AccountsSettings'),
  data: () => import('./DataSettings'),
  privacy: () => import('./PrivacySettings'),
  about: () => import('./AboutSettings'),
  refreshLogs: () => import('./RefreshLogSettings'),
  agentPermissions: () => import('./AgentPermissionsSettings'),
  favorites: () => import('./FavoritesPanel'),
} satisfies Record<SettingsTabId, () => Promise<unknown>>

const settingsTabComponents = {
  general: lazy(() =>
    settingsTabImporters
      .general()
      .then((module) => ({ default: module.GeneralSettings })),
  ),
  appearance: lazy(() =>
    settingsTabImporters
      .appearance()
      .then((module) => ({ default: module.AppearanceSettings })),
  ),
  reading: lazy(() =>
    settingsTabImporters
      .reading()
      .then((module) => ({ default: module.ReadingSettings })),
  ),
  subscriptions: lazy(() =>
    settingsTabImporters
      .subscriptions()
      .then((module) => ({ default: module.FeedsSettings })),
  ),
  ai: lazy(() =>
    settingsTabImporters
      .ai()
      .then((module) => ({ default: module.AISettings })),
  ),
  translation: lazy(() =>
    settingsTabImporters
      .translation()
      .then((module) => ({ default: module.TranslationSettings })),
  ),
  actions: lazy(() =>
    settingsTabImporters
      .actions()
      .then((module) => ({ default: module.ActionsSettings })),
  ),
  accounts: lazy(() =>
    settingsTabImporters
      .accounts()
      .then((module) => ({ default: module.AccountsSettings })),
  ),
  data: lazy(() =>
    settingsTabImporters
      .data()
      .then((module) => ({ default: module.DataSettings })),
  ),
  privacy: lazy(() =>
    settingsTabImporters
      .privacy()
      .then((module) => ({ default: module.PrivacySettings })),
  ),
  about: lazy(() =>
    settingsTabImporters
      .about()
      .then((module) => ({ default: module.AboutSettings })),
  ),
  refreshLogs: lazy(() =>
    settingsTabImporters
      .refreshLogs()
      .then((module) => ({ default: module.RefreshLogSettings })),
  ),
  agentPermissions: lazy(() =>
    settingsTabImporters
      .agentPermissions()
      .then((module) => ({ default: module.AgentPermissionsSettings })),
  ),
  favorites: lazy(() =>
    settingsTabImporters
      .favorites()
      .then((module) => ({ default: module.FavoritesPanel })),
  ),
} satisfies Record<SettingsTabId, React.ComponentType>

function preloadSettingsTab(tabId: SettingsTabId) {
  void settingsTabImporters[tabId]()
}

export function SettingsDialog() {
  const { isOpen, setOpen, activeTab, setActiveTab } = useSettingsStore()
  useOverlayHotkeyScope('settings', isOpen)
  const { zIndex, isTop } = useOverlayStackItem('settings', isOpen)
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<{
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  const [position, setPosition] = useState({ x: 120, y: 80 })
  const ActiveTabPanel = settingsTabComponents[activeTab]

  const tabs = [
    { id: 'general' as const, label: t('settings.general'), icon: Settings },
    {
      id: 'appearance' as const,
      label: t('settings.appearance'),
      icon: Palette,
    },
    {
      id: 'subscriptions' as const,
      label: t('settings.subscriptions'),
      icon: Rss,
    },
    { id: 'ai' as const, label: t('settings.ai'), icon: Bot },
    {
      id: 'agentPermissions' as const,
      label: t('settings.agentPermissions'),
      icon: ShieldCheck,
    },
    {
      id: 'translation' as const,
      label: t('settings.translation'),
      icon: Languages,
    },
    { id: 'actions' as const, label: t('settings.actions'), icon: Zap },
    { id: 'accounts' as const, label: t('settings.accounts'), icon: Link2 },
    { id: 'data' as const, label: t('settings.data'), icon: Database },
    { id: 'privacy' as const, label: t('settings.privacy'), icon: Shield },
    { id: 'about' as const, label: t('settings.about'), icon: Info },
    {
      id: 'refreshLogs' as const,
      label: t('settings.refreshLogs'),
      icon: Clock,
    },
    {
      id: 'favorites' as const,
      label: t('settings.favoritesTitle'),
      icon: Star,
    },
  ]

  useEffect(() => {
    preloadSettingsTab(activeTab)
  }, [activeTab])

  useEffect(() => {
    const width = Math.min(900, Math.floor(window.innerWidth * 0.95))
    const height = Math.min(620, Math.floor(window.innerHeight * 0.9))
    setPosition({
      x: Math.max(8, Math.round((window.innerWidth - width) / 2)),
      y: Math.max(8, Math.round((window.innerHeight - height) / 2)),
    })
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const onMouseMove = (e: MouseEvent) => {
      const drag = dragStateRef.current
      if (!drag) return
      const rect = dialogRef.current?.getBoundingClientRect()
      const width =
        rect?.width ?? Math.min(900, Math.floor(window.innerWidth * 0.95))
      const height =
        rect?.height ?? Math.min(620, Math.floor(window.innerHeight * 0.9))
      const nextX = drag.originX + (e.clientX - drag.startX)
      const nextY = drag.originY + (e.clientY - drag.startY)
      setPosition({
        x: Math.min(
          Math.max(8, nextX),
          Math.max(8, window.innerWidth - width - 8),
        ),
        y: Math.min(
          Math.max(8, nextY),
          Math.max(8, window.innerHeight - height - 8),
        ),
      })
    }
    const onMouseUp = () => {
      dragStateRef.current = null
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !isTop) return
      event.preventDefault()
      setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, isTop, setOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50" style={{ zIndex }}>
      <div
        ref={dialogRef}
        className="absolute flex resize overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-surface-dark-secondary"
        style={{
          width: 900,
          height: 620,
          minWidth: 680,
          minHeight: 480,
          maxWidth: '95vw',
          maxHeight: '90vh',
          left: position.x,
          top: position.y,
        }}
      >
        {/* Left sidebar */}
        <div className="w-[200px] flex-shrink-0 space-y-1 border-r bg-sidebar p-4 dark:bg-sidebar-dark">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">{t('settings.title')}</h2>
          </div>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              onMouseEnter={() => preloadSettingsTab(tab.id)}
              onFocus={() => preloadSettingsTab(tab.id)}
              className={`sidebar-item w-full ${activeTab === tab.id ? 'sidebar-item-active' : ''}`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right content */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            className="flex cursor-move select-none items-center justify-between border-b px-6 py-4"
            onMouseDown={(e) => {
              if (e.button !== 0) return
              dragStateRef.current = {
                startX: e.clientX,
                startY: e.clientY,
                originX: position.x,
                originY: position.y,
              }
            }}
          >
            <h3 className="font-medium">
              {tabs.find((t) => t.id === activeTab)?.label}
            </h3>
            <button
              onClick={() => setOpen(false)}
              onMouseDown={(e) => e.stopPropagation()}
              className="rounded-lg p-1 hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <LocalErrorBoundary
              title="设置页面加载失败"
              description="这个设置分组刚刚出错了，你可以重试当前标签页，或者切换到其他设置继续使用。"
              resetKey={activeTab}
            >
              <Suspense fallback={<SettingsTabFallback />}>
                <ActiveTabPanel />
              </Suspense>
            </LocalErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  )
}

function SettingsTabFallback() {
  return (
    <div className="flex min-h-[240px] items-center justify-center text-sm text-text-secondary dark:text-text-dark-secondary">
      Loading settings...
    </div>
  )
}
