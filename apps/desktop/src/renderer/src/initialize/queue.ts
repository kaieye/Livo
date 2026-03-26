const afterReadyCallbackQueue: Array<() => void> = []

let appReady = false

export function isAppReady(): boolean {
  return appReady
}

export function waitForAppReady(callback: () => void, delay = 0): void {
  const run = () => {
    if (delay > 0) {
      window.setTimeout(callback, delay)
      return
    }
    callback()
  }

  if (appReady) {
    run()
    return
  }

  afterReadyCallbackQueue.push(run)
}

export function applyAfterReadyCallbacks(): void {
  appReady = true
  const queued = afterReadyCallbackQueue.splice(
    0,
    afterReadyCallbackQueue.length,
  )
  for (const callback of queued) {
    callback()
  }
}
