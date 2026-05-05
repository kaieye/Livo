import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const refreshSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/HomeFeedRefresh.ets',
    import.meta.url,
  ),
  'utf8',
)

test('full-mode refresh defers heavy home reload until idle', () => {
  assert.match(
    refreshSource,
    /if \(this\.session\.shouldRenderAllEntriesForMode\(this\.session\.mode\)\) \{\s*this\.scheduleFinalHomeReloadWhenIdle\(currentVersion\)\s*return\s*\}/s,
  )
})

test('idle home reload path clears pending state after the deferred reload finishes', () => {
  assert.match(refreshSource, /const finishPending = \(\): void => \{/)
  assert.match(
    refreshSource,
    /reloadHomeEntriesFromLocal\(HOME_MAX_CANDIDATE_LIMIT, false, true\)\.finally\(\(\) => \{\s*finishPending\(\)\s*\}\)/s,
  )
})
