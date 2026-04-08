import { describe, expect, it } from 'vitest'
import {
  buildInstagramDiscoverAvatar,
  createInstagramDiscoverCandidate,
  INSTAGRAM_DISCOVER_PROFILE_TIMEOUT_MS,
} from './discover-instagram-search'

describe('discover-instagram-search helpers', () => {
  it('builds an immediate unavatar url for instagram discover results', () => {
    expect(buildInstagramDiscoverAvatar('@openai')).toBe(
      'https://unavatar.io/instagram/openai?fallback=false',
    )
  })

  it('creates discover candidates without waiting on rss parsing', () => {
    expect(
      createInstagramDiscoverCandidate({
        username: 'openai',
        rsshubInstance: 'https://rsshub.app',
        displayName: 'OpenAI',
        description: '1.2M followers',
      }),
    ).toEqual({
      username: 'openai',
      title: 'OpenAI (@openai) - Instagram',
      description: '1.2M followers',
      image: 'https://unavatar.io/instagram/openai?fallback=false',
      feedUrl: 'https://rsshub.app/instagram/user/openai',
    })
  })

  it('uses a tight timeout for instagram profile enrichment', () => {
    expect(INSTAGRAM_DISCOVER_PROFILE_TIMEOUT_MS).toBe(1600)
  })
})
