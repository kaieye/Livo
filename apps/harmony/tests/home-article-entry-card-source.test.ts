import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/HomeArticleEntryCard.ets',
    import.meta.url,
  ),
  'utf8',
)

test('home article entry card caches preview image resolution and fast-paths tweet-like entries', () => {
  assert.match(source, /private previewImageCacheKey: string = ''/)
  assert.match(source, /private previewImageCacheValue: string = ''/)
  assert.match(
    source,
    /if \(cacheKey === this\.previewImageCacheKey\) \{\s*return this\.previewImageCacheValue\s*\}/s,
  )
  assert.match(
    source,
    /if \(isTweetLikeEntry\(this\.entry\)\) \{\s*const pictureMediaCandidates = selectPictureMediaUrls\(lightweightCandidates\)/s,
  )
})
