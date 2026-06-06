import { useEffect, useState, type ReactNode } from 'react'

function MinimizeIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
    >
      <path d="M0 5h10" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

function MaximizeIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="0.5"
        y="0.5"
        width="9"
        height="9"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  )
}

function RestoreIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="0.5"
        y="2.5"
        width="7"
        height="7"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1"
      />
      <path
        d="M2.7 2.5V0.5H9.5V7.3H7.5"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M0.7 0.7 9.3 9.3M9.3 0.7 0.7 9.3"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ControlButton({
  label,
  onClick,
  variant = 'default',
  children,
}: {
  label: string
  onClick: () => void
  variant?: 'default' | 'close'
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`text-text-secondary dark:text-text-dark-secondary flex h-full w-[50px] items-center justify-center outline-none transition-colors ${
        variant === 'close'
          ? 'hover:bg-[#e81123] hover:text-white'
          : 'hover:bg-black/[0.07] dark:hover:bg-white/[0.09]'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * Custom window title bar. Only macOS and Windows hide the native title bar:
 * macOS renders an empty drag strip that leaves room for the system traffic
 * lights, Windows adds the minimize / maximize-restore / close controls on the
 * right. Linux and the web build keep the native title bar, so nothing renders.
 */
export function TitleBar() {
  const platform = window.api.windowControls.platform
  const isMac = platform === 'darwin'
  const isWindows = platform === 'win32'
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    let mounted = true
    void window.api.windowControls.isMaximized().then((value) => {
      if (mounted) setIsMaximized(value)
    })
    const off = window.api.windowControls.onMaximizeChange((value) => {
      setIsMaximized(value)
    })
    return () => {
      mounted = false
      off()
    }
  }, [])

  if (!isMac && !isWindows) return null

  return (
    <div
      aria-hidden
      className="drag-region pointer-events-none fixed inset-x-0 top-0 z-[60] flex h-9 select-none items-stretch justify-end"
    >
      {isWindows && (
        <div className="no-drag pointer-events-auto flex items-stretch">
          <ControlButton
            label="最小化"
            onClick={() => void window.api.windowControls.minimize()}
          >
            <MinimizeIcon />
          </ControlButton>
          <ControlButton
            label={isMaximized ? '向下还原' : '最大化'}
            onClick={() => void window.api.windowControls.maximizeToggle()}
          >
            {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
          </ControlButton>
          <ControlButton
            label="关闭"
            variant="close"
            onClick={() => void window.api.windowControls.close()}
          >
            <CloseIcon />
          </ControlButton>
        </div>
      )}
    </div>
  )
}
