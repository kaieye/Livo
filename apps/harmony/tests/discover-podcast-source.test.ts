import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const podcastData = JSON.parse(
  readFileSync(
    new URL(
      '../entry/src/main/ets/common/data/discover-builtin-feeds/podcast.json',
      import.meta.url,
    ),
    'utf8',
  ),
)

const builtinFeedsSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/data/DiscoverBuiltinFeeds.ets',
    import.meta.url,
  ),
  'utf8',
)

const catalogSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/DiscoverCatalog.ets',
    import.meta.url,
  ),
  'utf8',
)

const discoverTypesSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/DiscoverTypes.ets',
    import.meta.url,
  ),
  'utf8',
)

const identityResolverSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/services/FeedIdentityResolver.ets',
    import.meta.url,
  ),
  'utf8',
)

test('discover podcast feed file follows built-in feed shape', () => {
  assert.equal(podcastData.view, 'articles')
  assert.ok(podcastData.feeds.length >= 40)
  const urls = podcastData.feeds.map((feed) => feed.url)
  assert.equal(new Set(urls).size, urls.length)
  assert.ok(
    urls.includes('rsshub://xiaoyuzhou/podcast/640ee2438be5d40013fe4a87'),
  )
  assert.ok(urls.includes('https://hacker-podcast.agi.li/rss.xml'))
  assert.ok(urls.includes('rsshub://gcores/radios'))
  assert.equal(
    urls.some((url) => url.includes('rsshub.bestblogs.dev/xiaoyuzhou')),
    false,
  )
  podcastData.feeds.forEach((feed) => {
    assert.equal(typeof feed.title, 'string')
    assert.equal(typeof feed.url, 'string')
    assert.equal(typeof feed.language, 'string')
    assert.equal(typeof feed.descriptionZh, 'string')
    assert.equal(typeof feed.descriptionEn, 'string')
  })
})

test('discover built-in feed catalog exposes podcast source as articles', () => {
  assert.match(
    builtinFeedsSource,
    /import podcastFeedData from '\.\/discover-builtin-feeds\/podcast\.json'/,
  )
  assert.match(
    builtinFeedsSource,
    /export type DiscoverBuiltinFeedSourceKey = '' \| 'ins' \| 'ai' \| 'podcast'/,
  )
  assert.match(
    builtinFeedsSource,
    /podcast:\s*buildBuiltinFeeds\(FeedViewType\.Articles, \(podcastFeedData as FeedFileShape\)\.feeds \?\? \[\], 'podcast'\)/,
  )
  assert.match(
    builtinFeedsSource,
    /if \(sourceKey === 'podcast'\) \{\s*return BUILTIN_DISCOVER_FEEDS_BY_VIEW\.podcast\s*\}/s,
  )
  assert.match(
    builtinFeedsSource,
    /\.\.\.BUILTIN_DISCOVER_FEEDS_BY_VIEW\.podcast/,
  )
  assert.match(builtinFeedsSource, /case 'podcast':\s*return '内置-播客'/s)
  assert.match(
    builtinFeedsSource,
    /const xiaoyuzhouPodcastPrefix = '\/xiaoyuzhou\/podcast\/'/,
  )
})

test('discover category second row replaces the third Ins entry with podcast', () => {
  assert.doesNotMatch(catalogSource, /id: 'ins-3'/)
  const secondRowOrder = [
    catalogSource.indexOf("id: 'ai'"),
    catalogSource.indexOf("id: 'ins-2'"),
    catalogSource.indexOf("id: 'podcast'"),
    catalogSource.indexOf("id: 'ins-4'"),
  ]
  assert.ok(secondRowOrder.every((index) => index >= 0))
  assert.deepEqual(
    [...secondRowOrder].sort((left, right) => left - right),
    secondRowOrder,
  )
  assert.match(
    catalogSource,
    /id: 'podcast',\s*view: FeedViewType\.Articles,\s*label: '播客',/s,
  )
  assert.match(catalogSource, /sourceKey: 'podcast'/)
})

test('xiaoyuzhou rsshub routes keep article as the default target view', () => {
  assert.match(discoverTypesSource, /function isXiaoyuzhouDiscoverTarget/)
  assert.match(
    discoverTypesSource,
    /if \(isXiaoyuzhouDiscoverTarget\(targetUrl, siteUrl\)\) \{[\s\S]*?return FeedViewType\.Articles\s*\}/,
  )
  assert.match(
    identityResolverSource,
    /normalized\.includes\('\/xiaoyuzhou\/'\) \|\| normalized\.includes\('xiaoyuzhoufm\.com'\)/,
  )
  assert.match(identityResolverSource, /return FeedViewType\.Articles/)
})
