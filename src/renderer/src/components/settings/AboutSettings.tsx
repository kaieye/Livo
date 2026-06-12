import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Github } from 'lucide-react'
import { openExternalUrlSafe } from '../../services/external-url'
import { useUpdateStore } from '../../store/update-store'

function formatPublishedAt(value: string | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

const ICON_CACHE_KEY = 'livo-about-icon'

/**
 * 模块级缓存（会话内）+ localStorage 持久化（跨会话），
 * 配合 SettingsDialog 的 hover 预加载机制，确保首帧渲染前 icon 已就绪，消除跳变。
 */
let cachedIconUrl: string | null | undefined = undefined
let iconFetchPromise: Promise<string | null> | null = null

function readCachedIcon(): string | null {
  if (cachedIconUrl !== undefined) return cachedIconUrl
  try {
    const stored = localStorage.getItem(ICON_CACHE_KEY)
    if (stored) {
      cachedIconUrl = stored
      return stored
    }
  } catch {
    /* localStorage unavailable (e.g. SSR / test) */
  }
  return null
}

function ensureIconFetched(): Promise<string | null> {
  if (cachedIconUrl !== undefined) return Promise.resolve(cachedIconUrl)
  if (iconFetchPromise) return iconFetchPromise

  iconFetchPromise = window.api.app
    .getIcon()
    .then((icon) => {
      cachedIconUrl = icon
      if (icon) {
        try {
          localStorage.setItem(ICON_CACHE_KEY, icon)
        } catch {
          /* ignore */
        }
      }
      return icon
    })
    .catch(() => {
      cachedIconUrl = null
      return null
    })

  return iconFetchPromise
}

// 模块加载时立即启动预取，利用 SettingsDialog 中 preloadSettingsTab 的 hover 预加载时间窗口
if (typeof window !== 'undefined' && window.api) {
  ensureIconFetched()
}

export function AboutSettings() {
  const [version, setVersion] = useState('')
  const [iconUrl, setIconUrl] = useState<string | null>(readCachedIcon)
  const updateInfo = useUpdateStore((state) => state.info)
  const checkingUpdates = useUpdateStore((state) => state.isChecking)
  const isInstallingUpdate = useUpdateStore((state) => state.isInstallingUpdate)
  const installError = useUpdateStore((state) => state.installError)
  const lastCheckedAt = useUpdateStore((state) => state.lastCheckedAt)
  const checkForUpdates = useUpdateStore((state) => state.checkForUpdates)
  const installUpdate = useUpdateStore((state) => state.installUpdate)
  const { t } = useTranslation()

  useEffect(() => {
    window.api.app
      .getVersion()
      .then((nextVersion) => {
        setVersion(nextVersion)
        useUpdateStore.getState().setCurrentVersion(nextVersion)
      })
      .catch(() => setVersion('1.0.0'))

    ensureIconFetched().then((icon) => {
      setIconUrl(icon)
    })
  }, [])

  const handleCheckUpdates = useCallback(async () => {
    await checkForUpdates(true)
  }, [checkForUpdates])

  useEffect(() => {
    void handleCheckUpdates()
  }, [handleCheckUpdates])

  return (
    <div className="space-y-6">
      {/* Logo and name */}
      <div className="py-4 text-center">
        {iconUrl ? (
          <img
            src={iconUrl}
            alt="Livo"
            className="mx-auto mb-4 h-20 w-20 rounded-3xl"
          />
        ) : (
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-orange-500/10 to-orange-600/10">
            <svg
              className="text-accent h-12 w-12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 11a9 9 0 0 1 9 9" />
              <path d="M4 4a16 16 0 0 1 16 16" />
              <circle cx="5" cy="19" r="1" fill="currentColor" />
            </svg>
          </div>
        )}
        <h2 className="text-xl font-bold">Livo</h2>
        <p className="text-text-secondary dark:text-text-dark-secondary mt-1 text-sm">
          {t('settings.version')} {version || '1.0.0'}
        </p>
      </div>

      <div className="bg-surface-secondary dark:bg-surface-dark-tertiary space-y-3 rounded-xl border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{t('settings.checkUpdates')}</p>
            <p className="text-text-secondary dark:text-text-dark-secondary text-xs">
              {t('settings.currentVersionLabel')}: {version || '1.0.0'}
            </p>
            {lastCheckedAt ? (
              <p className="text-text-tertiary text-xs">
                最近检查：{new Date(lastCheckedAt).toLocaleString()}
              </p>
            ) : null}
          </div>
          <button
            onClick={() => void handleCheckUpdates()}
            disabled={checkingUpdates}
            className="rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-white/70 disabled:opacity-60 dark:hover:bg-black/10"
          >
            {checkingUpdates
              ? t('settings.checkingUpdates')
              : t('settings.checkUpdates')}
          </button>
        </div>

        {updateInfo && (
          <div className="space-y-2 text-sm">
            <p
              className={
                updateInfo.error
                  ? 'text-red-500'
                  : updateInfo.hasUpdate
                    ? 'text-accent'
                    : 'text-text-secondary dark:text-text-dark-secondary'
              }
            >
              {updateInfo.error
                ? `${t('settings.updateCheckFailed')}: ${updateInfo.error}`
                : updateInfo.hasUpdate
                  ? t('settings.updateAvailable')
                  : t('settings.updateUnavailable')}
            </p>
            {!updateInfo.error && (
              <div className="text-text-secondary dark:text-text-dark-secondary space-y-1 text-xs">
                <p>
                  {t('settings.currentVersionLabel')}:{' '}
                  {updateInfo.currentVersion}
                </p>
                {updateInfo.latestVersion && (
                  <p>
                    {t('settings.latestVersionLabel')}:{' '}
                    {updateInfo.latestVersion}
                  </p>
                )}
                {updateInfo.publishedAt && (
                  <p>
                    {t('settings.updatePublishedAt')}:{' '}
                    {formatPublishedAt(updateInfo.publishedAt)}
                  </p>
                )}
              </div>
            )}
            {updateInfo.hasUpdate && (
              <div className="flex flex-wrap gap-2">
                {updateInfo.installerDownloadUrl && (
                  <button
                    onClick={() => void installUpdate()}
                    disabled={isInstallingUpdate}
                    className="bg-accent rounded-lg px-3 py-2 text-sm text-white transition-colors hover:opacity-90 disabled:opacity-60"
                  >
                    {isInstallingUpdate
                      ? t('settings.installingUpdate')
                      : t('settings.installUpdate')}
                  </button>
                )}
                {updateInfo.releaseUrl && (
                  <button
                    onClick={() =>
                      void openExternalUrlSafe(updateInfo.releaseUrl!)
                    }
                    className="rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-white/70 dark:hover:bg-black/10"
                  >
                    {t('settings.openReleasePage')}
                  </button>
                )}
              </div>
            )}
            {installError && (
              <p className="text-xs text-red-500">
                {t('settings.updateInstallFailed')}: {installError}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Description */}
      <div className="text-text-secondary dark:text-text-dark-secondary space-y-2 text-center text-sm">
        <p>{t('settings.aboutDesc')}</p>
        <p>
          <strong>{t('settings.aiFeaturesOpen')}</strong>
        </p>
        <p>{t('settings.aboutAIDesc')}</p>
      </div>

      {/* Features */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        {[
          {
            label: t('settings.feature_rss'),
            desc: t('settings.feature_rssDesc'),
          },
          {
            label: t('settings.feature_aiSummary'),
            desc: t('settings.feature_aiSummaryDesc'),
          },
          {
            label: t('settings.feature_aiChat'),
            desc: t('settings.feature_aiChatDesc'),
          },
          {
            label: t('settings.feature_multiModel'),
            desc: t('settings.feature_multiModelDesc'),
          },
        ].map((feature) => (
          <div
            key={feature.label}
            className="bg-surface-secondary dark:bg-surface-dark-tertiary rounded-lg p-3"
          >
            <p className="font-medium">{feature.label}</p>
            <p className="text-text-tertiary mt-0.5 text-xs">{feature.desc}</p>
          </div>
        ))}
      </div>

      {/* Links */}
      <div className="flex justify-center gap-4 pt-2">
        <a
          href="https://github.com/kaieye/Livo"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-secondary hover:text-accent flex items-center gap-1.5 text-sm transition-colors"
        >
          <Github size={16} />
          GitHub
        </a>
      </div>
    </div>
  )
}
