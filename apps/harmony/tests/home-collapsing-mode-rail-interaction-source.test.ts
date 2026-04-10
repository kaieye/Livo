import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('collapsed home rail keeps the search button clear and expands before switching', () => {
  const indexSource = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )
  const railSource = readFileSync(
    new URL(
      '../entry/src/main/ets/common/components/ContentModeRail.ets',
      import.meta.url,
    ),
    'utf8',
  )

  assert.match(indexSource, /private homeModeRailRightInset\(\): number/)
  assert.match(indexSource, /HOME_COLLAPSED_MODE_RAIL_SIZE/)
  assert.match(indexSource, /ROOT_MODE_RAIL_TOP_GAP/)
  assert.match(
    indexSource,
    /const HOME_MODE_RAIL_COLLAPSE_OFFSET: number = ROOT_MODE_RAIL_TOP_GAP \+ HOME_MODE_RAIL_HEIGHT/,
  )
  assert.match(
    indexSource,
    /private homeFirstCardTopBoundary\(\): number \{\s*return HOME_MODE_SCENE_TOP_INSET - this\.currentHomeModeScrollOffset\s*\}[\s\S]*private homeModeRailTopBoundary\(\): number \{\s*return HOME_MODE_CONTENT_TOP_SPACER_HEIGHT\s*\}[\s\S]*private homeModeRailCollapseReady\(\): boolean \{\s*return this\.homeFirstCardTopBoundary\(\) <= this\.homeModeRailTopBoundary\(\)\s*\}[\s\S]*private homeModeRailCollapseProgress\(\): number \{[\s\S]*if \(this\.homeModeRailExpandedOverride\) \{\s*return 0\s*\}[\s\S]*if \(!this\.homeModeRailCollapseReady\(\)\) \{\s*return 0\s*\}[\s\S]*return this\.homeModeRailDismissedByScroll \? 1 : 0\s*\}/s,
  )
  assert.match(
    indexSource,
    /const HOME_MODE_RAIL_COLLAPSE_OFFSET: number = ROOT_MODE_RAIL_TOP_GAP \+ HOME_MODE_RAIL_HEIGHT/,
  )
  assert.match(
    indexSource,
    /if \(nextOffset < HOME_MODE_RAIL_COLLAPSE_OFFSET\) \{\s*this\.homeModeRailDismissedByScroll = false\s*\} else if \(!this\.homeModeRailExpandedOverride\) \{/s,
  )
  assert.match(
    indexSource,
    /\.onDidScroll\(\(_scrollOffset: number,[\s\S]*this\.syncHomeModeRailState\(mode\)/s,
  )
  assert.match(
    indexSource,
    /private handleModeSwipe\(event: GestureEvent\): void \{[\s\S]*const nextMode = this\.adjacentMode\(offsetX\)[\s\S]*if \(nextMode\) \{[\s\S]*this\.requestModeSwitch\(nextMode\)/s,
  )
  assert.match(
    indexSource,
    /private requestModeSwitch\(nextMode: SubscriptionMode\): void \{[\s\S]*this\.mode = nextMode[\s\S]*this\.visitedModes = rememberVisitedMode\(this\.visitedModes, nextMode\)[\s\S]*this\.homeModeRailExpandedOverride = false[\s\S]*this\.homeModeRailExpandedLockOffset = -1[\s\S]*const nextModeOffset = this\.homeModeScrollOffsetFor\(nextMode\)[\s\S]*this\.currentHomeModeScrollOffset = nextModeOffset[\s\S]*this\.homeModeRailDismissedByScroll = nextModeOffset > 0\.5[\s\S]*this\.updateHeaderBlurProgress\(nextModeOffset\)[\s\S]*this\.startModeTransition\(nextMode\)/s,
  )
  assert.match(
    indexSource,
    /private requestExpandedModeRail\(\): void \{[\s\S]*this\.homeModeRailExpandedLockOffset = this\.readHomeModeScrollOffset\(this\.mode\)[\s\S]*this\.homeModeRailExpandedOverride = true[\s\S]*this\.homeModeRailDismissedByScroll = false[\s\S]*this\.currentHomeModeScrollOffset = this\.homeModeRailExpandedLockOffset[\s\S]*this\.updateHeaderBlurProgress\(this\.homeModeRailExpandedLockOffset\)\s*\}/s,
  )
  assert.match(
    indexSource,
    /private isHomeModeRailCollapsed\(\): boolean \{\s*return this\.homeModeRailCollapseProgress\(\) >= 1\s*\}/s,
  )
  assert.match(indexSource, /private HomeCollapsedModeRailButton\(\)/)
  assert.match(indexSource, /private HomeSearchActionLayer\(\)/)
  assert.match(
    indexSource,
    /private HomeCollapsedModeRailButton\(\) \{[\s\S]*this\.HomeCollapsedModeRailIcon\(\)[\s\S]*\.onClick\(\(\) => \{[\s\S]*this\.requestExpandedModeRail\(\)[\s\S]*\}\)/s,
  )
  assert.match(
    indexSource,
    /private HomeCollapsedModeRailButton\(\) \{[\s\S]*homeCollapsedModeRailPressed[\s\S]*\.animation\(\{ duration: 140, curve: Curve\.EaseOut \}\)/s,
  )
  assert.match(
    indexSource,
    /this\.HomeModeRail\(\{[\s\S]*collapsed: false[\s\S]*collapseProgress: this\.homeModeRailCollapseProgress\(\)/s,
  )
  assert.match(indexSource, /private HomeCollapsedModeRailLayer\(\)/)
  assert.match(indexSource, /this\.HomeCollapsedModeRailButton\(\)/)
  assert.match(
    indexSource,
    /\.padding\(\{[\s\S]*top: this\.homeCollapsedModeRailTopPadding\(\),[\s\S]*left: PAGE_HORIZONTAL_PADDING,[\s\S]*right: this\.homeModeRailRightInset\(\),[\s\S]*\}/s,
  )
  assert.match(
    indexSource,
    /\.opacity\(this\.homeModeRailCollapseProgress\(\)\)/,
  )
  assert.match(indexSource, /\.enabled\(this\.isHomeModeRailCollapsed\(\)\)/)
  assert.match(indexSource, /\.zIndex\(132\)/)
  assert.match(
    indexSource,
    /private HomeCollapsedModeRailLayer\(\) \{[\s\S]*Row\(\{ space: HOME_INLINE_SEARCH_ACTION_GAP \}\) \{[\s\S]*this\.HomeCollapsedModeRailButton\(\)/s,
  )
  assert.match(
    indexSource,
    /private HomeSearchActionLayer\(\) \{[\s\S]*this\.HomeInlineSearchActionRow\(\)[\s\S]*right: PAGE_HORIZONTAL_PADDING[\s\S]*\.zIndex\(130\)/s,
  )
  assert.match(
    indexSource,
    /if \(options\.collapsed \?\? false\) \{[\s\S]*mode: 'articles'[\s\S]*mode: 'social'[\s\S]*mode: 'pictures'[\s\S]*mode: 'videos'[\s\S]*\} else \{[\s\S]*ContentModeRail\(\{[\s\S]*mode: this\.mode/s,
  )
  assert.match(railSource, /@Prop collapsed: boolean = false/)
  assert.match(
    railSource,
    /if \(this\.collapsed\) \{\s*this\.onExpandRequest\(\)\s*return\s*\}/s,
  )
})
