import type { EntryTaskState } from '../../../shared/types'

export type EntryInlineTaskStatusKey = 'fulltext' | 'aiSummary'

export interface EntryInlineTaskStatusLabels {
  fulltextRunning: string
  fulltextFailed: string
  aiSummaryRunning: string
  aiSummaryFailed: string
  unknownError: string
}

export interface EntryInlineTaskStatusItem {
  key: EntryInlineTaskStatusKey
  isRunning: boolean
  message: string
  canOpenSettings: boolean
}

export function isAIConfigError(error: string | undefined): boolean {
  const normalized = (error || '').toLowerCase()
  return (
    normalized.includes('api key') ||
    normalized.includes('apikey') ||
    normalized.includes('配置') ||
    normalized.includes('settings')
  )
}

function buildTaskItem(input: {
  key: EntryInlineTaskStatusKey
  state?: EntryTaskState
  runningText: string
  failedText: string
  unknownError: string
  canOpenSettings: boolean
}): EntryInlineTaskStatusItem | null {
  const status = input.state?.status
  if (status !== 'queued' && status !== 'running' && status !== 'failed') {
    return null
  }
  const isRunning = status === 'queued' || status === 'running'
  return {
    key: input.key,
    isRunning,
    message: isRunning
      ? input.runningText
      : `${input.failedText}：${input.state?.error || input.unknownError}`,
    canOpenSettings: input.canOpenSettings,
  }
}

export function buildEntryInlineTaskStatusItems(input: {
  fulltext?: EntryTaskState
  aiSummary?: EntryTaskState
  labels: EntryInlineTaskStatusLabels
}): EntryInlineTaskStatusItem[] {
  const { labels } = input
  return [
    buildTaskItem({
      key: 'fulltext',
      state: input.fulltext,
      runningText: labels.fulltextRunning,
      failedText: labels.fulltextFailed,
      unknownError: labels.unknownError,
      canOpenSettings: false,
    }),
    buildTaskItem({
      key: 'aiSummary',
      state: input.aiSummary,
      runningText: labels.aiSummaryRunning,
      failedText: labels.aiSummaryFailed,
      unknownError: labels.unknownError,
      canOpenSettings: isAIConfigError(input.aiSummary?.error),
    }),
  ].filter((item): item is EntryInlineTaskStatusItem => Boolean(item))
}
