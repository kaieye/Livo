import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'

import {
  FeatureCardShell,
  FeatureLanguageRow,
  FeatureToggleRow,
} from './feature-card-ui'

export interface SummaryFeatureCardProps {
  enabled: boolean
  autoTrigger: boolean
  language: string
  onEnabledChange: (next: boolean) => void
  onAutoTriggerChange: (next: boolean) => void
  onLanguageChange: (next: string) => void
}

/**
 * AI summary feature card (Harmony `SummaryFeatureCard` parity): output
 * language, auto-trigger on article open, and the master enable toggle.
 * Presentational — the host panel wires it to settings.
 */
export function SummaryFeatureCard({
  enabled,
  autoTrigger,
  language,
  onEnabledChange,
  onAutoTriggerChange,
  onLanguageChange,
}: SummaryFeatureCardProps) {
  const { t } = useTranslation()

  return (
    <FeatureCardShell
      title={t('settings.summaryTitle')}
      icon={<Sparkles size={15} className="text-accent" aria-hidden="true" />}
    >
      <FeatureLanguageRow
        label={t('settings.summaryLanguage')}
        value={language}
        onChange={onLanguageChange}
      />
      <FeatureToggleRow
        label={t('settings.autoSummary')}
        description={t('settings.autoSummaryDesc')}
        checked={autoTrigger}
        onChange={onAutoTriggerChange}
      />
      <FeatureToggleRow
        label={t('settings.enableSummary')}
        description={t('settings.enableSummaryDesc')}
        checked={enabled}
        onChange={onEnabledChange}
      />
    </FeatureCardShell>
  )
}
