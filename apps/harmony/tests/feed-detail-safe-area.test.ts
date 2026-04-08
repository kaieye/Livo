import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

test('FeedDetailView uses the shared secondary page header shell without per-page top padding drift', () => {
  const source = read(
    '../entry/src/main/ets/common/components/FeedDetailView.ets',
  )

  assert.match(source, /SecondaryPageHeaderShell\(\)\s*\{/)
  assert.doesNotMatch(
    source,
    /@StorageProp\('topAvoidArea'\) topAvoidArea: number = 0/,
  )
  assert.doesNotMatch(source, /topAvoidArea: this\.topAvoidArea/)
  assert.doesNotMatch(source, /private detailHeaderTopPadding\(\): number/)
  assert.doesNotMatch(source, /topPadding: this\.detailHeaderTopPadding\(\)/)
  assert.doesNotMatch(source, /topPadding:\s*[1-9]\d*/)
})
