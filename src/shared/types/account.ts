// Account and profile resolution types
import type { FeedViewType } from './feed'

export type AccountProvider =
  | 'google'
  | 'wechat'
  | 'youtube'
  | 'x'
  | 'instagram'
  | 'bilibili'

export interface AccountSessionState {
  provider: AccountProvider
  linked: boolean
  displayName?: string | null
  error?: string
}

export interface ResolvedProfileFeedCandidate {
  feedUrl: string
  title: string
  source: 'rss' | 'rsshub' | 'derived'
  siteUrl?: string
  description?: string
  view?: FeedViewType
  requiresAccount?: AccountProvider[]
  note?: string
}

export interface ResolvedProfileUrlResult {
  matched: boolean
  inputUrl: string
  normalizedUrl: string | null
  platform: 'youtube' | 'x' | 'instagram' | 'bilibili' | 'github' | null
  candidates: ResolvedProfileFeedCandidate[]
  accountStates?: AccountSessionState[]
  reason: 'invalid_url' | 'no_supported_profile_pattern' | null
}
