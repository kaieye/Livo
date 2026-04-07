import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('home page derives a collapsing mode rail progress and moves the collapsed rail toward the right edge', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  assert.match(source, /private homeModeRailCollapseProgress\(\): number/)
  assert.match(
    source,
    /const HOME_MODE_RAIL_COLLAPSE_OFFSET: number = ROOT_MODE_RAIL_TOP_GAP \+ HOME_MODE_RAIL_HEIGHT/,
  )
  assert.match(
    source,
    /interface HomeModeScrollOffsetMap \{\s*articles: number\s*social: number\s*pictures: number\s*videos: number\s*\}/s,
  )
  assert.match(
    source,
    /private readonly homeModeScrollOffsets: HomeModeScrollOffsetMap = \{\s*articles: 0,\s*social: 0,\s*pictures: 0,\s*videos: 0,\s*\}/s,
  )
  assert.match(source, /@State currentHomeModeScrollOffset: number = 0/)
  assert.match(source, /@State homeModeRailExpandedOverride: boolean = false/)
  assert.match(source, /@State homeModeRailExpandedLockOffset: number = -1/)
  assert.match(
    source,
    /private homeModeRailCollapseProgress\(\): number \{[\s\S]*if \(this\.homeModeRailExpandedOverride\) \{\s*return 0\s*\}[\s\S]*return this\.homeFirstCardTopBoundary\(\) <= HOME_MODE_CONTENT_TOP_SPACER_HEIGHT \? 1 : 0\s*\}/s,
  )
  assert.match(
    source,
    /private homeModeScrollOffsetFor\(mode: SubscriptionMode\): number/,
  )
  assert.match(
    source,
    /private homeModeScrollOffsetFor\(mode: SubscriptionMode\): number \{[\s\S]*case 'social':[\s\S]*this\.homeModeScrollOffsets\.social[\s\S]*case 'pictures':[\s\S]*this\.homeModeScrollOffsets\.pictures[\s\S]*case 'videos':[\s\S]*this\.homeModeScrollOffsets\.videos[\s\S]*this\.homeModeScrollOffsets\.articles[\s\S]*\}/s,
  )
  assert.match(
    source,
    /private updateHomeModeScrollOffset\(mode: SubscriptionMode, offset: number\): void/,
  )
  assert.match(
    source,
    /private updateHomeModeScrollOffset\(mode: SubscriptionMode, offset: number\): void \{[\s\S]*case 'social':[\s\S]*this\.homeModeScrollOffsets\.social = offset[\s\S]*case 'pictures':[\s\S]*this\.homeModeScrollOffsets\.pictures = offset[\s\S]*case 'videos':[\s\S]*this\.homeModeScrollOffsets\.videos = offset[\s\S]*this\.homeModeScrollOffsets\.articles = offset[\s\S]*\}/s,
  )
  assert.match(
    source,
    /private syncHomeModeRailState\(mode: SubscriptionMode = this\.mode\): void \{[\s\S]*const nextOffset = this\.readHomeModeScrollOffset\(mode\)[\s\S]*this\.updateHomeModeScrollOffset\(mode, nextOffset\)[\s\S]*if \(mode !== this\.mode\) \{\s*return\s*\}[\s\S]*if \(this\.homeModeRailExpandedOverride\) \{[\s\S]*Math\.abs\(nextOffset - this\.homeModeRailExpandedLockOffset\) < 0\.5[\s\S]*return[\s\S]*this\.homeModeRailExpandedOverride = false[\s\S]*this\.homeModeRailExpandedLockOffset = -1[\s\S]*\}[\s\S]*this\.currentHomeModeScrollOffset = nextOffset[\s\S]*this\.updateHeaderBlurProgress\(nextOffset\)\s*\}/s,
  )
  assert.match(
    source,
    /private readHomeModeScrollOffset\(mode: SubscriptionMode\): number/,
  )
  assert.match(
    source,
    /private readHomeModeScrollOffset\(mode: SubscriptionMode\): number \{[\s\S]*try \{[\s\S]*return Math\.max\(0, this\.homeScrollerForMode\(mode\)\.currentOffset\(\)\.yOffset\)[\s\S]*\} catch \(_\) \{[\s\S]*return this\.homeModeScrollOffsetFor\(mode\)[\s\S]*\}\s*\}/s,
  )
  assert.match(source, /private HomeCollapsingModeRailLayer\(\)/)
  assert.match(source, /private HomeCollapsedModeRailLayer\(\)/)
  assert.match(
    source,
    /private isHomeModeRailCollapsed\(\): boolean \{\s*return this\.homeModeRailCollapseProgress\(\) >= 1\s*\}/s,
  )
  assert.match(
    source,
    /private HomeCollapsingModeRailLayer\(\) \{[\s\S]*if \(!this\.isHomeModeRailCollapsed\(\)\) \{[\s\S]*this\.HomeModeRail\(\{[\s\S]*collapsed: false[\s\S]*collapseProgress: this\.homeModeRailCollapseProgress\(\)/s,
  )
  assert.match(
    source,
    /private HomeCollapsingModeRailLayer\(\) \{[\s\S]*align\(Alignment\.Top\)/s,
  )
  assert.match(
    source,
    /private homeCollapsedModeRailTopPadding\(\): number \{[\s\S]*this\.topAvoidArea[\s\S]*HOME_FLOATING_SEARCH_BUTTON_TOP_PADDING[\s\S]*ROOT_MODE_RAIL_TOP_GAP/s,
  )
  assert.match(
    source,
    /private homeCollapsedModeRailWidth\(\): number \{\s*return HOME_FLOATING_SEARCH_BUTTON_SIZE\s*\}/s,
  )
  assert.match(source, /private homeModeRailLeftPadding\(\): number/)
  assert.match(source, /private homeModeRailRightInset\(\): number/)
  assert.match(
    source,
    /private homeModeRailLeftPadding\(\): number \{\s*return PAGE_HORIZONTAL_PADDING\s*\}/s,
  )
  assert.match(
    source,
    /private homeModeRailRightInset\(\): number \{[\s\S]*if \(this\.homeModeRailCollapseProgress\(\) >= 1\) \{[\s\S]*PAGE_HORIZONTAL_PADDING \+ HOME_FLOATING_SEARCH_BUTTON_SIZE \+ ROOT_MODE_RAIL_TOP_GAP[\s\S]*\}[\s\S]*return PAGE_HORIZONTAL_PADDING\s*\}/s,
  )
  assert.match(
    source,
    /private HomeCollapsingModeRailLayer\(\) \{[\s\S]*collapsed: false[\s\S]*\.width\('100%'\)[\s\S]*justifyContent\(FlexAlign\.Start\)[\s\S]*alignItems\(HorizontalAlign\.Start\)[\s\S]*left: this\.homeModeRailLeftPadding\(\)[\s\S]*right: this\.homeModeRailRightInset\(\)/s,
  )
  assert.match(
    source,
    /private HomeCollapsedModeRailLayer\(\) \{[\s\S]*if \(this\.isHomeModeRailCollapsed\(\)\) \{[\s\S]*this\.HomeCollapsedModeRailButton\(\)[\s\S]*top: this\.homeCollapsedModeRailTopPadding\(\)[\s\S]*right: this\.homeModeRailRightInset\(\)[\s\S]*\.zIndex\(120\)/s,
  )
  assert.match(
    source,
    /private homeFirstCardTopBoundary\(\): number \{\s*return Math\.max\(0, HOME_MODE_HEADER_SPACER_HEIGHT - this\.currentHomeModeScrollOffset\)\s*\}/s,
  )
  assert.match(
    source,
    /build\(\) \{[\s\S]*if \(this\.isHomeRootTab\(\)\) \{[\s\S]*this\.HomeCollapsingModeRailLayer\(\)[\s\S]*if \(this\.isHomeRootTab\(\)\) \{[\s\S]*this\.HomeCollapsedModeRailLayer\(\)[\s\S]*if \(this\.isHomeRootTab\(\)\) \{[\s\S]*this\.HomeFloatingSearchButtonLayer\(\)/s,
  )
})
