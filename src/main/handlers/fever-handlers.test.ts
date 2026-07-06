import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC, unwrapIpcEnvelope } from '../../shared/ipc-contracts'

const handleMock = vi.hoisted(() => vi.fn())
const mocks = vi.hoisted(() => ({
  createFeverClient: vi.fn(),
  verify: vi.fn(),
  getFeverAccounts: vi.fn(),
  insertFeverAccount: vi.fn(),
  getFeverAccountById: vi.fn(),
  getFeverFeedMappings: vi.fn(),
  updateFeverAccount: vi.fn(),
  deleteFeverAccount: vi.fn(),
  getFeverSyncState: vi.fn(),
  getFeedById: vi.fn(),
  deleteFeed: vi.fn(),
  queueFeverSyncAccount: vi.fn(),
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: handleMock,
  },
}))

vi.mock('../services/system/logger', () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
}))

vi.mock('../services/fever/fever-client', () => ({
  createFeverClient: mocks.createFeverClient,
}))

vi.mock('../services/fever/fever-sync', () => ({
  queueFeverSyncAccount: mocks.queueFeverSyncAccount,
}))

vi.mock('../database', () => ({
  getDb: () => ({
    fever: {
      getFeverAccounts: mocks.getFeverAccounts,
      insertFeverAccount: mocks.insertFeverAccount,
      getFeverAccountById: mocks.getFeverAccountById,
      getFeverFeedMappings: mocks.getFeverFeedMappings,
      updateFeverAccount: mocks.updateFeverAccount,
      deleteFeverAccount: mocks.deleteFeverAccount,
      getFeverSyncState: mocks.getFeverSyncState,
    },
    feeds: {
      getFeedById: mocks.getFeedById,
      deleteFeed: mocks.deleteFeed,
    },
  }),
}))

type RegisteredHandler = (
  event: Record<string, never>,
  ...args: unknown[]
) => Promise<unknown>

function getRegisteredHandler(channel: string): RegisteredHandler {
  const call = handleMock.mock.calls.find(
    ([registered]) => registered === channel,
  )
  if (!call) throw new Error(`Missing IPC handler: ${channel}`)
  return call[1] as RegisteredHandler
}

