import test from 'node:test'
import assert from 'node:assert/strict'

import { expandRssHubFallbackRoutes } from '../entry/src/main/ets/common/utils/RssHubFallbackRoute.ts'

test('expandRssHubFallbackRoutes keeps non-instagram routes unchanged', () => {
  assert.deepEqual(expandRssHubFallbackRoutes('/youtube/channel/UC123'), [
    '/youtube/channel/UC123',
  ])
})

test('expandRssHubFallbackRoutes adds instagram mirror route fallbacks', () => {
  assert.deepEqual(
    expandRssHubFallbackRoutes('/instagram/user/du_chenduling'),
    [
      '/instagram/user/du_chenduling',
      '/instagram/user/du_chenduling/count=100',
      '/instagram/user/du_chenduling?limit=100',
      '/picnob/user/du_chenduling',
      '/picnob.info/user/du_chenduling',
      '/pixnoy/user/du_chenduling',
      '/piokok/user/du_chenduling',
    ],
  )
})
