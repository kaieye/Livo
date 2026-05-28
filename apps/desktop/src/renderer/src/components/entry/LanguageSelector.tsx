import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * Language display options for the compact toolbar selector.
 * Each language has a short label suitable for toolbar display.
 */
const LANGUAGES: { code: string; label: string }[] = [
  { code: 'zh-CN', label: '中文' },
  { code: 'en', label: 'EN' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'fr', label: 'FR' },
  { code: 'de', label: 'DE' },
  { code: 'es', label: 'ES' },
  { code: 'pt', label: 'PT' },
  { code: 'ru', label: 'RU' },
  { code: 'ar', label: 'AR' },
]

interface LanguageSelectorProps {
  /** Currently selected language code (e.g. 'en', 'zh-CN') */
  value: string
  /** Called when user selects a different language */
  onChange: (code: string) => void
  /** Disable the selector (e.g. during translation) */
  disabled?: boolean
}

/**
 * Compact language selector for the entry toolbar.
 *
 * Shows the current language's short label (e.g. "EN") as a button.
 * Click opens a compact dropdown with common target languages.
 * Selecting a language calls `onChange` and closes the dropdown.
 */
export function LanguageSelector({
  value,
  onChange,
  disabled = false,
}: LanguageSelectorProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const currentLang = LANGUAGES.find((l) => l.code === value)
  const displayLabel = currentLang?.label ?? value

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const handleSelect = useCallback(
    (code: string) => {
      onChange(code)
      setOpen(false)
    },
    [onChange],
  )

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={`flex items-center gap-0.5 rounded-lg px-1.5 py-1.5 text-xs font-medium text-text-secondary transition-all duration-150 hover:bg-surface-secondary hover:text-text dark:text-text-dark-secondary dark:hover:bg-surface-dark-secondary dark:hover:text-text-dark-primary ${disabled ? 'cursor-default opacity-30' : ''}`}
        title="Translation target language"
      >
        <span className="min-w-[1.25rem] text-center">{displayLabel}</span>
        <ChevronDown size={10} className="opacity-50" />
      </button>

      {open && (
        <div className="border-border-secondary bg-surface-primary dark:border-border-dark-secondary dark:bg-surface-dark-primary absolute bottom-full left-0 z-50 mb-1 min-w-[5rem] rounded-lg border py-1 shadow-lg">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleSelect(lang.code)}
              className={`block w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent/10 ${lang.code === value ? 'font-medium text-accent' : 'text-text-secondary dark:text-text-dark-secondary'}`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
