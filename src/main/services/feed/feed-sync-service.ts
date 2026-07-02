import { session } from 'electron'
import Store from 'electron-store'
import type {
  Feed,
  FeedSyncRecord,
  FeedSyncResult,
  FeedSyncStatus,
} from '../../../shared/types'
import { getDb } from '../../database'
import { addFeed, removeFeed } from '../../operations/feed-operations'
import { sessionStore } from '../auth/session-store'
import { logInfo } from '../system/logger'
import { settingsProvider } from '../system/settings-provider'
import { getEventBus } from '../system/event-bus'
import { DEFAULT_RSSHUB_INSTANCE } from '../../../shared/discover-data'
import { normalizeRsshubProtocolUrl, toRsshubProtocolUrl } from './rsshub-url'
import type { FeedSyncAction, SyncChange } from '../../database/repositories'
import { getBackendBaseUrl } from '../backend/backend-config'

const SYNC_BATCH_SIZE = 500

interface FeedSyncAuth {
  token: string
  userId: string
}

interface SyncResponse {
  accepted?: number
  ignored?: number
  records?: FeedSyncRecord[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isFeedSyncAction(value: unknown): value is FeedSyncAction {
  return value === 'subscribe' || value === 'unsubscribe'
}

function parseFeedSyncRecord(value: unknown): FeedSyncRecord | null {
  if (!isRecord(value)) return null
  if (typeof value.url !== 'string') return null
  if (!isFeedSyncAction(value.action)) return null
  const updatedAt = Number(value.updatedAt)
  if (!Number.isFinite(updatedAt) || updatedAt < 0) return null
  const title = typeof value.title === 'string' ? value.title.trim() : ''
  return {
    url: value.url,
    action: value.action,
    updatedAt,
    ...(title ? { title } : {}),
  }
}

function parseFeedSyncRecords(value: unknown): FeedSyncRecord[] {
  const source = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.records)
      ? value.records
      : []

  return source
    .map(parseFeedSyncRecord)
    .filter((record): record is FeedSyncRecord => !!record)
}

function toLatestRecordMap<T extends FeedSyncRecord>(
  records: T[],
): Map<string, T> {
  const map = new Map<string, T>()
  for (const record of records) {
    const existing = map.get(record.url)
    if (!existing || record.updatedAt >= existing.updatedAt) {
      map.set(record.url, record)
    }
  }
  return map
}

function toRemoteRecord(change: SyncChange): FeedSyncRecord {
  return {
    url: change.url,
    action: change.action,
    updatedAt: change.updatedAt,
    ...(change.title ? { title: change.title } : {}),
  }
}

function getSyncTitle(feed: Feed): string | undefined {
  const title = feed.title.trim()
  if (!title || title === feed.url || title === feed.upstreamUrl) {
    return undefined
  }
  return title
}

function needsRemoteTitleBackfill(
  remote: FeedSyncRecord,
  local: FeedSyncRecord,
): boolean {
  return (
    remote.action === 'subscribe' &&
    local.action === 'subscribe' &&
    !!local.title &&
    !remote.title
  )
}

function shouldApplyRemoteTitle(
  feed: Feed,
  title: string | undefined,
): boolean {
  if (!title) return false
  const current = feed.title.trim()
  return !current || current === feed.url || current === feed.upstreamUrl
}

function toBatches<T>(items: T[], size: number): T[][] {
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size))
  }
  return batches
}

export class FeedSyncService {
  private readonly baseUrl: string
  private readonly stateStore = new Store({ name: 'livo-feed-sync-state' })

