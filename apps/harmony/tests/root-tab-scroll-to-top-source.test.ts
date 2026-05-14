import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const rootShellSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/IndexRootNavigationShell.ets',
    import.meta.url,
  ),
  'utf8',
)
const rootCoordinatorSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/IndexRootTabCoordinator.ets',
    import.meta.url,
  ),
  'utf8',
)
const rootChromeSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/IndexRootChrome.ets',
    import.meta.url,
  ),
  'utf8',
)
const rootVisibilityPolicySource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/RootTabVisibilityPolicy.ets',
    import.meta.url,
  ),
  'utf8',
)
const indexSource = readFileSync(
  new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
  'utf8',
)
const homeOverlayLayerSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/IndexHomeOverlayLayer.ets',
    import.meta.url,
  ),
  'utf8',
)
const subscriptionsSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/SubscriptionsContent.ets',
    import.meta.url,
  ),
  'utf8',
)
const subscriptionsFeedListSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/SubscriptionsFeedListSection.ets',
    import.meta.url,
  ),
  'utf8',
)
const discoverSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/DiscoverContent.ets',
    import.meta.url,
  ),
  'utf8',
)
const settingsSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/SettingsContent.ets',
    import.meta.url,
  ),
  'utf8',
)
const homeModeEntriesSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/HomeModeEntriesPage.ets',
    import.meta.url,
  ),
  'utf8',
)
const homeOverlayControlsSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/HomeRootOverlayControls.ets',
    import.meta.url,
  ),
  'utf8',
)

test('root hds tab bar reports clicks for double-tap detection', () => {
  assert.match(
    rootShellSource,
    /onRootTabBarClick: \(index: number\) => void = \(\) => \{\}/,
  )
  assert.match(
    rootShellSource,
    /\.onTabBarClick\(\(index: number\) => \{\s*this\.onRootTabBarClick\(index\)\s*\}\)/s,
  )
  assert.match(
    indexSource,
    /onRootTabBarClick: \(index: number\) => this\.rootTabCoordinator\.handleRootTabBarClick\(index\)/,
  )
})

test('root tab title bar stays visible for top-level non-home tabs', () => {
  assert.match(rootChromeSource, /case 'subscriptions':\s*return '订阅'/)
  assert.match(rootChromeSource, /case 'discover':\s*return '发现'/)
  assert.match(rootChromeSource, /case 'settings':\s*return '设置'/)
  assert.match(
    rootVisibilityPolicySource,
    /shouldHideRootTitleBar\(tabId: RootTabId, context: RootTabBottomBarContext\): boolean/,
  )
  assert.match(
    rootVisibilityPolicySource,
    /if \(tabId === 'subscriptions'\) \{\s*return context\.subscriptionsOverlayLevel > 0\s*\}/s,
  )
  assert.match(
    rootVisibilityPolicySource,
    /if \(tabId === 'discover'\) \{\s*return context\.discoverHasForegroundOverlay\s*\}/s,
  )
  assert.match(
    rootVisibilityPolicySource,
    /if \(tabId === 'settings'\) \{\s*return context\.settingsOverlayLevel > 0\s*\}/s,
  )
  assert.match(
    rootShellSource,
    /mainTitle:\s*this\.isHomeRootTab\s*\?\s*'首页'\s*:\s*this\.currentRootTitle/,
  )
  assert.doesNotMatch(
    rootShellSource,
    /bottomBuilder:\s*this\.isSettingsRootTab/,
  )
})

