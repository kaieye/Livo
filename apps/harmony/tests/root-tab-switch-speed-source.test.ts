import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

test('root tab shell updates active tab state on tab content appear to prevent stale top overlays', () => {
  const indexSource = read('../entry/src/main/ets/pages/Index.ets')

  assert.match(
    indexSource,
    /private currentRootTabId\(\): RootTabId \{\s*return this\.highlightedRootTabId\s*\}/s,
  )
  assert.match(
    indexSource,
    /private handleRootTabChange\(index: number\): void \{[\s\S]*this\.highlightedRootTabId = tabId/s,
  )
  assert.doesNotMatch(
    indexSource,
    /private handleRootTabChange\(index: number\): void \{[\s\S]*this\.refreshRootTheme\(\)/s,
  )
  assert.match(
    indexSource,
    /\.onAppear\(\(\) => \{[\s\S]*this\.confirmRootTabSelection\(item\.id as RootTabId\)/s,
  )
  assert.match(
    indexSource,
    /private shouldHideRootTitleBar\(\): boolean \{[\s\S]*this\.currentRootTabId\(\) === 'subscriptions'[\s\S]*this\.currentRootTabId\(\) === 'discover'[\s\S]*this\.currentRootTabId\(\) === 'settings'/s,
  )
})
