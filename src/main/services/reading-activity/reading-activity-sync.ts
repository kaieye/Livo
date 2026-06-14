import { logInfo, logError, logWarn } from '../system/logger'
import { getBackendBaseUrl } from '../backend/backend-config'
import { sessionStore } from '../auth/session-store'
import type { IpcEnvelope } from '../../../shared/ipc-contracts'

export interface ReadingActivityDay {
  day: string
  count: number
}

export interface ReadingActivitySyncResult {
  uploaded: number
  aggregatedDays: ReadingActivityDay[]
}

/**
 * 向 Livo-Server 上报本地阅读活动（按设备、按天的绝对计数），
 * 服务端会按 (userId, day) 对多设备数据求和后返回聚合结果。
 */
export async function syncReadingActivity(
  deviceId: string,
  days: ReadingActivityDay[],
): Promise<ReadingActivitySyncResult> {
  const session = sessionStore.getSession()
  if (!session?.token) {
    throw new Error('Not logged in to Livo-Server')
  }

  const url = `${getBackendBaseUrl()}/api/reading-activity/sync`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify({ deviceId, days }),
  })

  if (!response.ok) {
    const text = await response.text()
    logError('Reading activity sync failed', {
      status: response.status,
      body: text,
    })
    throw new Error(`Sync failed: ${response.status} ${text}`)
  }

  const result =
    (await response.json()) as IpcEnvelope<ReadingActivitySyncResult>
  if (!result.ok) {
    throw new Error(result.error.message)
  }

  logInfo('Reading activity synced', {
    uploaded: result.data.uploaded,
    aggregated: result.data.aggregatedDays.length,
  })

  return result.data
}

/**
 * 从 Livo-Server 拉取按天聚合的阅读活动数据（多设备求和后的结果）。
 */
export async function fetchAggregatedReadingActivity(): Promise<
  ReadingActivityDay[]
> {
  const session = sessionStore.getSession()
  if (!session?.token) {
    return []
  }

  const url = `${getBackendBaseUrl()}/api/reading-activity`
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${session.token}`,
    },
  })

  if (!response.ok) {
    logWarn('Failed to fetch aggregated reading activity', {
      status: response.status,
    })
    return []
  }

  const result = (await response.json()) as IpcEnvelope<ReadingActivityDay[]>
  if (!result.ok) {
    logWarn('Reading activity fetch returned error', { error: result.error })
    return []
  }

  return result.data
}
