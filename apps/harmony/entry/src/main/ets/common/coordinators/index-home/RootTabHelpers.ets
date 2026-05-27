import { RootTabId } from '../../navigation/AppRouter'

export const ROOT_TAB_SCROLL_TO_TOP_AT_KEY: string = 'rootTabScrollToTopAt'
export const ROOT_TAB_SCROLL_TO_TOP_TAB_KEY: string = 'rootTabScrollToTopTab'
export const ROOT_TAB_DOUBLE_TAP_WINDOW_MS: number = 360

export function emitRootTabScrollToTop(tabId: RootTabId): void {
  AppStorage.setOrCreate(ROOT_TAB_SCROLL_TO_TOP_TAB_KEY, tabId)
  AppStorage.setOrCreate(ROOT_TAB_SCROLL_TO_TOP_AT_KEY, Date.now())
}

export function scrollScrollerToTop(scroller: Scroller, label: string): void {
  try {
    scroller.scrollTo({
      xOffset: 0,
      yOffset: 0,
      animation: {
        duration: 260,
        curve: Curve.EaseOut,
      },
    })
  } catch (error) {
    console.error(`滚动到顶部失败：${label}，${error instanceof Error ? error.message : String(error)}`)
  }
}

export interface RootTabBottomBarContext {
  discoverHasForegroundOverlay: boolean
  subscriptionsOverlayLevel: number
  settingsOverlayLevel: number
}

export function shouldHideRootTitleBar(tabId: RootTabId, context: RootTabBottomBarContext): boolean {
  if (tabId === 'discover') {
    return context.discoverHasForegroundOverlay
  }
  if (tabId === 'subscriptions') {
    return context.subscriptionsOverlayLevel > 0
  }
  if (tabId === 'settings') {
    return context.settingsOverlayLevel > 0
  }
  return false
}

export function shouldHideRootBottomBar(tabId: RootTabId, context: RootTabBottomBarContext): boolean {
  if (tabId === 'discover') {
    return context.discoverHasForegroundOverlay
  }
  if (tabId === 'subscriptions') {
    return context.subscriptionsOverlayLevel > 0
  }
  if (tabId === 'settings') {
    return context.settingsOverlayLevel > 0
  }
  return false
}
