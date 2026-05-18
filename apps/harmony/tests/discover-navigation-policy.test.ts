import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DISCOVER_OVERLAY_LEVEL_BROWSE,
  DISCOVER_OVERLAY_LEVEL_DEEP,
  DISCOVER_OVERLAY_LEVEL_ROOT,
  resolveDiscoverOverlayLevelAfterDestinationDisappear,
  resolveDiscoverOverlayReturnLevel,
  shouldApplyDiscoverOverlayAfterDestinationAppear,
  shouldSkipDiscoverOverlayRestoreAfterRootVisible,
  shouldShowDiscoverForegroundOverlay,
} from '../entry/src/main/ets/common/utils/discover/DiscoverNavigationPolicy.ts'

test('discover overlay return levels match root, browse and preview depth', () => {
  assert.equal(
    resolveDiscoverOverlayReturnLevel('root'),
    DISCOVER_OVERLAY_LEVEL_ROOT,
  )
  assert.equal(
    resolveDiscoverOverlayReturnLevel('browse'),
    DISCOVER_OVERLAY_LEVEL_BROWSE,
  )
  assert.equal(
    resolveDiscoverOverlayReturnLevel('preview'),
    DISCOVER_OVERLAY_LEVEL_DEEP,
  )
})

test('discover destination disappear restores root only when no deeper page is active', () => {
  assert.equal(
    resolveDiscoverOverlayLevelAfterDestinationDisappear(
      DISCOVER_OVERLAY_LEVEL_BROWSE,
      DISCOVER_OVERLAY_LEVEL_ROOT,
    ),
    DISCOVER_OVERLAY_LEVEL_ROOT,
  )
  assert.equal(
    resolveDiscoverOverlayLevelAfterDestinationDisappear(
      DISCOVER_OVERLAY_LEVEL_DEEP,
      DISCOVER_OVERLAY_LEVEL_ROOT,
    ),
    DISCOVER_OVERLAY_LEVEL_DEEP,
  )
})

test('discover foreground overlay is hidden only at root level', () => {
  assert.equal(
    shouldShowDiscoverForegroundOverlay(DISCOVER_OVERLAY_LEVEL_ROOT),
    false,
  )
  assert.equal(
    shouldShowDiscoverForegroundOverlay(DISCOVER_OVERLAY_LEVEL_BROWSE),
    true,
  )
  assert.equal(
    shouldShowDiscoverForegroundOverlay(DISCOVER_OVERLAY_LEVEL_DEEP),
    true,
  )
})

test('discover destination skips stale restore after root becomes visible again', () => {
  assert.equal(shouldSkipDiscoverOverlayRestoreAfterRootVisible(100, 0), false)
  assert.equal(shouldSkipDiscoverOverlayRestoreAfterRootVisible(100, 99), false)
  assert.equal(shouldSkipDiscoverOverlayRestoreAfterRootVisible(100, 100), true)
  assert.equal(shouldSkipDiscoverOverlayRestoreAfterRootVisible(100, 101), true)
})

test('discover destination appear does not re-open overlay after root is visible', () => {
  assert.equal(shouldApplyDiscoverOverlayAfterDestinationAppear(0), true)
  assert.equal(shouldApplyDiscoverOverlayAfterDestinationAppear(1), false)
})
