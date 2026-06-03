import { useTranslation } from 'react-i18next'
import { AlertCircle, Check, ChevronRight, Loader2 } from 'lucide-react'
import { useAccountStatusQuery } from '../../hooks/useAccountStatusQuery'
import type { ProviderConfig } from './provider-config'
import type { ProviderLinkStatus } from './useProviderLink'

interface ProviderRowProps {
  config: ProviderConfig
  status: ProviderLinkStatus
  errorDetail?: string | null
  onClick: () => void
}

// Single-row visual for a provider in a list (AccountLoginPage). Status badges
// + feedback labels are i18n-driven so the row is locale-safe — no string
// sniffing for success/error.
export function ProviderRow({
  config,
  status,
  errorDetail,
  onClick,
}: ProviderRowProps) {
  const { t } = useTranslation()
  const statusQuery = useAccountStatusQuery(config.provider)
  const accountStatus = statusQuery.data ?? { linked: false, displayName: null }
  const isStatusLoading = statusQuery.isLoading && !statusQuery.data
  const isLinked = accountStatus.linked && !!accountStatus.displayName
  const loading = status === 'loading'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="hover:bg-surface-secondary dark:bg-surface-dark-secondary dark:hover:bg-surface-dark-tertiary flex w-full items-start gap-3 rounded-xl border bg-white p-4 text-left transition-colors disabled:opacity-60"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${config.colorClass}`}>
            {config.name}
          </span>
          {isStatusLoading ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <Loader2 size={10} className="animate-spin" aria-hidden="true" />
            </span>
          ) : (
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                isLinked
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              {isLinked
                ? t('accountLogin.connected')
                : t('accountLogin.signIn')}
            </span>
          )}
        </div>
        <p className="text-text-secondary dark:text-text-dark-secondary mt-1 text-xs">
          {config.description}
        </p>
        {isLinked && accountStatus.displayName && (
          <p className="text-text-secondary dark:text-text-dark-secondary mt-1 text-xs">
            {t('accountLogin.signedInAs', { name: accountStatus.displayName })}
          </p>
        )}
        {status === 'success' && (
          <div className="mt-2 flex items-center gap-1 text-xs text-green-500">
            <Check size={12} aria-hidden="true" />
            <span>{t('accountLogin.linkSuccess')}</span>
          </div>
        )}
        {status === 'error' && (
          <div className="mt-2 flex items-center gap-1 text-xs text-red-500">
            <AlertCircle size={12} aria-hidden="true" />
            <span>{t('accountLogin.linkFailed')}</span>
          </div>
        )}
        {errorDetail && (
          <p className="mt-1 text-xs text-red-500">{errorDetail}</p>
        )}
      </div>
      <div className="text-text-secondary dark:text-text-dark-secondary flex flex-shrink-0 items-center gap-1 self-center text-xs">
        {loading ? (
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        ) : (
          <ChevronRight size={16} aria-hidden="true" />
        )}
      </div>
    </button>
  )
}
