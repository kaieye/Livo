import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('subscriptions feed section keeps the mode rail in scroll content without the legacy source summary', () => {
  const source = readFileSync(
    new URL(
      '../entry/src/main/ets/common/components/SubscriptionsContent.ets',
      import.meta.url,
    ),
    'utf8',
  )
  const feedSectionStart = source.indexOf(
    'private FeedSection(mode: SubscriptionMode) {',
  )
  const feedSectionEnd = source.indexOf(
    'private ModeFeedsScene(mode: SubscriptionMode) {',
  )

  assert.notEqual(feedSectionStart, -1)
  assert.notEqual(feedSectionEnd, -1)

  const feedSection = source.slice(feedSectionStart, feedSectionEnd)
  assert.match(feedSection, /ContentModeRail\(\{/)
  assert.doesNotMatch(feedSection, /Text\(this\.sourceHint\)/)
  assert.doesNotMatch(feedSection, /个订阅源/)
  assert.match(feedSection, /Column\(\{ space: 20 \}\)/)
})
