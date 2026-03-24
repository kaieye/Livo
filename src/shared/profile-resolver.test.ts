import { describe, expect, it } from 'vitest'

import { FeedViewType } from './types'
import { resolveProfileUrlToCandidates } from './profile-resolver'

describe('resolveProfileUrlToCandidates', () => {
  it('prefers Bilibili video feeds before dynamic feeds', () => {
    const resolved = resolveProfileUrlToCandidates(
      'https://space.bilibili.com/15210701',
      'https://rsshub.app',
    )

    expect(resolved.platform).toBe('bilibili')
    expect(resolved.candidates[0]?.feedUrl).toBe(
      'https://rsshub.app/bilibili/user/video/15210701',
    )
    expect(resolved.candidates[0]?.view).toBe(FeedViewType.Videos)
    expect(resolved.candidates[1]?.feedUrl).toBe(
      'https://rsshub.app/bilibili/user/dynamic/15210701',
    )
    expect(resolved.candidates[1]?.view).toBe(FeedViewType.SocialMedia)
  })
})
