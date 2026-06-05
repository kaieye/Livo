import { useTranslation } from 'react-i18next'
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_CATEGORY_LABELS,
  type ShortcutCategory,
} from '../../../../shared/shortcuts'

/** 在设置中展示当前应用支持的键盘快捷键。 */
export function ShortcutsSettings() {
  const { t } = useTranslation()
  const groups = new Map<ShortcutCategory, typeof DEFAULT_SHORTCUTS>()

  for (const shortcut of DEFAULT_SHORTCUTS) {
    if (!groups.has(shortcut.category)) groups.set(shortcut.category, [])
    groups.get(shortcut.category)!.push(shortcut)
  }

  return (
    <div className="space-y-6">
      {Array.from(groups.entries()).map(([category, shortcuts]) => (
        <section key={category}>
          <h4 className="text-text-tertiary mb-2 text-xs font-semibold uppercase tracking-wider">
            {t(`shortcuts.cat_${category}`, {
              defaultValue: SHORTCUT_CATEGORY_LABELS[category],
            })}
          </h4>
          <div className="dark:divide-border-dark divide-y overflow-hidden rounded-lg border">
            {shortcuts.map((shortcut) => {
              const i18nId = shortcut.id.replace(/-/g, '_')
              return (
                <div
                  key={shortcut.id}
                  className="hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary flex items-center justify-between gap-4 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {t(`shortcuts.label_${i18nId}`, {
                        defaultValue: shortcut.label,
                      })}
                    </p>
                    {shortcut.description && (
                      <p className="text-text-tertiary mt-0.5 truncate text-xs">
                        {t(`shortcuts.desc_${i18nId}`, {
                          defaultValue: shortcut.description,
                        })}
                      </p>
                    )}
                  </div>
                  <KeyCombo keys={shortcut.keys} />
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

function KeyCombo({ keys }: { keys: string }) {
  const { t } = useTranslation()
  const parts = keys.includes(' ')
    ? keys
        .split(' ')
        .flatMap((key, index, items) =>
          index < items.length - 1 ? [key, ' then '] : [key],
        )
    : keys.split('+')

  return (
    <span className="flex flex-shrink-0 items-center gap-0.5">
      {parts.map((part, index) => {
        if (part === ' then ') {
          return (
            <span key={index} className="text-text-tertiary mx-0.5 text-xs">
              {t('shortcuts.then')}
            </span>
          )
        }

        const label =
          part === 'Ctrl'
            ? '⌃'
            : part === 'Shift'
              ? '⇧'
              : part === 'Alt'
                ? '⌥'
                : part === 'Cmd' || part === 'Meta'
                  ? '⌘'
                  : part

        return (
          <kbd
            key={index}
            className="border-border bg-surface-secondary dark:border-border-dark dark:bg-surface-dark-tertiary inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-md border px-1.5 font-mono text-[11px] font-medium shadow-[0_1px_0_0_rgba(0,0,0,0.05)]"
          >
            {label}
          </kbd>
        )
      })}
    </span>
  )
}
