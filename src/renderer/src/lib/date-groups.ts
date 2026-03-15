/**
 * Date grouping utility — groups entries by date for timeline display.
 * Group entries by date.
 */
import type { Entry } from "../../../shared/types"

export interface DateGroup {
  label: string
  labelKey: string
  entries: Entry[]
}

/**
 * Group entries by date category: Today, Yesterday, N days ago, Earlier
 */
export function groupEntriesByDate(entries: Entry[]): DateGroup[] {
  if (entries.length === 0) return []

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const twoDaysAgo = new Date(today.getTime() - 2 * 86400000)
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000)

  const groups: Map<string, { labelKey: string; labelParams?: Record<string, unknown>; entries: Entry[] }> = new Map()

  for (const entry of entries) {
    const date = new Date(entry.publishedAt)
    let key: string
    let labelKey: string
    let labelParams: Record<string, unknown> | undefined

    if (date >= today) {
      key = "today"
      labelKey = "entryList.today"
    } else if (date >= yesterday) {
      key = "yesterday"
      labelKey = "entryList.yesterday"
    } else if (date >= twoDaysAgo) {
      key = "2days"
      labelKey = "entryList.daysAgo"
      labelParams = { days: 2 }
    } else if (date >= sevenDaysAgo) {
      const days = Math.floor((today.getTime() - date.getTime()) / 86400000)
      key = `${days}days`
      labelKey = "entryList.daysAgo"
      labelParams = { days }
    } else {
      key = "earlier"
      labelKey = "entryList.earlier"
    }

    if (!groups.has(key)) {
      groups.set(key, { labelKey, labelParams, entries: [] })
    }
    groups.get(key)!.entries.push(entry)
  }

  // Convert to array, maintaining order
  const result: DateGroup[] = []
  const orderedKeys = ["today", "yesterday", "2days"]
  // Add day-specific keys for 3-6 days
  for (let d = 3; d <= 6; d++) {
    orderedKeys.push(`${d}days`)
  }
  orderedKeys.push("earlier")

  for (const key of orderedKeys) {
    const group = groups.get(key)
    if (group) {
      // Use a simple label - i18n substitution handled by the component
      result.push({
        label: key,
        labelKey: group.labelKey,
        entries: group.entries,
      })
    }
  }

  return result
}
