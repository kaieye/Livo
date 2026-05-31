import {
  useSettingSection,
  useSettingsActions,
} from '../../store/settings-store'
import { useTranslation } from 'react-i18next'
import { TranslationFeatureCard } from './TranslationFeatureCard'
import { SummaryFeatureCard } from './SummaryFeatureCard'

export function TranslationSettings() {
  const translation = useSettingSection('translation')
  const summary = useSettingSection('summary')
  const { updateSettingsSection } = useSettingsActions()
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      {/* Notice */}
      <div className="rounded-lg border border-accent/20 bg-accent/5 p-3 text-sm">
        <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
          {t('settings.translationNotice')}
        </p>
      </div>

      <SummaryFeatureCard
        enabled={summary.enabled}
        autoTrigger={summary.autoTrigger}
        language={summary.language}
        onEnabledChange={(enabled) =>
          void updateSettingsSection('summary', { enabled })
        }
        onAutoTriggerChange={(autoTrigger) =>
          void updateSettingsSection('summary', { autoTrigger })
        }
        onLanguageChange={(language) =>
          void updateSettingsSection('summary', { language })
        }
      />

      <TranslationFeatureCard
        enabled={translation.enabled}
        autoTranslate={translation.autoTranslate}
        targetLanguage={translation.targetLanguage}
        onEnabledChange={(enabled) =>
          void updateSettingsSection('translation', { enabled })
        }
        onAutoTranslateChange={(autoTranslate) =>
          void updateSettingsSection('translation', { autoTranslate })
        }
        onLanguageChange={(targetLanguage) =>
          void updateSettingsSection('translation', { targetLanguage })
        }
      />
    </div>
  )
}
