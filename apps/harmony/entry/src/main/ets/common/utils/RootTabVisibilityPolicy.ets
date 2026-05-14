import { RootTabId } from '../navigation/AppRouter'

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
