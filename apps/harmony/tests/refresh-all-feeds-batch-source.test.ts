import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

test('AppRepository refreshes feeds with a bounded rolling pool', () => {
  const source = read('../entry/src/main/ets/common/data/AppRepository.ets')

  assert.match(
    source,
    /private static readonly refreshConcurrencyMin: number = 4/,
  )
  assert.match(
    source,
    /private static readonly refreshConcurrencyMax: number = 8/,
  )
  assert.match(
    source,
    /private static resolveRefreshConcurrency\(totalFeeds: number\): number \{/,
  )
  assert.match(
    source,
    /private static async refreshFeedsWithPool\(\s*feeds: Feed\[],\s*refreshConcurrency: number,/s,
  )
  assert.match(source, /if \(feeds\.length === 0\) \{/)
  assert.match(
    source,
    /const refreshConcurrency = AppRepository\.resolveRefreshConcurrency\(feeds\.length\)/,
  )
  assert.match(
    source,
    /const workerCount = Math\.min\(refreshConcurrency, feeds\.length\)/,
  )
  assert.match(source, /workers\.push\(worker\(\)\)/)
  assert.match(source, /await Promise\.all\(workers\)/)
  assert.match(source, /const currentIndex = nextIndex/)
  assert.match(
    source,
    /const value = await AppRepository\.refreshFeed\(feed\.id, true, false, false\)/,
  )
  assert.match(source, /results\[currentIndex\] = fulfilled/)
})
