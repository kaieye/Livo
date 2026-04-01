import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const rssFeedServiceSource = fs.readFileSync(
  path.join(
    process.cwd(),
    'apps/harmony/entry/src/main/ets/common/services/RssFeedService.ets',
  ),
  'utf8',
)

test('RssFeedService prefers RSS guid when generating entry identity', () => {
  assert.match(
    rssFeedServiceSource,
    /const guid = stripHtml\(pickTag\(itemBlock, 'guid'\)\)/,
  )
  assert.match(
    rssFeedServiceSource,
    /id: createEntryId\(feedId, guid, link, title, index\)/,
  )
})

test('RssFeedService prefers Atom id when generating entry identity', () => {
  assert.match(
    rssFeedServiceSource,
    /const entryId = stripHtml\(pickTag\(entryBlock, 'id'\)\)/,
  )
  assert.match(
    rssFeedServiceSource,
    /id: createEntryId\(feedId, entryId, link, title, index\)/,
  )
})
