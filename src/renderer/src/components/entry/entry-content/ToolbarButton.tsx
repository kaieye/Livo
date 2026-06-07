import type { ReactNode } from 'react'

export function ToolbarButton({
  children,
  onClick,
  disabled,
  active,
  title,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-text-secondary hover:bg-surface-secondary hover:text-text dark:text-text-dark-secondary dark:hover:bg-surface-dark-secondary dark:hover:text-text-dark-primary rounded-lg p-1.5 transition-all duration-150 disabled:cursor-default disabled:opacity-30 ${active ? 'bg-accent/10 !text-accent' : ''} `}
      title={title}
    >
      {children}
    </button>
  )
}
