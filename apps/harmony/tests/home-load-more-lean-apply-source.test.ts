import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const paginationSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/HomeFeedPagination.ets',
    import.meta.url,
  ),
  'utf8',
)

const dataManagerSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/HomeEntryDataManager.ets',
    import.meta.url,
  ),
  'utf8',
)

test('article and social load-more avoids global merge and snapshot work on the scroll path', () => {
  assert.match(
    paginationSource,
    /private shouldUseLeanLoadMoreApply\(mode: SubscriptionMode\): boolean \{\s*return mode === 'articles' \|\| mode === 'social'\s*\}/,
  )
  assert.match(
    paginationSource,
    /this\.session\.applyEntriesForMode\(mode, entries, true, skipNotify, leanApply, leanApply\)/,
  )
  assert.match(dataManagerSource, /skipPersist: boolean = false/)
  assert.match(dataManagerSource, /if \(!skipPersist && !skipMerge\) \{/)
})
