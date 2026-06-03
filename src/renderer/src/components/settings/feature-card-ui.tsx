import type { ReactNode } from 'react'

/** Target/output language options shared by the AI feature cards. */
export const AI_LANGUAGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
  { value: 'ru', label: 'Русский' },
  { value: 'ar', label: 'العربية' },
]

export function FeatureCardShell({
  title,
  icon,
  children,
}: {
  title: string
  icon?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="bg-surface-secondary dark:bg-surface-dark-tertiary rounded-xl border border-[var(--color-border-secondary)]">
      <div className="text-text-primary dark:text-text-dark-primary flex items-center gap-2 px-4 pb-1 pt-3.5 text-sm font-semibold">
        {icon}
        <span>{title}</span>
      </div>
      <div className="divide-y divide-[var(--color-border-secondary)]">
        {children}
      </div>
    </div>
  )
}

export function FeatureToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
    >
      <div className="min-w-0">
        <div className="text-text-primary dark:text-text-dark-primary text-sm font-medium">
          {label}
        </div>
        {description && (
          <p className="text-text-secondary dark:text-text-dark-secondary mt-0.5 text-xs">
            {description}
          </p>
        )}
      </div>
      <span
        className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
          checked ? 'bg-accent' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </span>
    </button>
  )
}

export function FeatureLanguageRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (next: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="text-text-primary dark:text-text-dark-primary text-sm font-medium">
        {label}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-surface-primary focus:ring-accent/50 dark:bg-surface-dark-secondary rounded-lg border border-[var(--color-border-secondary)] px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2"
      >
        {AI_LANGUAGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
