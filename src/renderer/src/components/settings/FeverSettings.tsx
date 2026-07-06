import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Flame,
  Loader2,
  Check,
  AlertCircle,
  Trash2,
  RefreshCw,
  Plus,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import type { FeverAccountView } from '../../../../shared/types'
import {
  useFeverAccountsQuery,
  useFeverSyncStateQuery,
  useFeverCreateAccountMutation,
  useFeverUpdateAccountMutation,
  useFeverDeleteAccountMutation,
  useFeverVerifyMutation,
  useFeverSyncMutation,
} from '../../hooks/useFeverAccounts'

export function FeverSettings() {
  const { t } = useTranslation()
  const accountsQuery = useFeverAccountsQuery()
  const [showAddForm, setShowAddForm] = useState(false)

  const accounts = accountsQuery.data ?? []

  return (
    <div className="space-y-6">
      <p className="text-text-secondary dark:text-text-dark-secondary text-sm">
        {t('settings.feverDesc')}
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowAddForm((current) => !current)}
          className="bg-accent hover:bg-accent-hover flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          <Plus size={16} />
          {t('settings.feverAddAccount')}
        </button>
      </div>

      {showAddForm && (
        <AddFeverAccountForm onClose={() => setShowAddForm(false)} t={t} />
      )}

      {accounts.length === 0 && !showAddForm && (
        <div className="text-text-secondary dark:text-text-dark-secondary py-8 text-center text-sm">
          {t('settings.feverNoAccounts')}
        </div>
      )}

      {accounts.map((account) => (
        <FeverAccountCard key={account.id} account={account} t={t} />
      ))}
    </div>
  )
}

