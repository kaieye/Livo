import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('home mode rail is rendered inside scrollable home scenes instead of the fixed header', () => {
  const source = readFileSync(
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    'utf8',
  )

  const homeRootPageStart = source.indexOf('private HomeRootPage() {')
  const buildStart = source.indexOf('build() {')
  const homeRootPage = source.slice(homeRootPageStart, buildStart)

  assert.notEqual(homeRootPageStart, -1)
  assert.notEqual(buildStart, -1)
  assert.doesNotMatch(homeRootPage, /PageHeader\([\s\S]*?ContentModeRail\(\{/)

  const entryListStart = source.indexOf(
    'private EntryList(mode: SubscriptionMode) {',
  )
  const pictureListStart = source.indexOf('private PictureEntryList() {')
  const modeSceneStart = source.indexOf(
    'private ModeEntriesScene(mode: SubscriptionMode) {',
  )
  const homeRootStart = source.indexOf('private HomeRootPage() {')

  const entryList = source.slice(entryListStart, pictureListStart)
  const pictureList = source.slice(pictureListStart, modeSceneStart)
  const modeScene = source.slice(modeSceneStart, homeRootStart)

  assert.match(entryList, /this\.HomeModeRail\(\)/)
  assert.match(pictureList, /this\.HomeModeRail\(\)/)
  assert.match(modeScene, /this\.HomeModeRail\(\)/)
})
