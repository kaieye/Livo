import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('subscriptions rail spacer uses a tighter extra height so the rail sits closer to the header', () => {
  const source = readFileSync(
    new URL(
      '../entry/src/main/ets/common/components/SubscriptionsContent.ets',
      import.meta.url,
    ),
    'utf8',
  )

  assert.match(
    source,
    /import \{[\s\S]*ROOT_MODE_RAIL_SPACER_EXTRA_HEIGHT[\s\S]*ROOT_MODE_RAIL_TOP_GAP[\s\S]*\} from '\.\/FloatingRootPageLayout'/,
  )
  assert.match(
    source,
    /FloatingRootPageSpacer\(\{\s*topAvoidArea: this\.topAvoidArea,\s*extraHeight: ROOT_MODE_RAIL_SPACER_EXTRA_HEIGHT,\s*\}\)/s,
  )
  assert.doesNotMatch(source, /RootModeRailSection\(\{/)
  assert.match(source, /Column\(\{ space: ROOT_MODE_RAIL_TOP_GAP \}\)/)
})
