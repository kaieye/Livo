import { lazy, Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { LocalErrorBoundary } from './components/LocalErrorBoundary'
import { QuickSearchPanel } from './components/search/QuickSearch'
import { CornerPlayer } from './components/media/MediaPlayer'
import { TextContextMenu } from './components/ui/TextContextMenu'
import { PageTransition } from './components/layout/PageTransition'
import { useAgentNavigate } from './hooks/useAgentNavigate'
import { useSettingsStore } from './store/settings-store'
import { useAIChatStore } from './store/ai-chat-store'
import {
  CommandPalette,
  useCommandPaletteStore,
} from './components/command/CommandPalette'

const robotIconUrl = new URL('./assets/robot.svg', import.meta.url).href

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

  if (isOpen) return null

  return (
    <button
      type="button"
      aria-label="打开 AI 助手"
      title="打开 AI 助手"
      onClick={() => useAIChatStore.getState().setPanelOpen(true)}
      className="no-drag text-accent focus:ring-accent/45 dark:bg-surface-dark-secondary/88 dark:hover:bg-surface-dark-secondary dark:focus:ring-offset-surface-dark fixed bottom-24 right-5 z-[45] flex h-14 w-14 items-center justify-center rounded-full border border-white/70 bg-white/85 shadow-[0_14px_32px_rgba(15,23,42,0.18)] backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_18px_40px_rgba(15,23,42,0.22)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white active:translate-y-0 dark:border-white/10 dark:shadow-[0_16px_38px_rgba(0,0,0,0.38)]"
    >
      <img src={robotIconUrl} alt="" aria-hidden="true" className="h-7 w-7" />
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
    <>
      <PageTransition>
        <Outlet />
      </PageTransition>
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
        <QuickSearchPanel />
      </LocalErrorBoundary>
      <LocalErrorBoundary
        title="命令面板出现问题"
        onDismiss={() => useCommandPaletteStore.getState().close()}
      >
        <CommandPalette />
      </LocalErrorBoundary>
      <CornerPlayer />
      <TextContextMenu />
    </>
  )
}
