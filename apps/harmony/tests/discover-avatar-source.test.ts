import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const avatarTileSource = fs.readFileSync(
  path.join(
    process.cwd(),
    'apps/harmony/entry/src/main/ets/common/components/AvatarTile.ets',
  ),
  'utf8',
)

const discoverContentSource = fs.readFileSync(
  path.join(
    process.cwd(),
    'apps/harmony/entry/src/main/ets/common/components/DiscoverContent.ets',
  ),
  'utf8',
)

test('AvatarTile resets load failure when the image url changes', () => {
  assert.match(
    avatarTileSource,
    /@Prop\s+@Watch\('handleImageUrlChange'\)\s+imageUrl:\s+string\s*=\s*''/,
  )
  assert.match(
    avatarTileSource,
    /private handleImageUrlChange\(\): void \{\s*this\.imageLoadFailed = false\s*\}/s,
  )
})

test('DiscoverContent resolves search result avatars through social display image helper', () => {
  assert.match(
    discoverContentSource,
    /import \{ resolveSocialFeedDisplayImageUrl \} from '\.\.\/utils\/SocialFeedPresentation'/,
  )
  assert.match(
    discoverContentSource,
    /const resolvedImageUrl = resolveSocialFeedDisplayImageUrl\(\s*candidate\.imageUrl \?\? '',\s*candidate\.targetUrl,\s*candidate\.siteUrl,\s*candidate\.targetTitle,\s*\)/s,
  )
  assert.match(
    discoverContentSource,
    /if \(resolvedImageUrl\) \{\s*return resolvedImageUrl\s*\}/s,
  )
})
