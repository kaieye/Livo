import type {
  AgentNavigationAction,
  AgentToolExecutionEvent,
  AppCommandPayload,
  AppSettings,
  FeedWithCount,
  TaskRunRecord,
} from './types'

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

export interface RendererEventPayloadByChannel {
  'app:command': [payload: AppCommandPayload]
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
}

export type RendererEventChannel = keyof RendererEventPayloadByChannel

export type RendererEventArgs<C extends RendererEventChannel> =
  RendererEventPayloadByChannel[C]

export type RendererEventCallback<C extends RendererEventChannel> = (
  ...args: RendererEventArgs<C>
) => void

export const RENDERER_EVENT_CHANNELS = [
  'app:command',
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
] as const satisfies readonly RendererEventChannel[]

const rendererEventChannels = new Set<string>(RENDERER_EVENT_CHANNELS)

export function isRendererEventChannel(
  channel: string,
): channel is RendererEventChannel {
  return rendererEventChannels.has(channel)
}
