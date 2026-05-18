import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const feedRefreshCoordinatorSource = readFileSync(
  new URL('../entry/src/main/ets/common/data/FeedRefreshCoordinator.ets', import.meta.url),
  'utf8',
)

const rssFeedFetcherSource = readFileSync(
  new URL('../entry/src/main/ets/common/services/rss-feed/RssFeedFetcher.ets', import.meta.url),
  'utf8',
)

const articleInlineVideoPlaybackControllerSource = readFileSync(
  new URL('../entry/src/main/ets/common/utils/ArticleInlineVideoPlaybackController.ets', import.meta.url),
  'utf8',
)

const contentBlockItemBuilderSource = readFileSync(
  new URL('../entry/src/main/ets/common/components/ContentBlockItemBuilder.ets', import.meta.url),
  'utf8',
)

const featuredEntriesQuerySource = readFileSync(
  new URL('../entry/src/main/ets/common/data/FeaturedEntriesQuery.ets', import.meta.url),
  'utf8',
)

const inlineMediaTileSource = readFileSync(
  new URL('../entry/src/main/ets/common/components/quoted-tweet/InlineMediaTile.ets', import.meta.url),
  'utf8',
)

const inlineMediaGridSource = readFileSync(
  new URL('../entry/src/main/ets/common/components/quoted-tweet/InlineMediaGrid.ets', import.meta.url),
  'utf8',
)

const quotedTweetRendererSource = readFileSync(
  new URL('../entry/src/main/ets/common/components/QuotedTweetRenderer.ets', import.meta.url),
  'utf8',
)

const indexHomeRootContentSource = readFileSync(
  new URL('../entry/src/main/ets/common/components/IndexHomeRootContent.ets', import.meta.url),
  'utf8',
)

const homeFeedSessionSource = readFileSync(
  new URL('../entry/src/main/ets/common/utils/HomeFeedSession.ets', import.meta.url),
  'utf8',
)

const homeFeedLoadMorePrefetchSource = readFileSync(
  new URL('../entry/src/main/ets/common/utils/HomeFeedLoadMorePrefetch.ets', import.meta.url),
  'utf8',
)

const indexPageSource = readFileSync(
  new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
  'utf8',
)

test('feed refresh concurrency is capped below network and decode pressure thresholds', () => {
  assert.match(feedRefreshCoordinatorSource, /const REFRESH_CONCURRENCY: number = 4/)
})

test('rss fetcher retries transient timeout and ssl failures with a fresh request', () => {
  assert.match(rssFeedFetcherSource, /const REQUEST_RETRY_ATTEMPTS: number = 2/)
  assert.match(rssFeedFetcherSource, /function isRetryableNetworkError/)
  assert.match(rssFeedFetcherSource, /message\.includes\('CURLcode result 28'\)/)
  assert.match(rssFeedFetcherSource, /message\.includes\('CURLcode result 35'\)/)
  assert.match(rssFeedFetcherSource, /message\.includes\('CURLcode result 42'\)/)
  assert.match(rssFeedFetcherSource, /async function requestWithRetry/)
})

