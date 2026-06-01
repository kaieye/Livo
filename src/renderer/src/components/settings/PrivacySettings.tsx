import {
  useSettingSection,
  useSettingsActions,
} from '../../store/settings-store'
import { useTranslation } from 'react-i18next'
import { Shield, Globe, Server, ToggleLeft, ToggleRight } from 'lucide-react'

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  const Icon = checked ? ToggleRight : ToggleLeft
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`inline-flex h-6 w-10 items-center rounded-full transition-colors ${
        checked ? 'bg-accent' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

function InfoCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="dark:bg-surface-dark-primary rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0 text-accent">
          <Icon size={22} />
        </div>
        <div className="min-w-0 space-y-2">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h4>
          <div className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

export function PrivacySettings() {
  const general = useSettingSection('general')
  const { updateSettingsSection } = useSettingsActions()
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t('settings.privacyInfo')}
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('settings.privacyInfoDesc')}
        </p>
      </div>

      <div className="space-y-3">
        <InfoCard icon={Shield} title={t('settings.privacyLocalFirst')}>
          <p>{t('settings.privacyLocalFirstDesc')}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>{t('settings.privacyLocalFirstItem1')}</li>
            <li>{t('settings.privacyLocalFirstItem2')}</li>
            <li>{t('settings.privacyLocalFirstItem3')}</li>
          </ul>
        </InfoCard>

        <InfoCard icon={Globe} title={t('settings.privacyNetwork')}>
          <p>{t('settings.privacyNetworkDesc')}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>{t('settings.privacyNetworkItem1')}</li>
            <li>{t('settings.privacyNetworkItem2')}</li>
            <li>{t('settings.privacyNetworkItem3')}</li>
          </ul>
        </InfoCard>

        <InfoCard icon={Server} title={t('settings.privacyProxy')}>
          <p>{t('settings.privacyProxyDesc')}</p>
        </InfoCard>
      </div>

      <div className="dark:bg-surface-dark-primary rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t('settings.imageProxy')}
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('settings.imageProxyDesc')}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {t('settings.imageProxyDetail')}
            </p>
          </div>
          <ToggleSwitch
            checked={general.imageProxy}
            onChange={(v) =>
              void updateSettingsSection('general', { imageProxy: v })
            }
          />
        </div>
      </div>
    </div>
  )
}
