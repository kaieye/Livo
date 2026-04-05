import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

test('subscriptions content leaves the root title bar responsible for the page title', () => {
  const source = read(
    '../entry/src/main/ets/common/components/SubscriptionsContent.ets',
  )

  assert.match(source, /const SUBSCRIPTIONS_TITLE_BAR_MINI_HEIGHT: number = 56/)
  assert.match(
    source,
    /const SUBSCRIPTIONS_TITLE_BAR_BOTTOM_TITLE_HEIGHT: number = 36/,
  )
  assert.match(
    source,
    /const SUBSCRIPTIONS_TITLE_BAR_OVERLAY_SPACER: number =[\s\S]*SUBSCRIPTIONS_TITLE_BAR_MINI_HEIGHT \+ SUBSCRIPTIONS_TITLE_BAR_BOTTOM_TITLE_HEIGHT/,
  )
  assert.doesNotMatch(
    source,
    /const SUBSCRIPTIONS_TITLE_BAR_OVERLAY_SPACER: number = PAGE_TOP_PADDING/,
  )
  assert.match(
    source,
    /Blank\(\)\s*\.height\(SUBSCRIPTIONS_TITLE_BAR_OVERLAY_SPACER\)/s,
  )
  assert.doesNotMatch(
    source,
    /private static readonly HEADER_OVERLAY_HEIGHT: number = 46/,
  )
  assert.doesNotMatch(source, /private headerOverlayHeight\(\): number/)
  assert.doesNotMatch(source, /private headerOverlayTint\(\): string/)
  assert.doesNotMatch(source, /private HeaderBlurOverlay\(\)/)
  assert.doesNotMatch(source, /Text\('订阅库'\)/)
  assert.doesNotMatch(source, /\.backdropBlur\(24\)/)
  assert.doesNotMatch(source, /this\.HeaderBlurOverlay\(\)/)
  assert.doesNotMatch(source, /\.hitTestBehavior\(HitTestMode\.None\)/)
  assert.match(
    source,
    /private readonly articlesScroller: Scroller = new Scroller\(\)/,
  )
  assert.match(
    source,
    /private readonly socialScroller: Scroller = new Scroller\(\)/,
  )
  assert.match(
    source,
    /private readonly picturesScroller: Scroller = new Scroller\(\)/,
  )
  assert.match(
    source,
    /private readonly videosScroller: Scroller = new Scroller\(\)/,
  )
  assert.match(source, /\.titleBar\(\{/)
  assert.match(source, /ScrollEffectType\.IMMERSIVE_GRADIENT_BLUR/)
  assert.match(source, /blurStrategy:\s*BlurStrategy\.ENABLE/)
  assert.match(source, /\.hideTitleBar\(this\.overlayLevel > 0\)/)
  assert.match(
    source,
    /\.bindToScrollable\(\[\s*this\.articlesScroller,\s*this\.socialScroller,\s*this\.picturesScroller,\s*this\.videosScroller,\s*\]\)/,
  )
})
