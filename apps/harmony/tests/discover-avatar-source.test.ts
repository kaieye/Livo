import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const avatarTileSource = fs.readFileSync(
  path.join(
    process.cwd(),
    'entry/src/main/ets/common/components/AvatarTile.ets',
  ),
  'utf8',
)

const discoverContentSource = fs.readFileSync(
  path.join(
    process.cwd(),
    'entry/src/main/ets/common/components/DiscoverContent.ets',
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

test('AvatarTile resets load failure when the refresh token changes', () => {
  assert.match(
    avatarTileSource,
    /@Prop\s+@Watch\('handleRefreshTokenChange'\)\s+refreshToken:\s+number\s*=\s*0/,
  )
  assert.match(
    avatarTileSource,
    /private handleRefreshTokenChange\(\): void \{\s*this\.imageLoadFailed = false\s*\}/s,
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

test('DiscoverContent falls back to site favicon ico for generic avatars', () => {
  assert.match(
    discoverContentSource,
    /private faviconUrl\(siteUrl: string\): string \{\s*const host = this\.hostOf\(siteUrl\)\s*return host \? `https:\/\/\$\{host\}\/favicon\.ico` : ''\s*\}/s,
  )
})

test('DiscoverContent resets avatar tiles after overlay or feed refresh changes', () => {
  assert.match(
    discoverContentSource,
    /refreshToken: this\.feedsChangedAt \+ this\.discoverOverlayLevel,/,
  )
})

test('DiscoverContent guards against auto keyboard popup on page enter', () => {
  assert.match(
    discoverContentSource,
    /private searchFocusGuardToken: number = 0/,
  )
  assert.match(
    discoverContentSource,
    /private preventAutoKeyboardPopup\(\): void \{[\s\S]*this\.dismissSearchFocus\(\)[\s\S]*setTimeout\([\s\S]*80\)[\s\S]*setTimeout\([\s\S]*220\)/,
  )
  assert.match(
    discoverContentSource,
    /aboutToAppear\(\): void \{\s*this\.preventAutoKeyboardPopup\(\)/s,
  )
})
