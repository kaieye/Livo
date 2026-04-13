import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

test('FeedDetailView clears transient state in aboutToAppear before loading new data', () => {
  const source = read(
    '../entry/src/main/ets/common/components/FeedDetailView.ets',
  )

  assert.match(
    source,
    /aboutToAppear\(\): void \{[\s\S]*this\.previewPayload = undefined/s,
  )
  assert.match(
    source,
    /aboutToAppear\(\): void \{[\s\S]*this\.existingFeed = undefined/s,
  )
  assert.match(
    source,
    /aboutToAppear\(\): void \{[\s\S]*this\.videoPreviewCache = \[\]/s,
  )
  assert.match(
    source,
    /aboutToAppear\(\): void \{[\s\S]*void this\.loadData\(\)/s,
  )
})
