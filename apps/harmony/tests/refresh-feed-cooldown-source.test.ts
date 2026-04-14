import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

test('refreshFeed skips feeds refreshed successfully within 3 minutes', () => {
  const source = read('../entry/src/main/ets/common/data/AppRepository.ets')

  assert.match(
    source,
    /private static readonly successfulRefreshCooldownMs: number = 3 \* 60 \* 1000/,
  )
  assert.match(
    source,
    /private static isFeedRefreshInCooldown\(feed: Feed, now: number = Date\.now\(\)\): boolean \{[\s\S]*const lastFetched = feed\.lastFetched \?\? 0[\s\S]*return now - lastFetched < AppRepository\.successfulRefreshCooldownMs[\s\S]*\}/s,
  )
  assert.match(
    source,
    /if \(AppRepository\.isFeedRefreshInCooldown\(feed\)\) \{[\s\S]*sourceLabel: `\$\{feed\.title\} · 3 分钟内已刷新，跳过`[\s\S]*fallbackUsed: false[\s\S]*\}/s,
  )
})
