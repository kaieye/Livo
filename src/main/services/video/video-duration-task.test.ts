import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'events'
import { VIDEO_DURATION_ENRICH_TASK } from '../system/task-contracts'
import { resetLocalTaskRunnerForTest } from '../system/task-runner-service'
import { fetchVideoDuration, queueVideoDurationEnrich } from './video-duration'

const mocks = vi.hoisted(() => ({
  eventSend: vi.fn(),
  getEntries: vi.fn(),
  updateEntry: vi.fn(),
  getAllFeeds: vi.fn(),
  httpsGet: vi.fn(),
  assertNetworkFetchUrl: vi.fn(async (url: string) => url),
}))

vi.mock('https', () => ({
  default: { get: mocks.httpsGet },
  get: mocks.httpsGet,
}))

vi.mock('../../database', () => ({
  getDb: () => ({
    entries: {
      getEntries: mocks.getEntries,
      updateEntry: mocks.updateEntry,
    },
    feeds: {
      getAllFeeds: mocks.getAllFeeds,
    },
  }),
}))

vi.mock('../system/event-bus', () => ({
  getEventBus: () => ({ send: mocks.eventSend }),
}))

vi.mock('../system/network-url-policy', () => ({
  assertNetworkFetchUrl: mocks.assertNetworkFetchUrl,
}))

function mockHttpsResponses(
  responses: Array<{
    statusCode: number
    location?: string
    body?: string
  }>,
) {
  mocks.httpsGet.mockImplementation((_url, _options, callback) => {
    const response = responses.shift()
    if (!response) {
      throw new Error('unexpected request')
    }

    const res = new EventEmitter() as EventEmitter & {
      statusCode: number
      headers: Record<string, string>
    }
    res.statusCode = response.statusCode
    res.headers = response.location ? { location: response.location } : {}

    queueMicrotask(() => {
      callback(res)
      if (response.body) {
        res.emit('data', Buffer.from(response.body))
      }
      res.emit('end')
    })

    return { on: vi.fn() }
  })
}

describe('queueVideoDurationEnrich', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetLocalTaskRunnerForTest()
    mocks.getEntries.mockReturnValue({ entries: [] })
    mocks.getAllFeeds.mockReturnValue([])
    mocks.assertNetworkFetchUrl.mockImplementation(async (url: string) => url)
  })

  it('通过 Task Runner 记录视频时长补全任务状态', async () => {
    await expect(queueVideoDurationEnrich('feed-1')).resolves.toBe(0)

    const runRecords = mocks.eventSend.mock.calls
      .filter(([channel]) => channel === 'tasks:run-updated')
      .map(([, record]) => record)

    expect(runRecords.map((record) => record.status)).toEqual([
      'queued',
      'running',
      'running',
      'running',
      'succeeded',
    ])
    expect(runRecords.at(-1)).toMatchObject({
      taskName: VIDEO_DURATION_ENRICH_TASK.name,
      status: 'succeeded',
      progress: {
        completed: 1,
        total: 1,
        message: 'no-candidates',
        data: { feedId: 'feed-1', enriched: 0 },
      },
      metadata: { feedId: 'feed-1' },
    })
  })

  it('同一 feed 的并发补全请求复用同一个 run', async () => {
    const first = queueVideoDurationEnrich('feed-1')
    const second = queueVideoDurationEnrich('feed-1')

    expect(second).toBe(first)
    await expect(first).resolves.toBe(0)
  })

  it('caps duration lookup redirects', async () => {
    mockHttpsResponses(
      Array.from({ length: 6 }, (_, index) => ({
        statusCode: 302,
        location: `https://www.youtube.com/watch?v=abcdefghijk&r=${index}`,
      })),
    )

    await expect(
      fetchVideoDuration('https://www.youtube.com/watch?v=abcdefghijk'),
    ).resolves.toBeUndefined()
    expect(mocks.httpsGet).toHaveBeenCalledTimes(6)
  })

  it('follows bounded duration redirects and parses the final response', async () => {
    mockHttpsResponses([
      {
        statusCode: 302,
        location: 'https://www.youtube.com/watch?v=abcdefghijk&redirect=1',
      },
      {
        statusCode: 200,
        body: '{"lengthSeconds":"123"}',
      },
    ])

    await expect(
      fetchVideoDuration('https://www.youtube.com/watch?v=abcdefghijk'),
    ).resolves.toBe(123)
  })
})
