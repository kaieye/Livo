import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

test('AppRepository refreshes feeds in bounded batches', () => {
  const source = read('../entry/src/main/ets/common/data/AppRepository.ets')

  assert.match(
    source,
    /private static readonly refreshConcurrencyLimit: number = 4/,
  )
  assert.match(source, /if \(feeds\.length === 0\) \{/)
  assert.match(
    source,
    /for \(let index = 0; index < feeds\.length; index \+= AppRepository\.refreshConcurrencyLimit\)/,
  )
  assert.match(
    source,
    /const batchFeeds = feeds\.slice\(index, index \+ AppRepository\.refreshConcurrencyLimit\)/,
  )
  assert.match(
    source,
    new RegExp('Promise\\.allSettled\\([\\s\\S]*batchFeeds\\.map\\('),
  )
})
