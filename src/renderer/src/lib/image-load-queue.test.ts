import { describe, expect, it, vi } from 'vitest'
import { ImageLoadQueue, type ImageLoadTicket } from './image-load-queue'

describe('ImageLoadQueue', () => {
  it('limits concurrent grants and starts queued loads after release', () => {
    const queue = new ImageLoadQueue(2)
    const granted: ImageLoadTicket[] = []
    const callbacks = [vi.fn(), vi.fn(), vi.fn()]

    for (const callback of callbacks) {
      queue.request((ticket) => {
        granted.push(ticket)
        callback()
      })
    }

    expect(callbacks[0]).toHaveBeenCalledTimes(1)
    expect(callbacks[1]).toHaveBeenCalledTimes(1)
    expect(callbacks[2]).not.toHaveBeenCalled()
    expect(queue.getActiveCount()).toBe(2)
    expect(queue.getPendingCount()).toBe(1)

    granted[0].release()

    expect(callbacks[2]).toHaveBeenCalledTimes(1)
    expect(queue.getActiveCount()).toBe(2)
    expect(queue.getPendingCount()).toBe(0)
  })

  it('removes cancelled pending loads from the queue', () => {
    const queue = new ImageLoadQueue(1)
    const first: ImageLoadTicket[] = []
    const second = vi.fn()
    const third = vi.fn()

    queue.request((ticket) => first.push(ticket))
    const cancelSecond = queue.request(second)
    queue.request(third)

    cancelSecond()
    first[0].release()

    expect(second).not.toHaveBeenCalled()
    expect(third).toHaveBeenCalledTimes(1)
    expect(queue.getActiveCount()).toBe(1)
    expect(queue.getPendingCount()).toBe(0)
  })

  it('treats release as idempotent', () => {
    const queue = new ImageLoadQueue(1)
    const tickets: ImageLoadTicket[] = []

    queue.request((ticket) => tickets.push(ticket))

    tickets[0].release()
    tickets[0].release()

    expect(queue.getActiveCount()).toBe(0)
    expect(queue.getPendingCount()).toBe(0)
  })
})
