import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('subscriptions rail aligns with the home title spacing while keeping the lower section gap', () => {
  const source = readFileSync(
    new URL(
      '../entry/src/main/ets/common/components/SubscriptionsContent.ets',
      import.meta.url,
    ),
    'utf8',
  )

  assert.match(source, /private FeedSection\(mode: SubscriptionMode\)/)
  assert.match(
    source,
    /Column\(\{ space: 0 \}\)\s*\{\s*Blank\(\)\s*\.height\(SUBSCRIPTIONS_TITLE_BAR_OVERLAY_SPACER\)/s,
  )
  assert.match(source, /Column\(\{ space: ROOT_MODE_RAIL_TOP_GAP \}\)/)
  assert.match(source, /Column\(\{ space: 14 \}\)/)
  assert.doesNotMatch(source, /Text\(this\.sourceHint\)/)
  assert.doesNotMatch(source, /个订阅源/)
})
