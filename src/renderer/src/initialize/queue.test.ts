import { describe, expect, it, vi } from 'vitest'

describe('app ready queue', () => {
  it('queues callbacks until ready and then flushes them', async () => {
    const mod = await import('./queue')
    const calls: string[] = []

    mod.waitForAppReady(() => calls.push('first'))
    mod.waitForAppReady(() => calls.push('second'))

    expect(calls).toEqual([])

    mod.applyAfterReadyCallbacks()

    expect(calls).toEqual(['first', 'second'])
    expect(mod.isAppReady()).toBe(true)
  })

  it('runs immediately after ready', async () => {
    const mod = await import('./queue')
    const spy = vi.fn()

    mod.applyAfterReadyCallbacks()
    mod.waitForAppReady(spy)

    expect(spy).toHaveBeenCalledTimes(1)
  })
})
