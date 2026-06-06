import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Outlet } from 'react-router-dom'
import { LocalErrorBoundary } from './components/LocalErrorBoundary'
import { PageTransition } from './components/layout/PageTransition'
import { TitleBar } from './components/layout/TitleBar'
import { useAgentNavigate } from './hooks/useAgentNavigate'
import { useSettingsStore } from './store/settings-store'
import { useAIChatStore } from './store/ai-chat-store'
import { useCommandPaletteStore } from './store/command-palette-store'

const robotIconUrl = new URL('./assets/robot.svg', import.meta.url).href

const AI_ASSISTANT_BUTTON_STORAGE_KEY = 'ai-assistant-button-position'
const AI_ASSISTANT_BUTTON_SIZE = 56
const AI_ASSISTANT_BUTTON_MARGIN = 20
const AI_ASSISTANT_BUTTON_DEFAULT_BOTTOM = 96

interface FloatingButtonPosition {
  x: number
  y: number
}

function clampFloatingAIButtonPosition(
  position: FloatingButtonPosition,
): FloatingButtonPosition {
  const maxX = Math.max(
    AI_ASSISTANT_BUTTON_MARGIN,
    window.innerWidth - AI_ASSISTANT_BUTTON_SIZE - AI_ASSISTANT_BUTTON_MARGIN,
  )
  const maxY = Math.max(
    AI_ASSISTANT_BUTTON_MARGIN,
    window.innerHeight - AI_ASSISTANT_BUTTON_SIZE - AI_ASSISTANT_BUTTON_MARGIN,
  )

  return {
    x: Math.min(Math.max(position.x, AI_ASSISTANT_BUTTON_MARGIN), maxX),
    y: Math.min(Math.max(position.y, AI_ASSISTANT_BUTTON_MARGIN), maxY),
  }
}

function getDefaultFloatingAIButtonPosition(): FloatingButtonPosition {
  return clampFloatingAIButtonPosition({
    x:
      window.innerWidth - AI_ASSISTANT_BUTTON_SIZE - AI_ASSISTANT_BUTTON_MARGIN,
    y:
      window.innerHeight -
      AI_ASSISTANT_BUTTON_SIZE -
      AI_ASSISTANT_BUTTON_DEFAULT_BOTTOM,
  })
}

function loadFloatingAIButtonPosition(): FloatingButtonPosition {
  try {
    const raw = localStorage.getItem(AI_ASSISTANT_BUTTON_STORAGE_KEY)
    if (!raw) return getDefaultFloatingAIButtonPosition()

    const parsed = JSON.parse(raw) as Partial<FloatingButtonPosition>
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') {
      return getDefaultFloatingAIButtonPosition()
    }

    return clampFloatingAIButtonPosition(parsed as FloatingButtonPosition)
  } catch {
    return getDefaultFloatingAIButtonPosition()
  }
}

function saveFloatingAIButtonPosition(position: FloatingButtonPosition): void {
  try {
    localStorage.setItem(
      AI_ASSISTANT_BUTTON_STORAGE_KEY,
      JSON.stringify(position),
    )
  } catch {
    // 位置记忆是体验增强，写入失败不应影响打开 AI 对话。
  }
}

const SettingsDialog = lazy(() =>
  import('./components/settings/SettingsDialog').then((module) => ({
    default: module.SettingsDialog,
  })),
)
const AIChatPanel = lazy(() =>
  import('./components/ai/AIChatPanel').then((module) => ({
    default: module.AIChatPanel,
  })),
)
const QuickSearchPanel = lazy(() =>
  import('./components/search/QuickSearch').then((module) => ({
    default: module.QuickSearchPanel,
  })),
)
const CommandPalette = lazy(() =>
  import('./components/command/CommandPalette').then((module) => ({
    default: module.CommandPalette,
  })),
)
const CornerPlayer = lazy(() =>
  import('./components/media/AudioMiniBar').then((module) => ({
    default: module.AudioMiniBar,
  })),
)
const TextContextMenu = lazy(() =>
  import('./components/ui/TextContextMenu').then((module) => ({
    default: module.TextContextMenu,
  })),
)
function LazySettingsDialogMount() {
  const isOpen = useSettingsStore((state) => state.isOpen)

  if (!isOpen) return null

  return (
    <Suspense fallback={null}>
      <SettingsDialog />
    </Suspense>
  )
}

function LazyAIChatPanelMount() {
  const isOpen = useAIChatStore((state) => state.isPanelOpen)

  if (!isOpen) return null

  return (
    <Suspense fallback={null}>
      <AIChatPanel />
    </Suspense>
  )
}

