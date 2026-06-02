import type { TaskContract, TaskRetryPolicy } from './task-contracts'

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

export interface TaskRunContext {
  readonly runId: string
  readonly taskName: string
  reportProgress(progress: TaskRunProgress): void
}

export interface TaskRunHandle<Result> {
  runId: string
  promise: Promise<Result>
  getRecord(): TaskRunRecord | undefined
}

export interface TaskRunnerOptions {
  maxRecentRuns?: number
  now?: () => number
  emit?: (record: TaskRunRecord) => void
}

interface QueuedTask<Payload, Result> {
  contract: TaskContract<Payload>
  payload: Payload
  handler: TaskHandler<Payload, Result>
  resolve: (value: Result) => void
  reject: (error: unknown) => void
  record: TaskRunRecord
}

type TaskHandler<Payload, Result> = (
  payload: Payload,
  context: TaskRunContext,
) => Promise<Result> | Result

export class TaskRunTimeoutError extends Error {
  constructor(taskName: string, timeoutMs: number) {
    super(`[task-runner] timeout after ${timeoutMs}ms: ${taskName}`)
    this.name = 'TaskRunTimeoutError'
  }
}

export class TaskRunStore {
  private readonly records = new Map<string, TaskRunRecord>()
  private readonly order: string[] = []

  constructor(private readonly maxRecentRuns = 100) {}

  upsert(record: TaskRunRecord): TaskRunRecord {
    const next = snapshotTaskRunRecord(record)
    if (!this.records.has(next.runId)) {
      this.order.push(next.runId)
    }
    this.records.set(next.runId, next)
    this.trim()
    return snapshotTaskRunRecord(next)
  }

  update(
    runId: string,
    patch: Partial<Omit<TaskRunRecord, 'runId'>>,
  ): TaskRunRecord | undefined {
    const current = this.records.get(runId)
    if (!current) return undefined
    const next = snapshotTaskRunRecord({ ...current, ...patch })
    this.records.set(runId, next)
    return snapshotTaskRunRecord(next)
  }

  get(runId: string): TaskRunRecord | undefined {
    const record = this.records.get(runId)
    return record ? snapshotTaskRunRecord(record) : undefined
  }

  listRecent(taskName?: string): TaskRunRecord[] {
    return this.order
      .map((runId) => this.records.get(runId))
      .filter((record): record is TaskRunRecord => {
        if (!record) return false
        return taskName ? record.taskName === taskName : true
      })
      .map(snapshotTaskRunRecord)
  }

  private trim(): void {
    while (this.order.length > this.maxRecentRuns) {
      const runId = this.order.shift()
      if (runId) this.records.delete(runId)
    }
  }
}

export class TaskRunner {
  private readonly store: TaskRunStore
  private readonly now: () => number
  private readonly emit: (record: TaskRunRecord) => void
  private readonly queues = new Map<
    string,
    Array<QueuedTask<unknown, unknown>>
  >()
  private readonly runningCounts = new Map<string, number>()
  private readonly activeDedupe = new Map<string, TaskRunHandle<unknown>>()
  private nextRunId = 1

  constructor(store?: TaskRunStore, options: TaskRunnerOptions = {}) {
    this.store = store ?? new TaskRunStore(options.maxRecentRuns)
    this.now = options.now ?? Date.now
    this.emit = options.emit ?? (() => {})
  }

  enqueue<Payload, Result>(
    contract: TaskContract<Payload>,
    payload: Payload,
    handler: TaskHandler<Payload, Result>,
    options: { metadata?: Record<string, unknown> } = {},
  ): TaskRunHandle<Result> {
    const dedupeKey = contract.dedupeKey?.(payload)
    const activeKey = this.makeActiveKey(contract.name, dedupeKey)
    const existing = dedupeKey ? this.activeDedupe.get(activeKey) : undefined
    if (existing) return existing as TaskRunHandle<Result>

    const now = this.now()
    const retry = normalizeRetry(contract.retry)
    const record = this.storeAndEmit({
      runId: this.createRunId(contract.name),
      taskName: contract.name,
      dedupeKey,
      status: 'queued',
      attempt: 0,
      maxAttempts: retry.maxAttempts,
      createdAt: now,
      updatedAt: now,
      metadata: options.metadata,
    })

    let resolvePromise!: (value: Result) => void
    let rejectPromise!: (error: unknown) => void
    const promise = new Promise<Result>((resolve, reject) => {
      resolvePromise = resolve
      rejectPromise = reject
    })

    const handle: TaskRunHandle<Result> = {
      runId: record.runId,
      promise,
      getRecord: () => this.store.get(record.runId),
    }

    if (dedupeKey) this.activeDedupe.set(activeKey, handle)

    const queued: QueuedTask<Payload, Result> = {
      contract,
      payload,
      handler,
      resolve: resolvePromise,
      reject: rejectPromise,
      record,
    }
    this.getQueue(contract.name).push(queued as QueuedTask<unknown, unknown>)
    this.schedule(contract.name)
    return handle
  }

  getActiveRun<Result>(
    taskName: string,
    dedupeKey: string,
  ): TaskRunHandle<Result> | undefined {
    return this.activeDedupe.get(this.makeActiveKey(taskName, dedupeKey)) as
      | TaskRunHandle<Result>
      | undefined
  }

  getRun(runId: string): TaskRunRecord | undefined {
    return this.store.get(runId)
  }

