// App commands and native bridge types
import type { SettingsTabId } from '../settings-schema'

export type { AppSettings, SettingsTabId } from '../settings-schema'
export { DEFAULT_SETTINGS } from '../settings-schema'

export interface RefreshRunItemResult {
  feedId: string
  feedTitle: string
  status: 'succeeded' | 'failed'
  newEntries: number
  error?: string
}

export interface RefreshLogEntry {
  id: string
  refreshedAt: number
  successFeedCount: number
  failedFeedCount: number
  failedFeedTitles: string[]
  items?: RefreshRunItemResult[]
}

export type AppCommandType =
  | 'open-settings'
  | 'open-search'
  | 'show-shortcuts'
  | 'refresh-all'
  | 'open-data-settings'

export interface AppCommandPayload {
  type: AppCommandType
  tab?: SettingsTabId
}

export interface AppUpdateInfo {
  hasUpdate: boolean
  currentVersion: string
  latestVersion?: string
  releaseUrl?: string
  publishedAt?: string
  notes?: string
  error?: string
}

export interface SaveTextFileOptions {
  content: string
  defaultFileName: string
  title?: string
  filters?: Array<{
    name: string
    extensions: string[]
  }>
}

export interface SaveTextFileResult {
  success: boolean
  canceled?: boolean
  filePath?: string
  error?: string
}

export interface DownloadUrlOptions {
  url: string
  suggestedFileName?: string
  title?: string
  filters?: Array<{
    name: string
    extensions: string[]
  }>
}

export interface DownloadUrlResult {
  success: boolean
  canceled?: boolean
  filePath?: string
  error?: string
}

export interface NativeContextMenuItem {
  id: string
  label?: string
  separator?: boolean
  disabled?: boolean
}
