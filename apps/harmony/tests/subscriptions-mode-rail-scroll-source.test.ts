import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('subscriptions mode rail and source summary are rendered inside the feed section scroll content', () => {
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
  assert.match(feedSection, /Text\(this\.sourceHint\)/)
  assert.match(
    feedSection,
    /Text\(`\$\{this\.filteredFeeds\(\)\.length\} 个订阅源`\)/,
  )
})