  listRecentRuns(taskName?: string): TaskRunRecord[] {
    return this.store.listRecent(taskName)
  }

  private schedule(taskName: string): void {
    const queue = this.getQueue(taskName)
    if (queue.length === 0) return

    const first = queue[0]
    const limit = getEffectiveConcurrency(first.contract.concurrency)
    const running = this.runningCounts.get(taskName) ?? 0
    if (running >= limit) return

    const task = queue.shift()
    if (!task) return

    this.runningCounts.set(taskName, running + 1)
    void this.execute(task).finally(() => {
      const currentRunning = this.runningCounts.get(taskName) ?? 1
      this.runningCounts.set(taskName, Math.max(0, currentRunning - 1))
      this.clearActive(task.contract.name, task.record.dedupeKey)
      this.schedule(taskName)
    })

    this.schedule(taskName)
  }

  private async execute<Payload, Result>(
    task: QueuedTask<Payload, Result>,
  ): Promise<void> {
    const retry = normalizeRetry(task.contract.retry)
    let lastError: unknown

    for (let attempt = 1; attempt <= retry.maxAttempts; attempt++) {
      const startedAt = this.now()
      this.updateAndEmit(task.record.runId, {
        status: 'running',
        attempt,
        startedAt,
        updatedAt: startedAt,
        error: undefined,
      })

      const context: TaskRunContext = {
        runId: task.record.runId,
        taskName: task.contract.name,
        reportProgress: (progress) => {
          this.updateAndEmit(task.record.runId, {
            progress,
            updatedAt: this.now(),
          })
        },
      }

      try {
        const result = await this.withTimeout(
          Promise.resolve(task.handler(task.payload, context)),
          task.contract,
        )
        const finishedAt = this.now()
        this.updateAndEmit(task.record.runId, {
          status: 'succeeded',
          finishedAt,
          updatedAt: finishedAt,
        })
        task.resolve(result)
        return
      } catch (error) {
        lastError = error
        if (attempt < retry.maxAttempts) {
          await sleep(getRetryDelayMs(retry, attempt))
          continue
        }
      }
    }

    const finishedAt = this.now()
    this.updateAndEmit(task.record.runId, {
      status: lastError instanceof TaskRunTimeoutError ? 'timeout' : 'failed',
      finishedAt,
      updatedAt: finishedAt,
      error: formatTaskError(lastError),
    })
    task.reject(lastError)
  }

  private withTimeout<Payload, Result>(
    promise: Promise<Result>,
    contract: TaskContract<Payload>,
  ): Promise<Result> {
    const timeoutMs = contract.timeoutMs
    if (!Number.isFinite(timeoutMs) || !timeoutMs || timeoutMs <= 0) {
      return promise
    }

    return new Promise<Result>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new TaskRunTimeoutError(contract.name, timeoutMs))
      }, timeoutMs)
      promise.then(
        (value) => {
          clearTimeout(timer)
          resolve(value)
        },
        (error) => {
          clearTimeout(timer)
          reject(error)
        },
      )
    })
  }

  private getQueue(taskName: string): Array<QueuedTask<unknown, unknown>> {
    let queue = this.queues.get(taskName)
    if (!queue) {
      queue = []
      this.queues.set(taskName, queue)
    }
    return queue
  }

  private createRunId(taskName: string): string {
    const normalized = taskName.replace(/[^a-z0-9]+/gi, '-')
    return `${normalized}-${this.now()}-${this.nextRunId++}`
  }

  private makeActiveKey(
    taskName: string,
    dedupeKey: string | undefined,
  ): string {
    return `${taskName}:${dedupeKey || ''}`
  }

  private clearActive(taskName: string, dedupeKey: string | undefined): void {
    if (!dedupeKey) return
    this.activeDedupe.delete(this.makeActiveKey(taskName, dedupeKey))
  }

  private storeAndEmit(record: TaskRunRecord): TaskRunRecord {
    const stored = this.store.upsert(record)
    this.emit(stored)
    return stored
  }

  private updateAndEmit(
    runId: string,
    patch: Partial<Omit<TaskRunRecord, 'runId'>>,
  ): TaskRunRecord | undefined {
    const record = this.store.update(runId, patch)
    if (record) this.emit(record)
    return record
  }
}

function normalizeRetry(retry: TaskRetryPolicy | undefined): TaskRetryPolicy {
  return {
    maxAttempts: Math.max(1, Math.floor(retry?.maxAttempts ?? 1)),
    delayMs: Math.max(0, retry?.delayMs ?? 0),
    backoff: retry?.backoff,
    maxDelayMs: retry?.maxDelayMs,
  }
}

function getRetryDelayMs(
  retry: TaskRetryPolicy,
  failedAttempt: number,
): number {
  const base = retry.delayMs ?? 0
  if (base <= 0) return 0
  const delay = retry.backoff ? base * Math.pow(2, failedAttempt - 1) : base
  return retry.maxDelayMs ? Math.min(delay, retry.maxDelayMs) : delay
}

function getEffectiveConcurrency(concurrency: number): number {
  if (!Number.isFinite(concurrency)) return 1
  return Math.max(1, Math.floor(concurrency))
}

function formatTaskError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function snapshotTaskRunRecord(record: TaskRunRecord): TaskRunRecord {
  return {
    ...record,
    progress: record.progress ? { ...record.progress } : undefined,
    metadata: record.metadata ? { ...record.metadata } : undefined,
  }
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}
