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
    /private shouldHideRootTitleBar\(\): boolean \{[\s\S]*this\.showSearch[\s\S]*this\.activeRootTabId === 'subscriptions'[\s\S]*this\.activeRootTabId === 'discover'[\s\S]*this\.activeRootTabId === 'settings'/s,
  )
  assert.match(
    indexSource,
    /private shouldHideBottomTabs\(\): boolean \{[\s\S]*this\.activeRootTabId === 'discover' && this\.discoverHasForegroundOverlay[\s\S]*this\.activeRootTabId === 'subscriptions' && this\.subscriptionsOverlayLevel > 0[\s\S]*this\.activeRootTabId === 'settings' && this\.settingsOverlayLevel > 0/s,
  )
  assert.match(
    indexSource,
    /\.titleBar\(\{[\s\S]*mainTitle:\s*this\.isHomeRootTab\(\) \|\| this\.isSettingsRootTab\(\) \? '' : this\.currentRootTitle\(\)/s,
  )
  assert.match(indexSource, /private HomeRootLowerTitleBuilder\(\)/)
  assert.match(indexSource, /private SettingsRootLowerTitleBuilder\(\)/)
  assert.match(
    indexSource,
    /private currentRootScrollEffectType\(\): ScrollEffectType/,
  )
  assert.match(indexSource, /ScrollEffectType\.IMMERSIVE_GRADIENT_BLUR/)
  assert.match(indexSource, /private isSettingsRootTab\(\): boolean/)
  assert.match(
    indexSource,
    /private currentRootBlurEffectiveEndOffset\(\): LengthMetrics/,
  )
  assert.match(
    indexSource,
    /scrollEffectType:\s*this\.currentRootScrollEffectType\(\)/,
  )
  assert.match(
    indexSource,
    /blurRadius:\s*this\.currentRootOriginalTitleBarBlurRadius\(\)/,
  )
  assert.match(
    indexSource,
    /maskExtraHeight:\s*this\.currentRootOriginalTitleBarMaskExtraHeight\(\)/,
  )
  assert.match(
    indexSource,
    /private currentRootOriginalTitleBarBackgroundColor\(\): ResourceColor/,
  )
  assert.match(
    indexSource,
    /private currentRootScrollEffectBackgroundColor\(\): ResourceColor/,
  )
  assert.match(
    indexSource,
    /private currentRootBlurStrategy\(\): BlurStrategy \| undefined/,
  )
  assert.match(indexSource, /SystemMaterialParams,/)
  assert.match(
    indexSource,
    /private currentRootSystemMaterialEffect\(\): SystemMaterialParams \| undefined/,
  )
  assert.match(
    indexSource,
    /private currentRootBindScrollers\(\): Scroller\[\]/,
  )
  assert.match(
    indexSource,
    /private handleSettingsContentScrollerReady\(scroller: Scroller\): void/,
  )
  assert.match(
    indexSource,
    /@State rootSettings: HarmonySettings = DEFAULT_HARMONY_SETTINGS/,
  )
  assert.match(
    indexSource,
    /const settings = await AppRepository\.settings\(\)[\s\S]*this\.rootSettings = settings[\s\S]*this\.theme = await ThemeService\.resolvePalette\(settings\)/,
  )
  assert.match(
    indexSource,
    /SettingsContent\(\{[\s\S]*inheritedSettings: this\.rootSettings[\s\S]*onSettingsChange: \(settings: HarmonySettings\) => \{\s*this\.rootSettings = settings/s,
  )
  assert.match(indexSource, /blurStrategy:\s*this\.currentRootBlurStrategy\(\)/)
  assert.match(
    indexSource,
    /\.bindToScrollable\(this\.currentRootBindScrollers\(\)\)/,
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
  assert.match(discoverSource, /HdsNavigation/)
  assert.match(discoverSource, /\.titleBar\(\{/)
  assert.match(
    discoverSource,
    /scrollEffectType:\s*ScrollEffectType\.IMMERSIVE_GRADIENT_BLUR/,
  )
  assert.match(discoverSource, /blurStrategy:\s*BlurStrategy\.ENABLE/)
  assert.match(
    discoverSource,
    /\.bindToScrollable\(\[this\.contentScroller\]\)/,
  )
  assert.match(discoverSource, /Navigation\(this\.discoverPathStack\)/)

  assert.match(
    subscriptionsSource,
    /private SubscriptionsRoot\(\) \{\s*Stack\(\{ alignContent: Alignment\.TopStart \}\)/s,
  )
  assert.doesNotMatch(subscriptionsSource, /FloatingRootPageLayout\(\{/)
  assert.doesNotMatch(subscriptionsSource, /private HeaderBlurOverlay\(\)/)
  assert.doesNotMatch(subscriptionsSource, /Text\('订阅库'\)/)
  assert.match(subscriptionsSource, /HdsNavigation/)
  assert.match(subscriptionsSource, /\.titleBar\(\{/)
  assert.match(
    subscriptionsSource,
    /scrollEffectType:\s*ScrollEffectType\.IMMERSIVE_GRADIENT_BLUR/,
  )
  assert.match(subscriptionsSource, /blurStrategy:\s*BlurStrategy\.ENABLE/)
  assert.match(
    subscriptionsSource,
    /\.bindToScrollable\(\[\s*this\.articlesScroller,\s*this\.socialScroller,\s*this\.picturesScroller,\s*this\.videosScroller,\s*\]\)/,
  )
  assert.match(subscriptionsSource, /Navigation\(this\.subscriptionPathStack\)/)

  assert.match(settingsSource, /private SettingsRootContent\(\)/)
  assert.match(settingsSource, /SETTINGS_TITLE_BAR_MINI_HEIGHT: number = 56/)
  assert.match(
    settingsSource,
    /SETTINGS_TITLE_BAR_BOTTOM_TITLE_HEIGHT: number = 36/,
  )
  assert.match(
    settingsSource,
    /SETTINGS_TITLE_BAR_OVERLAY_SPACER: number = SETTINGS_TITLE_BAR_MINI_HEIGHT \+ SETTINGS_TITLE_BAR_BOTTOM_TITLE_HEIGHT/,
  )
  assert.match(
    settingsSource,
    /private readonly contentScroller: Scroller = new Scroller\(\)/,
  )
  assert.match(
    settingsSource,
    /@Prop @Watch\('syncInheritedSettings'\) inheritedSettings: HarmonySettings = DEFAULT_HARMONY_SETTINGS/,
  )
  assert.match(
    settingsSource,
    /onContentScrollerReady: \(scroller: Scroller\) => void = \(\) => \{\}/,
  )
  assert.match(
    settingsSource,
    /aboutToAppear\(\): void \{\s*this\.onContentScrollerReady\(this\.contentScroller\)/s,
  )
  assert.match(
    settingsSource,
    /if \(!this\.showBottomTabs\) \{[\s\S]*this\.theme = this\.inheritedTheme[\s\S]*this\.config = this\.inheritedSettings[\s\S]*this\.hasLoaded = true[\s\S]*this\.onReady\(\)[\s\S]*return[\s\S]*\}\s*void this\.loadSettings\(\)/s,
  )
  assert.match(settingsSource, /private syncInheritedSettings\(\): void/)
  assert.match(settingsSource, /Scroll\(this\.contentScroller\)/)
  assert.match(
    settingsSource,
    /build\(\) \{\s*if \(this\.showBottomTabs\) \{\s*HdsNavigation\(\) \{\s*this\.SettingsRootContent\(\)/s,
  )
  assert.match(
    settingsSource,
    /else \{\s*HdsNavigation\(\) \{\s*this\.SettingsRootContent\(\)/s,
  )
  assert.match(
    settingsSource,
    /Blank\(\)\s*\.height\(SETTINGS_TITLE_BAR_OVERLAY_SPACER\)/s,
  )
  assert.doesNotMatch(settingsSource, /HEADER_OVERLAY_HEIGHT: number = 46/)
  assert.doesNotMatch(
    settingsSource,
    /@StorageProp\('topAvoidArea'\) topAvoidArea: number = 0/,
  )
  assert.doesNotMatch(settingsSource, /private headerOverlayHeight\(\): number/)
  assert.doesNotMatch(settingsSource, /private headerOverlayTint\(\): string/)
  assert.doesNotMatch(settingsSource, /private HeaderBlurOverlay\(\)/)
  assert.match(settingsSource, /private SettingsLowerTitleBuilder\(\)/)
  assert.match(settingsSource, /Text\('设置'\)/)
  assert.match(settingsSource, /\.fontSize\(28\)/)
  assert.match(settingsSource, /\.margin\(\{ top: -20 \}\)/)
  assert.doesNotMatch(
    settingsSource,
    /SymbolGlyph\(\$r\('sys\.symbol\.magnifyingglass'\)\)/,
  )
  assert.doesNotMatch(
    settingsSource,
    /\.justifyContent\(FlexAlign\.SpaceBetween\)/,
  )
  assert.doesNotMatch(
    settingsSource,
    /\.backgroundColor\(\$r\('sys\.color\.comp_background_tertiary'\)\)/,
  )
  assert.doesNotMatch(settingsSource, /openRootTab\('discover'\)/)
  assert.doesNotMatch(settingsSource, /\.backdropBlur\(24\)/)
  assert.doesNotMatch(settingsSource, /\.clip\(true\)/)
  assert.doesNotMatch(settingsSource, /\.hitTestBehavior\(HitTestMode\.None\)/)
  assert.match(settingsSource, /\.hideTitleBar\(true\)/)
  assert.match(
    settingsSource,
    /if \(this\.showBottomTabs && !this\.showSettingsSheet\) \{/,
  )
  assert.match(settingsSource, /\.titleBar\(\{/)
  assert.doesNotMatch(
    settingsSource,
    /menu:\s*this\.settingsNavigationMenu\(\)/,
  )
  assert.match(settingsSource, /blurStrategy:\s*BlurStrategy\.ENABLE/)
  assert.match(
    settingsSource,
    /\.bindToScrollable\(\[this\.contentScroller\]\)/,
  )
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
