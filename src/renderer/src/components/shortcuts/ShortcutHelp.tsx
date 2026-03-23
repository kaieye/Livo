/**
 * Keyboard shortcuts help dialog — shows all available shortcuts.
 * Triggered by Shift+? shortcut.
 */
import { X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { DEFAULT_SHORTCUTS, SHORTCUT_CATEGORY_LABELS, type ShortcutCategory } from "../../../../shared/shortcuts"
import { create } from "zustand"
import { useOverlayHotkeyScope } from "../../hooks/useHotkeyScope"

// ====== State ======
interface ShortcutHelpState {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

export const useShortcutHelpStore = create<ShortcutHelpState>((set, get) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set({ isOpen: !get().isOpen }),
}))

// ====== Component ======
export function ShortcutHelpDialog() {
  const { isOpen, close } = useShortcutHelpStore()
  useOverlayHotkeyScope("shortcut-help", isOpen)
  const { t } = useTranslation()

  if (!isOpen) return null

  // Group by category
  const groups = new Map<ShortcutCategory, typeof DEFAULT_SHORTCUTS>()
  for (const s of DEFAULT_SHORTCUTS) {
    if (!groups.has(s.category)) groups.set(s.category, [])
    groups.get(s.category)!.push(s)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={close}>
      <div
        className="bg-white dark:bg-surface-dark-secondary rounded-2xl shadow-2xl w-[600px] max-w-[90vw] max-h-[80vh] flex flex-col overflow-hidden animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold">{t("shortcuts.title")}</h2>
          <button onClick={close} className="p-1 rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {Array.from(groups.entries()).map(([category, shortcuts]) => (
            <div key={category}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">
                {t(`shortcuts.cat_${category}`, { defaultValue: SHORTCUT_CATEGORY_LABELS[category] })}
              </h3>
              <div className="space-y-1">
                {shortcuts.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary">
                    <div>
                      <span className="text-sm">{t(`shortcuts.label_${s.id.replace(/-/g, "_")}`, { defaultValue: s.label })}</span>
                      {s.description && (
                        <span className="text-xs text-text-tertiary ml-2">{t(`shortcuts.desc_${s.id.replace(/-/g, "_")}`, { defaultValue: s.description })}</span>
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
        <div className="border-t px-6 py-3 text-xs text-text-tertiary text-center">
          {t("shortcuts.footer", { open: "Shift+?", close: "Esc" }).split(/(Shift\+\?|Esc)/g).map((part, i) =>
            part === "Shift+?" ? <KeyCombo key={i} keys="Shift+?" /> :
            part === "Esc" ? <KeyCombo key={i} keys="Esc" /> :
            <span key={i}>{part}</span>
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
  const parts = keys.includes(" ")
    ? keys.split(" ").flatMap((k, i, arr) => (i < arr.length - 1 ? [k, " then "] : [k]))
    : keys.split("+")

  return (
    <span className="flex items-center gap-0.5">
      {parts.map((part, i) => {
        if (part === " then ") {
          return <span key={i} className="text-xs text-text-tertiary mx-0.5">{t("shortcuts.then")}</span>
        }
        // Map to shorter labels for display
        const label = part === "Ctrl" ? "⌃" : part === "Shift" ? "⇧" : part === "Alt" ? "⌥" : part === "Cmd" ? "⌘" : part === "Meta" ? "⌘" : part
        return (
          <kbd
            key={i}
            className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-md bg-surface-secondary dark:bg-surface-dark-tertiary text-[11px] font-mono font-medium border border-border dark:border-border-dark shadow-[0_1px_0_0_rgba(0,0,0,0.05)]"
          >
            {label}
          </kbd>
        )
      })}
    </span>
  )
}
