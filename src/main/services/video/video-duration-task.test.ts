import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VIDEO_DURATION_ENRICH_TASK } from '../system/task-contracts'
import { resetLocalTaskRunnerForTest } from '../system/task-runner-service'
import { queueVideoDurationEnrich } from './video-duration'

const mocks = vi.hoisted(() => ({
  eventSend: vi.fn(),
  getEntries: vi.fn(),
  updateEntry: vi.fn(),
  getAllFeeds: vi.fn(),
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

describe('queueVideoDurationEnrich', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetLocalTaskRunnerForTest()
    mocks.getEntries.mockReturnValue({ entries: [] })
    mocks.getAllFeeds.mockReturnValue([])
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
})
