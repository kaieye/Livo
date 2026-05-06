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
const indexSource = readFileSync(
  new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
  'utf8',
)
const subscriptionsSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/SubscriptionsContent.ets',
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
