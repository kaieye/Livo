import {
  useSettingSection,
  useSettingsActions,
} from '../../store/settings-store'
import { useTranslation } from 'react-i18next'
import { changeLanguage } from '../../i18n'
import { Check, GripVertical, Eye, EyeOff, RotateCcw } from 'lucide-react'
import { useState, useCallback, useRef } from 'react'
import {
  FeedViewType,
  VIEW_DEFINITIONS,
  DEFAULT_SETTINGS,
} from '../../../../shared/types'
import { isRedactedSecretValue } from '../../../../shared/settings-secrets'
import { VIEW_TYPE_I18N_KEYS } from '../../lib/view-type-keys'
export function GeneralSettings() {
  const general = useSettingSection('general')
  const { updateSettingsSection } = useSettingsActions()
  const { t } = useTranslation()
  const [languageChanged, setLanguageChanged] = useState(false)

  const languageOptions = [
    { value: 'zh-CN', label: '简体中文' },
    { value: 'en', label: 'English' },
    { value: 'ja', label: '日本語' },
    { value: 'zh-TW', label: '繁體中文' },
    { value: 'ko', label: '한국어' },
  ]

  const handleLanguageChange = async (newLanguage: string) => {
    await updateSettingsSection('general', { language: newLanguage })
    try {
      await changeLanguage(newLanguage)
      setLanguageChanged(true)
      setTimeout(() => setLanguageChanged(false), 2000)
    } catch (error) {
      console.error('Failed to change language:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Language */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {t('settings.language')}
        </label>
        <select
          value={general.language}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="bg-surface-secondary focus:ring-accent/50 dark:bg-surface-dark-tertiary w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
        >
          {languageOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {languageChanged && (
          <div className="mt-1.5 flex items-center gap-1 text-xs text-green-500">
            <Check size={14} />
            {t('settings.languageChanged')}
          </div>
        )}
      </div>

      {/* Network proxy */}
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {t('settings.proxy')}
          </label>
          <p className="text-text-secondary dark:text-text-dark-secondary text-xs">
            {t('settings.proxyDesc')}
          </p>
        </div>
        <div className="flex gap-2">
          {(
            [
              { key: 'system', label: t('settings.proxyMode_system') },
              { key: 'custom', label: t('settings.proxyMode_custom') },
            ] as const
          ).map((option) => (
            <button
              key={option.key}
              onClick={() => {
                void updateSettingsSection('general', { proxyMode: option.key })
              }}
              className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                general.proxyMode === option.key
                  ? 'border-accent bg-accent/5 text-accent font-medium'
                  : 'hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {general.proxyMode === 'custom' && (
          <div className="space-y-1.5">
            <input
              type="text"
              value={
                isRedactedSecretValue(general.proxyUrl) ? '' : general.proxyUrl
              }
              onChange={(e) =>
                void updateSettingsSection('general', {
                  proxyUrl: e.target.value,
                })
              }
              placeholder={
                isRedactedSecretValue(general.proxyUrl)
                  ? '代理地址已配置，输入新值可替换'
                  : t('settings.proxyPlaceholder')
              }
              className="bg-surface-secondary focus:ring-accent/50 dark:bg-surface-dark-tertiary w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
            />
            <p className="text-text-tertiary text-xs">
              {t('settings.proxyHint')}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">
            {t('settings.minimizeToTray')}
          </label>
          <p className="text-text-secondary dark:text-text-dark-secondary mt-0.5 text-xs">
            {t('settings.minimizeToTrayDesc')}
          </p>
        </div>
        <ToggleSwitch
          checked={general.minimizeToTray}
          onChange={(v) =>
            void updateSettingsSection('general', { minimizeToTray: v })
          }
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">
            {t('settings.startInTray')}
          </label>
          <p className="text-text-secondary dark:text-text-dark-secondary mt-0.5 text-xs">
            {t('settings.startInTrayDesc')}
          </p>
        </div>
        <ToggleSwitch
          checked={general.startInTray}
          onChange={(v) =>
            void updateSettingsSection('general', { startInTray: v })
          }
        />
      </div>

      {/* Refresh interval */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {t('settings.refreshInterval')}
        </label>
        <select
          value={general.refreshInterval}
          onChange={(e) =>
            void updateSettingsSection('general', {
              refreshInterval: Number(e.target.value),
            })
          }
          className="bg-surface-secondary focus:ring-accent/50 dark:bg-surface-dark-tertiary w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
        >
          <option value={0}>{t('settings.refresh_manual')}</option>
          <option value={15}>{t('settings.refresh_15min')}</option>
          <option value={30}>{t('settings.refresh_30min')}</option>
          <option value={60}>{t('settings.refresh_1hour')}</option>
          <option value={120}>{t('settings.refresh_2hours')}</option>
          <option value={360}>{t('settings.refresh_6hours')}</option>
        </select>
      </div>

      {/* Mark read on scroll */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">
            {t('settings.markReadOnScroll')}
          </label>
          <p className="text-text-secondary dark:text-text-dark-secondary mt-0.5 text-xs">
            {t('settings.markReadOnScrollDesc')}
          </p>
        </div>
        <ToggleSwitch
          checked={general.markReadOnScroll}
          onChange={(v) =>
            void updateSettingsSection('general', { markReadOnScroll: v })
          }
        />
      </div>

      {/* Dim read entries */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">{t('settings.dimRead')}</label>
          <p className="text-text-secondary dark:text-text-dark-secondary mt-0.5 text-xs">
            {t('settings.dimReadDesc')}
          </p>
        </div>
        <ToggleSwitch
          checked={general.dimRead}
          onChange={(v) =>
            void updateSettingsSection('general', { dimRead: v })
          }
        />
      </div>

      {/* Group by date */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">
            {t('settings.groupByDate')}
          </label>
          <p className="text-text-secondary dark:text-text-dark-secondary mt-0.5 text-xs">
            {t('settings.groupByDateDesc')}
          </p>
        </div>
        <ToggleSwitch
          checked={general.groupByDate}
          onChange={(v) =>
            void updateSettingsSection('general', { groupByDate: v })
          }
        />
      </div>

      {/* Render mark as read */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">
            {t('settings.renderMarkAsRead')}
          </label>
          <p className="text-text-secondary dark:text-text-dark-secondary mt-0.5 text-xs">
            {t('settings.renderMarkAsReadDesc')}
          </p>
        </div>
        <ToggleSwitch
          checked={general.renderMarkAsRead}
          onChange={(v) =>
            void updateSettingsSection('general', { renderMarkAsRead: v })
          }
        />
      </div>

      {/* Video pagination */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">
            {t('settings.videoPagination')}
          </label>
          <p className="text-text-secondary dark:text-text-dark-secondary mt-0.5 text-xs">
            {t('settings.videoPaginationDesc')}
          </p>
        </div>
        <ToggleSwitch
          checked={general.videoPagination}
          onChange={(v) =>
            void updateSettingsSection('general', { videoPagination: v })
          }
        />
      </div>

      {/* Bilibili playback mode */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">
            {t('settings.bilibiliOpenInPage')}
          </label>
          <p className="text-text-secondary dark:text-text-dark-secondary mt-0.5 text-xs">
            {t('settings.bilibiliOpenInPageDesc')}
          </p>
        </div>
        <ToggleSwitch
          checked={general.bilibiliOpenInPage}
          onChange={(v) =>
            void updateSettingsSection('general', { bilibiliOpenInPage: v })
          }
        />
      </div>

      {/* Image proxy */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">
            {t('settings.imageProxy')}
          </label>
          <p className="text-text-secondary dark:text-text-dark-secondary mt-0.5 text-xs">
            {t('settings.imageProxyDesc')}
          </p>
        </div>
        <ToggleSwitch
          checked={general.imageProxy}
          onChange={(v) =>
            void updateSettingsSection('general', { imageProxy: v })
          }
        />
      </div>

      {/* Show Recommended Feeds */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">
            {t('settings.showRecommended')}
          </label>
          <p className="text-text-secondary dark:text-text-dark-secondary mt-0.5 text-xs">
            {t('settings.showRecommendedDesc')}
          </p>
        </div>
        <ToggleSwitch
          checked={general.showRecommended}
          onChange={(v) =>
            void updateSettingsSection('general', { showRecommended: v })
          }
        />
      </div>

      {/* Feed refresh error indicator */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">
            {t('settings.showFeedRefreshErrorBadge')}
          </label>
          <p className="text-text-secondary dark:text-text-dark-secondary mt-0.5 text-xs">
            {t('settings.showFeedRefreshErrorBadgeDesc')}
          </p>
        </div>
        <ToggleSwitch
          checked={general.showFeedRefreshErrorBadge}
          onChange={(v) =>
            void updateSettingsSection('general', {
              showFeedRefreshErrorBadge: v,
            })
          }
        />
      </div>

      {/* View Tabs Configuration */}
      <ViewTabsConfig />

      {/* Render inline style */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">
            {t('settings.renderInlineStyle')}
          </label>
          <p className="text-text-secondary dark:text-text-dark-secondary mt-0.5 text-xs">
            {t('settings.renderInlineStyleDesc')}
          </p>
        </div>
        <ToggleSwitch
          checked={general.renderInlineStyle}
          onChange={(v) =>
            void updateSettingsSection('general', { renderInlineStyle: v })
          }
        />
      </div>

      {/* Thumbnail ratio */}
      <div>
        <label className="mb-2 block text-sm font-medium">
          {t('settings.thumbnailRatio')}
        </label>
        <div className="flex gap-2">
          {[
            {
              key: 'square' as const,
              label: t('settings.thumbnailRatio_square'),
            },
            {
              key: 'original' as const,
              label: t('settings.thumbnailRatio_original'),
            },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() =>
                void updateSettingsSection('general', {
                  thumbnailRatio: opt.key,
                })
              }
              className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                general.thumbnailRatio === opt.key
                  ? 'border-accent bg-accent/5 text-accent font-medium'
                  : 'hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* RSSHub Instance URL */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {t('settings.rsshubInstance')}
        </label>
        <p className="text-text-secondary dark:text-text-dark-secondary mb-2 text-xs">
          {t('settings.rsshubInstanceDesc')}
        </p>
        <input
          type="url"
          value={general.rsshubInstance || 'https://rsshub.pseudoyu.com'}
          onChange={(e) =>
            void updateSettingsSection('general', {
              rsshubInstance: e.target.value.trim(),
            })
          }
          placeholder="https://rsshub.pseudoyu.com"
          className="bg-surface-secondary focus:ring-accent/50 dark:bg-surface-dark-tertiary w-full rounded-lg border px-3 py-2.5 font-mono text-sm focus:outline-none focus:ring-2"
        />
        <div className="text-text-tertiary mt-1.5 text-xs">
          {t('settings.rsshubInstanceHint')}
        </div>
        <div className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
          {t('settings.rsshubInstanceInstagramTip')}
        </div>
      </div>
    </div>
  )
}

/** View Tabs Configuration — toggle visibility and drag to reorder */
function ViewTabsConfig() {
  const general = useSettingSection('general')
  const { updateSettingsSection } = useSettingsActions()
  const { t } = useTranslation()

  // Ensure viewTabs exist and append newly introduced views for old configs.
  const viewTabs = (() => {
    const fallback = DEFAULT_SETTINGS.general.viewTabs
    const source = Array.isArray(general.viewTabs) ? general.viewTabs : fallback
    const next = source
      .filter(
        (tab) =>
          typeof tab?.id === 'number' && typeof tab?.visible === 'boolean',
      )
      .filter((tab) => !!VIEW_DEFINITIONS[tab.id])
      .map((tab) => ({ ...tab }))
    const ids = new Set(next.map((tab) => tab.id))
    for (const tab of fallback) {
      if (!ids.has(tab.id)) next.push({ ...tab })
    }
    return next.length > 0 ? next : fallback
  })()

  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const dragRef = useRef<number | null>(null)
  const [dragOverlay, setDragOverlay] = useState<{
    label: string
    x: number
    y: number
  } | null>(null)

  const toggleVisible = useCallback(
    (idx: number) => {
      const next = [...viewTabs]
      // Must keep at least one visible
      const visibleCount = next.filter((t) => t.visible).length
      if (next[idx].visible && visibleCount <= 1) return
      next[idx] = { ...next[idx], visible: !next[idx].visible }
      void updateSettingsSection('general', { viewTabs: next })
    },
    [updateSettingsSection, viewTabs],
  )

  const handlePointerDragStart = useCallback(
    (idx: number, label: string, e: React.PointerEvent) => {
      e.preventDefault()
      setDragIdx(idx)
      dragRef.current = idx
      setDragOverlay({ label, x: e.clientX, y: e.clientY })
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

      const onMove = (ev: PointerEvent) => {
        setDragOverlay((prev) =>
          prev ? { ...prev, x: ev.clientX, y: ev.clientY } : null,
        )
        // Hit-test for reorder targets
        const overlayEl = document.getElementById('viewtab-drag-overlay')
        if (overlayEl) overlayEl.style.pointerEvents = 'none'
        const el = document.elementFromPoint(ev.clientX, ev.clientY)
        if (overlayEl) overlayEl.style.pointerEvents = ''
        if (el) {
          const rowEl = (el as HTMLElement).closest('[data-viewtab-idx]')
          if (rowEl) {
            const targetIdx = parseInt(
              rowEl.getAttribute('data-viewtab-idx')!,
              10,
            )
            setOverIdx(targetIdx)
          }
        }
      }

      const onUp = () => {
        const from = dragRef.current
        setOverIdx((currentOverIdx) => {
          if (
            from !== null &&
            currentOverIdx !== null &&
            from !== currentOverIdx
          ) {
            const next = [...viewTabs]
            const [moved] = next.splice(from, 1)
            next.splice(currentOverIdx, 0, moved)
            void updateSettingsSection('general', { viewTabs: next })
          }
          return null
        })
        setDragIdx(null)
        setDragOverlay(null)
        dragRef.current = null
        document.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerup', onUp)
      }

      document.addEventListener('pointermove', onMove)
      document.addEventListener('pointerup', onUp)
    },
    [updateSettingsSection, viewTabs],
  )

  const handleReset = useCallback(() => {
    void updateSettingsSection('general', {
      viewTabs: DEFAULT_SETTINGS.general.viewTabs,
    })
  }, [updateSettingsSection])

  const VIEW_COLOR_MAP: Record<number, string> = {
    [FeedViewType.Articles]: 'text-lime-600',
    [FeedViewType.SocialMedia]: 'text-sky-500',
    [FeedViewType.Videos]: 'text-red-500',
    [FeedViewType.Pictures]: 'text-pink-500',
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">
            {t('settings.viewTabs')}
          </label>
          <p className="text-text-secondary dark:text-text-dark-secondary mt-0.5 text-xs">
            {t('settings.viewTabsDesc')}
          </p>
        </div>
        <button
          onClick={handleReset}
          className="text-text-secondary hover:bg-surface-secondary hover:text-accent dark:hover:bg-surface-dark-tertiary flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors"
          title={t('settings.viewTabsReset')}
        >
          <RotateCcw size={12} />
          {t('settings.viewTabsReset')}
        </button>
      </div>
      <div className="relative overflow-hidden rounded-lg border">
        {viewTabs.map((tab, idx) => {
          const def = VIEW_DEFINITIONS[tab.id]
          if (!def) return null
          const colorClass = VIEW_COLOR_MAP[tab.id] || 'text-text-secondary'
          return (
            <div
              key={tab.id}
              data-viewtab-idx={idx}
              className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                idx > 0 ? 'border-t' : ''
              } ${dragIdx === idx ? 'opacity-40' : ''} ${
                overIdx === idx && dragIdx !== idx
                  ? 'bg-accent/10 ring-accent/30 ring-1 ring-inset'
                  : 'hover:bg-surface-secondary dark:bg-surface-dark-secondary dark:hover:bg-surface-dark-tertiary bg-white'
              }`}
            >
              {/* Drag handle */}
              <GripVertical
                size={14}
                className="dark:text-text-dark-tertiary text-text-tertiary flex-shrink-0 cursor-grab touch-none active:cursor-grabbing"
                onPointerDown={(e) =>
                  handlePointerDragStart(
                    idx,
                    t(VIEW_TYPE_I18N_KEYS[tab.id] || def.name),
                    e,
                  )
                }
              />
              {/* Icon + name */}
              <span
                className={`flex-shrink-0 ${tab.visible ? colorClass : 'text-text-tertiary'}`}
              >
                {def.icon === 'FileText' && <FileTextIcon size={16} />}
                {def.icon === 'MessageCircle' && (
                  <MessageCircleIcon size={16} />
                )}
                {def.icon === 'Play' && <PlayIcon size={16} />}
                {def.icon === 'Image' && <ImageIcon size={16} />}
              </span>
              <span
                className={`flex-1 text-sm ${tab.visible ? '' : 'text-text-tertiary line-through'}`}
              >
                {t(VIEW_TYPE_I18N_KEYS[tab.id] || def.name)}
              </span>
              {/* Visibility toggle */}
              <button
                onClick={() => toggleVisible(idx)}
                className={`rounded-md p-1 transition-colors ${
                  tab.visible
                    ? 'text-accent hover:bg-accent/10'
                    : 'text-text-tertiary hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary'
                }`}
                title={tab.visible ? '隐藏' : '显示'}
              >
                {tab.visible ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
            </div>
          )
        })}
        {/* Pointer-based drag overlay */}
        {dragOverlay && (
          <div
            id="viewtab-drag-overlay"
            style={{
              position: 'fixed',
              left: dragOverlay.x + 12,
              top: dragOverlay.y - 14,
              zIndex: 9999,
              pointerEvents: 'none',
            }}
            className="bg-accent/90 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium text-white shadow-lg"
          >
            {dragOverlay.label}
          </div>
        )}
      </div>
    </div>
  )
}

// Simple icon components for view tab settings (avoid importing full lucide set again)
function FileTextIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  )
}
function MessageCircleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  )
}
function PlayIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  )
}
function ImageIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  )
}

/** Reusable Toggle Switch component */
function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors ${
        checked ? 'bg-accent' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </button>
  )
}
