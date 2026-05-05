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
const indexSource = readFileSync(
  new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
  'utf8',
)
const cacheSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/utils/TweetEntryPresentationCache.ets',
    import.meta.url,
  ),
  'utf8',
)

test('load more diagnostics logs query, append notification, and tweet presentation cache summary', () => {
  assert.match(
    paginationSource,
    /append-page mode=\$\{mode\} prevTotal=\$\{previousTotal\} appendCount=\$\{appendCount\} nextPage=\$\{nextPage\.length\} queryMs=/,
  )
  assert.match(
    paginationSource,
    /beginTweetPresentationDiagSession\(mode, 'request-start', previousModeTotal\)/,
  )
  assert.match(
    paginationSource,
    /flushTweetPresentationDiagSession\('request-finally'\)/,
  )
  assert.match(
    dataManagerSource,
    /notifyModeAppended mode=\$\{mode\} startIndex=\$\{startIndex\} elapsedMs=/,
  )
  assert.match(
    indexSource,
    /tweet-presentation-diag-start token=\$\{this\.tweetPresentationDiagToken\}/,
  )
  assert.match(
    indexSource,
    /tweet-presentation-diag-done token=\$\{this\.tweetPresentationDiagToken\}/,
  )
  assert.match(
    cacheSource,
    /this\.diagnostics\?\.onAccess\(false, Date\.now\(\) - startedAt\)/,
  )
  assert.match(
    readFileSync(
      new URL(
        '../entry/src/main/ets/common/utils/HomeFeedLoadMorePrefetch.ets',
        import.meta.url,
      ),
      'utf8',
    ),
    /consume-prefetch nextLimit=\$\{nextLimit\} entries=\$\{entries\.length\} prefetchedLimit=\$\{remainingPrefetchedLimit\}/,
  )
})
