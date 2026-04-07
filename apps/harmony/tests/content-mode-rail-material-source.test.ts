import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('content mode rail uses translucent material styling with backdrop blur', () => {
  const source = readFileSync(
    new URL(
      '../entry/src/main/ets/common/components/ContentModeRail.ets',
      import.meta.url,
    ),
    'utf8',
  )

  assert.match(source, /private railBackgroundColor\(\): string/)
  assert.match(source, /private railBorderColor\(\): string/)
  assert.match(source, /private railBackdropBlur\(\): number/)
  assert.match(
    source,
    /private railBackgroundColor\(\): string \{\s*return this\.theme\.isDark \? 'rgba\(20,22,28,0\.72\)' : 'rgba\(255,255,255,0\.72\)'\s*\}/s,
  )
  assert.match(
    source,
    /private railBorderColor\(\): string \{\s*return this\.theme\.isDark \? 'rgba\(255,255,255,0\.12\)' : 'rgba\(255,255,255,0\.88\)'\s*\}/s,
  )
  assert.match(
    source,
    /private railBackdropBlur\(\): number \{\s*return this\.theme\.isDark \? 10 : 18\s*\}/s,
  )
  assert.match(source, /private railShellBackgroundColor\(\): string/)
  assert.match(source, /private railShellBackdropBlur\(\): number/)
  assert.match(
    source,
    /\.backgroundColor\(this\.railShellBackgroundColor\(\)\)/,
  )
  assert.match(source, /\.backdropBlur\(this\.railShellBackdropBlur\(\)\)/)
  assert.match(
    source,
    /\.border\(\{ width: this\.railShellBorderWidth\(\), color: this\.railBorderColor\(\) \}\)/,
  )
  assert.doesNotMatch(source, /\.backgroundColor\(this\.theme\.elevated\)/)
  assert.match(source, /\.clickEffect\(\{ level: ClickEffectLevel\.MIDDLE \}\)/)
})
