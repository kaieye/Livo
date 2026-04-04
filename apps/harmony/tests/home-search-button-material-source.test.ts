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

  assert.match(
    source,
    /private homeNavigationMenu\(\): HdsNavigationMenuContentOptions/,
  )
  assert.match(source, /private currentRootTitle\(\): string/)
  assert.match(
    source,
    /private currentRootMenu\(\): HdsNavigationMenuContentOptions \| undefined/,
  )
  assert.match(source, /private shouldHideRootTitleBar\(\): boolean/)
  assert.match(
    source,
    /private currentRootScrollEffectType\(\): ScrollEffectType/,
  )
  assert.match(source, /private currentRootTitleBarBlurRadius\(\): number/)
  assert.match(source, /private currentRootTitleBarMaskExtraHeight\(\): number/)
  assert.match(source, /SystemMaterialParams,/)
  assert.match(
    source,
    /private currentRootSystemMaterialEffect\(\): SystemMaterialParams \| undefined/,
  )
  assert.match(source, /private HomeModeRailSpacer\(\)/)
  assert.match(source, /\.height\(0\)/)
  assert.match(source, /label:\s*'搜索'/)
  assert.match(source, /icon:\s*\$r\('sys\.symbol\.magnifyingglass'\)/)
  assert.match(
    source,
    /action:\s*\(\)\s*=>\s*\{\s*this\.toggleHomeSearch\(\)\s*\}/s,
  )
  assert.match(
    source,
    /private currentRootTitle\(\): string \{[\s\S]*case 'subscriptions':\s*return '订阅库'[\s\S]*case 'discover':\s*return '添加订阅'[\s\S]*default:\s*return '今日推荐'/s,
  )
  assert.match(
    source,
    /private currentRootMenu\(\): HdsNavigationMenuContentOptions \| undefined \{[\s\S]*case 'home':\s*return this\.homeNavigationMenu\(\)[\s\S]*default:\s*return undefined/s,
  )
  assert.match(
    source,
    /private shouldHideRootTitleBar\(\): boolean \{[\s\S]*this\.activeRootTabId === 'settings'[\s\S]*this\.activeRootTabId === 'discover' && this\.discoverHasForegroundOverlay[\s\S]*this\.activeRootTabId === 'subscriptions' && this\.subscriptionsOverlayLevel > 0/s,
  )
  assert.match(
    source,
    /private currentRootScrollEffectType\(\): ScrollEffectType \{\s*return ScrollEffectType\.GRADIENT_BLUR\s*\}/s,
  )
  assert.match(
    source,
    /private currentRootTitleBarBlurRadius\(\): number \{\s*return 36\s*\}/s,
  )
  assert.match(
    source,
    /private currentRootTitleBarMaskExtraHeight\(\): number \{\s*return 32\s*\}/s,
  )
  assert.match(
    source,
    /private currentRootSystemMaterialEffect\(\): SystemMaterialParams \| undefined \{\s*return \{[\s\S]*materialType:\s*hdsMaterial\.MaterialType\.ADAPTIVE[\s\S]*materialLevel:\s*hdsMaterial\.MaterialLevel\.ADAPTIVE/s,
  )
  assert.match(
    source,
    /\.titleBar\(\{[\s\S]*mainTitle:\s*this\.currentRootTitle\(\),[\s\S]*menu:\s*this\.currentRootMenu\(\),[\s\S]*systemMaterialEffect:\s*this\.currentRootSystemMaterialEffect\(\),/s,
  )
  assert.match(source, /enableScrollEffect:\s*true/)
  assert.match(
    source,
    /scrollEffectType:\s*this\.currentRootScrollEffectType\(\)/,
  )
  assert.match(source, /blurEffectiveStartOffset:\s*LengthMetrics\.vp\(0\)/)
  assert.match(source, /blurEffectiveEndOffset:\s*LengthMetrics\.vp\(20\)/)
  assert.match(
    source,
    /originalStyle:\s*\{[\s\S]*backgroundStyle:\s*\{[\s\S]*backgroundColor:\s*this\.currentRootOriginalTitleBarBackgroundColor\(\),[\s\S]*maskExtraHeight:\s*this\.currentRootTitleBarMaskExtraHeight\(\),[\s\S]*blurRadius:\s*this\.currentRootTitleBarBlurRadius\(\),/s,
  )
  assert.match(
    source,
    /originalStyle:\s*\{[\s\S]*contentStyle:\s*\{[\s\S]*titleStyle:\s*\{[\s\S]*mainTitleColor:\s*\$r\('sys\.color\.font_primary'\),[\s\S]*subTitleColor:\s*\$r\('sys\.color\.font_secondary'\),/s,
  )
  assert.match(
    source,
    /scrollEffectStyle:\s*\{[\s\S]*backgroundStyle:\s*\{[\s\S]*backgroundColor:\s*this\.currentRootScrollEffectBackgroundColor\(\),[\s\S]*maskExtraHeight:\s*this\.currentRootTitleBarMaskExtraHeight\(\),[\s\S]*blurRadius:\s*this\.currentRootTitleBarBlurRadius\(\),/s,
  )
  assert.match(
    source,
    /scrollEffectStyle:\s*\{[\s\S]*contentStyle:\s*\{[\s\S]*menuStyle:\s*\{[\s\S]*backgroundColor:\s*\$r\('sys\.color\.comp_background_tertiary'\),[\s\S]*iconColor:\s*\$r\('sys\.color\.icon_primary'\),/s,
  )
  assert.match(source, /avoidLayoutSafeArea:\s*true/)
  assert.match(source, /enableComponentSafeArea:\s*true/)
  assert.match(source, /\.titleMode\(HdsNavigationTitleMode\.MINI\)/)
  assert.match(source, /\.hideTitleBar\(this\.shouldHideRootTitleBar\(\)\)/)
  assert.doesNotMatch(source, /private HomeSearchTrailingAction\(\)/)
  assert.doesNotMatch(source, /\.backgroundBlurStyle\(BlurStyle\.Regular\)/)
})
