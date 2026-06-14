import type { UserOperationKey } from '../../../shared/user-operations'
import { getLocalTaskRunner } from './task-runner-service'
import type { TaskContract } from './task-contracts'
import type { TaskRunContext } from './task-runner'
import { logUserOperation } from './user-operation-log'

type TaskHandler<Payload, Result> = (
  payload: Payload,
  context: TaskRunContext,
) => Promise<Result> | Result

export interface LoggedTaskParams<Payload, Result> {
  contract: TaskContract<Payload>
  payload: Payload
  handler: TaskHandler<Payload, Result>
  operationKey: UserOperationKey
  /** Extra task metadata (operationKey is injected automatically). */
  metadata?: Record<string, unknown>
  /** Set false to skip user-operation logging while still running the task. */
  log?: boolean
  /** Classify domain-level result envelopes that report failure without throwing. */
  resultStatus?: (result: Result) => 'succeeded' | 'failed'
  resultError?: (result: Result) => unknown
  target?: { id?: string; label?: string }
  details?: {
    queued?: Record<string, unknown>
    succeeded?: (result: Result) => Record<string, unknown>
    resultFailed?: (result: Result) => Record<string, unknown>
    failed?: (error: unknown) => Record<string, unknown>
  }
  /** Reuse an in-flight run with the same dedupe key instead of enqueuing. */
  reuseActiveDedupe?: boolean
}

export interface LoggedTaskHandle<Result> {
  runId: string
  promise: Promise<Result>
  /** True when an existing in-flight run was reused (no new log emitted). */
  reusedActiveRun: boolean
}

/**
 * Enqueue a task and emit its user-operation log lifecycle
 * (queued → succeeded/failed) in one place, returning the runId alongside the
 * result. Concentrates the boilerplate that otherwise repeats around every
 * long-running operation.
 */
export function runLoggedTask<Payload, Result>(
  params: LoggedTaskParams<Payload, Result>,
): LoggedTaskHandle<Result> {
  const runner = getLocalTaskRunner()
  const shouldLog = params.log !== false

  if (params.reuseActiveDedupe) {
    const dedupeKey = params.contract.dedupeKey?.(params.payload)
    if (dedupeKey) {
      const active = runner.getActiveRun<Result>(
        params.contract.name,
        dedupeKey,
      )
      if (active) {
        return {
          runId: active.runId,
          promise: active.promise,
          reusedActiveRun: true,
        }
      }
    }
  }

  const task = runner.enqueue(params.contract, params.payload, params.handler, {
    metadata: { operationKey: params.operationKey, ...params.metadata },
  })

  if (shouldLog) {
    logUserOperation({
      operationKey: params.operationKey,
      status: 'queued',
      runId: task.runId,
      targetId: params.target?.id,
      targetLabel: params.target?.label,
      details: params.details?.queued,
    })
  }

  const promise = task.promise.then(
    (result) => {
      if (shouldLog) {
        const status = params.resultStatus?.(result) ?? 'succeeded'
        logUserOperation({
          operationKey: params.operationKey,
          status,
          runId: task.runId,
          targetId: params.target?.id,
          targetLabel: params.target?.label,
          details:
            status === 'succeeded'
              ? params.details?.succeeded?.(result)
              : params.details?.resultFailed?.(result),
          error:
            status === 'failed'
              ? (params.resultError?.(result) ?? result)
              : undefined,
        })
      }
      return result
    },
    (error) => {
      if (shouldLog) {
        logUserOperation({
          operationKey: params.operationKey,
          status: 'failed',
          runId: task.runId,
          targetId: params.target?.id,
          targetLabel: params.target?.label,
          details: params.details?.failed?.(error),
          error,
        })
      }
      throw error
    },
  )

  return { runId: task.runId, promise, reusedActiveRun: false }
}
