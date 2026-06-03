import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TaskRunner, TaskRunStore } from '../system/task-runner'
import { FEVER_SYNC_TASK } from '../system/task-contracts'
import type { FeverAccount } from '../../../shared/types'

const mocks = vi.hoisted(() => ({
  eventSend: vi.fn(),
  emitRun: vi.fn(),
  getLocalTaskRunner: vi.fn(),
  createFeverClient: vi.fn(),
  listItems: vi.fn(),
  getFeverAccountById: vi.fn(),
  updateFeverAccount: vi.fn(),
  getFeverFeedMappingByRemoteId: vi.fn(),
  upsertFeverFeedMapping: vi.fn(),
  markFeverFeedMappingsInactive: vi.fn(),
  getFeverItemMapping: vi.fn(),
  upsertFeverItemMapping: vi.fn(),
  getFeverSyncState: vi.fn(),
  upsertFeverSyncState: vi.fn(),
  insertFeed: vi.fn(),
  updateFeed: vi.fn(),
  getFeedById: vi.fn(),
  insertEntry: vi.fn(),
  updateEntry: vi.fn(),
}))

vi.mock('../system/event-bus', () => ({
  getEventBus: () => ({ send: mocks.eventSend }),
}))

vi.mock('../system/task-runner-service', () => ({
  getLocalTaskRunner: mocks.getLocalTaskRunner,
}))

vi.mock('./fever-client', () => ({
  createFeverClient: mocks.createFeverClient,
}))

vi.mock('../../database', () => ({
  getFeverAccounts: vi.fn(() => []),
  getFeverAccountById: mocks.getFeverAccountById,
  updateFeverAccount: mocks.updateFeverAccount,
  getFeverFeedMappingByRemoteId: mocks.getFeverFeedMappingByRemoteId,
  upsertFeverFeedMapping: mocks.upsertFeverFeedMapping,
  markFeverFeedMappingsInactive: mocks.markFeverFeedMappingsInactive,
  getFeverItemMapping: mocks.getFeverItemMapping,
  upsertFeverItemMapping: mocks.upsertFeverItemMapping,
  getFeverSyncState: mocks.getFeverSyncState,
  upsertFeverSyncState: mocks.upsertFeverSyncState,
  insertFeed: mocks.insertFeed,
  updateFeed: mocks.updateFeed,
  getFeedById: mocks.getFeedById,
  insertEntry: mocks.insertEntry,
  updateEntry: mocks.updateEntry,
}))

const account: FeverAccount = {
  id: 'account-1',
  baseUrl: 'https://fever.example.com',
  username: 'user',
  apiKey: 'secret',
  enabled: true,
  autoSync: true,
  syncIntervalMin: 30,
  createdAt: 1000,
}

describe('queueFeverSyncAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const runner = new TaskRunner(new TaskRunStore(10), {
      emit: mocks.emitRun,
    })
    mocks.getLocalTaskRunner.mockReturnValue(runner)
    mocks.getFeverAccountById.mockReturnValue(account)
    mocks.getFeverFeedMappingByRemoteId.mockReturnValue(undefined)
    mocks.getFeverItemMapping.mockReturnValue(undefined)
    mocks.getFeverSyncState.mockReturnValue(undefined)
    mocks.getFeedById.mockReturnValue(undefined)
    mocks.listItems.mockResolvedValueOnce([
      {
        id: 101,
        feedId: 42,
        title: 'Remote entry',
        author: 'Author',
        html: '<p>Hello</p>',
        url: 'https://example.com/post',
        isRead: 0,
        isSaved: 1,
        createdOnTime: 1000,
      },
    ])
    mocks.createFeverClient.mockReturnValue({
      listFeeds: vi.fn(async () => [
        {
          id: 42,
          title: 'Remote feed',
          url: 'https://example.com/feed.xml',
          siteUrl: 'https://example.com',
          groupName: 'News',
        },
      ]),
      listItems: mocks.listItems,
    })
  })

  it('通过 Task Runner 执行 Fever 同步并记录最终进度', async () => {
    const { queueFeverSyncAccount } = await import('./fever-sync')

    const handle = queueFeverSyncAccount(account.id, { force: true })
    const result = await handle.promise
    const record = handle.getRecord()

    expect(result).toMatchObject({
      success: true,
      feedsSynced: 1,
      itemsSynced: 1,
      newEntries: 1,
    })
    expect(record).toMatchObject({
      taskName: FEVER_SYNC_TASK.name,
      status: 'succeeded',
      progress: {
        completed: 3,
        total: 3,
        message: 'done',
      },
    })
    expect(record?.progress?.data).toMatchObject({
      accountId: account.id,
      phase: 'done',
      feedsSynced: 1,
      itemsSynced: 1,
      newEntries: 1,
    })
    expect(mocks.eventSend).toHaveBeenCalledWith(
      'fever:sync-progress',
      expect.objectContaining({ accountId: account.id, phase: 'done' }),
    )
  })
})
