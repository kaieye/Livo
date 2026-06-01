import { describe, expect, it } from 'vitest'
import { buildDiscoverInstagramPlaceholderAvatar } from './discover-avatar'

describe('discover-avatar', () => {
  it('builds an immediate instagram gradient placeholder avatar', () => {
    const avatar = buildDiscoverInstagramPlaceholderAvatar('@openai')
    expect(avatar.startsWith('data:image/svg+xml,')).toBe(true)
    expect(decodeURIComponent(avatar)).toContain('linearGradient')
    expect(decodeURIComponent(avatar)).toContain('>O<')
  })
})
