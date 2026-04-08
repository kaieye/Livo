import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

test('DiscoverRemoteSearchService searches instagram profiles with lightweight parallel probing', () => {
  const source = read(
    '../entry/src/main/ets/common/services/DiscoverRemoteSearchService.ets',
  )

  assert.match(
    source,
    /const searchSeeds = await DiscoverRemoteSearchService\.searchInstagramUsersByTopsearch\(clean\)/,
  )
  assert.match(source, /const variants = buildQueryVariants\(query, 30\)/)
  assert.match(source, /const INSTAGRAM_SEARCH_TIMEOUT_MS = 3500/)
  assert.match(
    source,
    /const seedResults = await Promise\.allSettled\(\s*variants\.map\(\(username: string\) => DiscoverRemoteSearchService\.fetchInstagramProfileSeed\(username\)\),?\s*\)/,
  )
  assert.match(source, /const seeds: DiscoverRemoteProfileSeed\[\] = \[\]/)
  assert.match(
    source,
    /const fallbackSeeds: DiscoverRemoteProfileSeed\[\] = \[\]/,
  )
  assert.match(
    source,
    /seedResults\.forEach\(\(result: PromiseSettledResult<DiscoverRemoteProfileSeed \| undefined>\) => \{/,
  )
  assert.match(
    source,
    /const dedupedSeeds = dedupeAndLimitDiscoverCandidates\(\s*\[\.\.\.searchSeeds, \.\.\.fallbackSeeds\],\s*12,\s*\)/,
  )
  assert.match(
    source,
    /return dedupeCandidates\(dedupedSeeds\.map\(\(seed: DiscoverRemoteProfileSeed\) => withConfiguredRssHubCandidate\(\s*buildInstagramCandidateFromProfile\(seed, SOCIAL_VIEW_MAPPING\) as ResolvedDiscoverCandidate,\s*\)\)\)/s,
  )
  assert.doesNotMatch(
    source,
    /const payload = await RssFeedService\.previewFeedUrl\(routeUrl\)/,
  )
  assert.match(source, /connectTimeout: INSTAGRAM_SEARCH_TIMEOUT_MS/)
  assert.match(source, /readTimeout: INSTAGRAM_SEARCH_TIMEOUT_MS/)
  assert.match(
    source,
    /https:\/\/www\.instagram\.com\/web\/search\/topsearch\/\?query=\$\{encodeURIComponent\(query\)\}&context=user/,
  )
})
