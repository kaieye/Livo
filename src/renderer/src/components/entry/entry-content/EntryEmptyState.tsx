import { BookOpen } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { markStartupComponentMounted } from '../../../lib/startup-block-diagnostics'

export function EntryEmptyState() {
  const { t } = useTranslation()

  useEffect(() => {
    markStartupComponentMounted('EntryEmptyState')
  }, [])

  return (
    <div className="bg-surface-secondary dark:bg-surface-dark flex flex-1 items-center justify-center">
      <div className="text-text-secondary dark:text-text-dark-secondary text-center">
        <BookOpen
          size={48}
          className="text-text-tertiary mx-auto mb-4"
          strokeWidth={1.5}
        />
        <p className="text-lg font-medium">{t('entry.selectArticle')}</p>
        <p className="text-text-tertiary mt-1 text-sm">
          {t('entry.selectArticleHint')}
        </p>
        <div className="text-text-tertiary mt-6 space-y-1 text-xs">
          <p>
            <kbd className="bg-surface-tertiary dark:bg-surface-dark-tertiary rounded px-1.5 py-0.5 text-[10px]">
              J
            </kbd>{' '}
            /{' '}
            <kbd className="bg-surface-tertiary dark:bg-surface-dark-tertiary rounded px-1.5 py-0.5 text-[10px]">
              K
            </kbd>{' '}
            {t('entry.navUpDown')}
          </p>
          <p>
            <kbd className="bg-surface-tertiary dark:bg-surface-dark-tertiary rounded px-1.5 py-0.5 text-[10px]">
              S
            </kbd>{' '}
            {t('entry.starHint')}{' '}
            <kbd className="bg-surface-tertiary dark:bg-surface-dark-tertiary rounded px-1.5 py-0.5 text-[10px]">
              O
            </kbd>{' '}
            {t('entry.browserOpenHint')}
          </p>
        </div>
      </div>
    </div>
  )
}
