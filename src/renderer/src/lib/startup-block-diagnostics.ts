const STARTUP_BLOCK_PREFIX = '[StartupBlock]'
const STARTUP_OBSERVATION_WINDOW_MS = 5000
const LONG_TASK_THRESHOLD_MS = 50
const EVENT_LOOP_LAG_THRESHOLD_MS = 80
const EVENT_LOOP_SAMPLE_INTERVAL_MS = 100
const INPUT_DELAY_THRESHOLD_MS = 16

type StartupBlockEvent = {
  name: string
  at: number
  duration?: number
  detail?: string
}

type StartupBlockSession = {
  startedAt: number
  events: StartupBlockEvent[]
  stop: () => void
  record: (event: StartupBlockEvent) => void
  flush: (reason: string) => void
}

type PerformanceEventTiming = PerformanceEntry & {
  processingStart?: number
  interactionId?: number
}

let session: StartupBlockSession | null = null

function nowSinceStart(startedAt: number): number {
  return performance.now() - startedAt
}

function formatEvent(event: StartupBlockEvent): string {
  const duration =
    typeof event.duration === 'number'
      ? ` duration=${event.duration.toFixed(1)}ms`
      : ''
  const detail = event.detail ? ` ${event.detail}` : ''
  return `${event.name} at=${event.at.toFixed(1)}ms${duration}${detail}`
}

function safeObserve(
  observer: PerformanceObserver,
  options: PerformanceObserverInit,
): boolean {
  try {
    observer.observe(options)
    return true
  } catch {
    return false
  }
}

export function recordStartupBlockEvent(
  name: string,
  detail?: string,
  duration?: number,
): void {
  if (!session) return

  session.record({
    name,
    at: nowSinceStart(session.startedAt),
    duration,
    detail,
  })
}

export function markStartupComponentMounted(name: string): void {
  recordStartupBlockEvent(`${name}.mounted`)
}

export async function traceStartupChunk<T>(
  name: string,
  loader: () => Promise<T>,
): Promise<T> {
  const start = performance.now()
  recordStartupBlockEvent(`${name}.chunkStart`)

  try {
    const result = await loader()
    recordStartupBlockEvent(
      `${name}.chunkLoaded`,
      undefined,
      performance.now() - start,
    )
    return result
  } catch (error) {
    recordStartupBlockEvent(
      `${name}.chunkFailed`,
      error instanceof Error ? error.message : String(error),
      performance.now() - start,
    )
    throw error
  }
}

export function startStartupBlockDiagnostics(): void {
  if (session || typeof window === 'undefined') return

  const startedAt = performance.now()
  const events: StartupBlockEvent[] = []
  const cleanup: Array<() => void> = []
  let flushed = false

  const activeSession: StartupBlockSession = {
    startedAt,
    events,
    record(event) {
      if (performance.now() - startedAt > STARTUP_OBSERVATION_WINDOW_MS) return
      events.push(event)
      if (
        event.name.includes('longtask') ||
        event.name.includes('inputDelay') ||
        event.name.includes('eventLoopLag')
      ) {
        console.warn(`${STARTUP_BLOCK_PREFIX} ${formatEvent(event)}`)
      } else {
        console.info(`${STARTUP_BLOCK_PREFIX} ${formatEvent(event)}`)
      }
    },
    flush(reason) {
      if (flushed) return
      flushed = true
      activeSession.stop()
      console.group(`${STARTUP_BLOCK_PREFIX} summary reason=${reason}`)
      for (const event of events) {
        console.log(formatEvent(event))
      }
      console.groupEnd()
    },
    stop() {
      while (cleanup.length > 0) cleanup.pop()?.()
      if (session === activeSession) session = null
    },
  }

  session = activeSession
  activeSession.record({ name: 'diagnostics.started', at: 0 })

  if (typeof PerformanceObserver !== 'undefined') {
    const longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration < LONG_TASK_THRESHOLD_MS) continue
        activeSession.record({
          name: 'longtask',
          at: entry.startTime - startedAt,
          duration: entry.duration,
          detail: `entry=${entry.name}`,
        })
      }
    })
    if (safeObserve(longTaskObserver, { entryTypes: ['longtask'] })) {
      cleanup.push(() => longTaskObserver.disconnect())
    }

    const eventObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceEventTiming[]) {
        if (
          entry.name !== 'click' &&
          entry.name !== 'pointerdown' &&
          entry.name !== 'keydown'
        ) {
          continue
        }
        const processingStart = entry.processingStart ?? entry.startTime
        const delay = processingStart - entry.startTime
        if (delay < INPUT_DELAY_THRESHOLD_MS) continue
        activeSession.record({
          name: `${entry.name}.inputDelay`,
          at: entry.startTime - startedAt,
          duration: delay,
          detail:
            typeof entry.interactionId === 'number'
              ? `interactionId=${entry.interactionId}`
              : undefined,
        })
      }
    })
    if (
      safeObserve(eventObserver, {
        type: 'event',
        durationThreshold: INPUT_DELAY_THRESHOLD_MS,
      } as PerformanceObserverInit & { durationThreshold: number })
    ) {
      cleanup.push(() => eventObserver.disconnect())
    }
  }

  let expected = performance.now() + EVENT_LOOP_SAMPLE_INTERVAL_MS
  const lagTimer = window.setInterval(() => {
    const current = performance.now()
    const lag = current - expected
    if (lag >= EVENT_LOOP_LAG_THRESHOLD_MS) {
      activeSession.record({
        name: 'eventLoopLag',
        at: current - startedAt,
        duration: lag,
      })
    }
    expected = current + EVENT_LOOP_SAMPLE_INTERVAL_MS
  }, EVENT_LOOP_SAMPLE_INTERVAL_MS)
  cleanup.push(() => window.clearInterval(lagTimer))

  const pointerListener = (event: PointerEvent) => {
    activeSession.record({
      name: 'pointerdown.handlerReached',
      at: nowSinceStart(startedAt),
      detail: `target=${event.target instanceof Element ? event.target.tagName.toLowerCase() : 'unknown'}`,
    })
  }
  const clickListener = (event: MouseEvent) => {
    activeSession.record({
      name: 'click.handlerReached',
      at: nowSinceStart(startedAt),
      detail: `target=${event.target instanceof Element ? event.target.tagName.toLowerCase() : 'unknown'}`,
    })
  }
  window.addEventListener('pointerdown', pointerListener, true)
  window.addEventListener('click', clickListener, true)
  cleanup.push(() => {
    window.removeEventListener('pointerdown', pointerListener, true)
    window.removeEventListener('click', clickListener, true)
  })

  const flushTimer = window.setTimeout(() => {
    activeSession.flush('startup-window-complete')
  }, STARTUP_OBSERVATION_WINDOW_MS)
  cleanup.push(() => window.clearTimeout(flushTimer))
}
