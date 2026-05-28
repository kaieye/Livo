import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Settings as SettingsIcon } from 'lucide-react'

import type { AccountProvider } from '../../../shared/types'
import { ProviderRow } from '../components/account/ProviderRow'
import { PROVIDER_CONFIGS } from '../components/account/provider-config'
import { useProviderLink } from '../components/account/useProviderLink'
import { useSettingsStore } from '../store/settings-store'

// Standalone host for the account-link flow. The main process owns the actual
// WebView orchestration (via window.api.accounts.link); this page just lists
// supported providers and bridges click → IPC → navigate(-1). Post-login
// management (status detail, unlink, Bilibili followings import) stays in
// SettingsDialog → Accounts tab.
export default function AccountLoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { provider: providerParam } = useParams<{ provider?: string }>()
  const setSettingsOpen = useSettingsStore((s) => s.setOpen)
  const setSettingsTab = useSettingsStore((s) => s.setActiveTab)

  const initialProvider = isAccountProvider(providerParam)
    ? providerParam
    : null
  const [activeProvider, setActiveProvider] = useState<AccountProvider | null>(
    initialProvider,
  )

  // URL → state sync (so navigating /login/foo via browser back updates UI).
  useEffect(() => {
    setActiveProvider(isAccountProvider(providerParam) ? providerParam : null)
  }, [providerParam])

  const handleBack = useCallback(() => navigate(-1), [navigate])

  const handleOpenSettings = useCallback(() => {
    setSettingsTab('accounts')
    setSettingsOpen(true)
  }, [setSettingsOpen, setSettingsTab])

  return (
    <div className="bg-background flex h-screen w-full flex-col overflow-hidden dark:bg-surface-dark">
      <header className="flex flex-shrink-0 items-center gap-3 border-b bg-white/80 px-4 py-2 backdrop-blur-sm dark:bg-surface-dark-secondary/80">
        <button
          type="button"
          onClick={handleBack}
          aria-label={t('accountLogin.back')}
          title={t('accountLogin.back')}
          className="dark:hover:text-text-dark rounded-md p-1 text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text dark:text-text-dark-secondary dark:hover:bg-surface-dark-tertiary"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium">
          {t('accountLogin.pageTitle')}
        </h1>
        <button
          type="button"
          onClick={handleOpenSettings}
          className="dark:hover:text-text-dark inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text dark:text-text-dark-secondary dark:hover:bg-surface-dark-tertiary"
          title={t('accountLogin.manageInSettings')}
        >
          <SettingsIcon size={14} aria-hidden="true" />
          {t('accountLogin.manageInSettings')}
        </button>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 py-6">
        <p className="text-sm text-text-secondary dark:text-text-dark-secondary">
          {t('accountLogin.intro')}
        </p>

        <h2 className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wide text-text-secondary dark:text-text-dark-secondary">
          {t('accountLogin.providersHeading')}
        </h2>

        <div className="space-y-3">
          {PROVIDER_CONFIGS.map((config) => (
            <ProviderRowContainer
              key={config.provider}
              config={config}
              isActive={activeProvider === config.provider}
              onActivate={() => {
                setActiveProvider(config.provider)
                navigate(`/login/${config.provider}`, { replace: true })
              }}
              onSuccess={() => navigate(-1)}
            />
          ))}
        </div>

        <p className="mt-8 text-xs text-text-secondary dark:text-text-dark-secondary">
          {t('accountLogin.manageInSettingsHint')}
        </p>
      </main>
    </div>
  )
}

interface ProviderRowContainerProps {
  config: (typeof PROVIDER_CONFIGS)[number]
  isActive: boolean
  onActivate: () => void
  onSuccess: () => void
}

// Each row owns its own link-flow state via `useProviderLink`. We don't lift
// it to the page because providers run independently and we want isolated
// status per row.
function ProviderRowContainer({
  config,
  isActive,
  onActivate,
  onSuccess,
}: ProviderRowContainerProps) {
  const { status, errorDetail, link } = useProviderLink(config.provider)
  // Track the post-success nav timer so we can cancel it if the row unmounts
  // before the 400ms badge dwell — otherwise navigate(-1) would fire after
  // unmount and leave the user on the wrong route.
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => {
      if (navTimerRef.current) clearTimeout(navTimerRef.current)
    }
  }, [])

  const handleClick = useCallback(async () => {
    onActivate()
    const result = await link()
    if (result.success) {
      navTimerRef.current = setTimeout(() => onSuccess(), 400)
    }
  }, [link, onActivate, onSuccess])

  return (
    <ProviderRow
      config={config}
      status={isActive ? status : 'idle'}
      errorDetail={isActive ? errorDetail : null}
      onClick={handleClick}
    />
  )
}

function isAccountProvider(
  value: string | undefined,
): value is AccountProvider {
  return (
    value === 'youtube' ||
    value === 'x' ||
    value === 'instagram' ||
    value === 'bilibili'
  )
}
