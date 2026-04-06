import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('PageHeader circular trailing action uses immersive material styling', () => {
  const source = readFileSync(
    new URL(
      '../entry/src/main/ets/common/components/PageHeader.ets',
      import.meta.url,
    ),
    'utf8',
  )

  assert.match(source, /private trailingButtonBackgroundColor\(\): string/)
  assert.match(source, /private trailingButtonBorderColor\(\): string/)
  assert.match(source, /private trailingButtonShadow\(\): ShadowOptions/)
  assert.match(source, /private trailingButtonBackdropBlur\(\): number/)
  assert.match(
    source,
    /private trailingButtonBackgroundColor\(\): string \{[\s\S]*if \(this\.trailingButtonCircular\) \{\s*return this\.theme\.isDark \? 'rgba\(20,22,28,0\.72\)' : 'rgba\(255,255,255,0\.72\)'/s,
  )
  assert.match(
    source,
    /private trailingButtonBorderColor\(\): string \{\s*if \(this\.trailingButtonCircular\) \{\s*return this\.theme\.isDark \? 'rgba\(255,255,255,0\.12\)' : 'rgba\(255,255,255,0\.88\)'/s,
  )
  assert.match(
    source,
    /private trailingButtonShadow\(\): ShadowOptions \{\s*if \(this\.trailingButtonCircular\) \{\s*return \{\s*radius: 10,\s*color: this\.theme\.isDark \? 'rgba\(255,255,255,0\.10\)' : 'rgba\(15,23,42,0\.12\)',\s*offsetX: 0,\s*offsetY: 2,\s*\}/s,
  )
  assert.match(
    source,
    /private trailingButtonBackdropBlur\(\): number \{\s*if \(this\.trailingButtonCircular\) \{\s*return this\.theme\.isDark \? 10 : 18/s,
  )
  assert.match(
    source,
    /\.backgroundColor\(this\.trailingButtonBackgroundColor\(\)\)/,
  )
  assert.match(source, /\.backdropBlur\(this\.trailingButtonBackdropBlur\(\)\)/)
  assert.match(
    source,
    /\.border\(\{ width: 0\.8, color: this\.trailingButtonBorderColor\(\) \}\)/,
  )
  assert.match(source, /\.shadow\(this\.trailingButtonShadow\(\)\)/)
})

test('home page no longer injects a custom floating trailing builder for search', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  assert.doesNotMatch(
    source,
    /FloatingRootPageLayout\(\{[\s\S]*title:\s*'今日推荐'/s,
  )
  assert.doesNotMatch(source, /showTrailingBuilder:\s*true/s)
})

test('FloatingRootPageLayout forwards custom trailing builders to PageHeader', () => {
  const source = readFileSync(
    new URL(
      '../entry/src/main/ets/common/components/FloatingRootPageLayout.ets',
      import.meta.url,
    ),
    'utf8',
  )

  assert.match(source, /@Prop showTrailingBuilder: boolean = false/)
  assert.match(
    source,
    /@BuilderParam trailingBuilder: \(\) => void = this\.EmptyTrailingBuilder/,
  )
  assert.match(
    source,
    /PageHeader\(\{[\s\S]*showTrailingBuilder: this\.showTrailingBuilder,[\s\S]*\}\)\s*\{\s*this\.trailingBuilder\(\)\s*\}/s,
  )
})

test('home page uses HDS title bar system material for the search button', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  assert.match(source, /private currentRootTitle\(\): string/)
  assert.match(source, /private shouldHideRootTitleBar\(\): boolean/)
  assert.match(
    source,
    /private currentRootScrollEffectType\(\): ScrollEffectType/,
  )
  assert.match(source, /private isSettingsRootTab\(\): boolean/)
  assert.match(source, /private isHomeRootTab\(\): boolean/)
  assert.match(source, /private HomeRootLowerTitleBuilder\(\)/)
  assert.match(source, /private HomeTitleSearchButton\(\)/)
  assert.match(source, /ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT/)
  assert.match(source, /ROOT_PAGE_TITLE_CONTENT_BOTTOM_PADDING/)
  assert.match(source, /ROOT_PAGE_MODE_TOP_OFFSET/)
  assert.match(source, /ROOT_PAGE_TITLE_TEXT_BOTTOM_OFFSET/)
  assert.match(
    source,
    /const HOME_ROOT_TITLE_BAR_BOTTOM_TITLE_HEIGHT: number = ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT/,
  )
  assert.match(
    source,
    /private homeTitleSearchButtonBackgroundColor\(\): string/,
  )
  assert.match(source, /private homeTitleSearchButtonBorderColor\(\): string/)
  assert.match(source, /private homeTitleSearchButtonShadow\(\): ShadowOptions/)
  assert.match(source, /private homeTitleSearchButtonBackdropBlur\(\): number/)
  assert.match(source, /private SettingsRootLowerTitleBuilder\(\)/)
  assert.match(
    source,
    /private currentRootBlurEffectiveEndOffset\(\): LengthMetrics/,
  )
  assert.match(
    source,
    /private currentRootOriginalTitleBarBlurRadius\(\): number/,
  )
  assert.match(
    source,
    /private currentRootScrollEffectTitleBarBlurRadius\(\): number/,
  )
  assert.match(
    source,
    /private currentRootOriginalTitleBarMaskExtraHeight\(\): number/,
  )
  assert.match(
    source,
    /private currentRootScrollEffectTitleBarMaskExtraHeight\(\): number/,
  )
  assert.match(
    source,
    /private currentRootBlurStrategy\(\): BlurStrategy \| undefined/,
  )
  assert.match(source, /SystemMaterialParams,/)
  assert.match(
    source,
    /private currentRootSystemMaterialEffect\(\): SystemMaterialParams \| undefined/,
  )
  assert.match(source, /private currentRootBindScrollers\(\): Scroller\[\]/)
  assert.match(
    source,
    /private handleSettingsContentScrollerReady\(scroller: Scroller\): void/,
  )
  assert.match(source, /private HomeModeHeaderSection\(\)/)
  assert.match(source, /\.height\(0\)/)
  assert.match(source, /SymbolGlyph\(\$r\('sys\.symbol\.magnifyingglass'\)\)/)
  assert.match(source, /\.fontSize\(22\)/)
  assert.match(source, /\.width\(40\)/)
  assert.match(source, /\.height\(40\)/)
  assert.match(source, /\.borderRadius\(20\)/)
  assert.match(
    source,
    /private currentRootTitle\(\): string \{[\s\S]*case 'subscriptions':\s*return '订阅库'[\s\S]*case 'settings':\s*return '设置'[\s\S]*case 'discover':\s*return '添加订阅'[\s\S]*default:\s*return '今日推荐'/s,
  )
  assert.match(
    source,
    /private homeTitleSearchButtonBackgroundColor\(\): string \{\s*return this\.theme\.isDark \? 'rgba\(28,32,40,0\.82\)' : 'rgba\(255,255,255,0\.84\)'\s*\}/s,
  )
  assert.match(
    source,
    /private homeTitleSearchButtonBorderColor\(\): string \{\s*return this\.theme\.isDark \? 'rgba\(255,255,255,0\.18\)' : 'rgba\(255,255,255,0\.96\)'\s*\}/s,
  )
  assert.match(
    source,
    /private homeTitleSearchButtonShadow\(\): ShadowOptions \{\s*return \{\s*radius: 18,\s*color: this\.theme\.isDark \? 'rgba\(255,255,255,0\.16\)' : 'rgba\(255,255,255,0\.72\)',\s*offsetX: 0,\s*offsetY: 4,\s*\}\s*\}/s,
  )
  assert.match(
    source,
    /private homeTitleSearchButtonBackdropBlur\(\): number \{\s*return this\.theme\.isDark \? 16 : 24\s*\}/s,
  )
  assert.match(
    source,
    /private shouldHideRootTitleBar\(\): boolean \{[\s\S]*this\.activeRootTabId === 'subscriptions'[\s\S]*this\.activeRootTabId === 'discover'[\s\S]*this\.activeRootTabId === 'settings'/s,
  )
  assert.doesNotMatch(
    source,
    /private shouldHideRootTitleBar\(\): boolean \{\s*return this\.showSearch/s,
  )
  assert.match(
    source,
    /private currentRootScrollEffectType\(\): ScrollEffectType \{\s*return ScrollEffectType\.IMMERSIVE_GRADIENT_BLUR\s*\}/s,
  )
  assert.match(
    source,
    /private currentRootBlurEffectiveEndOffset\(\): LengthMetrics \{\s*return LengthMetrics\.vp\(30\)\s*\}/s,
  )
  assert.match(
    source,
    /private currentRootOriginalTitleBarBlurRadius\(\): number \{\s*return 28\s*\}/s,
  )
  assert.match(
    source,
    /private currentRootScrollEffectTitleBarBlurRadius\(\): number \{\s*return 48\s*\}/s,
  )
  assert.match(
    source,
    /private currentRootOriginalTitleBarMaskExtraHeight\(\): number \{\s*return 0\s*\}/s,
  )
  assert.match(
    source,
    /private currentRootScrollEffectTitleBarMaskExtraHeight\(\): number \{\s*return 0\s*\}/s,
  )
  assert.match(
    source,
    /private currentRootBlurStrategy\(\): BlurStrategy \| undefined \{\s*return BlurStrategy\.ENABLE\s*\}/s,
  )
  assert.match(
    source,
    /private HomeRootLowerTitleBuilder\(\) \{[\s\S]*Text\('今日推荐'\)[\s\S]*fontSize\(28\)[\s\S]*layoutWeight\(1\)[\s\S]*\.margin\(\{ bottom: ROOT_PAGE_TITLE_TEXT_BOTTOM_OFFSET \}\)[\s\S]*this\.HomeTitleSearchButton\(\)[\s\S]*height\(HOME_ROOT_TITLE_BAR_BOTTOM_TITLE_HEIGHT\)[\s\S]*alignItems\(VerticalAlign\.Bottom\)[\s\S]*justifyContent\(FlexAlign\.SpaceBetween\)[\s\S]*bottom: ROOT_PAGE_TITLE_CONTENT_BOTTOM_PADDING/s,
  )
  assert.match(
    source,
    /private HomeTitleSearchButton\(\) \{[\s\S]*\.backgroundColor\(this\.homeTitleSearchButtonBackgroundColor\(\)\)[\s\S]*\.backdropBlur\(this\.homeTitleSearchButtonBackdropBlur\(\)\)[\s\S]*\.border\(\{ width: 0\.8, color: this\.homeTitleSearchButtonBorderColor\(\) \}\)[\s\S]*\.shadow\(this\.homeTitleSearchButtonShadow\(\)\)[\s\S]*\.translate\(\{ y: 4 \}\)[\s\S]*\.onClick\(\(\) => \{\s*this\.toggleHomeSearch\(\)\s*\}\)/s,
  )
  assert.match(
    source,
    /private currentRootSystemMaterialEffect\(\): SystemMaterialParams \| undefined \{\s*return \{[\s\S]*materialType:\s*hdsMaterial\.MaterialType\.IMMERSIVE[\s\S]*materialLevel:\s*hdsMaterial\.MaterialLevel\.EXQUISITE/s,
  )
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
  assert.match(
    source,
    /private currentRootBindScrollers\(\): Scroller\[\] \{[\s\S]*if \(this\.activeRootTabId === 'home'\) \{[\s\S]*return \[\s*this\.articlesScroller,\s*this\.socialScroller,\s*this\.picturesScroller,\s*this\.videosScroller,\s*\][\s\S]*if \(this\.isSettingsRootTab\(\) && this\.settingsRootScroller\) \{\s*return \[this\.settingsRootScroller\]/s,
  )
  assert.match(
    source,
    /private handleSettingsContentScrollerReady\(scroller: Scroller\): void \{[\s\S]*this\.settingsRootScroller = scroller[\s\S]*this\.settingsScrollerBindingVersion \+= 1/s,
  )
  assert.match(
    source,
    /\.titleBar\(\{[\s\S]*mainTitle:\s*this\.isHomeRootTab\(\) \|\| this\.isSettingsRootTab\(\) \? '' : this\.currentRootTitle\(\),[\s\S]*bottomBuilder:\s*this\.isHomeRootTab\(\)\s*\?[\s\S]*this\.HomeRootLowerTitleBuilder\(\)[\s\S]*this\.isSettingsRootTab\(\)\s*\?[\s\S]*this\.SettingsRootLowerTitleBuilder\(\)[\s\S]*systemMaterialEffect:\s*this\.currentRootSystemMaterialEffect\(\),/s,
  )
  assert.doesNotMatch(source, /menu:\s*this\.currentRootMenu\(\)/)
  assert.match(source, /enableScrollEffect:\s*true/)
  assert.match(
    source,
    /scrollEffectType:\s*this\.currentRootScrollEffectType\(\)/,
  )
  assert.match(source, /blurEffectiveStartOffset:\s*LengthMetrics\.vp\(0\)/)
  assert.match(
    source,
    /blurEffectiveEndOffset:\s*this\.currentRootBlurEffectiveEndOffset\(\)/,
  )
  assert.match(source, /blurStrategy:\s*this\.currentRootBlurStrategy\(\)/)
  assert.match(
    source,
    /originalStyle:\s*\{[\s\S]*backgroundStyle:\s*\{[\s\S]*backgroundColor:\s*this\.currentRootOriginalTitleBarBackgroundColor\(\),[\s\S]*maskExtraHeight:\s*this\.currentRootOriginalTitleBarMaskExtraHeight\(\),[\s\S]*blurRadius:\s*this\.currentRootOriginalTitleBarBlurRadius\(\),/s,
  )
  assert.match(
    source,
    /originalStyle:\s*\{[\s\S]*contentStyle:\s*\{[\s\S]*titleStyle:\s*\{[\s\S]*mainTitleColor:\s*\$r\('sys\.color\.font_primary'\),[\s\S]*subTitleColor:\s*\$r\('sys\.color\.font_secondary'\),/s,
  )
  assert.match(
    source,
    /scrollEffectStyle:\s*\{[\s\S]*backgroundStyle:\s*\{[\s\S]*backgroundColor:\s*this\.currentRootScrollEffectBackgroundColor\(\),[\s\S]*maskExtraHeight:\s*this\.currentRootScrollEffectTitleBarMaskExtraHeight\(\),[\s\S]*blurRadius:\s*this\.currentRootScrollEffectTitleBarBlurRadius\(\),/s,
  )
  assert.match(
    source,
    /scrollEffectStyle:\s*\{[\s\S]*contentStyle:\s*\{[\s\S]*menuStyle:\s*\{[\s\S]*backgroundColor:\s*\$r\('sys\.color\.comp_background_tertiary'\),[\s\S]*iconColor:\s*\$r\('sys\.color\.icon_primary'\),/s,
  )
  assert.doesNotMatch(source, /avoidLayoutSafeArea:\s*true/)
  assert.doesNotMatch(source, /enableComponentSafeArea:\s*true/)
  assert.match(source, /\.titleMode\(HdsNavigationTitleMode\.MINI\)/)
  assert.match(source, /\.hideTitleBar\(this\.shouldHideRootTitleBar\(\)\)/)
  assert.match(
    source,
    /\.bindToScrollable\(this\.currentRootBindScrollers\(\)\)/,
  )
  assert.doesNotMatch(source, /private HomeSearchTrailingAction\(\)/)
  assert.doesNotMatch(source, /\.backgroundBlurStyle\(BlurStyle\.Regular\)/)
})
