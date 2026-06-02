import { describe, it, expect } from 'vitest'
import {
  isMirrorHost,
  isMirrorMediaUrl,
  isInstagramFeedUrl,
  isInstagramUserFeedUrl,
  isMirrorProxyUrl,
} from './url-detect'

describe('isMirrorHost', () => {
  it('matches media.picnob.info', () => {
    expect(isMirrorHost('media.picnob.info')).toBe(true)
  })
  it('matches media.pixnoy.com', () => {
    expect(isMirrorHost('media.pixnoy.com')).toBe(true)
  })
  it('matches sp3.pixnoy.com (CDN subdomain)', () => {
    expect(isMirrorHost('sp3.pixnoy.com')).toBe(true)
  })
  it('matches sp99.pixnoy.com (any spN)', () => {
    expect(isMirrorHost('sp99.pixnoy.com')).toBe(true)
  })
  it('matches piokok.com', () => {
    expect(isMirrorHost('piokok.com')).toBe(true)
  })
  it('matches pixwox.com', () => {
    expect(isMirrorHost('pixwox.com')).toBe(true)
  })
  it('matches picnob.com', () => {
    expect(isMirrorHost('picnob.com')).toBe(true)
  })
  it('rejects instagram.com', () => {
    expect(isMirrorHost('instagram.com')).toBe(false)
  })
  it('rejects example.com', () => {
    expect(isMirrorHost('example.com')).toBe(false)
  })
})

describe('isMirrorMediaUrl', () => {
  it('matches media.picnob.info URL', () => {
    expect(
      isMirrorMediaUrl('https://media.picnob.info/some/path/img.jpg'),
    ).toBe(true)
  })
  it('matches sp2.pixnoy.com URL', () => {
    expect(isMirrorMediaUrl('https://sp2.pixnoy.com/cdn/image.webp')).toBe(true)
  })
  it('matches ig_cache_key param', () => {
    expect(
      isMirrorMediaUrl('https://example.com/img?ig_cache_key=abc123'),
    ).toBe(true)
  })
  it('matches media.pixwox.com', () => {
    expect(isMirrorMediaUrl('https://media.pixwox.com/get?url=xyz')).toBe(true)
  })
  it('rejects plain URL', () => {
    expect(isMirrorMediaUrl('https://example.com/img.jpg')).toBe(false)
  })
})

describe('isInstagramFeedUrl', () => {
  it('matches instagram.com', () => {
    expect(isInstagramFeedUrl('https://www.instagram.com/user/')).toBe(true)
  })
  it('matches picnob.info URL', () => {
    expect(isInstagramFeedUrl('https://picnob.info/user/someone/')).toBe(true)
  })
  it('matches pixnoy URL', () => {
    expect(isInstagramFeedUrl('https://pixnoy.com/user/x/')).toBe(true)
  })
  it('matches piokok', () => {
    expect(isInstagramFeedUrl('https://piokok.com/user/x/')).toBe(true)
  })
  it('matches pixwox', () => {
    expect(isInstagramFeedUrl('https://pixwox.com/user/x/')).toBe(true)
  })
  it('rejects unrelated URL', () => {
    expect(isInstagramFeedUrl('https://example.com/feed')).toBe(false)
  })
})

describe('isInstagramUserFeedUrl', () => {
  it('matches instagram user route', () => {
    expect(
      isInstagramUserFeedUrl('https://rsshub.app/instagram/user/12345'),
    ).toBe(true)
  })
  it('matches picnob user route', () => {
    expect(
      isInstagramUserFeedUrl('https://rsshub.app/picnob/user/someone/'),
    ).toBe(true)
  })
  it('matches pixwox user route', () => {
    expect(
      isInstagramUserFeedUrl('https://rsshub.app/pixwox/user/someone/'),
    ).toBe(true)
  })
  it('matches picnob.info user route', () => {
    expect(
      isInstagramUserFeedUrl('https://rsshub.app/picnob.info/user/x/'),
    ).toBe(true)
  })
  it('rejects non-user route', () => {
    expect(
      isInstagramUserFeedUrl('https://rsshub.app/instagram/tag/food'),
    ).toBe(false)
  })
  it('rejects unrelated URL', () => {
    expect(isInstagramUserFeedUrl('https://example.com/feed')).toBe(false)
  })
})

describe('isMirrorProxyUrl', () => {
  it('matches picnob host', () => {
    expect(isMirrorProxyUrl('https://picnob.com/something')).toBe(true)
  })
  it('matches pixwox host', () => {
    expect(isMirrorProxyUrl('https://pixwox.com/something')).toBe(true)
  })
  it('matches media CDN URL', () => {
    expect(isMirrorProxyUrl('https://media.pixnoy.com/get?url=abc')).toBe(true)
  })
  it('matches ig_cache_key in non-mirror host', () => {
    expect(isMirrorProxyUrl('https://cdn.example.com/img?ig_cache_key=x')).toBe(
      true,
    )
  })
  it('rejects unrelated URL', () => {
    expect(isMirrorProxyUrl('https://example.com/feed')).toBe(false)
  })
})
