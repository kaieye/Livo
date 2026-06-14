const STORAGE_KEY = 'livo.reading.activity.v1'
const MAX_DAYS = 400
const DEVICE_ID_KEY = 'livo.device.id.v1'

export type ReadingActivity = Record<string, number>

function getOrCreateDeviceId(): string {
  try {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY)
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
      localStorage.setItem(DEVICE_ID_KEY, deviceId)
    }
    return deviceId
  } catch {
    return `device_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  }
}

export function getDeviceId(): string {
  return getOrCreateDeviceId()
}

export function toDayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getReadingActivity(): ReadingActivity {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const result: ReadingActivity = {}
    for (const [key, value] of Object.entries(parsed as ReadingActivity)) {
      const count = Number(value)
      if (
        /^\d{4}-\d{2}-\d{2}$/.test(key) &&
        Number.isFinite(count) &&
        count > 0
      ) {
        result[key] = Math.floor(count)
      }
    }
    return result
  } catch {
    return {}
  }
}

function pruneOldDays(activity: ReadingActivity): ReadingActivity {
  const keys = Object.keys(activity)
  if (keys.length <= MAX_DAYS) return activity
  const kept = keys.sort().slice(keys.length - MAX_DAYS)
  const result: ReadingActivity = {}
  for (const key of kept) result[key] = activity[key]
  return result
}

export function recordReadActivity(count = 1): void {
  if (count <= 0) return
  try {
    const activity = getReadingActivity()
    const key = toDayKey(new Date())
    activity[key] = (activity[key] ?? 0) + count
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pruneOldDays(activity)))
    window.dispatchEvent(new CustomEvent('reading-activity-updated'))
  } catch {
    // Ignore storage write errors.
  }
}

export async function syncReadingActivityToServer(): Promise<void> {
  try {
    const activity = getReadingActivity()
    const deviceId = getDeviceId()
    const days = Object.entries(activity).map(([day, count]) => ({
      day,
      count,
    }))

    if (days.length === 0) return

    const result = await window.api.readingActivity.sync(deviceId, days)

    // 服务端返回跨设备聚合后的数据，可选：合并到本地展示
    if (result.aggregatedDays && result.aggregatedDays.length > 0) {
      const merged: ReadingActivity = {}
      for (const { day, count } of result.aggregatedDays) {
        merged[day] = count
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pruneOldDays(merged)))
      window.dispatchEvent(new CustomEvent('reading-activity-updated'))
    }
  } catch (error) {
    console.error('Failed to sync reading activity:', error)
  }
}
