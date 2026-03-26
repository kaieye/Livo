import { useMemo } from 'react'
import { useSettingsStore } from '../../store/settings-store'
import { useUpdateStore } from '../../store/update-store'

export function UpdatePrompt() {
  const info = useUpdateStore((state) => state.info)
  const dismissedVersion = useUpdateStore((state) => state.dismissedVersion)
  const dismissVersion = useUpdateStore((state) => state.dismissVersion)

  const latestVersion = info?.latestVersion || ''
  const isVisible = useMemo(() => {
    return !!(
      info &&
      info.hasUpdate &&
      latestVersion &&
      latestVersion !== dismissedVersion
    )
  }, [dismissedVersion, info, latestVersion])

  if (!isVisible || !info) return null

  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[70] w-[min(92vw,560px)] -translate-x-1/2">
      <div className="pointer-events-auto flex items-center justify-between gap-4 rounded-2xl border border-accent/20 bg-white/95 px-4 py-3 shadow-2xl backdrop-blur dark:bg-surface-dark-secondary/95">
        <div className="min-w-0">
          <div className="text-sm font-medium text-text-primary dark:text-text-dark-primary">
            检测到新版本 {latestVersion}
          </div>
          <div className="mt-0.5 text-xs text-text-secondary dark:text-text-dark-secondary">
            当前版本 {info.currentVersion}，可以查看发行说明并手动更新。
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => dismissVersion(latestVersion)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-secondary dark:border-surface-dark-tertiary dark:hover:bg-surface-dark-tertiary"
          >
            稍后
          </button>
          <button
            onClick={() => {
              const settingsStore = useSettingsStore.getState()
              settingsStore.setActiveTab('about')
              settingsStore.setOpen(true)
            }}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm text-white hover:opacity-90"
          >
            查看更新
          </button>
        </div>
      </div>
    </div>
  )
}
