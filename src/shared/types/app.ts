// App commands and native bridge types
import type { AppSettings, SettingsTabId } from '../settings-schema'
import type { FeedWithCount } from './feed'
import type { ReaderSnapshot } from './entry'

export type { AppSettings, SettingsTabId } from '../settings-schema'
export {
  DEFAULT_AGENT_MAX_ROUNDS,
  DEFAULT_AGENT_MAX_TOKENS,
  DEFAULT_AGENT_RUN_TIMEOUT_SECONDS,
  DEFAULT_AGENT_TEMPERATURE,
  DEFAULT_SETTINGS,
  MAX_AGENT_MAX_ROUNDS,
  MAX_AGENT_MAX_TOKENS,
  MAX_AGENT_RUN_TIMEOUT_SECONDS,
  MAX_AGENT_TEMPERATURE,
} from '../settings-schema'

export interface RefreshRunItemResult {
  feedId: string
  feedTitle: string
  status: 'succeeded' | 'failed'
  newEntries: number
  error?: string
  /**
   * 拉取来源：
   * - `upstream` 表示直接从订阅源原链接（含本地聚合器/RSSHub）拉取。
   * - `server-cache` 表示命中 Livo-Server 后端缓存。
   * 字段为可选，兼容旧的刷新日志记录。
   */
  source?: 'upstream' | 'server-cache'
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
  installerAssetName?: string
  installerDownloadUrl?: string
  installerSize?: number
  publishedAt?: string
  notes?: string
  error?: string
}

export interface AppUpdateInstallResult {
  success: boolean
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

export interface AppHydratePayload {
  settings: AppSettings
  feeds: FeedWithCount[]
  auth: {
    success: boolean
    isValid: boolean
    user: unknown
  }
  initialSnapshot: ReaderSnapshot | null
}

export interface NativeContextMenuItem {
  id: string
  label?: string
  separator?: boolean
  disabled?: boolean
}
