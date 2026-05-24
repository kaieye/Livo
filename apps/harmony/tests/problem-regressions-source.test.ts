import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const feedRefreshCoordinatorSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/data/FeedRefreshCoordinator.ets',
    import.meta.url,
  ),
  'utf8',
)

const rssFeedFetcherSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/services/rss-feed/RssFeedFetcher.ets',
    import.meta.url,
  ),
  'utf8',
)

const articleInlineVideoPlaybackControllerSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/article/ArticleInlineVideoPlaybackController.ets',
    import.meta.url,
  ),
  'utf8',
)

const contentBlockItemBuilderSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/ContentBlockItemBuilder.ets',
    import.meta.url,
  ),
  'utf8',
)

const featuredEntriesQuerySource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/data/FeaturedEntriesQuery.ets',
    import.meta.url,
  ),
  'utf8',
)

const inlineMediaTileSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/quoted-tweet/InlineMediaTile.ets',
    import.meta.url,
  ),
  'utf8',
)

const inlineMediaGridSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/quoted-tweet/InlineMediaGrid.ets',
    import.meta.url,
  ),
  'utf8',
)

const inlineMediaSingleVideoSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/quoted-tweet/InlineMediaSingleVideo.ets',
    import.meta.url,
  ),
  'utf8',
)

const quotedTweetRendererSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/QuotedTweetRenderer.ets',
    import.meta.url,
  ),
  'utf8',
)

const tweetEntryCardSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/TweetEntryCard.ets',
    import.meta.url,
  ),
  'utf8',
)

const indexHomeRootContentSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/components/IndexHomeRootContent.ets',
    import.meta.url,
  ),
  'utf8',
)

const indexSource = readFileSync(
  new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
  'utf8',
)

const sessionSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/home/HomeFeedSession.ets',
    import.meta.url,
  ),
  'utf8',
)

const homeFeedLoadMorePrefetchSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/home/HomeFeedLoadMorePrefetch.ets',
    import.meta.url,
  ),
  'utf8',
)

const indexPageSource = readFileSync(
  new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
  'utf8',
)

test('feed refresh concurrency is capped below network and decode pressure thresholds', () => {
  assert.match(
    feedRefreshCoordinatorSource,
    /const REFRESH_CONCURRENCY: number = 4/,
  )
})

test('rss fetcher retries transient timeout and ssl failures with a fresh request', () => {
  assert.match(rssFeedFetcherSource, /const REQUEST_RETRY_ATTEMPTS: number = 2/)
  assert.match(rssFeedFetcherSource, /function isRetryableNetworkError/)
  assert.match(
    rssFeedFetcherSource,
    /message\.includes\('CURLcode result 28'\)/,
  )
  assert.match(
    rssFeedFetcherSource,
    /message\.includes\('CURLcode result 35'\)/,
  )
  assert.match(
    rssFeedFetcherSource,
    /message\.includes\('CURLcode result 42'\)/,
  )
  assert.match(rssFeedFetcherSource, /async function requestWithRetry/)
})

