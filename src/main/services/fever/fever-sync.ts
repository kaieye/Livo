import { getEventBus } from '../system/event-bus'
import { v4 as uuidv4 } from 'uuid'
import type { Entry, Feed, FeverAccount } from '../../../shared/types/index'
import { FeedViewType } from '../../../shared/types/index'
import {
  getFeverAccounts,
  getFeverAccountById,
  updateFeverAccount,
  getFeverFeedMappingByRemoteId,
  upsertFeverFeedMapping,
  markFeverFeedMappingsInactive,
  getFeverItemMapping,
  getFeverItemMappingsByLocalEntry,
  upsertFeverItemMapping,
  getFeverSyncState,
  upsertFeverSyncState,
  insertFeed,
  updateFeed,
  getFeedById,
  insertEntry,
  updateEntry,
} from '../../database'
import { createFeverClient } from './fever-client'
import type { FeverApiClient, FeverFeedWithGroup } from './fever-client'
import { FEVER_SYNC_TASK } from '../system/task-contracts'
import type { TaskRunContext, TaskRunHandle } from '../system/task-runner'
import { getLocalTaskRunner } from '../system/task-runner-service'

const FULL_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000
const FEVER_ITEMS_PER_PAGE = 50
const AUTO_SYNC_CHECK_INTERVAL_MS = 60 * 1000

let autoSyncTimer: ReturnType<typeof setInterval> | null = null

export interface FeverSyncProgress {
  accountId: string
  phase: 'feeds' | 'items' | 'write-back' | 'done'
  feedsSynced: number
  itemsSynced: number
  newEntries: number
  error?: string
}

export interface FeverSyncResult {
  success: boolean
  feedsSynced: number
  itemsSynced: number
  newEntries: number
  error?: string
}

function sendProgressToRenderer(
  progress: FeverSyncProgress,
  context?: TaskRunContext,
): void {
  getEventBus().send('fever:sync-progress', progress)
  context?.reportProgress({
    completed: getFeverProgressStep(progress.phase),
    total: 3,
    message: progress.phase,
    data: { ...progress },
  })
}

function getFeverProgressStep(phase: FeverSyncProgress['phase']): number {
  switch (phase) {
    case 'feeds':
      return 0
    case 'items':
      return 1
    case 'write-back':
      return 2
    case 'done':
      return 3
  }
}

function buildFeedFromFeverRemote(
  remote: FeverFeedWithGroup,
  accountId: string,
): Feed {
  const feedId = `fever-${accountId}-${remote.id}`
  const siteUrl =
    remote.siteUrl ||
    (() => {
      try {
        return new URL(remote.url).origin
      } catch {
        return ''
      }
    })()

  return {
    id: feedId,
    title: remote.title || remote.url,
    url: remote.url,
    siteUrl: siteUrl || undefined,
    view: FeedViewType.Articles,
    showInAll: true,
    fetchSource: 'direct',
    provider: 'fever',
    errorCount: 0,
    createdAt: Date.now(),
  }
}

function buildEntryFromFeverItem(
  item: {
    id: number
    feedId: number
    title: string
    author: string
    html: string
    url: string
    isRead: number
    isSaved: number
    createdOnTime: number
  },
  localFeedId: string,
): Entry {
  return {
    id: uuidv4(),
    feedId: localFeedId,
    title: item.title || '(untitled)',
    url: item.url || '',
    content: item.html || undefined,
    author: item.author || undefined,
    publishedAt: item.createdOnTime ? item.createdOnTime * 1000 : Date.now(),
    isRead: item.isRead === 1,
    isStarred: item.isSaved === 1,
    createdAt: Date.now(),
  }
}

