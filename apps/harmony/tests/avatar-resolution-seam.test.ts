import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const iAvatarResolverSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/services/avatar/IAvatarResolver.ets',
    import.meta.url,
  ),
  'utf8',
)

const httpAvatarResolverSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/services/avatar/HttpAvatarResolver.ets',
    import.meta.url,
  ),
  'utf8',
)

const preferenceCachedAvatarResolverSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/services/avatar/PreferenceCachedAvatarResolver.ets',
    import.meta.url,
  ),
  'utf8',
)

const socialFeedAvatarServiceSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/services/SocialFeedAvatarService.ets',
    import.meta.url,
  ),
  'utf8',
)

test('IAvatarResolver interface defines the expected contract', () => {
  assert.match(iAvatarResolverSource, /export interface IAvatarResolver/)
  assert.match(iAvatarResolverSource, /resolveFeedAvatar\(/)
})

test('HttpAvatarResolver implements IAvatarResolver and contains extraction logic', () => {
  assert.match(
    httpAvatarResolverSource,
    /import \{ IAvatarResolver \} from '\.\/IAvatarResolver'/,
  )
  assert.match(
    httpAvatarResolverSource,
    /export class HttpAvatarResolver implements IAvatarResolver/,
  )
  assert.match(httpAvatarResolverSource, /async resolveFeedAvatar\(/)
  assert.match(httpAvatarResolverSource, /fetchInstagramAvatar\(/)
  assert.match(httpAvatarResolverSource, /fetchYouTubeAvatar\(/)
  assert.match(httpAvatarResolverSource, /fetchBilibiliAvatar\(/)
})

test('PreferenceCachedAvatarResolver implements IAvatarResolver and uses DiscoverAvatarCacheStore', () => {
  assert.match(
    preferenceCachedAvatarResolverSource,
    /import \{ IAvatarResolver \} from '\.\/IAvatarResolver'/,
  )
  assert.match(
    preferenceCachedAvatarResolverSource,
    /import \{ DiscoverAvatarCacheStore \} from '\.\.\/DiscoverAvatarCacheStore'/,
  )
  assert.match(
    preferenceCachedAvatarResolverSource,
    /export class PreferenceCachedAvatarResolver implements IAvatarResolver/,
  )
  assert.match(
    preferenceCachedAvatarResolverSource,
    /DiscoverAvatarCacheStore\.load\(\)/,
  )
  assert.match(
    preferenceCachedAvatarResolverSource,
    /DiscoverAvatarCacheStore\.remember\(/,
  )
})

test('SocialFeedAvatarService facade exposes a setResolver seam and maintains backward compatibility', () => {
  assert.match(
    socialFeedAvatarServiceSource,
    /import \{ IAvatarResolver \} from '\.\/avatar\/IAvatarResolver'/,
  )
  assert.match(
    socialFeedAvatarServiceSource,
    /private static resolverInstance: IAvatarResolver/,
  )
  assert.match(
    socialFeedAvatarServiceSource,
    /static setResolver\(resolver: IAvatarResolver\): void/,
  )
  assert.match(
    socialFeedAvatarServiceSource,
    /static async resolveFeedAvatar\(/,
  )
  assert.match(
    socialFeedAvatarServiceSource,
    /return await SocialFeedAvatarService\.resolverInstance\.resolveFeedAvatar\(/,
  )
  assert.match(
    socialFeedAvatarServiceSource,
    /static async fetchInstagramAvatar\([\s\S]*?return await SocialFeedAvatarService\.resolverInstance\.fetchInstagramAvatar\(/,
  )
  assert.match(
    socialFeedAvatarServiceSource,
    /static async fetchYouTubeAvatar\([\s\S]*?return await SocialFeedAvatarService\.resolverInstance\.fetchYouTubeAvatar\(/,
  )
  assert.match(
    socialFeedAvatarServiceSource,
    /static async fetchBilibiliAvatar\([\s\S]*?return await SocialFeedAvatarService\.resolverInstance\.fetchBilibiliAvatar\(/,
  )
})
