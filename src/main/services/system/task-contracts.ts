export interface TaskRetryPolicy {
  maxAttempts: number
  delayMs?: number
  backoff?: boolean
  maxDelayMs?: number
}

export interface TaskContract<Payload = unknown> {
  name: string
  concurrency: number
  dedupeKey?: (payload: Payload) => string | undefined
  timeoutMs?: number
  retry?: TaskRetryPolicy
}

export const TASK_NAMES = {
  FEED_REFRESH_SINGLE: 'feed.refresh_single',
  FEED_REFRESH_ALL: 'feed.refresh_all',
  VIDEO_DURATION_ENRICH: 'video.duration_enrich',
  AI_DIGEST_GENERATE: 'ai.digest_generate',
  FEVER_SYNC: 'fever.sync',
} as const

export interface FeedRefreshSingleTaskPayload {
  feedId: string
  force: boolean
}

export interface FeedRefreshAllTaskPayload {
  force: boolean
}

export interface VideoDurationEnrichTaskPayload {
  feedId: string
}

export interface AiDigestGenerateTaskPayload {
  preset?: string
  feedId?: string
}

export interface FeverSyncTaskPayload {
  accountId: string
  force?: boolean
}

export const FEED_REFRESH_SINGLE_TASK: TaskContract<FeedRefreshSingleTaskPayload> =
  {
    name: TASK_NAMES.FEED_REFRESH_SINGLE,
    concurrency: 8,
    dedupeKey: (payload) => payload.feedId,
    timeoutMs: 150000,
    retry: { maxAttempts: 1 },
  }

export const FEED_REFRESH_ALL_TASK: TaskContract<FeedRefreshAllTaskPayload> = {
  name: TASK_NAMES.FEED_REFRESH_ALL,
  concurrency: 1,
  dedupeKey: () => 'all',
  retry: { maxAttempts: 1 },
}

export const VIDEO_DURATION_ENRICH_TASK: TaskContract<VideoDurationEnrichTaskPayload> =
  {
    name: TASK_NAMES.VIDEO_DURATION_ENRICH,
    concurrency: 1,
    dedupeKey: (payload) => payload.feedId,
    timeoutMs: 300000,
    retry: { maxAttempts: 1 },
  }

export const AI_DIGEST_GENERATE_TASK: TaskContract<AiDigestGenerateTaskPayload> =
  {
    name: TASK_NAMES.AI_DIGEST_GENERATE,
    concurrency: 1,
    dedupeKey: (payload) => payload.feedId || payload.preset || 'global',
    timeoutMs: 1800000,
    retry: {
      maxAttempts: 3,
      delayMs: 30000,
      backoff: true,
      maxDelayMs: 600000,
    },
  }

export const FEVER_SYNC_TASK: TaskContract<FeverSyncTaskPayload> = {
  name: TASK_NAMES.FEVER_SYNC,
  concurrency: 1,
  dedupeKey: (payload) => payload.accountId,
  timeoutMs: 3600000,
  retry: { maxAttempts: 3, delayMs: 30000 },
}
