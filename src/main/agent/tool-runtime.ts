import type { AgentExecutionContext, AgentToolResult } from '../../shared/types'

export type AgentToolInterruptionReason = 'cancelled' | 'timeout'

const TOOL_TIMEOUT_MS: Record<string, number> = {
  web_search: 12_000,
  refresh_subscription: 60_000,
  refresh_all_subscriptions: 5 * 60_000,
  export_opml: 60_000,
  cleanup_old_entries: 60_000,
}

export class AgentToolInterruptedError extends Error {
  constructor(readonly reason: AgentToolInterruptionReason) {
    super(reason === 'timeout' ? '工具执行超时。' : '工具执行已取消。')
    this.name =
      reason === 'timeout' ? 'AgentToolTimeoutError' : 'AgentToolCancelledError'
  }
}

export interface ScopedAgentToolContext {
  context: AgentExecutionContext
  dispose: () => void
}

export function createAgentToolContext(
  toolName: string,
  context: AgentExecutionContext,
): ScopedAgentToolContext {
  const timeoutMs = getEffectiveTimeoutMs(toolName, context.deadlineMs)
  if (timeoutMs === undefined) {
    return { context, dispose: () => {} }
  }

  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined

  const abortWith = (reason: unknown): void => {
    if (!controller.signal.aborted) controller.abort(reason)
  }

  const onAbort = (): void => {
    abortWith(interruptionErrorFromSignal(context.signal))
  }

  if (context.signal.aborted) {
    onAbort()
  } else {
    context.signal.addEventListener('abort', onAbort, { once: true })
  }

  if (timeoutMs <= 0) {
    abortWith(new AgentToolInterruptedError('timeout'))
  } else {
    timer = setTimeout(() => {
      abortWith(new AgentToolInterruptedError('timeout'))
    }, timeoutMs)
  }

  const deadlineMs =
    context.deadlineMs === undefined
      ? Date.now() + Math.max(0, timeoutMs)
      : Math.min(context.deadlineMs, Date.now() + Math.max(0, timeoutMs))

  return {
    context: {
      ...context,
      signal: controller.signal,
      deadlineMs,
    },
    dispose: () => {
      if (timer) clearTimeout(timer)
      context.signal.removeEventListener('abort', onAbort)
    },
  }
}

export async function runAgentToolWithSignal<T>(
  promise: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  throwIfAgentToolAborted(signal)

  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => {
      cleanup()
      reject(interruptionErrorFromSignal(signal))
    }
    const cleanup = (): void => {
      signal.removeEventListener('abort', onAbort)
    }

    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        cleanup()
        if (signal.aborted) {
          reject(interruptionErrorFromSignal(signal))
          return
        }
        resolve(value)
      },
      (error) => {
        cleanup()
        reject(error)
      },
    )
  })
}

export function throwIfAgentToolAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw interruptionErrorFromSignal(signal)
  }
}

export function agentToolInterruptionResult(
  error: unknown,
): AgentToolResult | null {
  const reason = interruptionReasonFromError(error)
  if (!reason) return null

  return {
    status: 'failed',
    message: reason === 'timeout' ? '工具执行超时。' : '工具执行已取消。',
    data: { interrupted: true, reason },
  }
}

export function isInterruptedToolResult(result: AgentToolResult): boolean {
  const data = result.data as
    | { interrupted?: unknown; reason?: unknown }
    | undefined
  return (
    result.status === 'failed' &&
    data?.interrupted === true &&
    (data.reason === 'cancelled' || data.reason === 'timeout')
  )
}

export function interruptionReasonFromResult(
  result: AgentToolResult,
): AgentToolInterruptionReason | null {
  if (!isInterruptedToolResult(result)) return null
  const reason = (result.data as { reason?: unknown } | undefined)?.reason
  return reason === 'timeout' ? 'timeout' : 'cancelled'
}

function getEffectiveTimeoutMs(
  toolName: string,
  deadlineMs: number | undefined,
): number | undefined {
  const toolTimeoutMs = TOOL_TIMEOUT_MS[toolName]
  const deadlineTimeoutMs =
    deadlineMs === undefined ? undefined : deadlineMs - Date.now()

  if (toolTimeoutMs === undefined) return deadlineTimeoutMs
  if (deadlineTimeoutMs === undefined) return toolTimeoutMs
  return Math.min(toolTimeoutMs, deadlineTimeoutMs)
}

function interruptionErrorFromSignal(
  signal: AbortSignal,
): AgentToolInterruptedError {
  const reason = interruptionReasonFromError(signal.reason) ?? 'cancelled'
  return new AgentToolInterruptedError(reason)
}

function interruptionReasonFromError(
  error: unknown,
): AgentToolInterruptionReason | null {
  if (error instanceof AgentToolInterruptedError) return error.reason

  const err = error as { name?: unknown; message?: unknown } | undefined
  const name = typeof err?.name === 'string' ? err.name : ''
  const message = typeof err?.message === 'string' ? err.message : ''

  if (
    name === 'AgentToolTimeoutError' ||
    name === 'TimeoutError' ||
    /timeout|timed out|超时/i.test(message)
  ) {
    return 'timeout'
  }

  if (
    name === 'AgentToolCancelledError' ||
    name === 'AbortError' ||
    /abort|cancel|取消/i.test(message)
  ) {
    return 'cancelled'
  }

  return null
}
