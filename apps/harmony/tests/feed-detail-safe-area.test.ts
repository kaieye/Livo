import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

test('FeedDetailView offsets its custom header below the top avoid area', () => {
  const source = read(
    '../entry/src/main/ets/common/components/FeedDetailView.ets',
  )

  assert.match(
    source,
    /@StorageProp\('topAvoidArea'\) topAvoidArea: number = 0/,
  )
  assert.match(source, /\.padding\(\{ top: this\.topAvoidArea \}\)/)
  assert.match(source, /top: PAGE_TOP_PADDING/)
  assert.match(
    source,
    /private detailHeaderTopPadding\(\): number \{\s*return this\.feedId \? 30 : 24\s*\}/s,
  )
  assert.match(source, /topPadding: this\.detailHeaderTopPadding\(\)/)
})
