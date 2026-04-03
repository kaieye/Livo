export interface HdsBottomTabItem {
  id: HdsBottomTabId
  label: string
}

export type HdsBottomTabId = 'home' | 'subscriptions' | 'discover' | 'settings'
export type HdsMaterialLevelName = 'ADAPTIVE'

const HDS_BOTTOM_TABS: HdsBottomTabItem[] = [
  { id: 'home', label: '首页' },
  { id: 'subscriptions', label: '订阅' },
  { id: 'discover', label: '发现' },
  { id: 'settings', label: '设置' },
]

export function resolveHdsBottomTabItems(): HdsBottomTabItem[] {
  return HDS_BOTTOM_TABS
}

export function rootTabIdToHdsIndex(tabId: HdsBottomTabId): number {
  const index = HDS_BOTTOM_TABS.findIndex((tab) => tab.id === tabId)
  return index >= 0 ? index : 0
}

export function hdsIndexToRootTabId(index: number): HdsBottomTabId {
  const item = HDS_BOTTOM_TABS[index]
  return item ? item.id : 'home'
}

export function resolveAdaptiveMaterialLevel(
  _supportedTypes: string[],
): HdsMaterialLevelName {
  return 'ADAPTIVE'
}

export function resolveHdsBottomTabBarBottomMargin(floatGap: number): number {
  return floatGap + 10
}