test('inline video playback ignores duplicate requests for the active source', () => {
  assert.match(articleInlineVideoPlaybackControllerSource, /const normalizedVideoUrl = \(block\.videoUrl \|\| ''\)\.trim\(\)/)
  assert.match(articleInlineVideoPlaybackControllerSource, /this\.owner\.activeVideoBlockId === block\.id[\s\S]*?return/)
  assert.match(contentBlockItemBuilderSource, /private activeDirectVideoSource\(\): string/)
  assert.match(contentBlockItemBuilderSource, /if \(this\.activeDirectVideoSource\(\)\) \{[\s\S]*?Video\(\{/)
})

test('picture load-more cache miss uses a small query buffer to reduce scroll jank', () => {
  assert.match(featuredEntriesQuerySource, /function fastPageCacheBufferForMode\(mode: HomeEntryMode\): number/)
  assert.match(featuredEntriesQuerySource, /if \(mode === 'pictures'\) \{\s*return 12\s*\}/)
  assert.match(featuredEntriesQuerySource, /const queryTarget = targetVisibleCount \+ fastPageCacheBufferForMode\(mode\)/)
})

test('social mode uses recent paged query instead of balanced scan on mode switch', () => {
  assert.match(featuredEntriesQuerySource, /function shouldUseRecentModeQuery\(mode: HomeEntryMode\): boolean \{\s*return mode === 'articles' \|\| mode === 'social'\s*\}/)
  assert.match(featuredEntriesQuerySource, /shouldUseRecentModeQuery\(mode\)\s*\?\s*await recentModeEntries\(mode, feeds, feedMap, safeCandidateLimit, true\)/)
  assert.match(featuredEntriesQuerySource, /shouldUseRecentModeQuery\(mode\)\s*\?\s*await recentModeEntries\(mode, feeds, feedMap, queryTarget, true\)/)
})

test('social inline media creates VideoController only for active playback', () => {
  assert.match(inlineMediaTileSource, /videoController\?: VideoController = undefined/)
  assert.doesNotMatch(inlineMediaTileSource, /videoController: VideoController = new VideoController\(\)/)
  assert.match(inlineMediaGridSource, /private activeVideoControllerFor\(item: PictureCarouselMediaItem, index: number\): VideoController \| undefined/)
  assert.match(inlineMediaGridSource, /return this\.isVideoActive\(item, index\) \? this\.controllerFor\(item, index\) : undefined/)
  assert.match(inlineMediaGridSource, /videoController: this\.activeVideoControllerFor\(item, index\)/)
  assert.match(quotedTweetRendererSource, /videoController: this\.isInlineVideoActive\(OUTER_SECTION_TAG, this\.outerView\(\)\.primaryMediaItem, 0\)[\s\S]*?\? this\.inlineVideoControllerFor/)
  assert.match(quotedTweetRendererSource, /videoController: this\.isInlineVideoActive\(NESTED_SECTION_TAG, this\.nestedView\(\)\.primaryMediaItem, 0\)[\s\S]*?\? this\.inlineVideoControllerFor/)
})

test('home mode scenes mount active/transition immediately and prewarm the rest after a short delay', () => {
  assert.match(indexHomeRootContentSource, /private shouldMountScene\(mode: SubscriptionMode\): boolean \{[\s\S]*?return this\.getSceneProps\(mode\)\.shouldMount \|\| this\.scenesPrewarmed/)
  assert.match(indexHomeRootContentSource, /@State private scenesPrewarmed: boolean = false/)
  assert.match(indexHomeRootContentSource, /this\.prewarmTimerId = setTimeout\(\(\) => \{[\s\S]*?this\.scenesPrewarmed = true/)
  assert.match(indexHomeRootContentSource, /if \(this\.shouldMountScene\('articles'\)\) \{[\s\S]*?this\.ModeEntriesScene\('articles'\)/)
  assert.match(indexHomeRootContentSource, /if \(this\.shouldMountScene\('pictures'\)\) \{[\s\S]*?this\.ModeEntriesScene\('pictures'\)/)
})

test('inactive mode precache is staggered and does not compete with the active switch target', () => {
  assert.match(homeFeedSessionSource, /private precacheModeToken: number = 0/)
  assert.match(homeFeedSessionSource, /const precacheLimit = resolveHomeVisibleEntryInitialLimit\(mode\)/)
  assert.match(homeFeedSessionSource, /180 \* \(index \+ 1\)/)
  assert.match(homeFeedSessionSource, /if \(this\.precacheModeToken !== token \|\| mode === this\.owner\.mode\) \{ return \}/)
})

test('load-more prefetch appends a fast page instead of rebuilding the whole mode', () => {
  assert.match(homeFeedLoadMorePrefetchSource, /FeaturedEntriesQuery\.featuredEntriesFastPageByMode\(mode, appendCount, previousEntries\.length\)/)
  assert.match(homeFeedLoadMorePrefetchSource, /private mergeUniqueEntries\(previousEntries: EntryCardModel\[], nextPage: EntryCardModel\[]\): EntryCardModel\[]/)
  assert.doesNotMatch(homeFeedLoadMorePrefetchSource, /FeaturedEntriesQuery\.featuredEntriesByMode\(mode, targetLimit\)/)
})

test('all home modes can trigger load-more by scroll progress before hard bottom reach', () => {
  assert.match(indexPageSource, /if \(mode !== 'videos'\) \{[\s\S]*?this\.syncHomeModeRailState\(mode\)/)
  assert.match(indexPageSource, /this\.maybeTriggerLoadMoreByScrollProgress\(mode, this\.readHomeModeScrollOffset\(mode\)\)/)
})
