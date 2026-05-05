import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const repositoryHelpersSource = readFileSync(
  new URL(
    '../entry/src/main/ets/common/data/AppRepositoryEntryHelpers.ets',
    import.meta.url,
  ),
  'utf8',
)

test('entry dedupe key includes title and publishedAt to avoid dropping distinct items with sparse ids', () => {
  assert.match(
    repositoryHelpersSource,
    /const title = \(entry\.title \|\| ''\)\.trim\(\)/,
  )
  assert.match(
    repositoryHelpersSource,
    /const publishedAt = entry\.publishedAt > 0 \? String\(entry\.publishedAt\) : '0'/,
  )
  assert.match(
    repositoryHelpersSource,
    /return `\$\{id\}\|\$\{feedId\}\|\$\{articleUrl\}\|\$\{title\}\|\$\{publishedAt\}`/,
  )
})
