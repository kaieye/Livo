import { AlertTriangle, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export interface ExternalLinkWarningState {
  url: string
  hostname: string
  isSuspicious: boolean
}

export function ExternalLinkWarningModal({
  warning,
  onClose,
  onContinue,
}: {
  warning: ExternalLinkWarningState
  onClose: () => void
  onContinue: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40">
      <div className="animate-in dark:bg-surface-dark-secondary mx-4 w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">
        <div className="mb-3 flex items-center gap-2 text-amber-500">
          <AlertTriangle size={20} />
          <h3 className="font-semibold">{t('entry.externalLinkWarning')}</h3>
          <button
            onClick={onClose}
            className="hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary ml-auto rounded p-1"
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-text-secondary dark:text-text-dark-secondary mb-1 text-sm">
          {t('entry.externalLinkDesc')}
        </p>
        <p className="bg-surface-secondary dark:bg-surface-dark-tertiary mb-3 break-all rounded px-2 py-1.5 font-mono text-xs text-red-500">
          {warning.hostname}
        </p>
        {warning.isSuspicious && (
          <p className="mb-3 flex items-center gap-1 text-xs text-red-500">
            <AlertTriangle size={12} />
            {t('entry.suspiciousLink')}
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary flex-1 rounded-lg border px-3 py-2 text-sm"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onContinue}
            className="bg-accent hover:bg-accent/90 flex-1 rounded-lg px-3 py-2 text-sm text-white"
          >
            {t('common.continueAccess')}
          </button>
        </div>
      </div>
    </div>
  )
}
