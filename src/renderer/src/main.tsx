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
import {
  hydrateFromLocalCache,
  hydrateDataToMemory,
} from './initialize/hydrate'
import { setAppIsHydrated, setAppIsReady } from './store/app-store'
import { applyAfterReadyCallbacks } from './initialize/queue'
import {
  recordStartupBlockEvent,
  recordStartupReactProfiler,
  startStartupBlockDiagnostics,
} from './lib/startup-block-diagnostics'
import './styles/tokens.css'
import './styles/globals.css'

const isDev = import.meta.env.DEV

if (isDev) {
  performance.mark('livo-renderer-module-loaded')
  startStartupBlockDiagnostics()
  recordStartupBlockEvent('renderer.moduleLoaded')
}

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

if (isDev) {
  performance.mark('livo-render-start')
  recordAppMetric('app.moduleLoaded', performance.now())
}

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
    if (isDev) recordStartupBlockEvent('react.strictMode.disabledForDev')
    return <>{children}</>
  }

  if (isDev) recordStartupBlockEvent('react.strictMode.enabled')
  return <React.StrictMode>{children}</React.StrictMode>
}

function renderApp(): void {
  if (isDev) recordStartupBlockEvent('react.render.start')
  const root = ReactDOM.createRoot(document.getElementById('root')!)

  root.render(
    <StrictModeBoundary>
      <ErrorBoundary>
        <RootProviders>
          {isDev ? (
            <React.Profiler
              id="RouterProvider"
              onRender={recordStartupReactProfiler}
            >
              <RouterProvider router={router} />
            </React.Profiler>
          ) : (
            <RouterProvider router={router} />
          )}
        </RootProviders>
      </ErrorBoundary>
    </StrictModeBoundary>,
  )
  if (isDev) {
    recordAppMetric('app.reactMounted', performance.now())
    recordStartupBlockEvent('react.render.scheduled')
  }
  notifyRendererShellReady()
}

/**
 * Bootstrap: cache → render → background refresh (Folo-style)
 */
async function bootstrap(): Promise<void> {
  try {
    hydrateFromLocalCache()

    // Render immediately, don't wait for IPC
    renderApp()

    // Set ready in finally() so UI always shows, even if IPC fails
    hydrateDataToMemory()
      .then((result) => {
        setAppIsHydrated(true)
        console.log(
          `[Livo] Background refresh complete in ${result.timings.total.toFixed(0)}ms`,
        )
      })
      .catch((err) => {
        console.error('[Livo] Background hydration failed:', err)
      })
      .finally(() => {
        flushSync(() => setAppIsReady(true))
        applyAfterReadyCallbacks()
        notifyRendererReady()
        document.documentElement.dataset.appReady = 'true'

        void import('./initialize/queue')
          .then(({ setupBackgroundEventListeners }) =>
            setupBackgroundEventListeners(),
          )
          .catch((error) => {
            console.error('[Livo] Failed to setup background listeners:', error)
          })

        if (isDev) {
          setTimeout(() => {
            printPerformanceSummary()
          }, 1000)
        }
      })
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
