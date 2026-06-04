import type { Entry, EntryTaskSnapshot, EntryTaskState } from './types/entry'
import type { TaskRunRecord } from './types/task'

type EntryTaskKind = 'fulltext' | 'aiSummary' | 'aiTranslate'
type ActiveTaskInput = Pick<
  TaskRunRecord,
  'status' | 'error' | 'updatedAt' | 'finishedAt'
>

export interface DeriveEntryTaskSnapshotOptions {
  activeTasks?: Partial<Record<EntryTaskKind, ActiveTaskInput>>
}

function hasText(value: string | undefined): boolean {
  return !!value?.trim()
}

function normalizeActiveStatus(
  activeTask: ActiveTaskInput | undefined,
): EntryTaskState | null {
  if (!activeTask) return null
  if (activeTask.status !== 'queued' && activeTask.status !== 'running') {
    return null
  }
  return {
    status: activeTask.status,
    error: activeTask.error,
    updatedAt: activeTask.updatedAt || activeTask.finishedAt,
  }
}

function deriveTaskState(input: {
  successValue?: string
  successUpdatedAt?: number
  error?: string
  activeTask?: ActiveTaskInput
}): EntryTaskState {
  if (hasText(input.successValue)) {
    return {
      status: 'succeeded',
      updatedAt: input.successUpdatedAt,
    }
  }

  if (hasText(input.error)) {
    return {
      status: 'failed',
      error: input.error,
    }
  }

  return normalizeActiveStatus(input.activeTask) ?? { status: 'idle' }
}

export function deriveFulltextStatus(
  entry: Entry,
  activeTask?: ActiveTaskInput,
): EntryTaskState {
  return deriveTaskState({
    successValue: entry.readabilityContent,
    successUpdatedAt: entry.readabilityFetchedAt,
    error: entry.readabilityError,
    activeTask,
  })
}

export function deriveAISummaryStatus(
  entry: Entry,
  activeTask?: ActiveTaskInput,
): EntryTaskState {
  return deriveTaskState({
    successValue: entry.aiSummary,
    successUpdatedAt: entry.aiSummaryGeneratedAt,
    error: entry.aiSummaryError,
    activeTask,
  })
}

export function deriveEntryTaskSnapshot(
  entry: Entry,
  options: DeriveEntryTaskSnapshotOptions = {},
): EntryTaskSnapshot {
  const snapshot: EntryTaskSnapshot = {
    fulltext: deriveFulltextStatus(entry, options.activeTasks?.fulltext),
    aiSummary: deriveAISummaryStatus(entry, options.activeTasks?.aiSummary),
  }

  const aiTranslateState = normalizeActiveStatus(
    options.activeTasks?.aiTranslate,
  )
  if (aiTranslateState) {
    snapshot.aiTranslate = aiTranslateState
  }

  return snapshot
}
