import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Rss, Github, Heart } from 'lucide-react'
import { useUpdateStore } from '../../store/update-store'

function formatPublishedAt(value: string | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export function AboutSettings() {
  const [version, setVersion] = useState('')
  const updateInfo = useUpdateStore((state) => state.info)
  const checkingUpdates = useUpdateStore((state) => state.isChecking)
  const lastCheckedAt = useUpdateStore((state) => state.lastCheckedAt)
  const checkForUpdates = useUpdateStore((state) => state.checkForUpdates)
  const { t } = useTranslation()

  useEffect(() => {
    window.api.app
      .getVersion()
      .then((nextVersion) => {
        setVersion(nextVersion)
        useUpdateStore.getState().setCurrentVersion(nextVersion)
      })
      .catch(() => setVersion('1.0.0'))
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
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-accent/10">
          <Rss size={36} className="text-accent" />
        </div>
        <h2 className="text-xl font-bold">Livo</h2>
        <p className="mt-1 text-sm text-text-secondary dark:text-text-dark-secondary">
          {t('settings.version')} {version || '1.0.0'}
        </p>
      </div>

      <div className="space-y-3 rounded-xl border bg-surface-secondary p-4 dark:bg-surface-dark-tertiary">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{t('settings.checkUpdates')}</p>
            <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
              {t('settings.currentVersionLabel')}: {version || '1.0.0'}
            </p>
            {lastCheckedAt ? (
              <p className="text-xs text-text-tertiary">
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
              <div className="space-y-1 text-xs text-text-secondary dark:text-text-dark-secondary">
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
            {updateInfo.hasUpdate && updateInfo.releaseUrl && (
              <button
                onClick={() =>
                  void window.api.app.openExternal(updateInfo.releaseUrl!)
                }
                className="rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-white/70 dark:hover:bg-black/10"
              >
                {t('settings.openReleasePage')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2 text-center text-sm text-text-secondary dark:text-text-dark-secondary">
        <p>{t('settings.aboutDesc')}</p>
        <p>
          <strong>{t('settings.noLoginNeeded')}</strong> ·{' '}
          <strong>{t('settings.noSubscriptionNeeded')}</strong> ·{' '}
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
            label: t('settings.feature_localStorage'),
            desc: t('settings.feature_localStorageDesc'),
          },
          {
            label: t('settings.feature_multiModel'),
            desc: t('settings.feature_multiModelDesc'),
          },
          {
            label: t('settings.feature_darkMode'),
            desc: t('settings.feature_darkModeDesc'),
          },
        ].map((feature) => (
          <div
            key={feature.label}
            className="rounded-lg bg-surface-secondary p-3 dark:bg-surface-dark-tertiary"
          >
            <p className="font-medium">{feature.label}</p>
            <p className="mt-0.5 text-xs text-text-tertiary">{feature.desc}</p>
          </div>
        ))}
      </div>

      {/* Links */}
      <div className="flex justify-center gap-4 pt-2">
        <a
          href="https://github.com/kaieye/Livo"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-accent"
        >
          <Github size={16} />
          GitHub
        </a>
        <span className="flex items-center gap-1.5 text-sm text-text-secondary">
          <Heart size={16} className="text-red-400" />
          {t('settings.openSourceFree')}
        </span>
      </div>
    </div>
  )
}
