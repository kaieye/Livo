import test from 'node:test'
import assert from 'node:assert/strict'

import {
  discoverAvatarCacheKeys,
  isDiscoverAvatarCacheableImageUrl,
  isDiscoverAvatarPlaceholderUrl,
} from '../entry/src/main/ets/common/utils/DiscoverAvatarPresentation.ts'

test('discover avatar cache keys match the same RSSHub route across instances', () => {
  const keys = discoverAvatarCacheKeys(
    'https://rsshub.liumingye.cn/twitter/user/elonmusk',
    'https://x.com/elonmusk',
  )

  assert.ok(keys.includes('rsshub://twitter/user/elonmusk|'))
  assert.ok(
    keys.includes('rsshub://twitter/user/elonmusk|https://x.com/elonmusk'),
  )
})

test('discover avatar cache keys include canonical social route aliases', () => {
  const keys = discoverAvatarCacheKeys(
    'https://rsshub.pseudoyu.com/x/user/openai',
    'https://x.com/openai',
  )

  assert.ok(keys.includes('https://rsshub.pseudoyu.com/twitter/user/openai|'))
  assert.ok(keys.includes('rsshub://twitter/user/openai|'))
})

test('discover avatar placeholder detection keeps hydrated images cacheable', () => {
  assert.equal(
    isDiscoverAvatarPlaceholderUrl(
      'https://www.google.com/s2/favicons?domain=rsshub.pseudoyu.com&sz=128',
    ),
    true,
  )
  assert.equal(
    isDiscoverAvatarPlaceholderUrl(
      'https://icons.duckduckgo.com/ip3/example.com.ico',
    ),
    true,
  )
  assert.equal(
    isDiscoverAvatarPlaceholderUrl('https://i0.hdslb.com/bfs/face/avatar.jpg'),
    false,
  )
})

test('discover avatar cache rejects RSSHub default favicon but keeps site favicons', () => {
  assert.equal(
    isDiscoverAvatarCacheableImageUrl(
      'https://www.google.com/s2/favicons?domain=rsshub.pseudoyu.com&sz=128',
    ),
    false,
  )
  assert.equal(
    isDiscoverAvatarCacheableImageUrl(
      'https://rsshub.pseudoyu.com/favicon.ico',
    ),
    false,
  )
  assert.equal(
    isDiscoverAvatarCacheableImageUrl(
      'https://lf-web-assets.juejin.cn/obj/juejin-web/xitu_juejin_web/static/favicons/apple-touch-icon.png',
    ),
    true,
  )
})

test('discover avatar cache rejects inferred platform avatars', () => {
  assert.equal(
    isDiscoverAvatarCacheableImageUrl(
      'https://unavatar.io/youtube/ucxzcjldbc09xxgz6gcdrc6a?fallback=false',
    ),
    false,
  )
  assert.equal(
    isDiscoverAvatarCacheableImageUrl(
      'https://unavatar.io/bilibili/946974?fallback=false',
    ),
    false,
  )
})
