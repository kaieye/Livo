import { useTranslation } from 'react-i18next'

export function ReadingSettings() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <p className="text-sm text-text-secondary dark:text-text-dark-secondary">
        {t('settings.readingMigratedToAppearance')}
      </p>
    </div>
  )
}
