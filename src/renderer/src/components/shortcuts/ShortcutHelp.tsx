/**
 * Keyboard shortcuts help dialog — shows all available shortcuts.
 * Triggered by Shift+? shortcut.
 */
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_CATEGORY_LABELS,
  type ShortcutCategory,
} from '../../../../shared/shortcuts'
import { useOverlayHotkeyScope } from '../../hooks/useHotkeyScope'
import { useShortcutHelpStore } from './shortcut-help-store'
import { useOverlayStackItem } from '../../store/overlay-stack-store'
import { useEffect } from 'react'

// ====== Component ======
export function ShortcutHelpDialog() {
  const { isOpen, close } = useShortcutHelpStore()
  useOverlayHotkeyScope('shortcut-help', isOpen)
  const { zIndex, isTop } = useOverlayStackItem('shortcut-help', isOpen)
  const { t } = useTranslation()

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !isTop) return
      event.preventDefault()
      close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [close, isOpen, isTop])

  if (!isOpen) return null

  // Group by category
  const groups = new Map<ShortcutCategory, typeof DEFAULT_SHORTCUTS>()
  for (const s of DEFAULT_SHORTCUTS) {
    if (!groups.has(s.category)) groups.set(s.category, [])
    groups.get(s.category)!.push(s)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      style={{ zIndex }}
      onClick={close}
    >
      <div
        className="animate-in dark:bg-surface-dark-secondary flex max-h-[80vh] w-[600px] max-w-[90vw] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-base font-semibold">{t('shortcuts.title')}</h2>
          <button
            onClick={close}
            className="hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary rounded-lg p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-4">
          {Array.from(groups.entries()).map(([category, shortcuts]) => (
            <div key={category}>
              <h3 className="text-text-tertiary mb-2 text-xs font-semibold uppercase tracking-wider">
                {t(`shortcuts.cat_${category}`, {
                  defaultValue: SHORTCUT_CATEGORY_LABELS[category],
                })}
              </h3>
              <div className="space-y-1">
                {shortcuts.map((s) => (
                  <div
                    key={s.id}
                    className="hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary flex items-center justify-between rounded-lg px-2 py-1.5"
                  >
                    <div>
                      <span className="text-sm">
                        {t(`shortcuts.label_${s.id.replace(/-/g, '_')}`, {
                          defaultValue: s.label,
                        })}
                      </span>
                      {s.description && (
                        <span className="text-text-tertiary ml-2 text-xs">
                          {t(`shortcuts.desc_${s.id.replace(/-/g, '_')}`, {
                            defaultValue: s.description,
                          })}
                        </span>
                      )}
                    </div>
                    <KeyCombo keys={s.keys} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-text-tertiary border-t px-6 py-3 text-center text-xs">
          {t('shortcuts.footer', { open: 'Shift+?', close: 'Esc' })
            .split(/(Shift\+\?|Esc)/g)
            .map((part, i) =>
              part === 'Shift+?' ? (
                <KeyCombo key={i} keys="Shift+?" />
              ) : part === 'Esc' ? (
                <KeyCombo key={i} keys="Esc" />
              ) : (
                <span key={i}>{part}</span>
              ),
            )}
        </div>
      </div>
    </div>
  )
}

/** Render a keyboard shortcut combo as styled kbd elements */
function KeyCombo({ keys }: { keys: string }) {
  const { t } = useTranslation()
  // Split by + but handle "Shift+?" specially
  const parts = keys.includes(' ')
    ? keys
        .split(' ')
        .flatMap((k, i, arr) => (i < arr.length - 1 ? [k, ' then '] : [k]))
    : keys.split('+')

  return (
    <span className="flex items-center gap-0.5">
      {parts.map((part, i) => {
        if (part === ' then ') {
          return (
            <span key={i} className="text-text-tertiary mx-0.5 text-xs">
              {t('shortcuts.then')}
            </span>
          )
        }
        // Map to shorter labels for display
        const label =
          part === 'Ctrl'
            ? '⌃'
            : part === 'Shift'
              ? '⇧'
              : part === 'Alt'
                ? '⌥'
                : part === 'Cmd'
                  ? '⌘'
                  : part === 'Meta'
                    ? '⌘'
                    : part
        return (
          <kbd
            key={i}
            className="border-border bg-surface-secondary dark:border-border-dark dark:bg-surface-dark-tertiary inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-md border px-1.5 font-mono text-[11px] font-medium shadow-[0_1px_0_0_rgba(0,0,0,0.05)]"
          >
            {label}
          </kbd>
        )
      })}
    </span>
  )
}
