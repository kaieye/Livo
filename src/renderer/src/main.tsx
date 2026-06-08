import React from 'react'
import { flushSync } from 'react-dom'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { ErrorBoundary } from './components/ErrorBoundary'
import {
  recordAppMetric,
  printPerformanceSummary,
} from './lib/performance-metrics'
import { RootProviders } from './providers/RootProviders'
import { hydrateDataToMemory } from './initialize/hydrate'
import { setAppIsHydrated, setAppIsReady } from './store/app-store'
import './styles/tokens.css'
import './styles/globals.css'

function installRendererErrorReporting(): void {
  window.addEventListener('error', (event) => {
    const error = event.error instanceof Error ? event.error : null
    void window.api.app.reportError({
      source: 'window.error',
      message: error?.message || event.message || 'Unknown window error',
      stack: error?.stack,
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason =
      event.reason instanceof Error
        ? { message: event.reason.message, stack: event.reason.stack }
        : { message: String(event.reason), stack: undefined }

    void window.api.app.reportError({
      source: 'window.unhandledrejection',
      message: reason.message,
      stack: reason.stack,
    })
  })
}

installRendererErrorReporting()

const _platform = window.api?.windowControls?.platform
if (_platform === 'win32') {
  document.documentElement.classList.add('has-window-controls')
}
if (_platform === 'darwin' || _platform === 'win32') {
  document.documentElement.classList.add('has-titlebar')
}

performance.mark('livo-render-start')

// 启动数据 hydrate，但不再用它阻塞首屏 shell。
const hydratePromise = hydrateDataToMemory()
recordAppMetric('hydrate.start', performance.now())

function removeInlineSkeleton(): void {
  const skeleton = document.getElementById('app-skeleton')
  if (skeleton) {
    skeleton.remove()
  }
}

function revealInteractiveShell(): void {
  // 首屏 shell 与数据 hydrate 分离：先让布局和基础交互可用，
  // 数据随后通过 store 更新逐步填充。
  flushSync(() => setAppIsReady(true))
  recordAppMetric('app.shellReady', performance.now())
  recordAppMetric('app.ready', performance.now())

  requestAnimationFrame(() => {
    removeInlineSkeleton()
    document.documentElement.dataset.appReady = 'true'
    void window.api.app.readyToShowMainWindow().catch((error) => {
      console.error('[Livo] Failed to show main window:', error)
    })
  })
}

try {
  // 立即挂载 React；内联骨架屏会覆盖到 shell 首帧准备好。
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <RootProviders>
          <RouterProvider router={router} />
        </RootProviders>
      </ErrorBoundary>
    </React.StrictMode>,
  )
  recordAppMetric('app.reactMounted', performance.now())

  requestAnimationFrame(revealInteractiveShell)

  // 数据 hydrate 在 shell 可见后继续后台完成。
  hydratePromise
    .then((result) => {
      console.log(
        `[Livo] Data hydration complete in ${result.timings.total.toFixed(0)}ms`,
      )
      recordAppMetric('app.dataHydrated', performance.now())
      setAppIsHydrated(true)
    })
    .catch((error) => {
      console.error('[Livo] Data hydration failed:', error)
      void window.api.app.reportError({
        source: 'hydrate',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
    })
    .finally(() => {
      setAppIsHydrated(true)

      // hydrate 完成后打印性能摘要，方便对比 shell ready 与 data ready。
      setTimeout(() => {
        printPerformanceSummary()
      }, 1000)
    })
} catch (err) {
  console.error('[Livo] Failed to mount React app:', err)
  void window.api.app.reportError({
    source: 'react-mount',
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  })
  document.getElementById('root')!.innerHTML = `
    <div style="padding:40px;font-family:sans-serif;">
      <h2 style="color:#FF5C00;">Livo 启动失败</h2>
      <pre style="background:#f5f5f5;padding:16px;border-radius:8px;color:#c00;">${err}</pre>
    </div>
  `
}
