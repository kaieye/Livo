export type TaskRunStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'timeout'

export interface TaskRunProgress {
  total?: number
  completed?: number
  message?: string
  data?: Record<string, unknown>
}

export interface TaskRunRecord {
  runId: string
  taskName: string
  dedupeKey?: string
  status: TaskRunStatus
  attempt: number
  maxAttempts: number
  createdAt: number
  updatedAt: number
  startedAt?: number
  finishedAt?: number
  error?: string
  progress?: TaskRunProgress
  metadata?: Record<string, unknown>
}

export interface TaskRunListOptions {
  taskName?: string
  limit?: number
}
