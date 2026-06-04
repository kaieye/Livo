import type {
  AIDigestPreset,
  AIDigestRun,
  EntryAISummarySession,
  EntryAITranslationSegment,
  EntryAITranslationSession,
  Entry,
  Feed,
  FeverAccount,
  FeverFeedMapping,
  FeverItemMapping,
  FeverSyncState,
  MediaItem,
} from '../../shared/types'
import { FeedViewType } from '../../shared/types'

export function feedFromRow(row: any): Feed {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    siteUrl: row.site_url || undefined,
    description: row.description || undefined,
    imageUrl: row.image_url || undefined,
    folder: row.folder || undefined,
    category: row.category || undefined,
    view: row.view as FeedViewType,
    maxEntries: row.max_entries ?? undefined,
    showInAll: row.show_in_all === 1,
    lastFetched: row.last_fetched ?? undefined,
    etag: row.etag || undefined,
    lastModified: row.last_modified || undefined,
    fetchSource: row.fetch_source || undefined,
    upstreamUrl: row.upstream_url || undefined,
    remoteFeedId: row.remote_feed_id || undefined,
    provider: row.provider || 'local',
    lastRefreshStatus: row.last_refresh_status || undefined,
    lastRefreshAttemptedAt: row.last_refresh_attempted_at ?? undefined,
    lastRefreshError: row.last_refresh_error || undefined,
    lastRefreshRawError: row.last_refresh_raw_error || undefined,
    errorCount: row.error_count,
    createdAt: row.created_at,
  }
}

export function entryAISummarySessionFromRow(row: any): EntryAISummarySession {
  return {
    id: row.id,
    entryId: row.entry_id,
    status: row.status,
    draftText: row.draft_text || '',
    finalText: row.final_text || undefined,
    errorCode: row.error_code || undefined,
    errorMessage: row.error_message || undefined,
    rawErrorMessage: row.raw_error_message || undefined,
    model: row.model || undefined,
    sourceHash: row.source_hash || undefined,
    runId: row.run_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    finishedAt: row.finished_at ?? undefined,
  }
}

function parseTranslationSegments(value: unknown): EntryAITranslationSegment[] {
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const segment = item as Partial<EntryAITranslationSegment>
        const status =
          segment.status === 'running' ||
          segment.status === 'succeeded' ||
          segment.status === 'failed' ||
          segment.status === 'skipped'
            ? segment.status
            : 'queued'
        return {
          index: Number(segment.index) || 0,
          sourceText: String(segment.sourceText || ''),
          translatedText: String(segment.translatedText || ''),
          status,
          errorMessage: segment.errorMessage
            ? String(segment.errorMessage)
            : undefined,
        }
      })
  } catch {
    return []
  }
}

export function entryAITranslationSessionFromRow(
  row: any,
): EntryAITranslationSession {
  return {
    id: row.id,
    entryId: row.entry_id,
    targetLanguage: row.target_language,
    status: row.status,
    segments: parseTranslationSegments(row.segments_json),
    errorCode: row.error_code || undefined,
    errorMessage: row.error_message || undefined,
    model: row.model || undefined,
    configFingerprint: row.config_fingerprint || undefined,
    runId: row.run_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    finishedAt: row.finished_at ?? undefined,
  }
}

export function entryFromRow(row: any): Entry {
  let media: MediaItem[] | undefined
  if (row.media) {
    try {
      media = JSON.parse(row.media)
    } catch {
      media = undefined
    }
  }
  return {
    id: row.id,
    feedId: row.feed_id,
    title: row.title,
    url: row.url,
    content: row.content || undefined,
    summary: row.summary || undefined,
    readabilityContent: row.readability_content || undefined,
    readabilityTitle: row.readability_title || undefined,
    readabilityExcerpt: row.readability_excerpt || undefined,
    readabilitySiteName: row.readability_site_name || undefined,
    readabilityLength: row.readability_length ?? undefined,
    readabilityFetchedAt: row.readability_fetched_at ?? undefined,
    readabilityError: row.readability_error || undefined,
    aiSummary: row.ai_summary || undefined,
    aiSummaryGeneratedAt: row.ai_summary_generated_at ?? undefined,
    aiSummaryError: row.ai_summary_error || undefined,
    notifiedAt: row.notified_at ?? undefined,
    author: row.author || undefined,
    authorAvatar: row.author_avatar || undefined,
    imageUrl: row.image_url || undefined,
    media,
    publishedAt: row.published_at,
    isRead: row.is_read === 1,
    isStarred: row.is_starred === 1,
    readProgress: row.read_progress ?? undefined,
    isListened: row.is_listened === 1,
    listenProgress: row.listen_progress ?? undefined,
    createdAt: row.created_at,
  }
}

export function digestRunFromRow(row: any): AIDigestRun {
  let sourceEntryIds: string[] = []
  if (row.source_entry_ids) {
    try {
      sourceEntryIds = JSON.parse(row.source_entry_ids)
    } catch {
      sourceEntryIds = []
    }
  }
  return {
    id: row.id,
    preset: row.preset as AIDigestPreset,
    feedId: row.feed_id || undefined,
    title: row.title,
    status: row.status,
    windowStartAt: row.window_start_at,
    windowEndAt: row.window_end_at,
    sourceEntryIds,
    candidateCount: row.candidate_count,
    content: row.content || undefined,
    error: row.error || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function feverAccountFromRow(row: any): FeverAccount {
  return {
    id: row.id,
    baseUrl: row.base_url,
    username: row.username,
    apiKey: row.api_key,
    enabled: row.enabled === 1,
    autoSync: row.auto_sync === 1,
    syncIntervalMin: row.sync_interval_min,
    lastSyncAt: row.last_sync_at ?? undefined,
    lastError: row.last_error || undefined,
    createdAt: row.created_at,
  }
}

export function feverFeedMappingFromRow(row: any): FeverFeedMapping {
  return {
    accountId: row.account_id,
    feverFeedId: row.fever_feed_id,
    localFeedId: row.local_feed_id,
    remoteGroup: row.remote_group || undefined,
    remoteTitle: row.remote_title || undefined,
    remoteUrl: row.remote_url || undefined,
    isActive: row.is_active === 1,
    lastSeenAt: row.last_seen_at,
  }
}

export function feverItemMappingFromRow(row: any): FeverItemMapping {
  return {
    accountId: row.account_id,
    feverItemId: row.fever_item_id,
    feverFeedId: row.fever_feed_id,
    localFeedId: row.local_feed_id,
    localEntryId: row.local_entry_id,
    remoteIsRead: row.remote_is_read === 1,
    remoteIsStarred: row.remote_is_starred === 1,
    isActive: row.is_active === 1,
    lastSeenAt: row.last_seen_at,
  }
}

export function feverSyncStateFromRow(row: any): FeverSyncState {
  return {
    accountId: row.account_id,
    lastItemId: row.last_item_id,
    lastSyncAt: row.last_sync_at ?? undefined,
    lastFullSyncAt: row.last_full_sync_at ?? undefined,
    lastError: row.last_error || undefined,
  }
}
