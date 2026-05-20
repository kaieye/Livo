// Typewriter — 打字机逐字动画工具
//
// 设计要点：
//   1. "追平"模型：不是从 0 开始逐字渲染，而是只对增量部分追加动画
//   2. 自适应 chunk 大小：pending 越多每帧吐得越多，越少吐得越慢
//   3. 可中途取消：新消息到达 / 切换会话时调用 cancel()
//   4. 回调驱动：onTick 更新 UI，onDone 标记完成
//
// 用法：
//   const tw = new Typewriter()
//   tw.start(fullText, {
//     onTick: (displayed) => { ... },
//     onDone: () => { ... }
//   })
//   tw.cancel()  // 中断

const MIN_CHARS_PER_TICK = 2
const MAX_CHARS_PER_TICK = 6
const MIN_DELAY_MS = 40
const MAX_DELAY_MS = 70
const MID_DELAY_MS = Math.round((MIN_DELAY_MS + MAX_DELAY_MS) / 2)

export interface TypewriterCallbacks {
  onTick: (displayedText: string) => void
  onDone: () => void
}

export class Typewriter {
  private timerId: number | null = null
  private pending: string = ''
  private displayed: string = ''
  private fullText: string = ''
  private callbacks: TypewriterCallbacks | null = null
  private cancelled: boolean = false

  start(
    fullText: string,
    callbacks: TypewriterCallbacks,
    fromText: string = '',
  ): void {
    this.cancel()

    const trimmed = (fullText ?? '').trimEnd()
    if (!trimmed) {
      callbacks.onDone()
      return
    }

    this.fullText = trimmed
    this.displayed = fromText
    this.callbacks = callbacks
    this.cancelled = false

    if (fromText && trimmed.startsWith(fromText)) {
      this.pending = trimmed.slice(fromText.length)
    } else {
      this.pending = trimmed
    }

    if (!this.pending) {
      this.callbacks.onTick(this.displayed)
      this.finish()
      return
    }

    this.tick()
    this.scheduleNext()
  }

  cancel(): void {
    this.cancelled = true
    this.clearTimer()
    this.pending = ''
    this.callbacks = null
  }

  flush(): void {
    this.clearTimer()
    if (this.callbacks && this.fullText) {
      this.callbacks.onTick(this.fullText)
    }
    this.finish()
  }

  get isRunning(): boolean {
    return this.timerId !== null && !this.cancelled
  }

  private tick(): void {
    if (this.cancelled || !this.pending || !this.callbacks) {
      return
    }

    const chunkSize = this.computeChunkSize(this.pending.length)
    const actualSize = Math.min(this.pending.length, chunkSize)

    const chunk = this.pending.slice(0, actualSize)
    this.pending = this.pending.slice(actualSize)
    this.displayed += chunk

    this.callbacks.onTick(this.displayed)

    if (!this.pending) {
      this.finish()
    }
  }

  private scheduleNext(): void {
    if (this.cancelled || !this.pending) {
      return
    }

    const delay = this.computeDelay(this.pending.length)
    this.timerId = setTimeout(() => {
      this.timerId = null
      this.tick()
      this.scheduleNext()
    }, delay)
  }

  private computeChunkSize(pendingLength: number): number {
    const preferred = Math.ceil(pendingLength / 3)
    const bounded = Math.max(
      MIN_CHARS_PER_TICK,
      Math.min(MAX_CHARS_PER_TICK, preferred),
    )
    return bounded
  }

  private computeDelay(pendingLength: number): number {
    if (pendingLength <= MIN_CHARS_PER_TICK) {
      return MAX_DELAY_MS
    }
    if (pendingLength <= MAX_CHARS_PER_TICK) {
      return MIN_DELAY_MS
    }
    if (pendingLength <= MAX_CHARS_PER_TICK * 2) {
      return MID_DELAY_MS
    }
    return MIN_DELAY_MS
  }

  private finish(): void {
    this.clearTimer()
    const cb = this.callbacks
    this.callbacks = null
    this.pending = ''
    cb?.onDone()
  }

  private clearTimer(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId)
      this.timerId = null
    }
  }
}