  constructor(baseUrl: string = getBackendBaseUrl()) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
  }

  getStatus(): FeedSyncStatus {
    const session = sessionStore.getSession()
    const isAuthenticated = !!session?.userId && sessionStore.isSessionValid()
    if (!isAuthenticated || !session?.userId) {
      return {
        isAuthenticated: false,
        lastSyncAt: null,
        pendingChanges: 0,
      }
    }

    return this.getStatusForUser(session.userId)
  }

  async syncNow(): Promise<FeedSyncResult> {
    return this.reconcile('now', { upload: true, download: true })
  }

  async syncToCloud(): Promise<FeedSyncResult> {
    return this.reconcile('to-cloud', { upload: true, download: false })
  }

  async syncFromCloud(): Promise<FeedSyncResult> {
    return this.reconcile('from-cloud', { upload: false, download: true })
  }

  private requireAuth(): FeedSyncAuth {
    const current = sessionStore.getSession()
    const token = current?.token
    if (!token || !current?.userId) {
      throw new Error('Feed sync requires a valid login session')
    }
    return { token, userId: current.userId }
  }

  private getLastSyncAt(userId: string): number | null {
    const values = this.stateStore.get('lastSyncAtByUser') as
      | Record<string, number>
      | undefined
    const value = values?.[userId]
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }

  private setLastSyncAt(userId: string, syncedAt: number): void {
    const values =
      (this.stateStore.get('lastSyncAtByUser') as
        | Record<string, number>
        | undefined) ?? {}
    this.stateStore.set('lastSyncAtByUser', {
      ...values,
      [userId]: syncedAt,
    })
  }

  private getStatusForUser(
    userId: string,
    lastSyncAt: number | null = this.getLastSyncAt(userId),
  ): FeedSyncStatus {
    return {
      isAuthenticated: true,
      lastSyncAt,
      pendingChanges: getDb().syncChanges.countPending(userId),
    }
  }

  private async requestJson(
    path: string,
    auth: FeedSyncAuth,
    init: RequestInit = {},
  ): Promise<unknown> {
    const response = await session.defaultSession.fetch(
      `${this.baseUrl}${path}`,
      {
        ...init,
        headers: {
          ...(init.headers || {}),
          Authorization: `Bearer ${auth.token}`,
        },
      },
    )

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(
        `Feed sync request failed: ${response.status}${text ? ` ${text}` : ''}`,
      )
    }

    return response.json()
  }

  private async fetchRemoteRecords(
    auth: FeedSyncAuth,
  ): Promise<FeedSyncRecord[]> {
    const payload = await this.requestJson('/api/feeds', auth)
    return parseFeedSyncRecords(payload)
  }

  private async uploadChanges(
    auth: FeedSyncAuth,
    changes: FeedSyncRecord[],
  ): Promise<SyncResponse> {
    let accepted = 0
    let ignored = 0
    let records: FeedSyncRecord[] | undefined

    for (const batch of toBatches(changes, SYNC_BATCH_SIZE)) {
      const payload = await this.requestJson('/api/feeds/sync', auth, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ changes: batch }),
      })

      if (isRecord(payload) && typeof payload.accepted === 'number') {
        accepted += payload.accepted
      } else {
        accepted += batch.length
      }
      if (isRecord(payload) && typeof payload.ignored === 'number') {
        ignored += payload.ignored
      }

      const responseRecords = parseFeedSyncRecords(payload)
      if (responseRecords.length > 0) {
        records = responseRecords
      }
    }

    return { accepted, ignored, records }
  }

  private ensureLocalSubscribeSnapshots(userId: string): void {
    const db = getDb()
    for (const feed of db.feeds.getAllFeeds()) {
      // Fever 账号订阅由 Fever 自己同步，避免把第三方账号源写入 Livo 账号云端。
      if (feed.provider === 'fever') continue
      const title = getSyncTitle(feed)
      const existing = db.syncChanges.getChange(userId, feed.url)
      if (existing) {
        if (
          existing.action === 'subscribe' &&
          title &&
          !existing.title?.trim()
        ) {
          db.syncChanges.upsertChange({
            ...existing,
            title,
            synced: false,
          })
        }
        continue
      }
      db.syncChanges.upsertChange({
        url: feed.url,
        action: 'subscribe',
        updatedAt: feed.createdAt,
        userId,
        synced: false,
        title,
      })
    }
  }

  private findLocalFeedByUrl(url: string): Feed | undefined {
    const rsshubInstance =
      settingsProvider.get().general.rsshubInstance?.trim() ||
      DEFAULT_RSSHUB_INSTANCE
    const protocolUrl = toRsshubProtocolUrl(url)
    const normalizedUrl = normalizeRsshubProtocolUrl(
      protocolUrl,
      rsshubInstance,
    )

    return (
      getDb().feeds.getFeedByUrl(url) ||
      getDb().feeds.getFeedByUrl(protocolUrl) ||
      getDb().feeds.getFeedByUrl(normalizedUrl) ||
      getDb().feeds.getFeedByUrl(toRsshubProtocolUrl(normalizedUrl))
    )
  }

  // 让本地订阅表与一条云端记录的 action 对齐：subscribe 时确保订阅存在，
  // unsubscribe 时确保订阅已删除。幂等，可安全重复调用。
  private async ensureFeedMaterialized(
    record: FeedSyncRecord,
  ): Promise<{ subscribed: number; unsubscribed: number }> {
    const existing = this.findLocalFeedByUrl(record.url)

    if (record.action === 'subscribe') {
      if (!existing) {
        await addFeed({
          url: record.url,
          title: record.title,
          deferInitialFetch: true,
          recordSyncChange: false,
        })
        return { subscribed: 1, unsubscribed: 0 }
      }
      if (shouldApplyRemoteTitle(existing, record.title)) {
        getDb().feeds.updateFeed(existing.id, { title: record.title })
        getEventBus().send('feeds:updated', {
          feedId: existing.id,
          feedIds: [existing.id],
          feeds: [{ id: existing.id, title: record.title }],
        })
      }
    } else if (existing) {
      removeFeed(existing.id, { recordSyncChange: false })
      return { subscribed: 0, unsubscribed: 1 }
    }

    return { subscribed: 0, unsubscribed: 0 }
  }

  private async applyRemoteRecord(
    userId: string,
    record: FeedSyncRecord,
  ): Promise<{ subscribed: number; unsubscribed: number }> {
    const applied = await this.ensureFeedMaterialized(record)

    getDb().syncChanges.upsertChange({
      ...record,
      userId,
      synced: true,
    })

    return applied
  }

  private async applyRemoteRecords(
    userId: string,
    records: FeedSyncRecord[],
  ): Promise<{
    downloaded: number
    subscribed: number
    unsubscribed: number
    skipped: number
  }> {
    let downloaded = 0
    let subscribed = 0
    let unsubscribed = 0
    let skipped = 0

    for (const record of records) {
      const local = getDb().syncChanges.getChange(userId, record.url)
      if (local && local.updatedAt > record.updatedAt) {
        skipped++
        continue
      }
      if (
        local &&
        local.updatedAt === record.updatedAt &&
        local.action === record.action
      ) {
        // 快照已对齐，但本地订阅表可能与之脱节（如订阅被清空而快照仍在），
        // 这里强制让订阅表与云端 action 一致，否则订阅永远补不回来。
        const applied = await this.ensureFeedMaterialized(record)
        subscribed += applied.subscribed
        unsubscribed += applied.unsubscribed
        if (applied.subscribed || applied.unsubscribed) {
          downloaded++
        }
        if (!local.synced) {
          getDb().syncChanges.upsertChange({
            ...record,
            userId,
            synced: true,
          })
        }
        continue
      }

      const applied = await this.applyRemoteRecord(userId, record)
      subscribed += applied.subscribed
      unsubscribed += applied.unsubscribed
      downloaded++
    }

    return { downloaded, subscribed, unsubscribed, skipped }
  }

  private async reconcile(
    mode: FeedSyncResult['mode'],
    options: { upload: boolean; download: boolean },
  ): Promise<FeedSyncResult> {
    const auth = this.requireAuth()
    logInfo('[feed-sync] start', { mode, userId: auth.userId })

    this.ensureLocalSubscribeSnapshots(auth.userId)

    const remoteRecords = await this.fetchRemoteRecords(auth)
    const localRecords = getDb().syncChanges.getChangesByUser(auth.userId)
    const remoteByUrl = toLatestRecordMap(remoteRecords)
    const localByUrl = toLatestRecordMap(localRecords.map(toRemoteRecord))
    const urls = new Set([...remoteByUrl.keys(), ...localByUrl.keys()])

    const remoteToApply: FeedSyncRecord[] = []
    const localToUpload: FeedSyncRecord[] = []
    const alignedRecords: FeedSyncRecord[] = []
    let ignored = 0

    for (const url of urls) {
      const remote = remoteByUrl.get(url)
      const local = localByUrl.get(url)

      if (remote && local) {
        if (remote.updatedAt > local.updatedAt) {
          remoteToApply.push(remote)
        } else if (local.updatedAt > remote.updatedAt) {
          localToUpload.push(local)
        } else if (remote.action !== local.action) {
          // 同一毫秒内冲突时以云端为准，避免两端反复覆盖。
          remoteToApply.push(remote)
        } else if (needsRemoteTitleBackfill(remote, local)) {
          localToUpload.push(local)
        } else {
          alignedRecords.push(remote)
        }
        continue
      }

      if (remote) {
        remoteToApply.push(remote)
      } else if (local) {
        localToUpload.push(local)
      }
    }

    let downloaded = 0
    let subscribed = 0
    let unsubscribed = 0

    if (alignedRecords.length > 0) {
      getDb().syncChanges.markChangesSynced(
        auth.userId,
        alignedRecords.map((record) => record.url),
      )
      // 快照两端一致，但本地订阅表可能已被清空，下行同步时补齐订阅表。
      if (options.download) {
        for (const record of alignedRecords) {
          const applied = await this.ensureFeedMaterialized(record)
          subscribed += applied.subscribed
          unsubscribed += applied.unsubscribed
          if (applied.subscribed || applied.unsubscribed) {
            downloaded++
          }
        }
      }
    }

    if (options.download) {
      const applied = await this.applyRemoteRecords(auth.userId, remoteToApply)
      downloaded += applied.downloaded
      subscribed += applied.subscribed
      unsubscribed += applied.unsubscribed
      ignored += applied.skipped
    } else {
      ignored += remoteToApply.length
    }

    let uploaded = 0
    if (options.upload && localToUpload.length > 0) {
      const response = await this.uploadChanges(auth, localToUpload)
      uploaded += response.accepted ?? localToUpload.length
      ignored += response.ignored ?? 0

      const responseByUrl = response.records
        ? toLatestRecordMap(response.records)
        : new Map<string, FeedSyncRecord>()
      const uploadedUrls = localToUpload
        .filter((change) => {
          const remote = responseByUrl.get(change.url)
          return (
            !remote ||
            (remote.action === change.action &&
              remote.updatedAt === change.updatedAt)
          )
        })
        .map((change) => change.url)
      getDb().syncChanges.markChangesSynced(auth.userId, uploadedUrls)

      if (options.download && response.records) {
        const applied = await this.applyRemoteRecords(
          auth.userId,
          response.records,
        )
        downloaded += applied.downloaded
        subscribed += applied.subscribed
        unsubscribed += applied.unsubscribed
        ignored += applied.skipped
      }
    }

    const lastSyncAt = Date.now()
    this.setLastSyncAt(auth.userId, lastSyncAt)
    const status = this.getStatusForUser(auth.userId, lastSyncAt)
    const result: FeedSyncResult = {
      ...status,
      success: true,
      mode,
      remoteRecords: remoteRecords.length,
      localRecords: localRecords.length,
      uploaded,
      downloaded,
      subscribed,
      unsubscribed,
      ignored,
    }
    logInfo('[feed-sync] done', result)
    return result
  }
}

export const feedSyncService = new FeedSyncService()
