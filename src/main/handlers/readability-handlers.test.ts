import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC, unwrapIpcEnvelope } from '../../shared/ipc-contracts'
import { ENTRY_FULLTEXT_FETCH_TASK } from '../services/system/task-contracts'

const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
  eventSend: vi.fn(),
  fetchReadableContent: vi.fn(),
  resolveRelativeUrls: vi.fn(),
  updateEntry: vi.fn(),
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: mocks.handle,
  },
}))

vi.mock('../database', () => ({
  getDb: () => ({
    entries: {
      updateEntry: mocks.updateEntry,
    },
  }),
}))

vi.mock('../services/entry/readability', () => ({
  fetchReadableContent: mocks.fetchReadableContent,
  resolveRelativeUrls: mocks.resolveRelativeUrls,
}))

vi.mock('../services/system/event-bus', () => ({
  getEventBus: () => ({
    send: mocks.eventSend,
  }),
}))

vi.mock('../services/system/logger', () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
}))

type RegisteredHandler = (
  event: Record<string, never>,
  ...args: unknown[]
) => Promise<unknown>

function getRegisteredHandler(channel: string): RegisteredHandler {
  const call = mocks.handle.mock.calls.find(
    ([registered]) => registered === channel,
  )
  if (!call) throw new Error(`Missing IPC handler: ${channel}`)
  return call[1] as RegisteredHandler
}

describe('registerReadabilityHandlers', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    const { resetLocalTaskRunnerForTest } =
      await import('../services/system/task-runner-service')
    resetLocalTaskRunnerForTest()
    mocks.resolveRelativeUrls.mockImplementation((html: string) => html)
  })

  it('fetches fulltext through TaskRunner and persists successful entry fields', async () => {
    mocks.fetchReadableContent.mockResolvedValue({
      title: 'Readable title',
      content: '<p>Readable body</p>',
      excerpt: 'Excerpt',
      siteName: 'Example',
      length: 42,
    })
    const { registerReadabilityHandlers } =
      await import('./readability-handlers')
    registerReadabilityHandlers()

    const fetch = getRegisteredHandler(IPC.READABILITY_FETCH)
    const result = unwrapIpcEnvelope(
      await fetch({}, 'https://example.com/post', 'entry-1'),
    )

    expect(result).toMatchObject({
      success: true,
      content: '<p>Readable body</p>',
      runId: expect.stringContaining('entry-fulltext-fetch'),
    })
    expect(mocks.updateEntry).toHaveBeenCalledWith(
      'entry-1',
      expect.objectContaining({
        readabilityContent: '<p>Readable body</p>',
        readabilityTitle: 'Readable title',
        readabilityError: undefined,
      }),
    )
    const runRecords = mocks.eventSend.mock.calls
      .filter(([channel]) => channel === 'tasks:run-updated')
      .map(([, record]) => record)
    expect(runRecords.at(-1)).toMatchObject({
      taskName: ENTRY_FULLTEXT_FETCH_TASK.name,
      status: 'succeeded',
      metadata: {
        entryId: 'entry-1',
        entryTaskKind: 'fulltext',
      },
    })
  })

  it('persists readabilityError when fulltext fetch fails', async () => {
    mocks.fetchReadableContent.mockRejectedValue(new Error('HTTP 403'))
    const { registerReadabilityHandlers } =
      await import('./readability-handlers')
    registerReadabilityHandlers()

    const fetch = getRegisteredHandler(IPC.READABILITY_FETCH)
    const result = unwrapIpcEnvelope(
      await fetch({}, 'https://example.com/post', 'entry-1'),
    )

    expect(result).toMatchObject({
      success: false,
      error: 'HTTP 403',
    })
    expect(mocks.updateEntry).toHaveBeenCalledWith('entry-1', {
      readabilityError: 'HTTP 403',
    })
  })
})
