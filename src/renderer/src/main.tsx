import React from 'react'
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
import { setAppIsReady } from './store/app-store'
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

// PERF OPTIMIZATION: Start data hydration immediately, before React mounts
// This allows data loading and React initialization to happen in parallel
const hydratePromise = hydrateDataToMemory()
recordAppMetric('hydrate.start', performance.now())

try {
  // Mount React immediately (with skeleton)
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

  // Wait for data hydration to complete
  hydratePromise
    .then((result) => {
      console.log(
        `[Livo] Data hydration complete in ${result.timings.total.toFixed(0)}ms`,
      )
      recordAppMetric('app.dataHydrated', performance.now())
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
      // Mark app as ready regardless of hydration result
      setAppIsReady(true)
      recordAppMetric('app.ready', performance.now())
      document.documentElement.dataset.appReady = 'true'
      void window.api.app.readyToShowMainWindow().catch((error) => {
        console.error('[Livo] Failed to show main window:', error)
      })

      // PERF: Print performance summary after app is ready
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
