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
import { applyAfterReadyCallbacks } from './initialize/queue'
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

function removeInlineSkeleton(): void {
  const skeleton = document.getElementById('app-skeleton')
  if (skeleton) {
    skeleton.remove()
  }
}

/**
 * Bootstrap 函数 - 阻塞式数据加载，确保数据就绪后才渲染 React
 *
 * 性能优化策略：
 * 1. 使用 await 等待 hydrate 完成，避免组件在空数据状态下渲染
 * 2. 使用 flushSync 确保 appReady 状态立即同步到 DOM
 * 3. 延迟移除骨架屏和窗口显示，确保首帧已渲染
 */
async function bootstrap(): Promise<void> {
  try {
    // 阻塞等待数据 hydrate 完成
    recordAppMetric('hydrate.start', performance.now())
    const result = await hydrateDataToMemory()
    recordAppMetric('hydrate.complete', performance.now())

    console.log(
      `[Livo] Data hydration complete in ${result.timings.total.toFixed(0)}ms`,
    )

    // 先设置 hydrated 状态
    setAppIsHydrated(true)

    // 应用 ready 后的回调
    applyAfterReadyCallbacks()

    // 设置后台事件监听器（从 AppBootstrapProvider 迁移过来）
    const { setupBackgroundEventListeners } = await import('./initialize/queue')
    setupBackgroundEventListeners()

    // 挂载 React 应用（此时 appReady 仍为 false，会显示空白）
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

    // React 挂载后，在下一帧设置 appReady 触发组件渲染
    requestAnimationFrame(() => {
      flushSync(() => {
        setAppIsReady(true)
      })
      recordAppMetric('app.shellReady', performance.now())
    })
    recordAppMetric('app.ready', performance.now())

    // 延迟移除骨架屏和显示窗口，确保首帧完成渲染
    requestAnimationFrame(() => {
      removeInlineSkeleton()
      document.documentElement.dataset.appReady = 'true'
      void window.api.app.readyToShowMainWindow().catch((error) => {
        console.error('[Livo] Failed to show main window:', error)
      })

      // 通知主进程渲染器已就绪
      void window.api.app.rendererReady().catch((error) => {
        console.error('[Livo] Failed to notify renderer ready:', error)
      })
    })

    // 打印性能摘要
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

    // 显示友好的错误界面
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
