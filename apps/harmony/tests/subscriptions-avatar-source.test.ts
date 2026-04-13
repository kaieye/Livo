import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

test('SubscriptionsContent resolves social avatars before generic favicon fallback', () => {
  const source = read(
    '../entry/src/main/ets/common/components/SubscriptionsContent.ets',
  )

  assert.match(
    source,
    /import \{ resolveSocialFeedDisplayImageUrl \} from '\.\.\/utils\/SocialFeedPresentation'/,
  )
  assert.match(source, /private normalizeSiteUrl\(value: string\): string/)
  assert.match(
    source,
    /const normalizedFeedUrl = this\.normalizeSiteUrl\(feed\.url\)/,
  )
  assert.match(
    source,
    /const normalizedSiteUrl = this\.normalizeSiteUrl\(feed\.siteUrl\)/,
  )
  assert.match(
    source,
    /const resolved = resolveSocialFeedDisplayImageUrl\(\s*feed\.imageUrl,\s*normalizedFeedUrl,\s*normalizedSiteUrl,\s*feed\.title,\s*\)/,
  )
  assert.match(source, /return this\.deriveFallbackIcon\(normalizedSiteUrl\)/)
})