function AddFeverAccountForm({
  onClose,
  t,
}: {
  onClose: () => void
  t: (key: string) => string
}) {
  const [baseUrl, setBaseUrl] = useState('')
  const [username, setUsername] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const verifyMutation = useFeverVerifyMutation()
  const createMutation = useFeverCreateAccountMutation()

  const handleVerify = async () => {
    setFeedback(null)
    setError(null)
    const result = await verifyMutation.mutateAsync({
      baseUrl,
      username,
      apiKey,
    })
    if (result.success) {
      setFeedback(t('settings.feverVerifySuccess'))
    } else {
      setError(result.error || t('settings.feverVerifyFailed'))
    }
  }

  const handleCreate = async () => {
    if (!baseUrl.trim() || !apiKey.trim()) return
    setFeedback(null)
    setError(null)
    try {
      await createMutation.mutateAsync({ baseUrl, username, apiKey })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="dark:bg-surface-dark-secondary space-y-3 rounded-xl border bg-white p-4">
      <div className="space-y-2">
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder={t('settings.feverBaseUrlPlaceholder')}
          className="bg-surface-secondary focus:ring-accent/40 dark:bg-surface-dark-tertiary w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
        />
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t('settings.feverUsername')}
          className="bg-surface-secondary focus:ring-accent/40 dark:bg-surface-dark-tertiary w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
        />
        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={t('settings.feverApiKey')}
          type="password"
          className="bg-surface-secondary focus:ring-accent/40 dark:bg-surface-dark-tertiary w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleVerify}
          disabled={
            verifyMutation.isPending || !baseUrl.trim() || !apiKey.trim()
          }
          className="border-border hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors disabled:opacity-60"
        >
          {verifyMutation.isPending && (
            <Loader2 size={12} className="animate-spin" />
          )}
          {t('settings.feverTestConnection')}
        </button>
        <button
          onClick={handleCreate}
          disabled={
            createMutation.isPending || !baseUrl.trim() || !apiKey.trim()
          }
          className="bg-accent hover:bg-accent-hover rounded-lg px-4 py-2 text-xs font-medium text-white transition-colors disabled:opacity-60"
        >
          {createMutation.isPending && (
            <Loader2 size={12} className="animate-spin" />
          )}
          {t('settings.feverAddAccount')}
        </button>
        <button
          onClick={onClose}
          className="border-border hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary rounded-lg border px-3 py-2 text-xs transition-colors"
        >
          Cancel
        </button>
      </div>

      {feedback && (
        <div className="flex items-center gap-1.5 text-xs text-green-500">
          <Check size={14} />
          {feedback}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-500">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
    </div>
  )
}

function FeverAccountCard({
  account,
  t,
}: {
  account: FeverAccountView
  t: (key: string) => string
}) {
  const updateMutation = useFeverUpdateAccountMutation()
  const deleteMutation = useFeverDeleteAccountMutation()
  const syncMutation = useFeverSyncMutation()
  const syncStateQuery = useFeverSyncStateQuery(account.id)
  const [feedback, setFeedback] = useState<string | null>(null)

  const syncState = syncStateQuery.data

  const handleToggleEnabled = () => {
    updateMutation.mutate({
      id: account.id,
      updates: { enabled: !account.enabled },
    })
  }

  const handleToggleAutoSync = () => {
    updateMutation.mutate({
      id: account.id,
      updates: { autoSync: !account.autoSync },
    })
  }

  const handleSync = async () => {
    setFeedback(t('settings.feverSyncInProgress'))
    const result = await syncMutation.mutateAsync(account.id)
    if (result.success) {
      setFeedback(
        `${t('settings.feverSyncComplete')} — ${result.newEntries} new`,
      )
    } else {
      setFeedback(`${t('settings.feverSyncError')}: ${result.error}`)
    }
    setTimeout(() => setFeedback(null), 4000)
  }

  const handleDelete = () => {
    if (confirm(t('settings.feverConfirmDelete'))) {
      deleteMutation.mutate(account.id)
    }
  }

  const handleIntervalChange = (value: string) => {
    const min = Math.max(0, Math.min(1440, parseInt(value, 10) || 0))
    updateMutation.mutate({
      id: account.id,
      updates: { syncIntervalMin: min },
    })
  }

  const lastSyncText = syncState?.lastSyncAt
    ? new Date(syncState.lastSyncAt).toLocaleString()
    : t('settings.feverNever')

  return (
    <div className="dark:bg-surface-dark-secondary overflow-hidden rounded-xl border bg-white">
      <div className="bg-surface-secondary/50 dark:bg-surface-dark-tertiary/50 flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Flame size={16} className="text-orange-500" />
          <span className="text-sm font-semibold">{account.baseUrl}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              account.enabled
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
            }`}
          >
            {account.enabled
              ? t('settings.feverEnabled')
              : t('settings.feverDisconnected')}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleToggleEnabled}
            className="hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary rounded-lg p-1.5 transition-colors"
            title={t('settings.feverEnabled')}
          >
            {account.enabled ? (
              <ToggleRight size={20} className="text-green-500" />
            ) : (
              <ToggleLeft size={20} className="text-gray-400" />
            )}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="rounded-lg p-1.5 text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950"
            title={t('settings.feverDeleteAccount')}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="space-y-3 px-4 py-3.5">
        <div className="text-text-secondary dark:text-text-dark-secondary text-xs">
          {t('settings.feverUsername')}: {account.username || '—'}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={account.autoSync}
              onChange={handleToggleAutoSync}
              className="accent-accent"
            />
            {t('settings.feverAutoSync')}
          </label>

          {account.autoSync && (
            <div className="flex items-center gap-1.5 text-xs">
              <span>{t('settings.feverSyncInterval')}:</span>
              <input
                type="number"
                value={account.syncIntervalMin}
                onChange={(e) => handleIntervalChange(e.target.value)}
                min={0}
                max={1440}
                className="bg-surface-secondary focus:ring-accent/40 dark:bg-surface-dark-tertiary w-16 rounded border px-2 py-1 text-xs focus:outline-none focus:ring-2"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-text-secondary dark:text-text-dark-secondary text-xs">
            {t('settings.feverLastSync')}: {lastSyncText}
          </span>

          <button
            onClick={handleSync}
            disabled={syncMutation.isPending || !account.enabled}
            className="bg-accent hover:bg-accent-hover flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white transition-colors disabled:opacity-60"
          >
            {syncMutation.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            {t('settings.feverSync')}
          </button>
        </div>

        {syncState?.lastError && (
          <div className="flex items-center gap-1.5 text-xs text-red-500">
            <AlertCircle size={12} />
            {syncState.lastError}
          </div>
        )}

        {feedback && (
          <div
            className={`flex items-center gap-1.5 text-xs ${
              feedback.includes(t('settings.feverSyncError'))
                ? 'text-red-500'
                : 'text-green-500'
            }`}
          >
            {feedback.includes(t('settings.feverSyncError')) ? (
              <AlertCircle size={14} />
            ) : (
              <Check size={14} />
            )}
            {feedback}
          </div>
        )}
      </div>
    </div>
  )
}
