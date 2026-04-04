import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('home entry list does not replay per-card enter transitions during mode switches', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  const entryListStart = source.indexOf(
    'private EntryList(mode: SubscriptionMode) {',
  )
  const pictureListStart = source.indexOf('private PictureEntryList() {')

  assert.notEqual(entryListStart, -1)
  assert.notEqual(pictureListStart, -1)

  const entryList = source.slice(entryListStart, pictureListStart)

  assert.doesNotMatch(entryList, /\.transition\(livoMotion\.enterSoft/)
})
