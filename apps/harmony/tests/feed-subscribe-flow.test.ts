import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const feedSubscribeViewSource = fs.readFileSync(
  path.join(
    process.cwd(),
    'apps/harmony/entry/src/main/ets/common/components/FeedSubscribeConfigView.ets',
  ),
  'utf8',
)

const appRepositorySource = fs.readFileSync(
  path.join(
    process.cwd(),
    'apps/harmony/entry/src/main/ets/common/data/AppRepository.ets',
  ),
  'utf8',
)

const discoverRemoteSearchServiceSource = fs.readFileSync(
  path.join(
    process.cwd(),
    'apps/harmony/entry/src/main/ets/common/services/DiscoverRemoteSearchService.ets',
  ),
  'utf8',
)

const feedDetailViewSource = fs.readFileSync(
  path.join(
    process.cwd(),
    'apps/harmony/entry/src/main/ets/common/components/FeedDetailView.ets',
  ),
  'utf8',
)

test('FeedSubscribeConfigView guards duplicate subscribe submissions and rechecks existing feed by url', () => {
  assert.match(feedSubscribeViewSource, /@State isSubmitting: boolean = false/)
  assert.match(
    feedSubscribeViewSource,
    /if \(this\.isSubmitting\) \{\s*return\s*\}/,
  )
  assert.match(
    feedSubscribeViewSource,
    /await AppRepository\.feedEntityByUrl\(this\.mappedTargetUrl\(\)\)/,
  )
  assert.match(
    feedSubscribeViewSource,
    /const cachedPreview = DiscoverRemoteSearchService\.cachedPreviewPayload\(this\.targetUrl\)/,
  )
  assert.match(
    feedSubscribeViewSource,
    /DiscoverRemoteSearchService\.cachedPreviewPayload\(this\.mappedTargetUrl\(\)\)/,
  )
  assert.match(
    feedSubscribeViewSource,
    /const effectiveTargetUrl = cachedPreview\?\.resolvedFeedUrl\?\.trim\(\) \|\| this\.mappedTargetUrl\(\)/,
  )
  assert.match(
    feedSubscribeViewSource,
    /const effectiveSiteUrl = cachedPreview\?\.siteUrl\?\.trim\(\) \|\| this\.targetSiteUrl\.trim\(\)/,
  )
  assert.match(
    feedSubscribeViewSource,
    /await AppRepository\.feedEntityBySiteUrl\(effectiveSiteUrl\)/,
  )
  assert.match(
    feedSubscribeViewSource,
    /imageUrl: cachedPreview\?\.imageUrl \|\| this\.targetImageUrl \|\| latestExistingFeed\?\.imageUrl \|\| ''/,
  )
})

test('FeedSubscribeConfigView skips immediate refresh when cached preview already has entries', () => {
  assert.match(
    feedSubscribeViewSource,
    /const hasSeededPreview = !!cachedPreview && \(cachedPreview\.entries\?\.length \?\? 0\) > 0/,
  )
  assert.match(
    feedSubscribeViewSource,
    /if \(!hasSeededPreview\) \{\s*const refreshResult = await AppRepository\.refreshFeed\(/,
  )
})

test('AppRepository createFeed falls back to existing feed on unique url conflict', () => {
  assert.match(
    appRepositorySource,
    /static async feedEntityByUrl\(url: string\): Promise<Feed \| undefined>/,
  )
  assert.match(
    appRepositorySource,
    /static async feedEntityBySiteUrl\(siteUrl: string\): Promise<Feed \| undefined>/,
  )
  assert.match(
    appRepositorySource,
    /if \(message\.includes\('constraint violation'\)\)/,
  )
  assert.match(
    appRepositorySource,
    /const existing = await FeedRepository\.getByUrl\(draft\.url\)/,
  )
})

test('seedFeedFromPreview replaces stale entries before writing the preview entries', () => {
  const entryRepositorySource = fs.readFileSync(
    path.join(
      process.cwd(),
      'apps/harmony/entry/src/main/ets/common/repositories/EntryRepository.ets',
    ),
    'utf8',
  )

  assert.match(
    entryRepositorySource,
    /static async removeByFeed\(feedId: string\): Promise<void>/,
  )
  assert.match(
    appRepositorySource,
    /await EntryRepository\.removeByFeed\(feedId\)/,
  )
  assert.match(
    appRepositorySource,
    /await EntryRepository\.upsertMany\(rekeyPreviewEntries\(feedId, payload\.entries\)\)/,
  )
})

test('RssFeedService exposes the resolved fallback feed url in preview payloads', () => {
  const rssFeedServiceSource = fs.readFileSync(
    path.join(
      process.cwd(),
      'apps/harmony/entry/src/main/ets/common/services/RssFeedService.ets',
    ),
    'utf8',
  )

  assert.match(rssFeedServiceSource, /resolvedFeedUrl\?: string/)
  assert.match(rssFeedServiceSource, /finalUrl: string/)
  assert.match(rssFeedServiceSource, /resolvedFeedUrl: requestUrl/)
})

test('Discover preview remembers the latest payload for subscription seeding', () => {
  assert.match(
    discoverRemoteSearchServiceSource,
    /static rememberPreviewPayload\(targetUrl: string, payload: FeedRefreshPayload\): void/,
  )
  assert.match(
    discoverRemoteSearchServiceSource,
    /DiscoverRemoteSearchService\.cachePreviewPayload\(trimmed, payload\)/,
  )
  assert.match(
    discoverRemoteSearchServiceSource,
    /DiscoverRemoteSearchService\.cachePreviewPayload\(payload\.resolvedFeedUrl, payload\)/,
  )
  assert.match(
    discoverRemoteSearchServiceSource,
    /DiscoverRemoteSearchService\.cachePreviewPayload\(payload\.siteUrl, payload\)/,
  )
  assert.match(
    feedDetailViewSource,
    /DiscoverRemoteSearchService\.rememberPreviewPayload\(this\.targetUrl, resolvedCachedPayload\)/,
  )
  assert.match(
    feedDetailViewSource,
    /DiscoverRemoteSearchService\.rememberPreviewPayload\(this\.targetUrl, payload\)/,
  )
})
