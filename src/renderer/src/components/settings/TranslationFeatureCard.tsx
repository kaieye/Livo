import { useTranslation } from 'react-i18next'
import { Languages } from 'lucide-react'

import {
  FeatureCardShell,
  FeatureLanguageRow,
  FeatureToggleRow,
} from './feature-card-ui'

export interface TranslationFeatureCardProps {
  enabled: boolean
  autoTranslate: boolean
  targetLanguage: string
  onEnabledChange: (next: boolean) => void
  onAutoTranslateChange: (next: boolean) => void
  onLanguageChange: (next: string) => void
}

/**
 * AI translation feature card (Harmony `TranslationFeatureCard` parity):
 * target language, auto-translate on article open, and the master enable
 * toggle. Presentational — the host panel wires it to settings.
 */
export function TranslationFeatureCard({
  enabled,
  autoTranslate,
  targetLanguage,
  onEnabledChange,
  onAutoTranslateChange,
  onLanguageChange,
}: TranslationFeatureCardProps) {
  const { t } = useTranslation()

  return (
    <FeatureCardShell
      title={t('settings.translationTitle')}
      icon={<Languages size={15} className="text-accent" aria-hidden="true" />}
    >
      <FeatureLanguageRow
        label={t('settings.targetLanguage')}
        value={targetLanguage}
        onChange={onLanguageChange}
      />
      <FeatureToggleRow
        label={t('settings.autoTranslate')}
        description={t('settings.autoTranslateDesc')}
        checked={autoTranslate}
        onChange={onAutoTranslateChange}
      />
      <FeatureToggleRow
        label={t('settings.enableTranslation')}
        description={t('settings.enableTranslationDesc')}
        checked={enabled}
        onChange={onEnabledChange}
      />
    </FeatureCardShell>
  )
}
