import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sessionSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/coordinators/home/HomeFeedSession.ets',
    import.meta.url,
  ),
  'utf8',
)

test('HomeFeedSession primes active-mode load-more prefetch aggressively after initial and reload paths', () => {
  assert.match(
    sessionSource,
    /private static readonly ACTIVE_MODE_PREFETCH_DELAY_MS: number = 80/,
  )
  assert.match(
    sessionSource,
    /primeActiveModeLoadMorePrefetch\(\s*reason: string,\s*delayMs: number = HomeFeedSession\.ACTIVE_MODE_PREFETCH_DELAY_MS,/s,
  )
  assert.match(
    sessionSource,
    /this\.primeActiveModeLoadMorePrefetch\('bootstrap'\)/,
  )
  assert.match(
    sessionSource,
    /this\.primeActiveModeLoadMorePrefetch\(`reload-featured mode=\$\{targetMode\}`\)/,
  )
  assert.match(
    sessionSource,
    /this\.primeActiveModeLoadMorePrefetch\('reload-home'\)/,
  )
})
