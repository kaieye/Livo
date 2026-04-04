import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('home mode rail is rendered inside scrollable home scenes instead of the fixed header', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  const homeRootPageStart = source.indexOf('private HomeRootPage() {')
  const buildStart = source.indexOf('build() {')
  const homeRootPage = source.slice(homeRootPageStart, buildStart)

  assert.notEqual(homeRootPageStart, -1)
  assert.notEqual(buildStart, -1)
  assert.doesNotMatch(homeRootPage, /PageHeader\([\s\S]*?ContentModeRail\(\{/)

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

  assert.match(entryList, /this\.HomeModeRail\(\)/)
  assert.match(pictureList, /this\.HomeModeRail\(\)/)
  assert.match(modeScene, /this\.HomeModeRail\(\)/)
})

test('home reuses a single full-width rail section wrapper across scene types', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  assert.match(
    source,
    /import \{[\s\S]*ROOT_MODE_RAIL_SPACER_EXTRA_HEIGHT[\s\S]*ROOT_MODE_RAIL_TOP_GAP[\s\S]*\} from '\.\.\/common\/components\/FloatingRootPageLayout'/,
  )

  assert.doesNotMatch(source, /RootModeRailSection\(\{/)
  assert.doesNotMatch(source, /private HomeModeRailSection\(\)/)
})

test('home uses one shared vertical gap value around the rail across list and grid scenes', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  assert.match(source, /const HOME_MODE_CONTENT_GAP: number = 12/)
  assert.match(source, /List\(\{ space: HOME_MODE_CONTENT_GAP \}\)/)
  const listGapUsageCount = (
    source.match(/List\(\{ space: HOME_MODE_CONTENT_GAP \}\)/g) ?? []
  ).length
  assert.equal(listGapUsageCount, 2)
  assert.match(source, /Column\(\{ space: HOME_MODE_CONTENT_GAP \}\)/)
  assert.doesNotMatch(source, /List\(\{ space: 10 \}\)/)
  assert.doesNotMatch(source, /List\(\{ space: 12 \}\)/)
})

test('home rail spacer uses a tighter extra height so the rail sits closer to the header', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  assert.match(
    source,
    /import \{[\s\S]*ROOT_MODE_RAIL_SPACER_EXTRA_HEIGHT[\s\S]*\} from '\.\.\/common\/components\/FloatingRootPageLayout'/,
  )
  assert.match(
    source,
    /FloatingRootPageSpacer\(\{\s*topAvoidArea: this\.topAvoidArea,\s*extraHeight: ROOT_MODE_RAIL_SPACER_EXTRA_HEIGHT,\s*\}\)/s,
  )
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
  assert.match(homeSource, /Column\(\{ space: ROOT_MODE_RAIL_TOP_GAP \}\)/)
  assert.match(
    subscriptionsSource,
    /Column\(\{ space: ROOT_MODE_RAIL_TOP_GAP \}\)/,
  )
})