describe('registerFeverHandlers', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    handleMock.mockReset()
    mocks.createFeverClient.mockReturnValue({
      verify: mocks.verify,
    })
  })

  it('does not create a Fever account when connection verification fails', async () => {
    mocks.verify.mockResolvedValue(false)
    const { registerFeverHandlers } = await import('./fever-handlers')
    registerFeverHandlers()

    const createAccount = getRegisteredHandler(IPC.FEVER_ACCOUNTS_CREATE)
    const result = await createAccount(
      {},
      {
        baseUrl: 'https://rss.example.com',
        username: 'alice',
        apiKey: 'wrong-password',
      },
    )

    expect(result).toMatchObject({
      ok: false,
      error: {
        message: 'Fever authentication failed',
      },
    })
    expect(mocks.insertFeverAccount).not.toHaveBeenCalled()
  })

  it('does not expose stored Fever API keys when listing accounts', async () => {
    mocks.getFeverAccounts.mockReturnValue([
      {
        id: 'account-1',
        baseUrl: 'https://rss.example.com',
        username: 'alice',
        apiKey: 'stored-api-password',
        enabled: true,
        autoSync: true,
        syncIntervalMin: 30,
        createdAt: 1000,
      },
    ])
    const { registerFeverHandlers } = await import('./fever-handlers')
    registerFeverHandlers()

    const listAccounts = getRegisteredHandler(IPC.FEVER_ACCOUNTS_LIST)
    const accounts = unwrapIpcEnvelope(await listAccounts({})) as Array<
      Record<string, unknown>
    >

    expect(accounts).toEqual([
      {
        id: 'account-1',
        baseUrl: 'https://rss.example.com',
        username: 'alice',
        enabled: true,
        autoSync: true,
        syncIntervalMin: 30,
        createdAt: 1000,
        apiKeyConfigured: true,
      },
    ])
    expect(JSON.stringify(accounts)).not.toContain('stored-api-password')
  })

  it('reports missing Fever API keys without exposing an empty secret field', async () => {
    mocks.getFeverAccounts.mockReturnValue([
      {
        id: 'account-1',
        baseUrl: 'https://rss.example.com',
        username: 'alice',
        apiKey: '',
        enabled: true,
        autoSync: true,
        syncIntervalMin: 30,
        createdAt: 1000,
      },
    ])
    const { registerFeverHandlers } = await import('./fever-handlers')
    registerFeverHandlers()

    const listAccounts = getRegisteredHandler(IPC.FEVER_ACCOUNTS_LIST)
    const accounts = unwrapIpcEnvelope(await listAccounts({})) as Array<
      Record<string, unknown>
    >

    expect(accounts[0]).not.toHaveProperty('apiKey')
    expect(accounts[0]).toMatchObject({ apiKeyConfigured: false })
  })

  it('creates a Fever account after connection verification succeeds', async () => {
    mocks.verify.mockResolvedValue(true)
    const { registerFeverHandlers } = await import('./fever-handlers')
    registerFeverHandlers()

    const createAccount = getRegisteredHandler(IPC.FEVER_ACCOUNTS_CREATE)
    const account = unwrapIpcEnvelope(
      await createAccount(
        {},
        {
          baseUrl: 'https://rss.example.com',
          username: 'alice',
          apiKey: 'api-password',
        },
      ),
    )

    expect(account).toMatchObject({
      baseUrl: 'https://rss.example.com',
      username: 'alice',
      apiKeyConfigured: true,
      enabled: true,
      autoSync: true,
    })
    expect(account).not.toHaveProperty('apiKey')
    expect(JSON.stringify(account)).not.toContain('api-password')
    expect(mocks.createFeverClient).toHaveBeenCalledWith(
      'https://rss.example.com/api/fever.php',
      'alice',
      'api-password',
    )
    expect(mocks.insertFeverAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: 'https://rss.example.com',
        username: 'alice',
        apiKey: 'api-password',
      }),
    )
  })

  it('keeps FreshRSS Google Reader endpoint input visible while verifying through Fever', async () => {
    mocks.verify.mockResolvedValue(true)
    const { registerFeverHandlers } = await import('./fever-handlers')
    registerFeverHandlers()

    const createAccount = getRegisteredHandler(IPC.FEVER_ACCOUNTS_CREATE)
    const account = unwrapIpcEnvelope(
      await createAccount(
        {},
        {
          baseUrl: 'https://rss.example.com/api/greader.php',
          username: 'alice',
          apiKey: 'api-password',
        },
      ),
    )

    expect(account).toMatchObject({
      baseUrl: 'https://rss.example.com/api/greader.php',
      username: 'alice',
      apiKeyConfigured: true,
    })
    expect(account).not.toHaveProperty('apiKey')
    expect(mocks.createFeverClient).toHaveBeenCalledWith(
      'https://rss.example.com/api/fever.php',
      'alice',
      'api-password',
    )
    expect(mocks.insertFeverAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: 'https://rss.example.com/api/greader.php',
      }),
    )
  })

  it('removes local Fever feeds when deleting an account', async () => {
    mocks.getFeverAccountById.mockReturnValue({
      id: 'account-1',
      baseUrl: 'https://rss.example.com/api/greader.php',
      username: 'alice',
      apiKey: 'api-password',
      enabled: true,
      autoSync: true,
      syncIntervalMin: 30,
      createdAt: 1000,
    })
    mocks.getFeverFeedMappings.mockReturnValue([
      {
        accountId: 'account-1',
        feverFeedId: 1,
        localFeedId: 'fever-feed-1',
        isActive: true,
        lastSeenAt: 1000,
      },
      {
        accountId: 'account-1',
        feverFeedId: 2,
        localFeedId: 'local-feed-2',
        isActive: true,
        lastSeenAt: 1000,
      },
    ])
    mocks.getFeedById.mockImplementation((feedId: string) => ({
      id: feedId,
      title: feedId,
      url: `https://example.com/${feedId}.xml`,
      view: 0,
      showInAll: true,
      fetchSource: 'direct',
      provider: feedId.startsWith('fever-') ? 'fever' : 'local',
      errorCount: 0,
      createdAt: 1000,
    }))
    const { registerFeverHandlers } = await import('./fever-handlers')
    registerFeverHandlers()

    const deleteAccount = getRegisteredHandler(IPC.FEVER_ACCOUNTS_DELETE)
    const result = unwrapIpcEnvelope(await deleteAccount({}, 'account-1'))

    expect(result).toEqual({ success: true })
    expect(mocks.deleteFeed).toHaveBeenCalledWith('fever-feed-1')
    expect(mocks.deleteFeed).not.toHaveBeenCalledWith('local-feed-2')
    expect(mocks.deleteFeverAccount).toHaveBeenCalledWith('account-1')
  })
})
