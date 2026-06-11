import type {
  AgentNavigationAction,
  AgentToolExecutionEvent,
  AppCommandPayload,
  AppSettings,
  FeedWithCount,
  TaskRunRecord,
} from './types'
import type { DeepLinkAction } from './deep-link'

export interface FeedRefreshProgressPayload {
  total: number
  completed: number
  percent: number
  feedId?: string
  feedTitle?: string
  success?: boolean
  newEntries?: number
  feed?: Partial<FeedWithCount>
  done?: boolean
}

export interface FeedsUpdatedPayload {
  newEntries?: number
  feedId?: string
  background?: boolean
  round?: number
  hasEntries?: boolean
  hasAvatar?: boolean
  /** Optional list of feed IDs that changed. If present, only these feeds need to be updated. */
  feedIds?: string[]
  /** Optional partial feed updates for incremental patching */
  feeds?: Array<Partial<FeedWithCount> & { id: string }>
}

export interface ImportProgressPayload {
  current: number
  total: number
  title: string
  status: string
}

export interface ImportRefreshProgressPayload {
  completed: number
  total: number
  success: number
  failed: number
  currentTitle?: string
}

export interface AIStreamChunkPayload {
  requestId: string
  content: string
}

export interface AIStreamDonePayload {
  requestId: string
}

export interface AIStreamErrorPayload {
  requestId: string
  error: string
}

export type AgentToolEventPayload = {
  requestId: string
} & AgentToolExecutionEvent

export interface FeverSyncProgressPayload {
  accountId: string
  phase: 'feeds' | 'items' | 'write-back' | 'done'
  feedsSynced: number
  itemsSynced: number
  newEntries: number
  error?: string
}

export interface RealtimeNotificationPayload {
  type: 'info' | 'warning' | 'error' | 'success'
  title: string
  message: string
  data?: unknown
}

export interface RendererEventPayloadByChannel {
  'app:command': [payload: AppCommandPayload]
  'app:deep-link': [payload: DeepLinkAction]
  'feeds:updated': [payload: FeedsUpdatedPayload]
  'feeds:refresh-progress': [payload: FeedRefreshProgressPayload]
  'import:progress': [payload: ImportProgressPayload]
  'import:refresh-progress': [payload: ImportRefreshProgressPayload]
  'entries:enriched': []
  'entries:repaired': []
  'ai:summary-stream-chunk': [payload: AIStreamChunkPayload]
  'ai:summary-stream-done': [payload: AIStreamDonePayload]
  'ai:summary-stream-error': [payload: AIStreamErrorPayload]
  'ai:chat-stream-chunk': [payload: AIStreamChunkPayload]
  'ai:chat-stream-done': [payload: AIStreamDonePayload]
  'ai:chat-stream-error': [payload: AIStreamErrorPayload]
  'ai:translate-stream-chunk': [payload: AIStreamChunkPayload]
  'ai:translate-stream-done': [payload: AIStreamDonePayload]
  'ai:translate-stream-error': [payload: AIStreamErrorPayload]
  'settings:changed': [settings: AppSettings]
  'agent:tool-event': [payload: AgentToolEventPayload]
  'agent:navigate': [action: AgentNavigationAction]
  'window:maximize-changed': [isMaximized: boolean]
  'fever:sync-progress': [payload: FeverSyncProgressPayload]
  'tasks:run-updated': [record: TaskRunRecord]
  'ws:connected': []
  'ws:disconnected': []
  'ws:error': [message: string]
  'ws:notification': [payload: RealtimeNotificationPayload]
}

export type RendererEventChannel = keyof RendererEventPayloadByChannel

export type RendererEventArgs<C extends RendererEventChannel> =
  RendererEventPayloadByChannel[C]

export type RendererEventCallback<C extends RendererEventChannel> = (
  ...args: RendererEventArgs<C>
) => void

export const RENDERER_EVENT_CHANNELS = [
  'app:command',
  'app:deep-link',
  'feeds:updated',
  'feeds:refresh-progress',
  'import:progress',
  'import:refresh-progress',
  'entries:enriched',
  'entries:repaired',
  'ai:summary-stream-chunk',
  'ai:summary-stream-done',
  'ai:summary-stream-error',
  'ai:chat-stream-chunk',
  'ai:chat-stream-done',
  'ai:chat-stream-error',
  'ai:translate-stream-chunk',
  'ai:translate-stream-done',
  'ai:translate-stream-error',
  'settings:changed',
  'agent:tool-event',
  'agent:navigate',
  'window:maximize-changed',
  'fever:sync-progress',
  'tasks:run-updated',
  'ws:connected',
  'ws:disconnected',
  'ws:error',
  'ws:notification',
] as const satisfies readonly RendererEventChannel[]

const rendererEventChannels = new Set<string>(RENDERER_EVENT_CHANNELS)

export function isRendererEventChannel(
  channel: string,
): channel is RendererEventChannel {
  return rendererEventChannels.has(channel)
}
