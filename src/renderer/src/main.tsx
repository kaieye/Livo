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
import { hydrateDataToMemory, hydrateStartupCache } from './initialize/hydrate'
import { setAppIsHydrated, setAppIsReady } from './store/app-store'
import { applyAfterReadyCallbacks } from './initialize/queue'
import {
  recordStartupBlockEvent,
  recordStartupReactProfiler,
  startStartupBlockDiagnostics,
} from './lib/startup-block-diagnostics'
import './styles/tokens.css'
import './styles/globals.css'

let hasStartupSnapshotCache = false

performance.mark('livo-renderer-module-loaded')
startStartupBlockDiagnostics()
recordStartupBlockEvent('renderer.moduleLoaded')

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
recordAppMetric('app.moduleLoaded', performance.now())

function notifyRendererShellReady(): void {
  requestAnimationFrame(() => {
    void window.api.app.readyToShowMainWindow().catch((error) => {
      console.error('[Livo] Failed to notify shell ready:', error)
    })
  })
}

function notifyRendererReady(): void {
  void window.api.app.rendererReady().catch((error) => {
    console.error('[Livo] Failed to notify renderer ready:', error)
  })
}

function StrictModeBoundary({ children }: { children: React.ReactNode }) {
  if (import.meta.env.DEV && import.meta.env.VITE_LIVO_STRICT_MODE !== 'true') {
    recordStartupBlockEvent('react.strictMode.disabledForDev')
    return <>{children}</>
  }

  recordStartupBlockEvent('react.strictMode.enabled')
  return <React.StrictMode>{children}</React.StrictMode>
}

function renderApp(): void {
  recordStartupBlockEvent('react.render.start')
  const root = ReactDOM.createRoot(document.getElementById('root')!)

  root.render(
    <StrictModeBoundary>
      <ErrorBoundary>
        <RootProviders>
          <React.Profiler
            id="RouterProvider"
            onRender={recordStartupReactProfiler}
          >
            <RouterProvider router={router} />
          </React.Profiler>
        </RootProviders>
      </ErrorBoundary>
    </StrictModeBoundary>,
  )
  recordAppMetric('app.reactMounted', performance.now())
  recordStartupBlockEvent('react.render.scheduled')
  notifyRendererShellReady()
}

/**
 * Render the shell first, then hydrate data. This keeps the window responsive
 * while settings, feeds, auth, and initial entries load in the background.
 */
async function bootstrap(): Promise<void> {
  try {
    hasStartupSnapshotCache = hydrateStartupCache()
    recordStartupBlockEvent('hydrate.startupCache.complete')
    renderApp()

    recordAppMetric('hydrate.start', performance.now())
    recordStartupBlockEvent('hydrate.data.start')
    const result = await hydrateDataToMemory()
    recordAppMetric('hydrate.complete', performance.now())
    recordStartupBlockEvent(
      'hydrate.data.complete',
      undefined,
      result.timings.total,
    )

    setAppIsHydrated(true)
    console.log(
      `[Livo] Data hydration complete in ${result.timings.total.toFixed(0)}ms`,
    )

    flushSync(() => {
      recordStartupBlockEvent('app.ready.flushSync.start')
      setAppIsReady(true)
    })
    recordStartupBlockEvent('app.ready.flushSync.complete')
    applyAfterReadyCallbacks()
    recordAppMetric('app.shellReady', performance.now())

    document.documentElement.dataset.appReady = 'true'

    notifyRendererReady()

    recordAppMetric('app.ready', performance.now())
    recordStartupBlockEvent('app.ready')

    if (!result.initialSnapshot) {
      recordStartupBlockEvent(
        hasStartupSnapshotCache
          ? 'hydrate.initialSnapshot.skippedStartupCache'
          : 'hydrate.initialSnapshot.skippedNoStartupCache',
      )
    }

    void import('./initialize/queue')
      .then(({ setupBackgroundEventListeners }) =>
        setupBackgroundEventListeners(),
      )
      .catch((error) => {
        console.error('[Livo] Failed to setup background listeners:', error)
      })

    setTimeout(() => {
      printPerformanceSummary()
    }, 1000)
  } catch (err) {
    console.error('[Livo] Bootstrap failed:', err)
    void window.api.app.reportError({
      source: 'bootstrap',
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
}

// 启动应用
bootstrap()
