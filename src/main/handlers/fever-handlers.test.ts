import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC, unwrapIpcEnvelope } from '../../shared/ipc-contracts'

const handleMock = vi.hoisted(() => vi.fn())
const mocks = vi.hoisted(() => ({
  createFeverClient: vi.fn(),
  verify: vi.fn(),
  getFeverAccounts: vi.fn(),
  insertFeverAccount: vi.fn(),
  getFeverAccountById: vi.fn(),
  updateFeverAccount: vi.fn(),
  deleteFeverAccount: vi.fn(),
  getFeverSyncState: vi.fn(),
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
      updateFeverAccount: mocks.updateFeverAccount,
      deleteFeverAccount: mocks.deleteFeverAccount,
      getFeverSyncState: mocks.getFeverSyncState,
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
      apiKey: 'api-password',
      enabled: true,
      autoSync: true,
    })
    expect(mocks.createFeverClient).toHaveBeenCalledWith(
      'https://rss.example.com/api/fever.php',
      'alice',
      'api-password',
    )
    expect(mocks.insertFeverAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: 'https://rss.example.com',
        username: 'alice',
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
    })
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
})