test('subscriptions root uses the same mode rail component as home', () => {
  assert.match(
    subscriptionsFeedListSource,
    /import \{ HomeRootOverlayControls \} from '\.\/HomeRootOverlayControls'/,
  )
  assert.match(
    subscriptionsFeedListSource,
    /HomeRootOverlayControls\(\{\s*theme:\s*this\.theme,\s*mode:\s*this\.activeMode,/s,
  )
  assert.match(subscriptionsFeedListSource, /barBottomMargin:\s*0/)
  assert.match(subscriptionsFeedListSource, /\.height\(HOME_MODE_RAIL_HEIGHT\)/)
})

test('root tab coordinator emits scroll-to-top only after a repeated tab click', () => {
  assert.match(rootCoordinatorSource, /ROOT_TAB_DOUBLE_TAP_WINDOW_MS/)
  assert.match(
    rootCoordinatorSource,
    /private lastTabBarClickId: RootTabId \| '' = ''/,
  )
  assert.match(
    rootCoordinatorSource,
    /handleRootTabBarClick\(index: number\): void \{/,
  )
  assert.match(
    rootCoordinatorSource,
    /this\.owner\.scrollRootTabToTop\(tabId\)/,
  )
})

test('each root tab owns its own top scroll target', () => {
  assert.match(indexSource, /scrollRootTabToTop\(tabId: RootTabId\): void \{/)
  assert.match(
    indexSource,
    /scrollScrollerToTop\(this\.homeScrollerForMode\(this\.mode\), '首页'\)/,
  )
  assert.match(indexSource, /emitRootTabScrollToTop\(tabId\)/)
  assert.match(
    subscriptionsSource,
    /handleRootTabScrollToTopSignal\(\): void \{/,
  )
  assert.match(
    subscriptionsSource,
    /scrollScrollerToTop\(this\.activeModeScroller\(\), '订阅'\)/,
  )
  assert.match(
    discoverSource,
    /scrollScrollerToTop\(this\.contentScroller, '发现'\)/,
  )
  assert.match(
    settingsSource,
    /scrollScrollerToTop\(this\.contentScroller, '设置'\)/,
  )
})

test('root home title bar keeps gradient blur over top content', () => {
  assert.match(
    rootShellSource,
    /@State private homeTitleBarMaterialLevel: hdsMaterial\.MaterialLevel = hdsMaterial\.MaterialLevel\.EXQUISITE/,
  )
  assert.match(
    rootShellSource,
    /this\.homeTitleBarMaterialLevel = hdsMaterial\.MaterialLevel\.SMOOTH/,
  )
  assert.match(
    rootShellSource,
    /private HomeTitleBarMaterialEffect\(\): SystemMaterialParams \{/,
  )
  assert.match(rootShellSource, /enableScrollEffect:\s*!this\.isHomeRootTab/)
  assert.match(
    rootShellSource,
    /scrollEffectType:\s*this\.isHomeRootTab\s*\?\s*ScrollEffectType\.GRADIENT_BLUR\s*:\s*this\.scrollEffectType/,
  )
  assert.match(rootShellSource, /avoidLayoutSafeArea:\s*true/)
  assert.match(rootShellSource, /enableComponentSafeArea:\s*false/)
  assert.match(
    rootShellSource,
    /systemMaterialEffect:\s*this\.isHomeRootTab\s*\?\s*this\.HomeTitleBarMaterialEffect\(\)\s*:\s*this\.systemMaterialEffect/,
  )
  assert.match(
    rootShellSource,
    /\.ignoreLayoutSafeArea\(\s*\[LayoutSafeAreaType\.SYSTEM\],\s*\[LayoutSafeAreaEdge\.TOP,\s*LayoutSafeAreaEdge\.BOTTOM\]\s*\)/s,
  )
  assert.match(
    homeModeEntriesSource,
    /\.clipContent\(ContentClipMode\.SAFE_AREA\)/,
  )
})

test('home title actions keep stable menu config and are not blocked by overlay chrome', () => {
  assert.match(
    rootShellSource,
    /private homeTitleMenus: HdsNavigationMenuContentOptions = \{/,
  )
  assert.match(
    rootShellSource,
    /menu:\s*this\.isHomeRootTab[\s\S]*\?\s*this\.homeTitleMenus/,
  )
  assert.match(rootShellSource, /this\.onHomeRefresh\(\)/)
  assert.match(rootShellSource, /this\.onHomeSearchOpen\(\)/)
  assert.match(
    homeOverlayLayerSource,
    /\.hitTestBehavior\(HitTestMode\.Transparent\)/,
  )
  assert.match(homeOverlayLayerSource, /\.hitTestBehavior\(HitTestMode\.None\)/)
})

test('home refresh title action gives immediate visible feedback', () => {
  assert.match(indexSource, /private handleHomeRefreshAction\(\): void \{/)
  assert.match(indexSource, /this\.showToast\('正在刷新订阅\.\.\.', 1200\)/)
  assert.match(
    indexSource,
    /onHomeRefresh: \(\) => this\.handleHomeRefreshAction\(\)/,
  )
  assert.match(homeOverlayLayerSource, /private RefreshStatusPill\(\)/)
  assert.match(
    homeOverlayLayerSource,
    /if \(this\.isRefreshing\) \{\s*this\.RefreshStatusPill\(\)\s*\}/s,
  )
})
