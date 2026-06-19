export interface ScopedAbortSignal {
  signal: AbortSignal
  dispose: () => void
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  throw abortErrorFromSignal(signal)
}

export function abortErrorFromSignal(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) return signal.reason
  return new DOMException('Aborted', 'AbortError')
}

export function isAbortError(error: unknown): boolean {
  const err = error as { name?: unknown; message?: unknown } | undefined
  const name = typeof err?.name === 'string' ? err.name : ''
  const message = typeof err?.message === 'string' ? err.message : ''
  return (
    name === 'AbortError' ||
    name === 'AgentToolCancelledError' ||
    name === 'AgentToolTimeoutError' ||
    /abort|cancel|timeout|timed out|取消|超时/i.test(message)
  )
}

export function scopedSignalWithTimeout(
  timeoutMs: number,
  parent?: AbortSignal,
): ScopedAbortSignal {
  if (!parent && (!Number.isFinite(timeoutMs) || timeoutMs <= 0)) {
    const controller = new AbortController()
    return { signal: controller.signal, dispose: () => {} }
  }

  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined

  const abortFromParent = (): void => {
    if (!controller.signal.aborted) {
      controller.abort(
        parent?.reason ?? new DOMException('Aborted', 'AbortError'),
      )
    }
  }

  if (parent?.aborted) {
    abortFromParent()
  } else {
    parent?.addEventListener('abort', abortFromParent, { once: true })
  }

  if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
    timer = setTimeout(() => {
      if (!controller.signal.aborted) {
        controller.abort(new DOMException('Timed out', 'TimeoutError'))
      }
    }, timeoutMs)
  }

  return {
    signal: controller.signal,
    dispose: () => {
      if (timer) clearTimeout(timer)
      parent?.removeEventListener('abort', abortFromParent)
    },
  }
}