async function syncFeeds(
  client: FeverApiClient,
  account: FeverAccount,
): Promise<Map<number, string>> {
  const remoteFeeds = await client.listFeeds()
  const now = Date.now()
  const localFeedByRemoteId = new Map<number, string>()
  const activeRemoteIds: number[] = []

  for (const remote of remoteFeeds) {
    activeRemoteIds.push(remote.id)
    const existing = getFeverFeedMappingByRemoteId(account.id, remote.id)

    if (existing) {
      localFeedByRemoteId.set(remote.id, existing.localFeedId)
      upsertFeverFeedMapping({
        ...existing,
        lastSeenAt: now,
        isActive: true,
        remoteGroup: remote.groupName || existing.remoteGroup,
        remoteTitle: remote.title || existing.remoteTitle,
        remoteUrl: remote.url || existing.remoteUrl,
      })

      const localFeed = getFeedById(existing.localFeedId)
      if (localFeed) {
        const updates: Partial<Feed> = {}
        if (remote.title && remote.title !== localFeed.title)
          updates.title = remote.title
        if (remote.url && remote.url !== localFeed.url) updates.url = remote.url
        if (Object.keys(updates).length > 0) {
          updateFeed(existing.localFeedId, updates)
        }
      }
    } else {
      const feed = buildFeedFromFeverRemote(remote, account.id)
      insertFeed(feed)
      localFeedByRemoteId.set(remote.id, feed.id)
      upsertFeverFeedMapping({
        accountId: account.id,
        feverFeedId: remote.id,
        localFeedId: feed.id,
        remoteGroup: remote.groupName || undefined,
        remoteTitle: remote.title || undefined,
        remoteUrl: remote.url || undefined,
        isActive: true,
        lastSeenAt: now,
      })
    }
  }

  markFeverFeedMappingsInactive(account.id, activeRemoteIds)
  return localFeedByRemoteId
}

async function syncItems(
  client: FeverApiClient,
  account: FeverAccount,
  localFeedByRemoteId: Map<number, string>,
  options?: { force?: boolean },
): Promise<{ itemsSynced: number; newEntries: number }> {
  const syncState = getFeverSyncState(account.id)
  const now = Date.now()
  const isFullSync =
    options?.force ||
    !syncState?.lastFullSyncAt ||
    now - syncState.lastFullSyncAt > FULL_SYNC_INTERVAL_MS

  let sinceId = isFullSync ? 0 : syncState?.lastItemId || 0
  let itemsSynced = 0
  let newEntries = 0
  let highestItemId = sinceId

  while (true) {
    const items = await client.listItems({ sinceId })
    if (items.length === 0) break

    for (const item of items) {
      if (item.id > highestItemId) highestItemId = item.id

      const localFeedId = localFeedByRemoteId.get(item.feedId)
      if (!localFeedId) continue

      const existingMapping = getFeverItemMapping(account.id, item.id)
      if (existingMapping) {
        upsertFeverItemMapping({
          ...existingMapping,
          lastSeenAt: now,
          isActive: true,
          remoteIsRead: item.isRead === 1,
          remoteIsStarred: item.isSaved === 1,
        })

        const entry = getFeedById(existingMapping.localEntryId)
          ? undefined
          : undefined
        if (entry !== undefined) {
          updateEntry(existingMapping.localEntryId, {
            isRead: item.isRead === 1,
            isStarred: item.isSaved === 1,
          })
        }
      } else {
        const entry = buildEntryFromFeverItem(item, localFeedId)
        insertEntry(entry)
        newEntries++
        upsertFeverItemMapping({
          accountId: account.id,
          feverItemId: item.id,
          feverFeedId: item.feedId,
          localFeedId,
          localEntryId: entry.id,
          remoteIsRead: item.isRead === 1,
          remoteIsStarred: item.isSaved === 1,
          isActive: true,
          lastSeenAt: now,
        })
      }
      itemsSynced++
    }

    if (items.length < FEVER_ITEMS_PER_PAGE) break
    sinceId = items[items.length - 1].id
  }

  upsertFeverSyncState({
    accountId: account.id,
    lastItemId: highestItemId,
    lastSyncAt: now,
    lastFullSyncAt: isFullSync ? now : syncState?.lastFullSyncAt,
  })

  return { itemsSynced, newEntries }
}

/**
 * Push local read/star state back to the Fever server.
 *
 * This is called per-entry as a fire-and-forget when the user marks an entry
 * as read/unread or starred/unstarred.  Failures are silently ignored — the
 * next full sync will reconcile differences.
 */
export function feverWriteBack(
  entryId: string,
  state: 'read' | 'unread' | 'saved' | 'unsaved',
): void {
  const mappings = getFeverItemMappingsByLocalEntry(entryId)
  for (const mapping of mappings) {
    const account = getFeverAccountById(mapping.accountId)
    if (!account?.enabled) continue
    const client = createFeverClient(
      account.baseUrl,
      account.username,
      account.apiKey,
    )
    client
      .markItem(mapping.feverItemId, state)
      .then(() => {
        const updates: Record<string, boolean> = {}
        if (state === 'read' || state === 'unread')
          updates.remoteIsRead = state === 'read'
        if (state === 'saved' || state === 'unsaved')
          updates.remoteIsStarred = state === 'saved'
        upsertFeverItemMapping({ ...mapping, ...updates })
      })
      .catch(() => {
        // Best-effort; reconciled on next sync
      })
  }
}

