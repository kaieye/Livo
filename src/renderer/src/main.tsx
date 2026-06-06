import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { ErrorBoundary } from './components/ErrorBoundary'
import { recordAppMetric } from './lib/performance-metrics'
import { RootProviders } from './providers/RootProviders'
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

try {
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
