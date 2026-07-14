import { useMemo } from 'react'
import { useUpdateStore } from '../../store/update-store'

export function UpdatePrompt() {
  const info = useUpdateStore((state) => state.info)
  const dismissedVersion = useUpdateStore((state) => state.dismissedVersion)
  const dismissVersion = useUpdateStore((state) => state.dismissVersion)
  const installUpdate = useUpdateStore((state) => state.installUpdate)
  const isInstallingUpdate = useUpdateStore((state) => state.isInstallingUpdate)
  const installError = useUpdateStore((state) => state.installError)
  const updateStatus = useUpdateStore((state) => state.updateStatus)
  const downloadProgress = useUpdateStore((state) => state.downloadProgress)

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
      <div className="border-accent/20 dark:bg-surface-dark-secondary/95 pointer-events-auto flex items-center justify-between gap-4 rounded-2xl border bg-white/95 px-4 py-3 shadow-2xl backdrop-blur">
        <div className="min-w-0">
          <div className="text-text-primary dark:text-text-dark-primary text-sm font-medium">
            检测到新版本 {latestVersion}
          </div>
          <div className="text-text-secondary dark:text-text-dark-secondary mt-0.5 text-xs">
            {updateStatus === 'downloading'
              ? `正在下载更新 ${Math.round(downloadProgress ?? 0)}%…`
              : updateStatus === 'installing'
                ? '更新已下载，正在重启并完成安装…'
                : `当前版本 ${info.currentVersion}，点击即可下载并在原安装位置完成更新。`}
          </div>
          {updateStatus === 'downloading' && (
            <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary mt-2 h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-accent h-full rounded-full transition-[width]"
                style={{ width: `${downloadProgress ?? 0}%` }}
              />
            </div>
          )}
          {installError && (
            <div className="mt-1 text-xs text-red-500">{installError}</div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => dismissVersion(latestVersion)}
            disabled={isInstallingUpdate}
            className="border-border hover:bg-surface-secondary dark:border-surface-dark-tertiary dark:hover:bg-surface-dark-tertiary rounded-lg border px-3 py-1.5 text-sm"
          >
            稍后
          </button>
          <button
            onClick={() => void installUpdate()}
            disabled={isInstallingUpdate}
            className="bg-accent rounded-lg px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-60"
          >
            {updateStatus === 'downloading'
              ? `下载中 ${Math.round(downloadProgress ?? 0)}%`
              : updateStatus === 'installing'
                ? '正在重启…'
                : isInstallingUpdate
                  ? '正在更新…'
                  : '立即更新'}
          </button>
        </div>
      </div>
    </div>
  )
}
