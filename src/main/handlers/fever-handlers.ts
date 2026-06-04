import { IPC } from '../../shared/types'
import type { FeverAccount } from '../../shared/types'
import { registerChannel } from '../ipc/register-channel'
import { toHandlerError } from '../ipc/handler-error'
import { getDb } from '../database'
import { createFeverClient } from '../services/fever/fever-client'
import { queueFeverSyncAccount } from '../services/fever/fever-sync'
import { v4 as uuidv4 } from 'uuid'

export function registerFeverHandlers(): void {
  registerChannel(IPC.FEVER_ACCOUNTS_LIST, () => {
    return getDb().fever.getFeverAccounts()
  })

  registerChannel(
    IPC.FEVER_ACCOUNTS_CREATE,
    (
      _event,
      input: { baseUrl: string; username: string; apiKey: string },
    ): FeverAccount => {
      const account: FeverAccount = {
        id: uuidv4(),
        baseUrl: input.baseUrl.replace(/\/+$/, ''),
        username: input.username,
        apiKey: input.apiKey,
        enabled: true,
        autoSync: true,
        syncIntervalMin: 30,
        createdAt: Date.now(),
      }
      getDb().fever.insertFeverAccount(account)
      return account
    },
  )

  registerChannel(
    IPC.FEVER_ACCOUNTS_UPDATE,
    (
      _event,
      id: string,
      updates: Partial<FeverAccount>,
    ): { success: boolean; error?: string } => {
      const existing = getDb().fever.getFeverAccountById(id)
      if (!existing) return { success: false, error: 'Account not found' }
      getDb().fever.updateFeverAccount(id, updates)
      return { success: true }
    },
  )

  registerChannel(
    IPC.FEVER_ACCOUNTS_DELETE,
    (_event, id: string): { success: boolean; error?: string } => {
      const existing = getDb().fever.getFeverAccountById(id)
      if (!existing) return { success: false, error: 'Account not found' }
      getDb().fever.deleteFeverAccount(id)
      return { success: true }
    },
  )

  registerChannel(
    IPC.FEVER_VERIFY,
    async (
      _event,
      baseUrl: string,
      username: string,
      apiKey: string,
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const client = createFeverClient(
          baseUrl.replace(/\/+$/, ''),
          username,
          apiKey,
        )
        const ok = await client.verify()
        return ok
          ? { success: true }
          : { success: false, error: 'Authentication failed' }
      } catch (err) {
        return toHandlerError(err)
      }
    },
  )

  registerChannel(
    IPC.FEVER_SYNC,
    async (
      _event,
      accountId: string,
    ): Promise<{
      success: boolean
      feedsSynced: number
      itemsSynced: number
      newEntries: number
      error?: string
    }> => {
      return queueFeverSyncAccount(accountId, { force: true }).promise
    },
  )

  registerChannel(
    IPC.FEVER_SYNC_ALL,
    async (): Promise<{
      success: boolean
      results: Array<{ accountId: string; success: boolean; error?: string }>
    }> => {
      const accounts = getDb()
        .fever.getFeverAccounts()
        .filter((a) => a.enabled)
      const results: Array<{
        accountId: string
        success: boolean
        error?: string
      }> = []
      for (const account of accounts) {
        try {
          const result = await queueFeverSyncAccount(account.id).promise
          results.push({
            accountId: account.id,
            success: result.success,
            error: result.error,
          })
        } catch (err) {
          results.push({
            accountId: account.id,
            ...toHandlerError(err),
          })
        }
      }
      return { success: true, results }
    },
  )

  registerChannel(IPC.FEVER_SYNC_STATE, (_event, accountId: string) => {
    return getDb().fever.getFeverSyncState(accountId) || null
  })
}
