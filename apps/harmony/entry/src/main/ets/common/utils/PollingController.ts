// Polling controller for account login detection
// Abstracts setInterval/clearInterval lifecycle management

export type PollingCallback = () => void

export class PollingController {
  private pollId: number = -1
  private intervalMs: number
  private callback: PollingCallback | null = null

  constructor(intervalMs: number) {
    this.intervalMs = intervalMs
  }

  start(callback: PollingCallback): void {
    this.stop()
    this.callback = callback
    this.pollId = setInterval(() => {
      if (this.callback) {
        this.callback()
      }
    }, this.intervalMs)
  }

  stop(): void {
    if (this.pollId >= 0) {
      clearInterval(this.pollId)
      this.pollId = -1
    }
    this.callback = null
  }

  isRunning(): boolean {
    return this.pollId >= 0
  }
}
