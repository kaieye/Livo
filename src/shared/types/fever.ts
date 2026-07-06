// Fever protocol and aggregator types

export interface FeverAccount {
  id: string
  baseUrl: string
  username: string
  apiKey: string
  enabled: boolean
  autoSync: boolean
  syncIntervalMin: number
  lastSyncAt?: number
  lastError?: string
  createdAt: number
}

export type FeverAccountView = Omit<FeverAccount, 'apiKey'> & {
  apiKeyConfigured: boolean
}

export interface FeverFeedMapping {
  accountId: string
  feverFeedId: number
  localFeedId: string
  remoteGroup?: string
  remoteTitle?: string
  remoteUrl?: string
  isActive: boolean
  lastSeenAt: number
}

export interface FeverItemMapping {
  accountId: string
  feverItemId: number
  feverFeedId: number
  localFeedId: string
  localEntryId: string
  remoteIsRead?: boolean
  remoteIsStarred?: boolean
  isActive: boolean
  lastSeenAt: number
}

export interface FeverSyncState {
  accountId: string
  lastItemId: number
  lastSyncAt?: number
  lastFullSyncAt?: number
  lastError?: string
}

export interface AggregatorSettings {
  mode: 'disabled' | 'prefer-local-agent' | 'prefer-remote' | 'remote-only'
  endpoint: string
  apiKey: string
  deviceId: string
  pollIntervalSeconds: number
  pushEnabled: boolean
  cacheRetentionDays: number
}
