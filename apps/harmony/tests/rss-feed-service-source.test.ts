import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

test('RssFeedService recognizes x routes as RSSHub urls for fallback retries', () => {
  const source = read(
    '../entry/src/main/ets/common/services/RssFeedService.ets',
  )

  assert.match(
    source,
    /return lowerUrl\.includes\('\/bilibili\/'\) \|\|[\s\S]*lowerUrl\.includes\('\/x\/'\) \|\|[\s\S]*lowerUrl\.includes\('\/twitter\/'\)/s,
  )
})

test('RssFeedService canonicalizes feed urls before issuing refresh requests', () => {
  const source = read(
    '../entry/src/main/ets/common/services/RssFeedService.ets',
  )

  assert.match(
    source,
    /import \{ canonicalFeedUrl \} from '\.\.\/utils\/SocialFeedTitles'/,
  )
  assert.match(
    source,
    /let actualUrl = canonicalFeedUrl\(feed\.url, feed\.siteUrl \|\| ''\) \|\| feed\.url/,
  )
})

test('RssFeedService prioritizes route-specific rsshub instances and uses longer timeout for instagram-like routes', () => {
  const source = read(
    '../entry/src/main/ets/common/services/RssFeedService.ets',
  )

  assert.match(
    source,
    /function preferredRssHubInstances\(route: string\): string\[\]/,
  )
  assert.match(
    source,
    /if \(route\.toLowerCase\(\)\.includes\('\/x\/'\) \|\| route\.toLowerCase\(\)\.includes\('\/twitter\/'\)\) \{\s*return \[\s*'https:\/\/rsshub\.pseudoyu\.com'/s,
  )
  assert.match(
    source,
    /if \(route\.toLowerCase\(\)\.includes\('\/bilibili\/'\)\) \{\s*return \[\s*'https:\/\/rsshub\.liumingye\.cn'/s,
  )
  assert.match(
    source,
    /if \(route\.toLowerCase\(\)\.includes\('\/picnob\/'\) \|\| route\.toLowerCase\(\)\.includes\('\/instagram\/'\)\) \{\s*return \[\s*'https:\/\/rsshub\.liumingye\.cn'/s,
  )
  assert.match(
    source,
    /function rssHubRequestTimeoutMs\(route: string\): number/,
  )
  assert.match(
    source,
    /if \(route\.toLowerCase\(\)\.includes\('\/picnob\/'\) \|\| route\.toLowerCase\(\)\.includes\('\/instagram\/'\)\) \{\s*return 8000/s,
  )
  assert.match(source, /const instances = preferredRssHubInstances\(route\)/)
  assert.match(source, /const timeoutMs = rssHubRequestTimeoutMs\(route\)/)
  assert.match(source, /connectTimeout: timeoutMs/)
  assert.match(source, /readTimeout: timeoutMs/)
})
