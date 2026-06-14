import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CURATED_FEEDS } from '../../../shared/discover-data'
import { getDb } from '../../database'
import { addFeed } from '../../operations/feed-operations'
import { buildAddBuiltinSubscriptionTool } from './discover-tools'

vi.mock('../../database', () => ({
  getDb: vi.fn(),
}))

vi.mock('../../operations/feed-operations', () => ({
  addFeed: vi.fn(),
}))

const getDbMock = vi.mocked(getDb)
const addFeedMock = vi.mocked(addFeed)

function mockFeedsRepository(existingFeed: unknown = null): void {
  getDbMock.mockReturnValue({
    feeds: {
      getFeedByUrl: vi.fn(() => existingFeed),
    },
  } as unknown as ReturnType<typeof getDb>)
}

describe('buildAddBuiltinSubscriptionTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFeedsRepository()
  })

  it('routes built-in subscription through the shared Subscription Module', async () => {
    const builtin = CURATED_FEEDS[0]
    addFeedMock.mockResolvedValue({
      success: true,
      existed: false,
      feed: {
        id: 'feed-1',
        title: builtin.title,
        url: builtin.url,
      },
    } as Awaited<ReturnType<typeof addFeed>>)

    const tool = buildAddBuiltinSubscriptionTool()
    const result = await tool.execute({} as never, { feedTitle: builtin.title })

    expect(addFeedMock).toHaveBeenCalledWith({
      url: builtin.url,
      title: builtin.title,
      category: builtin.category,
    })
    expect(result.status).toBe('success')
    expect(result.data).toEqual({ feedId: 'feed-1' })
  })

  it('does not call the Subscription Module when the Feed is already subscribed', async () => {
    const builtin = CURATED_FEEDS[0]
    mockFeedsRepository({ id: 'existing-feed', title: builtin.title })

    const tool = buildAddBuiltinSubscriptionTool()
    const result = await tool.execute({} as never, { feedTitle: builtin.title })

    expect(addFeedMock).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      status: 'success',
      message: `您已订阅 "${builtin.title}"`,
    })
  })
})