function FloatingAIAssistantButton() {
  const isOpen = useAIChatStore((state) => state.isPanelOpen)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dragStateRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    startPosition: FloatingButtonPosition
    hasMoved: boolean
  } | null>(null)
  const ignoreNextClickRef = useRef(false)
  const [position, setPosition] = useState<FloatingButtonPosition>(
    loadFloatingAIButtonPosition,
  )
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      setPosition((current) => {
        const next = clampFloatingAIButtonPosition(current)
        saveFloatingAIButtonPosition(next)
        return next
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return

      dragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startPosition: position,
        hasMoved: false,
      }
      buttonRef.current?.setPointerCapture(event.pointerId)
    },
    [position],
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const dragState = dragStateRef.current
      if (!dragState || dragState.pointerId !== event.pointerId) return

      const dx = event.clientX - dragState.startX
      const dy = event.clientY - dragState.startY
      if (!dragState.hasMoved && Math.hypot(dx, dy) < 4) return

      dragState.hasMoved = true
      ignoreNextClickRef.current = true
      setIsDragging(true)
      setPosition(
        clampFloatingAIButtonPosition({
          x: dragState.startPosition.x + dx,
          y: dragState.startPosition.y + dy,
        }),
      )
      event.preventDefault()
    },
    [],
  )

  const finishDragging = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const dragState = dragStateRef.current
      if (!dragState || dragState.pointerId !== event.pointerId) return

      dragStateRef.current = null
      setIsDragging(false)
      if (dragState.hasMoved) {
        setPosition((current) => {
          const next = clampFloatingAIButtonPosition(current)
          saveFloatingAIButtonPosition(next)
          return next
        })
      }

      buttonRef.current?.releasePointerCapture(event.pointerId)
    },
    [],
  )

  if (isOpen) return null

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label="打开 AI 助手"
      title="打开 AI 助手"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDragging}
      onPointerCancel={finishDragging}
      onClick={() => {
        if (ignoreNextClickRef.current) {
          ignoreNextClickRef.current = false
          return
        }

        useAIChatStore.getState().setPanelOpen(true)
      }}
      className={`no-drag text-accent focus:ring-accent/45 dark:bg-surface-dark-secondary/88 dark:hover:bg-surface-dark-secondary dark:focus:ring-offset-surface-dark fixed z-[45] flex h-14 w-14 touch-none select-none items-center justify-center rounded-full border border-white/70 bg-white/85 shadow-[0_14px_32px_rgba(15,23,42,0.18)] backdrop-blur-xl transition duration-200 hover:bg-white hover:shadow-[0_18px_40px_rgba(15,23,42,0.22)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:border-white/10 dark:shadow-[0_16px_38px_rgba(0,0,0,0.38)] ${
        isDragging
          ? 'cursor-grabbing'
          : 'cursor-grab hover:-translate-y-0.5 active:translate-y-0'
      }`}
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <img
        src={robotIconUrl}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="pointer-events-none h-7 w-7"
      />
    </button>
  )
}

/**
 * Root layout component rendered by the HashRouter.
 * Provides <Outlet /> for child routes and mounts global overlays
 * (Settings, AI Chat, Quick Search, Command Palette, Corner Player, Context Menu).
 */
export default function App() {
  useAgentNavigate()

  return (
    <div className="relative h-full w-full overflow-hidden">
      <PageTransition>
        <Outlet />
      </PageTransition>
      <TitleBar />
      <LocalErrorBoundary
        title="设置面板加载失败"
        onDismiss={() => useSettingsStore.getState().setOpen(false)}
      >
        <LazySettingsDialogMount />
      </LocalErrorBoundary>
      <LocalErrorBoundary
        title="AI 面板加载失败"
        onDismiss={() => useAIChatStore.getState().setPanelOpen(false)}
      >
        <FloatingAIAssistantButton />
        <LazyAIChatPanelMount />
      </LocalErrorBoundary>
      <LocalErrorBoundary title="快速搜索出现问题">
        <Suspense fallback={null}>
          <QuickSearchPanel />
        </Suspense>
      </LocalErrorBoundary>
      <LocalErrorBoundary
        title="命令面板出现问题"
        onDismiss={() => useCommandPaletteStore.getState().close()}
      >
        <Suspense fallback={null}>
          <CommandPalette />
        </Suspense>
      </LocalErrorBoundary>
      <Suspense fallback={null}>
        <CornerPlayer />
        <TextContextMenu />
      </Suspense>
    </div>
  )
}
