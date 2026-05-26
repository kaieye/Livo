import type { EntryCardModel } from './ViewModels'
import type { AccountProvider } from './SettingsModels'

export interface RemoteFeedResult {
  entries: EntryCardModel[]
  sourceLabel: string
  newEntriesCount?: number
  failedFeedCount?: number
  failedFeedLabels?: string[]
  failedFeedDetails?: string[]
  skippedByCooldown?: boolean
  skippedFeedCount?: number
  allSkippedByCooldown?: boolean
  fallbackUsed: boolean
}

export interface RefreshLogEntry {
  id: string
  refreshedAt: number
  successFeedCount: number
  failedFeedCount: number
  failedFeedTitles: string[]
}

export interface AccountStatusResult {
  provider: AccountProvider
  linked: boolean
  displayName: string
  error: string
}

export interface AccountSelfCheckRow {
  name: string
  pass: boolean
  detail: string
}

export interface AccountSelfCheckResult {
  summary: string
  rows: AccountSelfCheckRow[]
}

export interface PendingBilibiliCreator {
  mid: number
  uname: string
  exists: boolean
}

export interface BilibiliImportProgress {
  total: number
  completed: number
  imported: number
  skipped: number
  failed: number
}
