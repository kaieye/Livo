import { lazy, Suspense } from 'react'
import { LocalErrorBoundary } from './components/LocalErrorBoundary'
import { Layout } from './components/layout/Layout'
import { QuickSearchPanel } from './components/search/QuickSearch'
import { CornerPlayer } from './components/media/MediaPlayer'
import { TextContextMenu } from './components/ui/TextContextMenu'
import { useSettingsStore } from './store/settings-store'
import { useAIChatStore } from './store/ai-chat-store'
import { useShortcutHelpStore } from './components/shortcuts/shortcut-help-store'

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
const ShortcutHelpDialog = lazy(() =>
  import('./components/shortcuts/ShortcutHelp').then((module) => ({
    default: module.ShortcutHelpDialog,
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

function LazyShortcutHelpDialogMount() {
  const isOpen = useShortcutHelpStore((state) => state.isOpen)

  if (!isOpen) return null

  return (
    <Suspense fallback={null}>
      <ShortcutHelpDialog />
    </Suspense>
  )
}

export default function App() {
  return (
    <>
      <Layout />
      <LocalErrorBoundary
        title="设置面板加载失败"
        onDismiss={() => useSettingsStore.getState().setOpen(false)}
      >
        <LazySettingsDialogMount />
      </LocalErrorBoundary>
      <LocalErrorBoundary title="快速搜索出现问题">
        <QuickSearchPanel />
      </LocalErrorBoundary>
      <LocalErrorBoundary
        title="AI 面板加载失败"
        onDismiss={() => useAIChatStore.getState().setPanelOpen(false)}
      >
        <LazyAIChatPanelMount />
      </LocalErrorBoundary>
      <LocalErrorBoundary
        title="快捷键帮助出现问题"
        onDismiss={() => useShortcutHelpStore.getState().close()}
      >
        <LazyShortcutHelpDialogMount />
      </LocalErrorBoundary>
      <CornerPlayer />
      <TextContextMenu />
    </>
  )
}
