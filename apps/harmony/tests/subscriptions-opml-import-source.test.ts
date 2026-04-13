import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

test('SubscriptionsSettingsPanel reads OPML import content through file descriptor APIs for picker URIs', () => {
  const source = read(
    '../entry/src/main/ets/common/components/SettingsSecondaryPanels.ets',
  )

  assert.match(source, /private readTextFromUri\(uri: string\): string/)
  assert.match(source, /private decodeUtf8Bytes\(bytes: Uint8Array\): string/)
  assert.match(source, /return decodeURIComponent\(encoded\)/)
  assert.match(source, /if \(!!extractInstagramUsername\(normalized\)\) \{/)
  assert.match(source, /return FeedViewType\.Pictures/)
  assert.match(source, /private normalizeImportedUrl\(raw: string\): string/)
  assert.match(source, /fileIo\.openSync\(uri, fileIo\.OpenMode\.READ_ONLY\)/)
  assert.match(source, /fileIo\.readSync\(file\.fd, buffer\)/)
  assert.match(source, /const xml = this\.readTextFromUri\(targetUri\)/)
  assert.match(
    source,
    /const url = this\.normalizeImportedUrl\(opmlFeed\.xmlUrl \|\| ''\)/,
  )
  assert.match(source, /const importedView = this\.inferFeedViewByUrl\(url\)/)
  assert.match(
    source,
    /const existingFeedMap: Map<string, Feed> = new Map<string, Feed>\(\)/,
  )
  assert.match(source, /await AppRepository\.updateFeed\(existingFeed\.id, \{/)
  assert.match(
    source,
    /siteUrl: this\.normalizeImportedUrl\(opmlFeed\.htmlUrl \|\| ''\)/,
  )
  assert.doesNotMatch(source, /fileIo\.readText\(targetUri\)/)
})
