import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('home mode rail is rendered inside each scroll scene instead of a fixed root overlay', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  const homeRootPageStart = source.indexOf('private HomeRootPage() {')
  const buildStart = source.indexOf('build() {')
  const homeRootPage = source.slice(homeRootPageStart, buildStart)

  assert.notEqual(homeRootPageStart, -1)
  assert.notEqual(buildStart, -1)
  assert.doesNotMatch(homeRootPage, /this\.HomeFixedModeRail\(\)/)
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

  assert.match(entryList, /this\.HomeModeHeaderSection\(\)/)
  assert.match(pictureList, /this\.HomeModeHeaderSection\(\)/)
  assert.match(modeScene, /this\.HomeModeHeaderSection\(\)/)
})

test('home no longer keeps a dedicated fixed rail wrapper once the rail moves into content scenes', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  assert.match(
    source,
    /import \{[\s\S]*ROOT_MODE_RAIL_TOP_GAP[\s\S]*\} from '\.\.\/common\/components\/FloatingRootPageLayout'/,
  )
  assert.doesNotMatch(source, /RootModeRailSection\(\{/)
  assert.match(source, /private HomeModeHeaderSection\(\)/)
  assert.doesNotMatch(source, /private HomeFixedModeRail\(\)/)
})

test('home uses one shared vertical gap value around the content area across list and grid scenes', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  assert.match(source, /const HOME_MODE_CONTENT_GAP: number = 14/)
  assert.match(
    source,
    /List\(\{ space: HOME_MODE_CONTENT_GAP, scroller: this\.homeScrollerForMode\(mode\) \}\)/,
  )
  const listGapUsageCount = (
    source.match(
      /List\(\{ space: HOME_MODE_CONTENT_GAP, scroller: this\.homeScrollerForMode\(mode\) \}\)/g,
    ) ?? []
  ).length
  assert.equal(listGapUsageCount, 1)
  assert.match(
    source,
    /List\(\{ space: HOME_MODE_CONTENT_GAP, scroller: this\.picturesScroller \}\)/,
  )
  assert.match(source, /Column\(\{ space: HOME_MODE_CONTENT_GAP \}\)/)
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
  assert.match(
    source,
    /Blank\(\)\s*\.height\(HOME_MODE_CONTENT_TOP_SPACER_HEIGHT\)/s,
  )
  assert.match(source, /private HomeModeHeaderSection\(\)/)
  assert.doesNotMatch(source, /private HomeFixedModeRail\(\)/)
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
  assert.match(homeSource, /this\.HomeModeRail\(\)/)
  assert.match(
    subscriptionsSource,
    /Column\(\{ space: ROOT_MODE_RAIL_TOP_GAP \}\)/,
  )
})
