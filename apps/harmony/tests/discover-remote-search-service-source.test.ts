import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

test('DiscoverRemoteSearchService searches X users through Nitter result pages before fallback profile probes', () => {
  const source = read(
    '../entry/src/main/ets/common/services/DiscoverRemoteSearchService.ets',
  )

  assert.match(
    source,
    /private static async searchXUsers\(query: string\): Promise<ResolvedDiscoverCandidate\[]>/,
  )
  assert.match(
    source,
    /const searchSeeds = await DiscoverRemoteSearchService\.searchXUsersByNitter\(clean\)/,
  )
  assert.match(source, /parseXProfilesFromSearchHtml\(html, clean\)/)
  assert.match(
    source,
    /const dedupedSeeds = dedupeAndLimitDiscoverCandidates\(\s*\[\.\.\.searchSeeds, \.\.\.fallbackSeeds\],\s*12,\s*\)/,
  )
})

test('DiscoverRemoteSearchService searches Instagram users through official topsearch payloads before profile fallback probes', () => {
  const source = read(
    '../entry/src/main/ets/common/services/DiscoverRemoteSearchService.ets',
  )

  assert.match(
    source,
    /private static async searchInstagramUsers\(query: string\): Promise<ResolvedDiscoverCandidate\[]>/,
  )
  assert.match(
    source,
    /const searchSeeds = await DiscoverRemoteSearchService\.searchInstagramUsersByTopsearch\(clean\)/,
  )
  assert.match(
    source,
    /https:\/\/www\.instagram\.com\/web\/search\/topsearch\/\?query=\$\{encodeURIComponent\(query\)\}&context=user/,
  )
  assert.match(
    source,
    /parseInstagramProfilesFromTopsearchPayload\(JSON\.parse\(String\(response\.result\)\), query\)/,
  )
  assert.match(
    source,
    /const dedupedSeeds = dedupeAndLimitDiscoverCandidates\(\s*\[\.\.\.searchSeeds, \.\.\.fallbackSeeds\],\s*12,\s*\)/,
  )
})