async function performWriteBack(
  _client: FeverApiClient,
  _account: FeverAccount,
  _localFeedByRemoteId: Map<number, string>,
): Promise<void> {
  // Per-entry write-back is handled via `feverWriteBack()` (exported above)
  // called from entry-handlers as a fire-and-forget.  This batch phase exists
  // as a hook for future reconciliation — the incremental sync already pulls
  // remote state on each cycle.
}

export async function syncFeverAccount(
  accountId: string,
  options?: { force?: boolean; context?: TaskRunContext },
): Promise<FeverSyncResult> {
  const account = getFeverAccountById(accountId)
  if (!account) {
    return {
      success: false,
      feedsSynced: 0,
      itemsSynced: 0,
      newEntries: 0,
      error: 'Account not found',
    }
  }

  const client = createFeverClient(
    account.baseUrl,
    account.username,
    account.apiKey,
  )

  try {
    sendProgressToRenderer(
      {
        accountId,
        phase: 'feeds',
        feedsSynced: 0,
        itemsSynced: 0,
        newEntries: 0,
      },
      options?.context,
    )

    const localFeedByRemoteId = await syncFeeds(client, account)
    sendProgressToRenderer(
      {
        accountId,
        phase: 'items',
        feedsSynced: localFeedByRemoteId.size,
        itemsSynced: 0,
        newEntries: 0,
      },
      options?.context,
    )

    const { itemsSynced, newEntries } = await syncItems(
      client,
      account,
      localFeedByRemoteId,
      options,
    )
    sendProgressToRenderer(
      {
        accountId,
        phase: 'write-back',
        feedsSynced: localFeedByRemoteId.size,
        itemsSynced,
        newEntries,
      },
      options?.context,
    )

    await performWriteBack(client, account, localFeedByRemoteId)

    updateFeverAccount(accountId, {
      lastSyncAt: Date.now(),
      lastError: undefined,
    })
    sendProgressToRenderer(
      {
        accountId,
        phase: 'done',
        feedsSynced: localFeedByRemoteId.size,
        itemsSynced,
        newEntries,
      },
      options?.context,
    )

    return {
      success: true,
      feedsSynced: localFeedByRemoteId.size,
      itemsSynced,
      newEntries,
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    updateFeverAccount(accountId, { lastError: errorMsg })
    sendProgressToRenderer(
      {
        accountId,
        phase: 'done',
        feedsSynced: 0,
        itemsSynced: 0,
        newEntries: 0,
        error: errorMsg,
      },
      options?.context,
    )
    return {
      success: false,
      feedsSynced: 0,
      itemsSynced: 0,
      newEntries: 0,
      error: errorMsg,
    }
  }
}

export function queueFeverSyncAccount(
  accountId: string,
  options?: { force?: boolean },
): TaskRunHandle<FeverSyncResult> {
  return getLocalTaskRunner().enqueue(
    FEVER_SYNC_TASK,
    { accountId, force: options?.force },
    (payload, context) =>
      syncFeverAccount(payload.accountId, {
        force: payload.force,
        context,
      }),
    {
      metadata: {
        accountId,
        force: options?.force ?? false,
      },
    },
  )
}

function checkAndSyncDueAccounts(): void {
  const accounts = getFeverAccounts()
  const now = Date.now()

  for (const account of accounts) {
    if (!account.enabled || !account.autoSync) continue
    if (account.syncIntervalMin <= 0) continue

    const intervalMs = account.syncIntervalMin * 60 * 1000
    const lastSync = account.lastSyncAt || 0
    if (now - lastSync < intervalMs) continue

    queueFeverSyncAccount(account.id).promise.catch((err) => {
      console.warn('[fever] auto-sync failed for', account.baseUrl, err)
    })
  }
}

export function startFeverAutoSync(): void {
  if (autoSyncTimer) return
  autoSyncTimer = setInterval(
    checkAndSyncDueAccounts,
    AUTO_SYNC_CHECK_INTERVAL_MS,
  )
}

export function stopFeverAutoSync(): void {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer)
    autoSyncTimer = null
  }
}
