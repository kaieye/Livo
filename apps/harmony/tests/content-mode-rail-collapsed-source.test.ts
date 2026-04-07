import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('content mode rail supports collapsed circular icon-only rendering', () => {
  const source = readFileSync(
    new URL(
      '../entry/src/main/ets/common/components/ContentModeRail.ets',
      import.meta.url,
    ),
    'utf8',
  )

  assert.match(source, /@Prop collapsed: boolean = false/)
  assert.match(source, /@Prop collapseProgress: number = 0/)
  assert.match(source, /onExpandRequest: \(\) => void = \(\) => \{\}/)
  assert.match(source, /private collapsedCircleSize\(\): number/)
  assert.match(source, /private collapsedIcon\(mode: ContentMode\)/)
  assert.match(
    source,
    /private modeIconSize\(collapsed: boolean = false\): number/,
  )
  assert.match(source, /private CollapsedRail\(\)/)
  assert.match(
    source,
    /if \(this\.collapsed\) \{[\s\S]*this\.CollapsedRail\(\)/s,
  )
  assert.match(
    source,
    /private railShellBackgroundColor\(\): string \{[\s\S]*this\.collapsed \? '#00000000' : this\.railBackgroundColor\(\)/s,
  )
  assert.match(
    source,
    /private CollapsedRail\(\) \{[\s\S]*\.width\(this\.collapsedCircleSize\(\)\)[\s\S]*\.height\(this\.collapsedCircleSize\(\)\)[\s\S]*\.borderRadius\(this\.collapsedCircleSize\(\)\)/s,
  )
  assert.match(
    source,
    /private modeIconSize\(collapsed: boolean = false\): number \{[\s\S]*return collapsed \? 24 : 16[\s\S]*\}/s,
  )
  assert.match(
    source,
    /private CollapsedRail\(\) \{[\s\S]*this\.collapsedIcon\(this\.mode\)/s,
  )
  assert.match(
    source,
    /private CollapsedRail\(\) \{[\s\S]*\.onClick\(\(\) => \{[\s\S]*this\.handleCollapsedTap\(\)[\s\S]*\}\)/s,
  )
  assert.doesNotMatch(
    source,
    /private CollapsedRail\(\) \{[\s\S]*Text\(this\.collapsedLabel\(\)\)/s,
  )
})
