import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

test('floating root pages share a common floating header shell', () => {
  const layoutSource = read(
    '../entry/src/main/ets/common/components/FloatingRootPageLayout.ets',
  )
  const indexSource = read('../entry/src/main/ets/pages/Index.ets')
  const discoverSource = read(
    '../entry/src/main/ets/common/components/DiscoverContent.ets',
  )
  const subscriptionsSource = read(
    '../entry/src/main/ets/common/components/SubscriptionsContent.ets',
  )
  const settingsSource = read(
    '../entry/src/main/ets/common/components/SettingsContent.ets',
  )

  assert.match(layoutSource, /export struct FloatingRootPageLayout/)
  assert.match(layoutSource, /PageHeader\(\{/)
  assert.match(layoutSource, /@Prop scrollBlurProgress: number = 0/)
  assert.doesNotMatch(layoutSource, /\.backdropBlur\(/)
  assert.doesNotMatch(layoutSource, /resolvedHeaderBlurRadius\(\)/)
  assert.doesNotMatch(layoutSource, /topBlurStripHeight\(\)/)
  assert.doesNotMatch(
    layoutSource,
    /Stack\(\{ alignContent: Alignment\.TopStart \}\)/,
  )
  assert.match(layoutSource, /top: this\.topAvoidArea\b/)
  assert.doesNotMatch(
    layoutSource,
    /top: this\.topAvoidArea \+ PAGE_TOP_PADDING/,
  )
  assert.doesNotMatch(layoutSource, /@BuilderParam content:/)
  assert.match(layoutSource, /\.backgroundColor\(this\.theme\.background\)/)
  assert.match(
    indexSource,
    /private HomeRootPage\(\) \{\s*Stack\(\{ alignContent: Alignment\.TopStart \}\)/s,
  )
  assert.doesNotMatch(indexSource, /FloatingRootPageLayout\(\{/)
  assert.match(indexSource, /private currentRootTitle\(\): string/)
  assert.match(indexSource, /private shouldHideRootTitleBar\(\): boolean/)
  assert.match(
    indexSource,
    /\.titleBar\(\{[\s\S]*mainTitle:\s*this\.currentRootTitle\(\)/s,
  )
  assert.match(
    indexSource,
    /private currentRootScrollEffectType\(\): ScrollEffectType/,
  )
  assert.match(indexSource, /ScrollEffectType\.GRADIENT_BLUR/)
  assert.match(
    indexSource,
    /scrollEffectType:\s*this\.currentRootScrollEffectType\(\)/,
  )
  assert.match(
    indexSource,
    /blurRadius:\s*this\.currentRootTitleBarBlurRadius\(\)/,
  )
  assert.match(
    indexSource,
    /maskExtraHeight:\s*this\.currentRootTitleBarMaskExtraHeight\(\)/,
  )
  assert.match(
    indexSource,
    /private currentRootOriginalTitleBarBackgroundColor\(\): ResourceColor/,
  )
  assert.match(
    indexSource,
    /private currentRootScrollEffectBackgroundColor\(\): ResourceColor/,
  )
  assert.match(indexSource, /SystemMaterialParams,/)
  assert.match(
    indexSource,
    /private currentRootSystemMaterialEffect\(\): SystemMaterialParams \| undefined/,
  )
  assert.match(
    indexSource,
    /\.hideTitleBar\(this\.shouldHideRootTitleBar\(\)\)/,
  )
  assert.match(
    discoverSource,
    /private DiscoverRoot\(\) \{\s*Stack\(\{ alignContent: Alignment\.TopStart \}\)/s,
  )
  assert.doesNotMatch(discoverSource, /FloatingRootPageLayout\(\{/)
  assert.match(
    subscriptionsSource,
    /private SubscriptionsRoot\(\) \{\s*Stack\(\{ alignContent: Alignment\.TopStart \}\)/s,
  )
  assert.doesNotMatch(subscriptionsSource, /FloatingRootPageLayout\(\{/)
  assert.match(settingsSource, /build\(\) \{\s*HdsNavigation\(\)/s)
  assert.match(settingsSource, /SETTINGS_TITLE_BAR_OVERLAY_SPACER: number = 56/)
  assert.match(settingsSource, /HEADER_OVERLAY_HEIGHT: number = 56/)
  assert.match(
    settingsSource,
    /@StorageProp\('topAvoidArea'\) topAvoidArea: number = 0/,
  )
  assert.match(
    settingsSource,
    /private readonly contentScroller: Scroller = new Scroller\(\)/,
  )
  assert.match(settingsSource, /private headerOverlayHeight\(\): number/)
  assert.match(settingsSource, /private headerOverlayTint\(\): string/)
  assert.match(settingsSource, /private HeaderBlurOverlay\(\)/)
  assert.match(settingsSource, /Scroll\(this\.contentScroller\)/)
  assert.match(
    settingsSource,
    /Blank\(\)\s*\.height\(SETTINGS_TITLE_BAR_OVERLAY_SPACER\)/s,
  )
  assert.match(settingsSource, /Text\('设置'\)/)
  assert.match(settingsSource, /\.backdropBlur\(24\)/)
  assert.match(settingsSource, /\.clip\(true\)/)
  assert.match(settingsSource, /\.hitTestBehavior\(HitTestMode\.None\)/)
  assert.match(settingsSource, /\.hideTitleBar\(true\)/)
  assert.doesNotMatch(settingsSource, /titleBar\(\{/)
  assert.doesNotMatch(settingsSource, /FloatingRootPageLayout\(\{/)
  assert.doesNotMatch(settingsSource, /SettingsBlurHeader\(\)/)
})

test('settings content no longer renders PageHeader directly inside a list item', () => {
  const settingsSource = read(
    '../entry/src/main/ets/common/components/SettingsContent.ets',
  )

  assert.doesNotMatch(
    settingsSource,
    /ListItem\(\) \{\s*Column\(\) \{\s*PageHeader\(\{/s,
  )
})
