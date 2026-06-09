import { type PropsWithChildren } from 'react'
import { AppCommandProvider } from './AppCommandProvider'
import { GlobalShortcutsProvider } from './GlobalShortcutsProvider'
import { I18nProvider } from './I18nProvider'
import { OverlayStackProvider } from './OverlayStackProvider'
import { QueryProvider } from './QueryProvider'
import { QueryVisibilityRefreshProvider } from './QueryVisibilityRefreshProvider'
import { SettingSyncProvider } from './SettingSyncProvider'
import { UpdateCheckProvider } from './UpdateCheckProvider'
import { PerformanceMetricsProvider } from './PerformanceMetricsProvider'

/**
 * RootProviders - 扁平化的 Provider 结构
 *
 * 性能优化：
 * 1. 移除了 AppBootstrapProvider - 其逻辑已迁移到 main.tsx 的 bootstrap() 函数
 * 2. 移除了 DeferredProviders - 所有 Provider 同步初始化，减少嵌套层级
 * 3. 数据 hydrate 已在 React 挂载前完成，组件首次渲染时数据已就绪
 *
 * 原有的 11 层嵌套减少到 7 层，减少了 Context 初始化成本和重复渲染。
 */
export function RootProviders({ children }: PropsWithChildren) {
  return (
    <I18nProvider>
      <QueryProvider>
        <OverlayStackProvider>
          <AppCommandProvider>
            <GlobalShortcutsProvider>
              <QueryVisibilityRefreshProvider>
                <SettingSyncProvider>
                  <UpdateCheckProvider>
                    <PerformanceMetricsProvider />
                  </UpdateCheckProvider>
                </SettingSyncProvider>
              </QueryVisibilityRefreshProvider>
              {children}
            </GlobalShortcutsProvider>
          </AppCommandProvider>
        </OverlayStackProvider>
      </QueryProvider>
    </I18nProvider>
  )
}
