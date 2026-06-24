import { Send, Square } from 'lucide-react'
import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'

interface AIChatComposerProps {
  input: string
  inputRef: RefObject<HTMLTextAreaElement | null>
  isLoading: boolean
  disabled: boolean
  onInputChange: (value: string) => void
  onSubmit: (event: React.FormEvent) => void
  onKeyDown: (event: React.KeyboardEvent) => void
  onStop: () => void
}

export function AIChatComposer({
  input,
  inputRef,
  isLoading,
  disabled,
  onInputChange,
  onSubmit,
  onKeyDown,
  onStop,
}: AIChatComposerProps) {
  const { t } = useTranslation()

  return (
    <form onSubmit={onSubmit} className="flex-shrink-0 border-t p-3">
      <div className="flex gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('aiChat.inputPlaceholder')}
          rows={1}
          disabled={disabled}
          className="bg-surface-secondary focus:ring-accent/50 dark:bg-surface-dark-secondary max-h-[120px] flex-1 resize-none rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:opacity-50"
          style={{
            height: 'auto',
            minHeight: '36px',
          }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement
            target.style.height = 'auto'
            target.style.height = `${Math.min(target.scrollHeight, 120)}px`
          }}
        />
        {isLoading ? (
          <button
            type="button"
            onClick={onStop}
            className="bg-surface-secondary text-text-secondary hover:bg-surface-tertiary dark:bg-surface-dark-secondary dark:hover:bg-surface-dark-tertiary self-end rounded-lg p-2 transition-colors"
            title={t('aiChat.stop')}
          >
            <Square size={16} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim() || disabled}
            className="bg-accent hover:bg-accent-hover self-end rounded-lg p-2 text-white transition-colors disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        )}
      </div>
    </form>
  )
}
