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
  assert.match(
    indexSource,
    /private HomeRootPage\(\) \{\s*Stack\(\{ alignContent: Alignment\.TopStart \}\)/s,
  )
  assert.match(indexSource, /FloatingRootPageLayout\(\{/)
  assert.match(indexSource, /scrollBlurProgress: this\.headerBlurProgress/)
  assert.match(
    indexSource,
    /FloatingRootPageLayout\(\{[\s\S]*?\}\)\s*\.align\(Alignment\.TopStart\)/,
  )
  assert.match(
    discoverSource,
    /private DiscoverRoot\(\) \{\s*Stack\(\{ alignContent: Alignment\.TopStart \}\)/s,
  )
  assert.match(discoverSource, /FloatingRootPageLayout\(\{/)
  assert.match(discoverSource, /scrollBlurProgress: this\.headerBlurProgress/)
  assert.match(
    discoverSource,
    /FloatingRootPageLayout\(\{[\s\S]*?\}\)\s*\.align\(Alignment\.TopStart\)/,
  )
  assert.match(
    subscriptionsSource,
    /private SubscriptionsRoot\(\) \{\s*Stack\(\{ alignContent: Alignment\.TopStart \}\)/s,
  )
  assert.match(subscriptionsSource, /FloatingRootPageLayout\(\{/)
  assert.match(
    subscriptionsSource,
    /scrollBlurProgress: this\.headerBlurProgress/,
  )
  assert.match(
    subscriptionsSource,
    /FloatingRootPageLayout\(\{[\s\S]*?\}\)\s*\.align\(Alignment\.TopStart\)/,
  )
  assert.match(
    settingsSource,
    /build\(\) \{\s*Stack\(\{ alignContent: Alignment\.TopStart \}\)/s,
  )
  assert.match(settingsSource, /FloatingRootPageLayout\(\{/)
  assert.match(settingsSource, /scrollBlurProgress: this\.headerBlurProgress/)
  assert.match(
    settingsSource,
    /FloatingRootPageLayout\(\{[\s\S]*?\}\)\s*\.align\(Alignment\.TopStart\)/,
  )
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
