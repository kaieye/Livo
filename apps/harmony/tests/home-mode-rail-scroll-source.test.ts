import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('home mode rail is rendered in a fixed root overlay instead of inside each scroll scene', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  const homeRootPageStart = source.indexOf('private HomeRootPage() {')
  const buildStart = source.indexOf('build() {')
  const homeRootPage = source.slice(homeRootPageStart, buildStart)
  const buildBlock = source.slice(buildStart)

  assert.notEqual(homeRootPageStart, -1)
  assert.notEqual(buildStart, -1)
  assert.doesNotMatch(homeRootPage, /this\.HomeCollapsingModeRailLayer\(\)/)
  assert.match(
    buildBlock,
    /if \(this\.isHomeRootTab\(\)\) \{[\s\S]*this\.HomeCollapsingModeRailLayer\(\)/s,
  )
  assert.doesNotMatch(homeRootPage, /Refresh\(/)

  const entryListStart = source.indexOf(
    'private EntryList(mode: SubscriptionMode) {',
  )
  const pictureListStart = source.indexOf('private PictureEntryList() {')
  const modeSceneStart = source.indexOf(
    'private ModeEntriesScene(mode: SubscriptionMode) {',
  )
  const homeRootStart = source.indexOf('private HomeRootPage() {')

  const entryList = source.slice(entryListStart, pictureListStart)
  const pictureList = source.slice(pictureListStart, modeSceneStart)
  const modeScene = source.slice(modeSceneStart, homeRootStart)

  assert.doesNotMatch(entryList, /this\.HomeModeHeaderSection\(\)/)
  assert.doesNotMatch(pictureList, /this\.HomeModeHeaderSection\(\)/)
  assert.doesNotMatch(modeScene, /this\.HomeModeHeaderSection\(\)/)
  assert.match(source, /private HomeRefreshGapSlot\(mode: SubscriptionMode\)/)
  assert.doesNotMatch(source, /private HomeRefreshIndicatorLayer\(\)/)
  assert.doesNotMatch(source, /builder: this\.HomeRefreshIndicatorLayer\(\)/)
  assert.match(source, /LoadingProgress\(\)/)
  assert.doesNotMatch(
    modeScene,
    /Refresh\(\{ refreshing: \$\$this\.isRefreshing \}\)/,
  )
  assert.match(modeScene, /\.onWillScroll\(/)
  assert.match(modeScene, /\.onDidStopDragging\(/)
  assert.doesNotMatch(entryList, /this\.HomeModeRail\(\)/)
  assert.doesNotMatch(pictureList, /this\.HomeModeRail\(\)/)
  assert.doesNotMatch(modeScene, /this\.HomeModeRail\(\)/)
})

test('home keeps a dedicated fixed rail wrapper once the rail moves out of content scenes', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  assert.match(
    source,
    /import \{[\s\S]*ROOT_MODE_RAIL_TOP_GAP[\s\S]*\} from '\.\.\/common\/components\/FloatingRootPageLayout'/,
  )
  assert.doesNotMatch(source, /RootModeRailSection\(\{/)
  assert.doesNotMatch(source, /private HomeModeHeaderSection\(\)/)
  assert.match(source, /private HomeCollapsingModeRailLayer\(\)/)
})

test('home no longer ships debug boundary lines for the rail top and first card top', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  assert.doesNotMatch(source, /private homeFirstCardTopBoundary\(\): number \{/)
  assert.doesNotMatch(
    source,
    /return Math\.max\(0, HOME_MODE_HEADER_SPACER_HEIGHT - this\.currentHomeModeScrollOffset\)/,
  )
  assert.doesNotMatch(source, /private HomeModeRailDebugBoundaryLayer\(\)/)
  assert.doesNotMatch(source, /const HOME_MODE_HEADER_SPACER_HEIGHT: number =/)
  assert.doesNotMatch(
    source,
    /private homeRefreshTopSpacerHeight\(\): number \{/,
  )
  assert.doesNotMatch(source, /Math\.pow\(scrollProgress, 0\.42\)/)
  assert.doesNotMatch(
    source,
    /Blank\(\)\s*\.height\(this\.homeRefreshTopSpacerHeight\(\)\)/s,
  )
  assert.doesNotMatch(source, /private HomeModeHeaderSection\(\)/)
  const listGapUsageCount = (
    source.match(
      /List\(\{ space: HOME_MODE_CONTENT_GAP, scroller: this\.homeScrollerForMode\(mode\) \}\)/g,
    ) ?? []
  ).length
  assert.equal(listGapUsageCount, 1)
  assert.match(
    source,
    /ListItem\(\)\s*\{[\s\S]{0,220}Blank\(\)\s*\.height\(HOME_MODE_SCENE_TOP_INSET\)/s,
  )
  assert.match(
    source,
    /List\(\{ space: HOME_MODE_CONTENT_GAP, scroller: this\.picturesScroller \}\)/,
  )
  assert.match(source, /Column\(\{ space: HOME_MODE_CONTENT_GAP \}\)/)
  assert.match(source, /Blank\(\)\s*\.height\(HOME_MODE_SCENE_TOP_INSET\)/s)
  assert.doesNotMatch(
    source,
    /Row\(\) \{\s*Blank\(\)\s*\.height\(HOME_MODE_SCENE_TOP_INSET\)/s,
  )
  assert.doesNotMatch(
    source,
    /\.translate\(\{ y: this\.homeModeSceneSpacerTranslateY\(mode\) \}\)/,
  )
  assert.doesNotMatch(source, /List\(\{ space: 10 \}\)/)
  assert.doesNotMatch(source, /List\(\{ space: 12 \}\)/)
})

test('home header section now includes the immersive title bar overlay before content starts', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  assert.match(source, /const ROOT_TITLE_BAR_MINI_HEIGHT: number = 56/)
  assert.match(
    source,
    /const HOME_ROOT_TITLE_BAR_BOTTOM_TITLE_HEIGHT: number = ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT/,
  )
  assert.match(
    source,
    /const HOME_TITLE_BAR_OVERLAY_SPACER: number =[\s\S]*ROOT_TITLE_BAR_MINI_HEIGHT \+ HOME_ROOT_TITLE_BAR_BOTTOM_TITLE_HEIGHT \+ ROOT_PAGE_MODE_TOP_OFFSET/,
  )
  assert.match(
    source,
    /const HOME_MODE_CONTENT_TOP_SPACER_HEIGHT: number = HOME_TITLE_BAR_OVERLAY_SPACER/,
  )
  assert.match(source, /const HOME_MODE_RAIL_HEIGHT: number = 46/)
  assert.match(
    source,
    /const HOME_MODE_SCENE_TOP_INSET: number =[\s\S]*HOME_MODE_CONTENT_TOP_SPACER_HEIGHT \+ ROOT_MODE_RAIL_TOP_GAP \+ HOME_MODE_RAIL_HEIGHT/,
  )
  assert.doesNotMatch(
    source,
    /private homeModeSceneSpacerTranslateY\(mode: SubscriptionMode\): number \{/,
  )
  assert.doesNotMatch(source, /const HOME_MODE_HEADER_SPACER_HEIGHT: number =/)
  assert.doesNotMatch(
    source,
    /private homeRefreshTopSpacerHeight\(\): number \{/,
  )
  assert.doesNotMatch(source, /Math\.pow\(scrollProgress, 0\.42\)/)
  assert.doesNotMatch(
    source,
    /Blank\(\)\s*\.height\(this\.homeRefreshTopSpacerHeight\(\)\)/s,
  )
  assert.doesNotMatch(source, /private HomeModeHeaderSection\(\)/)
  assert.match(source, /Blank\(\)\s*\.height\(HOME_MODE_SCENE_TOP_INSET\)/s)
  assert.doesNotMatch(
    source,
    /Row\(\) \{\s*Blank\(\)\s*\.height\(HOME_MODE_SCENE_TOP_INSET\)/s,
  )
  assert.doesNotMatch(
    source,
    /\.translate\(\{ y: this\.homeModeSceneSpacerTranslateY\(mode\) \}\)/,
  )
  assert.doesNotMatch(
    source,
    /\.padding\(\{ top: HOME_MODE_SCENE_TOP_INSET \}\)/,
  )
  assert.doesNotMatch(source, /\.backgroundColor\('\#00000000'\)/)
  assert.match(source, /private HomeCollapsingModeRailLayer\(\)/)
})

test('home refresh indicator is visually anchored below the spacer while keeping list content in place', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  assert.doesNotMatch(source, /const HOME_REFRESH_ANCHOR_OFFSET: number =/)
  assert.doesNotMatch(
    source,
    /const HOME_REFRESH_CONTENT_COMPENSATION_OFFSET: number =/,
  )
  assert.doesNotMatch(
    source,
    /\.translate\(\{ y: HOME_REFRESH_ANCHOR_OFFSET \}\)/,
  )
  assert.doesNotMatch(
    source,
    /\.translate\(\{ y: HOME_REFRESH_CONTENT_COMPENSATION_OFFSET \}\)/,
  )
  assert.match(source, /const HOME_REFRESH_PULL_DISTANCE: number = 60/)
  assert.match(source, /const HOME_REFRESH_FOLLOW_RATIO: number = 0\.72/)
  assert.match(source, /const HOME_REFRESH_CONTENT_HOLD_DISTANCE: number = 36/)
  assert.match(
    source,
    /const HOME_REFRESH_INDICATOR_VISUAL_OFFSET: number = 32/,
  )
  assert.match(source, /const HOME_REFRESH_GAP_OPEN_PULL_DISTANCE: number = 28/)
  assert.match(
    source,
    /const HOME_REFRESH_INDICATOR_RESTING_TRANSLATE_Y: number = 12/,
  )
  assert.match(source, /const HOME_REFRESH_RESET_DURATION: number = 220/)
  assert.match(source, /const HOME_REFRESH_DISMISS_SCROLL_OFFSET: number = 18/)
  assert.match(source, /@State homeRefreshIndicatorOffset: number = 0/)
  assert.match(
    source,
    /@State homeRefreshStatus: RefreshStatus = RefreshStatus\.Inactive/,
  )
  assert.match(source, /@State homeRefreshPullDistance: number = 0/)
  assert.match(source, /@State homeRefreshContentHoldOffset: number = 0/)
  assert.match(source, /@State homeRefreshIndicatorDismissed: boolean = false/)
  assert.doesNotMatch(source, /new ScrollResult\(\)/)
  assert.doesNotMatch(source, /: ScrollResult/)
  assert.doesNotMatch(source, /: OffsetResult/)
  assert.doesNotMatch(source, /return \{\s*offsetRemain: 0,\s*\}/s)
  assert.doesNotMatch(source, /class HomePullConsumedScroll \{/)
  assert.doesNotMatch(source, /class HomePullConsumedOffset \{/)
  assert.doesNotMatch(
    source,
    /private consumedHomePullScrollResult\(\): HomePullConsumedScroll/,
  )
  assert.doesNotMatch(source, /new HomePullConsumedScroll\(\)/)
  assert.doesNotMatch(
    source,
    /private consumedHomePullOffsetResult\(\): HomePullConsumedOffset/,
  )
  assert.doesNotMatch(source, /new HomePullConsumedOffset\(\)/)
  assert.match(
    source,
    /private consumeHomePullScroll\(mode: SubscriptionMode, scrollOffset: number\)/,
  )
  assert.match(
    source,
    /const isAtTop = this\.homeModeScrollOffsetFor\(mode\) <= 0\.5/,
  )
  assert.doesNotMatch(
    source,
    /const isAtTop = this\.readHomeModeScrollOffset\(mode\) <= 0\.5/,
  )
  assert.doesNotMatch(
    source,
    /if \(scrollOffset > 0\.5\) \{\s*this\.dismissHomeRefreshIndicatorDuringRefresh\(\)\s*\}/s,
  )
  assert.match(
    source,
    /if \(this\.homeRefreshIndicatorDismissed\) \{\s*this\.homeRefreshIndicatorDismissed = false\s*\}/s,
  )
  assert.doesNotMatch(source, /return this\.consumedHomePullScrollResult\(\)/)
  assert.doesNotMatch(source, /return this\.consumedHomePullOffsetResult\(\)/)
  assert.match(source, /private finalizeHomePullRefresh\(\): void/)
  assert.match(
    source,
    /if \(this\.isRefreshing\) \{\s*if \(this\.homeRefreshIndicatorDismissed\) \{\s*this\.homeRefreshIndicatorOffset = 0\s*\}\s*return\s*\}/s,
  )
  assert.match(
    source,
    /private dismissHomeRefreshIndicatorDuringRefresh\(\): void/,
  )
  assert.match(source, /private reopenHomeRefreshGapDuringRefresh\(\): void/)
  assert.match(source, /private animateHomePullRefreshReset\(\): void/)
  assert.match(source, /private resetHomePullRefreshState\(\): void/)
  assert.match(source, /this\.animateHomePullRefreshReset\(\)/)
  assert.match(source, /this\.dismissHomeRefreshIndicatorDuringRefresh\(\)/)
  assert.match(source, /this\.reopenHomeRefreshGapDuringRefresh\(\)/)
  assert.match(source, /setTimeout\(\(\) => \{/)
  assert.match(
    source,
    /this\.homeRefreshContentHoldOffset = HOME_REFRESH_CONTENT_HOLD_DISTANCE/,
  )
  assert.match(source, /this\.homeRefreshContentHoldOffset = 0/)
  assert.match(source, /this\.homeRefreshIndicatorDismissed = true/)
  assert.match(source, /this\.homeRefreshIndicatorDismissed = false/)
  assert.match(
    source,
    /private shouldShowHomeRefreshGap\(mode: SubscriptionMode\): boolean \{/,
  )
  assert.match(
    source,
    /private shouldShowHomeRefreshIndicator\(mode: SubscriptionMode\): boolean \{/,
  )
  assert.match(
    source,
    /private homeRefreshGapHeight\(mode: SubscriptionMode\): number \{/,
  )
  assert.match(source, /private HomeRefreshGapSlot\(mode: SubscriptionMode\)/)
  assert.doesNotMatch(source, /private HomeRefreshIndicatorLayer\(\)/)
  assert.doesNotMatch(
    source,
    /private homeRefreshContentTranslateY\(mode: SubscriptionMode\): number \{/,
  )
  assert.doesNotMatch(
    source,
    /private homeRefreshIndicatorTopMargin\(\): number \{/,
  )
  assert.match(source, /\.width\('100%'\)/)
  assert.match(source, /\.justifyContent\(FlexAlign\.Center\)/)
  assert.match(source, /\.alignItems\(HorizontalAlign\.Center\)/)
  assert.match(source, /\.height\(this\.homeRefreshGapHeight\(mode\)\)/)
  assert.match(
    source,
    /const dragGapHeight = Math\.max\(0, this\.homeRefreshIndicatorOffset - HOME_REFRESH_GAP_OPEN_PULL_DISTANCE\) \* HOME_REFRESH_FOLLOW_RATIO/,
  )
  assert.match(source, /return HOME_REFRESH_INDICATOR_RESTING_TRANSLATE_Y/)
  assert.match(
    source,
    /return HOME_REFRESH_INDICATOR_RESTING_TRANSLATE_Y \+ \(1 - this\.homeRefreshIndicatorProgress\(\)\) \* 12/,
  )
  assert.match(
    source,
    /\.onWillScroll\(\(scrollOffset: number,[\s\S]*?this\.consumeHomePullScroll\(mode, scrollOffset\)/s,
  )
  assert.match(
    source,
    /\.onDidStopDragging\(\(_willFling: boolean\) => \{\s*this\.finalizeHomePullRefresh\(\)\s*\}\)/s,
  )
  assert.doesNotMatch(
    source,
    /if \(this\.isHomeRootTab\(\) && this\.shouldShowHomeRefreshIndicator\(\)\) \{[\s\S]*this\.HomeRefreshIndicatorLayer\(\)/s,
  )
  assert.doesNotMatch(
    source,
    /ListItem\(\) \{\s*this\.HomeRefreshGapSlot\(mode\)\s*\}\s*\.width\('100%'\)/s,
  )
  assert.doesNotMatch(
    source,
    /ListItem\(\) \{\s*this\.HomeRefreshGapSlot\('pictures'\)\s*\}\s*\.width\('100%'\)/s,
  )
  assert.match(
    source,
    /ListItem\(\) \{\s*Column\(\) \{[\s\S]*?Blank\(\)[\s\S]*?this\.HomeRefreshGapSlot\(mode\)[\s\S]*?\}\s*\.width\('100%'\)\s*\}\s*\.width\('100%'\)/s,
  )
  assert.match(
    source,
    /ListItem\(\) \{\s*Column\(\) \{[\s\S]*?Blank\(\)[\s\S]*?this\.HomeRefreshGapSlot\('pictures'\)[\s\S]*?\}\s*\.width\('100%'\)\s*\}\s*\.width\('100%'\)/s,
  )
  assert.match(
    source,
    /Column\(\{ space: HOME_MODE_CONTENT_GAP \}\) \{[\s\S]*?Column\(\) \{[\s\S]*?Blank\(\)[\s\S]*?this\.HomeRefreshGapSlot\(mode\)[\s\S]*?\}\s*\.width\('100%'\)[\s\S]*?HomeVideoGrid\(/s,
  )
  assert.match(source, /if \(this\.shouldShowHomeRefreshIndicator\(mode\)\) \{/)
  assert.match(source, /\.translate\(\{ x: this\.modeSceneOffset\(mode\) \}\)/)
  assert.doesNotMatch(
    source,
    /\.translate\(\{ y: this\.homeRefreshContentTranslateY\(mode\) \}\)/,
  )
  assert.match(
    source,
    /if \(this\.isRefreshing && nextOffset > HOME_REFRESH_DISMISS_SCROLL_OFFSET\) \{\s*this\.dismissHomeRefreshIndicatorDuringRefresh\(\)\s*\}/s,
  )
  assert.doesNotMatch(
    source,
    /else if \(this\.isRefreshing && nextOffset <= 0\.5\) \{\s*this\.reopenHomeRefreshGapDuringRefresh\(\)\s*\}/s,
  )
  assert.match(
    source,
    /if \(scrollOffset < 0 && this\.homeModeScrollOffsetFor\(mode\) <= 0\.5\) \{[\s\S]*?this\.homeRefreshIndicatorOffset = Math\.max\([\s\S]*?HOME_REFRESH_MAX_PULL_DISTANCE[\s\S]*?\)[\s\S]*?if \(this\.homeRefreshIndicatorOffset >= HOME_REFRESH_GAP_OPEN_PULL_DISTANCE\) \{\s*this\.reopenHomeRefreshGapDuringRefresh\(\)\s*\}/s,
  )
  assert.match(source, /this\.resetHomePullRefreshState\(\)/)
})

test('home and subscriptions share the same rail top gap constant so the rail position stays aligned', () => {
  const homeSource = readFileSync(
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
  const layoutSource = readFileSync(
    new URL(
      '../entry/src/main/ets/common/components/FloatingRootPageLayout.ets',
      import.meta.url,
    ),
    'utf8',
  )

  assert.match(layoutSource, /export const ROOT_MODE_RAIL_TOP_GAP: number = 8/)
  assert.match(
    homeSource,
    /import \{[\s\S]*ROOT_MODE_RAIL_TOP_GAP[\s\S]*\} from '\.\.\/common\/components\/FloatingRootPageLayout'/,
  )
  assert.match(
    subscriptionsSource,
    /import \{[\s\S]*ROOT_MODE_RAIL_TOP_GAP[\s\S]*\} from '\.\/FloatingRootPageLayout'/,
  )
  assert.match(homeSource, /this\.HomeModeRail\(\{/)
  assert.match(
    subscriptionsSource,
    /Column\(\{ space: ROOT_MODE_RAIL_TOP_GAP \}\)/,
  )
  assert.match(homeSource, /private HomeCollapsingModeRailLayer\(\)/)
})
