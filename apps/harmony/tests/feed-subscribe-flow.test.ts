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

const socialFeedAvatarServiceSource = fs.readFileSync(
  path.join(
    process.cwd(),
    'apps/harmony/entry/src/main/ets/common/services/SocialFeedAvatarService.ets',
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

const discoverContentSource = fs.readFileSync(
  path.join(
    process.cwd(),
    'apps/harmony/entry/src/main/ets/common/components/DiscoverContent.ets',
  ),
  'utf8',
)

const seedDataSource = fs.readFileSync(
  path.join(
    process.cwd(),
    'apps/harmony/entry/src/main/ets/common/data/SeedData.ets',
  ),
  'utf8',
)

test('TweetEntryCard renders tweet-specific sections', () => {
  const source = fs.readFileSync(
    'apps/harmony/entry/src/main/ets/common/components/TweetEntryCard.ets',
    'utf8',
  )

  assert.match(source, /export struct TweetEntryCard/)
  assert.match(source, /presentation: TweetEntryPresentation/)
  assert.match(source, /presentation\.displayName/)
  assert.match(source, /presentation\.username/)
  assert.match(source, /presentation\.text/)
  assert.match(source, /presentation\.mediaUrls/)
  assert.match(
    source,
    /private usernameLabel\(\): string \{\s*return \(this\.presentation\.username \|\| ''\)\.trim\(\)\s*\}/s,
  )
  assert.match(
    source,
    /if \(this\.usernameLabel\(\)\) \{\s*Text\(this\.usernameLabel\(\)\)/s,
  )
  assert.match(source, /presentation\.kind === 'retweet'/)
  assert.match(source, /presentation\.retweetByLabel/)
  assert.match(source, /private QuoteCard\(\)/)
  assert.match(source, /presentation\.kind === 'quote'/)
  assert.match(source, /presentation\.quotedTweet/)
  assert.doesNotMatch(source, /private ActionRow\(\)/)
  assert.doesNotMatch(source, /private ActionItem\(/)
  assert.match(source, /avatarSize:\s*17/)
  assert.match(source, /showFallbackLabel:\s*false/)
  assert.match(source, /Row\(\{ space: 8 \}\) \{\s*AvatarTile\(/s)
  assert.match(source, /Text\(this\.presentation\.displayName \|\| '未知来源'\)/)
  assert.match(source, /Column\(\{ space: 8 \}\) \{\s*this\.RetweetBanner\(\)\s*Row\(\{ space: 8 \}\)/s)
  assert.match(
    source,
    /\.alignItems\(VerticalAlign\.Top\)\s*if \(this\.presentation\.text\) \{\s*Text\(this\.presentation\.text\)/s,
  )
  assert.doesNotMatch(
    source,
    /Text\(this\.presentation\.text\)[\s\S]{0,120}\.maxLines\(/s,
  )
})

test('FeedDetailView routes x previews through TweetEntryCard', () => {
  assert.match(
    feedDetailViewSource,
    /import \{ presentTweetEntryFromEntry \} from '\.\.\/utils\/TweetEntryPresentation'/,
  )
  assert.match(
    feedDetailViewSource,
    /import \{ TweetEntryCard \} from '\.\/TweetEntryCard'/,
  )
  assert.match(feedDetailViewSource, /private isXPreview\(\): boolean/)
  assert.match(
    feedDetailViewSource,
    /presentTweetEntryFromEntry\(entry, this\.resolvedAvatarUrl\(\)\)/,
  )
  assert.match(
    feedDetailViewSource,
    /else if \(this\.isXPreview\(\)\) \{\s*TweetEntryCard\(\{/s,
  )
})

test('Index routes x social cards through TweetEntryCard', () => {
  const indexSource = fs.readFileSync(
    path.join(process.cwd(), 'apps/harmony/entry/src/main/ets/pages/Index.ets'),
    'utf8',
  )

  assert.match(
    indexSource,
    /import \{ TweetEntryCard \} from '\.\.\/common\/components\/TweetEntryCard'/,
  )
  assert.match(
    indexSource,
    /import \{ presentTweetEntryFromCard \} from '\.\.\/common\/utils\/TweetEntryPresentation'/,
  )
  assert.match(indexSource, /private isXSocialEntry\(entry: EntryCardModel\): boolean/)
  assert.match(indexSource, /private SocialEntryCard\(entry: EntryCardModel\)/)
  assert.match(indexSource, /presentTweetEntryFromCard\(entry\)/)
  assert.match(
    indexSource,
    /if \(mode === 'social'\) \{\s*this\.SocialEntryCard\(entry\)\s*\} else \{\s*this\.EntryCard\(entry\)\s*\}/s,
  )
})

test('Home and subscriptions mode scenes support horizontal swipe switching', () => {
  const indexSource = fs.readFileSync(
    path.join(process.cwd(), 'apps/harmony/entry/src/main/ets/pages/Index.ets'),
    'utf8',
  )
  const subscriptionsContentSource = fs.readFileSync(
    path.join(process.cwd(), 'apps/harmony/entry/src/main/ets/common/components/SubscriptionsContent.ets'),
    'utf8',
  )

  assert.match(indexSource, /const MODE_SWIPE_TRIGGER_OFFSET: number = 56/)
  assert.match(indexSource, /private handleModeSwipe\(event: GestureEvent\): void/)
  assert.match(indexSource, /PanGesture\(\{ direction: PanDirection\.Horizontal \}\)/)
  assert.match(indexSource, /this\.handleModeSwipe\(event\)/)

  assert.match(subscriptionsContentSource, /const MODE_SWIPE_TRIGGER_OFFSET: number = 56/)
  assert.match(subscriptionsContentSource, /private handleModeSwipe\(event: GestureEvent\): void/)
  assert.match(subscriptionsContentSource, /PanGesture\(\{ direction: PanDirection\.Horizontal \}\)/)
  assert.match(subscriptionsContentSource, /this\.handleModeSwipe\(event\)/)
})

test('SubscriptionsContent keeps overlay storage in sync across detail and config destinations', () => {
  const subscriptionsContentSource = fs.readFileSync(
    path.join(process.cwd(), 'apps/harmony/entry/src/main/ets/common/components/SubscriptionsContent.ets'),
    'utf8',
  )

  assert.match(
    subscriptionsContentSource,
    /private syncOverlayLevel\(level: number\): void \{\s*this\.overlayLevel = level\s*AppStorage\.setOrCreate\('subscriptionsOverlayLevel', level\)\s*\}/s,
  )
  assert.match(
    subscriptionsContentSource,
    /private settleSubscriptionsRootVisible\(\): void \{\s*this\.syncOverlayLevel\(0\)\s*\}/s,
  )
  assert.match(
    subscriptionsContentSource,
    /FeedDetailView\(\{[\s\S]*onBack: \(\) => \{ this\.closeFeedDetailPage\(\) \}/s,
  )
  assert.match(
    subscriptionsContentSource,
    /\.onAppear\(\(\) => \{\s*this\.syncOverlayLevel\(1\)\s*\}\)/s,
  )
  assert.match(
    subscriptionsContentSource,
    /\.onDisAppear\(\(\) => \{\s*const currentLevel = AppStorage\.get<number>\('subscriptionsOverlayLevel'\) \?\? 0\s*if \(currentLevel <= 1\) \{\s*this\.syncOverlayLevel\(0\)\s*\}\s*\}\)/s,
  )
  assert.match(
    subscriptionsContentSource,
    /FeedSubscribeConfigView\(\{[\s\S]*onBack: \(\) => \{[\s\S]*this\.subscriptionPathStack\.pop\(true\)[\s\S]*\}/s,
  )
  assert.match(
    subscriptionsContentSource,
    /\.onAppear\(\(\) => \{\s*this\.syncOverlayLevel\(2\)\s*\}\)/s,
  )
  assert.match(
    subscriptionsContentSource,
    /\.onDisAppear\(\(\) => \{\s*const currentLevel = AppStorage\.get<number>\('subscriptionsOverlayLevel'\) \?\? 0\s*if \(currentLevel > 1\) \{\s*this\.syncOverlayLevel\(1\)\s*\} else \{\s*this\.syncOverlayLevel\(currentLevel\)\s*\}\s*\}\)/s,
  )
  assert.match(
    subscriptionsContentSource,
    /\.onAppear\(\(\) => \{\s*this\.settleSubscriptionsRootVisible\(\)\s*\}\)/s,
  )
})

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
    /const effectiveTargetUrl = this\.effectiveSubscribedUrl\(\s*cachedPreview\?\.resolvedFeedUrl\?\.trim\(\) \|\| this\.mappedTargetUrl\(\),\s*cachedPreview\?\.siteUrl\?\.trim\(\) \|\| this\.targetSiteUrl\.trim\(\),\s*\)/,
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

test('FeedDetailView builds instagram avatar candidates from resolved and subscribed feed urls', () => {
  assert.match(
    feedDetailViewSource,
    /extractInstagramUsername\(this\.previewPayload\?\.resolvedFeedUrl \|\| ''\)/,
  )
  assert.match(
    feedDetailViewSource,
    /extractInstagramUsername\(this\.existingFeed\?\.url \|\| ''\)/,
  )
})

test('FeedDetailView prefers cached preview image for subscribed instagram detail rendering', () => {
  assert.match(
    feedDetailViewSource,
    /private preferredDisplayImageUrl\(primaryImageUrl: string, fallbackImageUrl: string\): string/,
  )
  assert.match(
    feedDetailViewSource,
    /const payloadImageUrl = this\.preferredDisplayImageUrl\(cachedPayload\?\.imageUrl \|\| '', displayFeed\.imageUrl\)/,
  )
})

test('Harmony subscribes and detail view both resolve real instagram avatars', () => {
  assert.match(
    socialFeedAvatarServiceSource,
    /static async fetchInstagramAvatar\(username: string\): Promise<string>/,
  )
  assert.match(
    socialFeedAvatarServiceSource,
    /extractMetaContent\(html, 'og:image'\)/,
  )
  assert.match(
    appRepositorySource,
    /const nextResolvedImageUrl = await SocialFeedAvatarService\.resolveFeedAvatar\(/,
  )
  assert.match(
    feedDetailViewSource,
    /await this\.hydrateSubscribedAvatar\(feed, payloadImageUrl\)/,
  )
  assert.match(
    feedDetailViewSource,
    /this\.resetHeroAvatarCandidates\(\)\s*await this\.hydrateSubscribedAvatar\(feed, payloadImageUrl\)/,
  )
})

test('FeedDetailView dedupes picture preview entries before rendering', () => {
  assert.match(
    feedDetailViewSource,
    /return this\.dedupePicturePreviewEntries\(entries\)\.slice\(0, 50\)/,
  )
  assert.match(
    feedDetailViewSource,
    /private dedupePicturePreviewEntries\(entries: Entry\[\]\): Entry\[\]/,
  )
})

test('FeedDetailView hides subscribe button when feed already exists', () => {
  assert.match(
    feedDetailViewSource,
    /if \(this\.previewPayload && !this\.existingFeed\)/,
  )
  assert.doesNotMatch(
    feedDetailViewSource,
    /Button\(this\.existingFeed \? '已订阅' : '订阅'\)/,
  )
})

test('DiscoverContent highlights unsubscribed search results and shows subscribed state for existing feeds', () => {
  assert.match(
    discoverContentSource,
    /import \{ extractInstagramUsername, extractXUsername \} from '\.\.\/utils\/SocialFeedTitles'/,
  )
  assert.match(
    discoverContentSource,
    /private isSubscribedCandidate\(candidate: ResolvedDiscoverCandidate\): boolean/,
  )
  assert.match(
    discoverContentSource,
    /private extractCanonicalFeedIdentity\(primaryUrl: string, secondaryUrl: string\): string/,
  )
  assert.match(
    discoverContentSource,
    /private extractBilibiliIdentity\(value: string\): string/,
  )
  assert.match(
    discoverContentSource,
    /private extractYouTubeIdentity\(value: string\): string/,
  )
  assert.match(
    discoverContentSource,
    /private collectFeedIdentityKeys\(url: string, siteUrl: string, title: string\): string\[\]/,
  )
  assert.match(
    discoverContentSource,
    /return this\.isSubscribedFeedIdentity\(feed\.url, feed\.siteUrl, feed\.title\)/,
  )
  assert.match(
    discoverContentSource,
    /return this\.isSubscribedFeedIdentity\(candidate\.targetUrl, candidate\.siteUrl, candidate\.targetTitle\)/,
  )
  assert.match(
    discoverContentSource,
    /private candidateActionLabel\(candidate: ResolvedDiscoverCandidate\): string/,
  )
  assert.match(
    discoverContentSource,
    /Button\(this\.candidateActionLabel\(candidate\)\)/,
  )
  assert.match(
    discoverContentSource,
    /\.backgroundColor\(this\.candidateActionBackground\(candidate\)\)/,
  )
  assert.match(
    discoverContentSource,
    /\.onClick\(\(\) => \{\s*this\.openSubscribeConfigPage\(candidate\)\s*\}\)/,
  )
})

test('DiscoverContent dismisses search focus when the page reappears', () => {
  assert.match(discoverContentSource, /private dismissSearchFocus\(\): void/)
  assert.match(
    discoverContentSource,
    /this\.searchInputController\.stopEditing\(\)/,
  )
  assert.match(
    discoverContentSource,
    /aboutToAppear\(\): void \{\s*this\.dismissSearchFocus\(\)/,
  )
  assert.match(
    discoverContentSource,
    /\.onAppear\(\(\) => \{\s*this\.dismissSearchFocus\(\)/,
  )
})

test('DiscoverService provides built-in recommended feeds for every discover chip platform', () => {
  const discoverServiceSource = fs.readFileSync(
    path.join(
      process.cwd(),
      'apps/harmony/entry/src/main/ets/common/services/DiscoverService.ets',
    ),
    'utf8',
  )

  const requiredMarkers = [
    "siteUrl: 'https://www.youtube.com/",
    "siteUrl: 'https://space.bilibili.com/",
    "siteUrl: 'https://x.com/",
    "siteUrl: 'https://www.instagram.com/",
  ]

  requiredMarkers.forEach((marker) => {
    assert.match(
      discoverServiceSource,
      new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    )
  })
})

test('DiscoverContent still uses platform-scoped recommended fallback helpers', () => {
  const discoverServiceSource = fs.readFileSync(
    path.join(
      process.cwd(),
      'apps/harmony/entry/src/main/ets/common/services/DiscoverService.ets',
    ),
    'utf8',
  )

  assert.match(
    discoverContentSource,
    /filteredRecommendedFeedsByPlatform\(this\.searchPlatform\)/,
  )
  assert.match(
    discoverContentSource,
    /searchedRecommendedFeedsByPlatform\(this\.query, this\.searchPlatform\)/,
  )
  assert.match(
    discoverServiceSource,
    /export function filteredRecommendedFeedsByPlatform\(platform: DiscoverSearchPlatform\)/,
  )
})

test('Discover built-in recommendations carry avatar metadata into candidate rows', () => {
  const discoverServiceSource = fs.readFileSync(
    path.join(
      process.cwd(),
      'apps/harmony/entry/src/main/ets/common/services/DiscoverService.ets',
    ),
    'utf8',
  )

  assert.match(
    discoverServiceSource,
    /export interface RecommendedFeed \{[\s\S]*imageUrl\?: string[\s\S]*\}/,
  )
  assert.match(
    discoverServiceSource,
    /export interface RecommendedFeed \{[\s\S]*followers\?: string[\s\S]*\}/,
  )
  assert.match(
    discoverServiceSource,
    /export interface ResolvedDiscoverCandidate \{[\s\S]*followers\?: string[\s\S]*\}/,
  )
  assert.match(
    discoverServiceSource,
    /imageUrl: 'https:\/\/yt3\.googleusercontent\.com\//,
  )
  assert.match(
    discoverServiceSource,
    /imageUrl: 'https:\/\/i\d\.hdslb\.com\/bfs\/face\//,
  )
  assert.match(discoverServiceSource, /imageUrl: 'https:\/\/unavatar\.io\/x\//)
  assert.match(
    discoverServiceSource,
    /imageUrl: 'https:\/\/unavatar\.io\/instagram\//,
  )
  assert.match(discoverContentSource, /imageUrl: feed\.imageUrl \|\| ''/)
  assert.match(discoverContentSource, /followers: feed\.followers \|\| ''/)
  assert.match(
    discoverContentSource,
    /private candidateMetaText\(candidate: ResolvedDiscoverCandidate\): string/,
  )
  assert.match(
    discoverContentSource,
    /Text\(this\.candidateMetaText\(candidate\)\)/,
  )
})

test('AppRepository keeps better subscribed feed metadata when refresh payload is lower quality', () => {
  assert.match(
    appRepositorySource,
    /resolvePreferredStoredFeedTitle\(feed\.title, payload\.feedTitle \|\| '', nextUrl, nextSiteUrl\)/,
  )
  assert.match(
    appRepositorySource,
    /resolvePreferredStoredFeedImageUrl\(feed\.imageUrl \|\| '', nextResolvedImageUrl\)/,
  )
})

test('SeedData defines the four built-in default subscriptions for the home tabs', () => {
  assert.match(seedDataSource, /title: '阮一峰的网络日志'/)
  assert.match(seedDataSource, /url: 'https:\/\/www\.ruanyifeng\.com\/blog\/atom\.xml'/)
  assert.match(seedDataSource, /view: FeedViewType\.Articles/)

  assert.match(seedDataSource, /title: 'elonmusk'/)
  assert.match(seedDataSource, /url: 'https:\/\/rsshub\.pseudoyu\.com\/x\/user\/elonmusk'/)
  assert.match(seedDataSource, /view: FeedViewType\.SocialMedia/)

  assert.match(seedDataSource, /title: 'du_chenduling'/)
  assert.match(seedDataSource, /url: 'https:\/\/rsshub\.pseudoyu\.com\/instagram\/user\/du_chenduling'/)
  assert.match(seedDataSource, /view: FeedViewType\.Pictures/)

  assert.match(seedDataSource, /title: '影视飓风'/)
  assert.match(seedDataSource, /url: 'https:\/\/rsshub\.pseudoyu\.com\/bilibili\/user\/video\/946974'/)
  assert.match(seedDataSource, /view: FeedViewType\.Videos/)
})
