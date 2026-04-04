import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('home article and picture sections keep List virtualization and always-enabled spring dragging', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  const entryListStart = source.indexOf(
    'private EntryList(mode: SubscriptionMode) {',
  )
  const pictureListStart = source.indexOf('private PictureEntryList() {')
  const modeSceneStart = source.indexOf(
    'private ModeEntriesScene(mode: SubscriptionMode) {',
  )

  assert.notEqual(entryListStart, -1)
  assert.notEqual(pictureListStart, -1)
  assert.notEqual(modeSceneStart, -1)

  const entryList = source.slice(entryListStart, pictureListStart)
  const pictureList = source.slice(pictureListStart, modeSceneStart)

  assert.match(entryList, /List\(\{ space: 10 \}\)/)
  assert.match(
    entryList,
    /\.edgeEffect\(EdgeEffect\.Spring, \{ alwaysEnabled: true \}\)/,
  )
  assert.doesNotMatch(entryList, /Scroll\(\)/)

  assert.match(pictureList, /List\(\{ space: 12 \}\)/)
  assert.match(
    pictureList,
    /\.edgeEffect\(EdgeEffect\.Spring, \{ alwaysEnabled: true \}\)/,
  )
  assert.doesNotMatch(pictureList, /Scroll\(\)/)
})
