import { useTranslation } from 'react-i18next'
import {
  ShieldCheck,
  FileText,
  ChevronRight,
  Settings as SettingsIcon,
  Link2,
  Trash2,
} from 'lucide-react'
import type { AgentPermissionSettings } from '../../../../shared/types'
import {
  useSettingSection,
  useSettingsActions,
} from '../../store/settings-store'

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`inline-flex h-6 w-10 flex-shrink-0 items-center rounded-full transition-colors ${
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

interface PermissionRowConfig {
  key: keyof AgentPermissionSettings
  icon: React.ComponentType<{ size?: number; className?: string }>
  title: string
  subtitle: string
}

export function AgentPermissionsSettings() {
  const { t } = useTranslation()
  const permissions = useSettingSection('agentPermissions')
  const { updateSettingsSection } = useSettingsActions()

  const rows: PermissionRowConfig[] = [
    {
      key: 'allowRead',
      icon: FileText,
      title: t('settings.agentPermAllowRead'),
      subtitle: t('settings.agentPermAllowReadDesc'),
    },
    {
      key: 'allowNavigate',
      icon: ChevronRight,
      title: t('settings.agentPermAllowNavigate'),
      subtitle: t('settings.agentPermAllowNavigateDesc'),
    },
    {
      key: 'allowMutate',
      icon: SettingsIcon,
      title: t('settings.agentPermAllowMutate'),
      subtitle: t('settings.agentPermAllowMutateDesc'),
    },
    {
      key: 'allowExternal',
      icon: Link2,
      title: t('settings.agentPermAllowExternal'),
      subtitle: t('settings.agentPermAllowExternalDesc'),
    },
    {
      key: 'allowDestructive',
      icon: Trash2,
      title: t('settings.agentPermAllowDestructive'),
      subtitle: t('settings.agentPermAllowDestructiveDesc'),
    },
  ]

  const handleToggle = (key: keyof AgentPermissionSettings, value: boolean) => {
    void updateSettingsSection('agentPermissions', { [key]: value })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck size={16} className="text-accent" />
          <h4 className="text-sm font-medium">
            {t('settings.agentPermissions')}
          </h4>
        </div>
        <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
          {t('settings.agentPermissionsDesc')}
        </p>
      </section>

      {/* Permission rows */}
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface dark:bg-surface-dark-secondary">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center gap-3 px-4 py-3.5">
            <row.icon size={18} className="flex-shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <p className="text-text-primary text-sm font-medium dark:text-text-dark-primary">
                {row.title}
              </p>
              <p className="mt-0.5 text-xs text-text-secondary dark:text-text-dark-secondary">
                {row.subtitle}
              </p>
            </div>
            <ToggleSwitch
              checked={permissions[row.key]}
              onChange={(v) => handleToggle(row.key, v)}
            />
          </div>
        ))}
      </div>

      {/* Footer hint */}
      <p className="dark:text-text-dark-tertiary text-xs text-text-tertiary">
        {t('settings.agentPermissionsConfirmHint')}
      </p>
    </div>
  )
}