test('inline video playback ignores duplicate requests for the active source', () => {
  assert.match(
    articleInlineVideoPlaybackControllerSource,
    /const normalizedVideoUrl = \(block\.videoUrl \|\| ''\)\.trim\(\)/,
  )
  assert.match(
    articleInlineVideoPlaybackControllerSource,
    /this\.owner\.activeVideoBlockId === block\.id[\s\S]*?return/,
  )
  assert.match(
    contentBlockItemBuilderSource,
    /private activeDirectVideoSource\(\): string/,
  )
  assert.match(
    contentBlockItemBuilderSource,
    /if \(this\.activeDirectVideoSource\(\)\) \{[\s\S]*?Video\(\{/,
  )
})

test('picture load-more cache miss uses a small query buffer to reduce scroll jank', () => {
  assert.match(
    featuredEntriesQuerySource,
    /function fastPageCacheBufferForMode\(mode: HomeEntryMode\): number/,
  )
  assert.match(
    featuredEntriesQuerySource,
    /if \(mode === 'pictures'\) \{\s*return 12\s*\}/,
  )
  assert.match(
    featuredEntriesQuerySource,
    /const queryTarget = targetVisibleCount \+ fastPageCacheBufferForMode\(mode\)/,
  )
})

test('social mode uses recent paged query instead of balanced scan on mode switch', () => {
  assert.match(
    featuredEntriesQuerySource,
    /function shouldUseRecentModeQuery\(mode: HomeEntryMode\): boolean \{\s*return mode === 'articles' \|\| mode === 'social' \|\| mode === 'pictures'\s*\}/,
  )
  assert.match(
    featuredEntriesQuerySource,
    /shouldUseRecentModeQuery\(mode\)\s*\?\s*await recentModeEntries\(this\.entryRepo, mode, feeds, feedMap, safeCandidateLimit, true\)/,
  )
  assert.match(
    featuredEntriesQuerySource,
    /shouldUseRecentModeQuery\(mode\)\s*\?\s*await recentModeEntries\(this\.entryRepo, mode, feeds, feedMap, queryTarget, true\)/,
  )
})

test('social inline media creates VideoController only for active playback', () => {
  assert.match(
    inlineMediaTileSource,
    /videoController\?: VideoController = undefined/,
  )
  assert.doesNotMatch(
    inlineMediaTileSource,
    /videoController: VideoController = new VideoController\(\)/,
  )
  assert.match(
    inlineMediaGridSource,
    /private activeVideoControllerFor\(item: PictureCarouselMediaItem, index: number\): VideoController \| undefined/,
  )
  assert.match(
    inlineMediaGridSource,
    /return this\.isVideoActive\(item, index\) \? this\.controllerFor\(item, index\) : undefined/,
  )
  assert.match(
    inlineMediaGridSource,
    /private isActiveMediaItem\(item: PictureCarouselMediaItem, index: number\): boolean/,
  )
  assert.match(
    inlineMediaGridSource,
    /isVideoActive: this\.isActiveMediaItem\(item, index\)/,
  )
  assert.match(
    inlineMediaGridSource,
    /return this\.isVideoActive\(item, index\)/,
  )
  assert.match(
    inlineMediaGridSource,
    /videoController: this\.isActiveMediaItem\(item, index\)[\s\S]*?\? this\.controllerFor\(item, index\)[\s\S]*?: undefined/,
  )
  assert.match(inlineMediaGridSource, /@Prop renderVersion: number = 0/)
  assert.match(
    inlineMediaGridSource,
    /private renderKey\(item: PictureCarouselMediaItem, index: number\): string/,
  )
  assert.match(
    inlineMediaGridSource,
    /return `\$\{this\.keyOf\(item, index\)\}_\$\{this\.isActiveMediaItem\(item, index\) \? 'active' : 'idle'\}_\$\{this\.renderVersion\}`/,
  )
  assert.match(
    inlineMediaGridSource,
    /\}, \(item: PictureCarouselMediaItem, index: number\) => this\.renderKey\(item, index\)\)/,
  )
  assert.match(inlineMediaSingleVideoSource, /@Prop renderVersion: number = 0/)
  assert.match(inlineMediaSingleVideoSource, /private renderKey\(\): string/)
  assert.match(inlineMediaSingleVideoSource, /\.key\(this\.renderKey\(\)\)/)
  assert.match(
    inlineMediaTileSource,
    /\.onTouch\(\(event: TouchEvent\) => \{\s*event\.stopPropagation\(\)/,
  )
  assert.match(
    inlineMediaTileSource,
    /private resolvedActiveVideoHeight\(\): number/,
  )
  assert.match(inlineMediaTileSource, /return 208/)
  assert.match(
    inlineMediaTileSource,
    /\.controls\(true\)\s*\.autoPlay\(true\)\s*\.muted\(false\)\s*\.objectFit\(ImageFit\.Contain\)\s*\.onPrepared\(\(\) => \{[\s\S]*?this\.startVideoPlayback\(\)/,
  )
  assert.match(
    inlineMediaTileSource,
    /\.height\(this\.hasVideo\(\) && this\.isVideoActive \? this\.resolvedActiveVideoHeight\(\) : this\.tileHeight\)/,
  )
  assert.match(
    inlineMediaTileSource,
    /\.width\('100%'\)\s*\.height\('100%'\)\s*\.borderRadius\(this\.tileBorderRadius\)\s*\.objectFit\(ImageFit\.Cover\)/,
  )
  assert.match(
    readFileSync(
      new URL(
        '../entry/src/main/ets/common/components/ArticleSocialDetail.ets',
        import.meta.url,
      ),
      'utf8',
    ),
    /\.controls\(true\)\s*\.autoPlay\(true\)\s*\.muted\(false\)\s*\.objectFit\(ImageFit\.Contain\)\s*\.onPrepared\(\(\) => \{[\s\S]*?this\.startInlineVideo\(section, item, index\)/,
  )
  assert.match(
    readFileSync(
      new URL(
        '../entry/src/main/ets/common/components/ArticleSocialDetail.ets',
        import.meta.url,
      ),
      'utf8',
    ),
    /\.onTouch\(\(event: TouchEvent\) => \{\s*event\.stopPropagation\(\)/,
  )
  assert.match(
    inlineMediaTileSource,
    /\.width\(this\.tileWidth\)\s*\.height\(this\.hasVideo\(\) && this\.isVideoActive \? this\.resolvedActiveVideoHeight\(\) : this\.tileHeight\)/,
  )
  assert.match(
    quotedTweetRendererSource,
    /@Prop activeInlineVideoKey: string = ''/,
  )
  assert.match(
    quotedTweetRendererSource,
    /private isActiveMedia\(sectionTag: string, item: PictureCarouselMediaItem, index: number\): boolean/,
  )
  assert.match(
    quotedTweetRendererSource,
    /if \(this\.isActiveMedia\(OUTER_SECTION_TAG, this\.outerView\(\)\.primaryMediaItem, 0\)\) \{[\s\S]*?isVideoActive: true,[\s\S]*?videoController: this\.inlineVideoControllerFor/,
  )
  assert.match(
    quotedTweetRendererSource,
    /if \(this\.isActiveMedia\(NESTED_SECTION_TAG, this\.nestedView\(\)\.primaryMediaItem, 0\)\) \{[\s\S]*?isVideoActive: true,[\s\S]*?videoController: this\.inlineVideoControllerFor/,
  )
  assert.match(
    tweetEntryCardSource,
    /@State private inlineVideoRenderVersion: number = 0/,
  )
  assert.match(tweetEntryCardSource, /this\.inlineVideoRenderVersion \+= 1/)
  assert.match(
    tweetEntryCardSource,
    /renderVersion: this\.inlineVideoRenderVersion/,
  )
  assert.match(quotedTweetRendererSource, /@Prop renderVersion: number = 0/)
  assert.match(quotedTweetRendererSource, /renderVersion: this\.renderVersion/)
  assert.match(
    tweetEntryCardSource,
    /activeMediaKey: this\.activeInlineVideoKey/,
  )
  assert.match(
    tweetEntryCardSource,
    /activeInlineVideoKey: this\.activeInlineVideoKey/,
  )
  assert.match(
    tweetEntryCardSource,
    /private requestInlineVideoStart\(controller: VideoController\): void/,
  )
  assert.match(
    tweetEntryCardSource,
    /const controller = this\.inlineVideoControllerFor\(section, item, index\)[\s\S]*?this\.requestInlineVideoStart\(controller\)/,
  )
  assert.match(
    readFileSync(
      new URL('../entry/src/main/ets/pages/ArticleDetail.ets', import.meta.url),
      'utf8',
    ),
    /private requestSocialInlineVideoStart\(controller: VideoController\): void[\s\S]*?setTimeout\(\(\) => \{[\s\S]*?controller\.start\(\)/,
  )
})

test('home mode scenes mount active/transition immediately and unmount fully when inactive', () => {
  assert.match(
    indexHomeRootContentSource,
    /private shouldMountScene\(mode: SubscriptionMode\): boolean \{\s*return this\.getSceneProps\(mode\)\.shouldMount\s*\}/,
  )
  assert.doesNotMatch(indexHomeRootContentSource, /scenesPrewarmed/)
  assert.doesNotMatch(indexHomeRootContentSource, /visitedModes\.add\(mode\)/)
  assert.match(
    indexHomeRootContentSource,
    /if \(this\.shouldMountScene\('articles'\)\) \{[\s\S]*?this\.ModeEntriesScene\('articles'\)/,
  )
  assert.match(
    indexHomeRootContentSource,
    /if \(this\.shouldMountScene\('pictures'\)\) \{[\s\S]*?this\.ModeEntriesScene\('pictures'\)/,
  )
})

test('inactive mode precache is staggered and does not compete with the active switch target', () => {
  assert.match(sessionSource, /private precacheModeToken: number = 0/)
  assert.match(
    sessionSource,
    /const precacheLimit = resolveHomeVisibleEntryInitialLimit\(mode\)/,
  )
  assert.match(sessionSource, /180 \* \(index \+ 1\)/)
  assert.match(
    sessionSource,
    /if \(this\.precacheModeToken !== token \|\| mode === this\.owner\.mode\) \{\s*return\s*\}/s,
  )
})

test('load-more prefetch appends a fast page instead of rebuilding the whole mode', () => {
  assert.match(
    homeFeedLoadMorePrefetchSource,
    /this\.featuredEntriesQuery\.featuredEntriesFastPageByMode\(mode, appendCount, previousEntries\.length\)/,
  )
  assert.match(
    homeFeedLoadMorePrefetchSource,
    /import \{ mergeUniqueEntries \} from '\.\/HomeEntryUtils'/,
  )
  assert.doesNotMatch(
    homeFeedLoadMorePrefetchSource,
    /this\.featuredEntriesQuery\.featuredEntriesByMode\(mode, targetLimit\)/,
  )
})

test('all home modes can trigger load-more by scroll progress before hard bottom reach', () => {
  assert.match(
    indexPageSource,
    /if \(mode !== 'videos'\) \{[\s\S]*?this\.syncHomeModeRailState\(mode\)/,
  )
  assert.match(
    indexPageSource,
    /this\.maybeTriggerLoadMoreByScrollProgress\(mode, this\.readHomeModeScrollOffset\(mode\)\)/,
  )
})
