import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/HomeFeedSession.ets',
    import.meta.url,
  ),
  'utf8',
)

test('home feed session primes active-mode load-more prefetch aggressively after initial and reload paths', () => {
  assert.match(
    source,
    /private static readonly ACTIVE_MODE_PREFETCH_DELAY_MS: number = 80/,
  )
  assert.match(
    source,
    /private primeActiveModeLoadMorePrefetch\(\s*reason: string,\s*delayMs: number = HomeFeedSession\.ACTIVE_MODE_PREFETCH_DELAY_MS,/s,
  )
  assert.match(source, /this\.primeActiveModeLoadMorePrefetch\('bootstrap'\)/)
  assert.match(
    source,
    /this\.primeActiveModeLoadMorePrefetch\(`reload-featured mode=\$\{targetMode\}`\)/,
  )
  assert.match(source, /this\.primeActiveModeLoadMorePrefetch\('reload-home'\)/)
})
