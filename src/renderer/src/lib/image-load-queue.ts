export interface ImageLoadTicket {
  release: () => void
}

interface QueuedImageLoad {
  cancelled: boolean
  onGrant: (ticket: ImageLoadTicket) => void
}

export class ImageLoadQueue {
  private activeCount = 0
  private readonly pending: QueuedImageLoad[] = []

  constructor(private readonly maxActive: number) {
    if (!Number.isInteger(maxActive) || maxActive < 1) {
      throw new Error('maxActive must be a positive integer')
    }
  }

  request(onGrant: (ticket: ImageLoadTicket) => void): () => void {
    const load: QueuedImageLoad = { cancelled: false, onGrant }
    this.pending.push(load)
    this.drain()

    return () => {
      if (load.cancelled) return
      load.cancelled = true
      const pendingIndex = this.pending.indexOf(load)
      if (pendingIndex >= 0) {
        this.pending.splice(pendingIndex, 1)
      }
    }
  }

  getActiveCount(): number {
    return this.activeCount
  }

  getPendingCount(): number {
    return this.pending.length
  }

  private drain(): void {
    while (this.activeCount < this.maxActive && this.pending.length > 0) {
      const load = this.pending.shift()
      if (!load || load.cancelled) continue

      this.activeCount += 1
      let released = false
      const release = () => {
        if (released) return
        released = true
        this.activeCount = Math.max(0, this.activeCount - 1)
        this.drain()
      }

      load.onGrant({ release })
    }
  }
}

export const previewImageLoadQueue = new ImageLoadQueue(2)
