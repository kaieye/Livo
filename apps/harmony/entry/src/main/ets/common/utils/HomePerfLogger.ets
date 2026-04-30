import {
  HOME_LOAD_MORE_DEBUG_ENABLED,
  HOME_LOAD_MORE_DEBUG_PREFIX,
  HOME_LOAD_STATE_DIAG_ENABLED,
  HOME_LOAD_STATE_DIAG_PREFIX,
  HOME_PERF_DIAG_ENABLED,
  HOME_PERF_DIAG_PREFIX,
} from '../components/HomeRootConfig'

export class HomePerfLogger {
  sessionId: number = 0
  sessionStartedAt: number = 0

  startSession(): void {
    this.sessionId += 1
    this.sessionStartedAt = Date.now()
  }

  perf(message: string): void {
    if (!HOME_PERF_DIAG_ENABLED) {
      return
    }
    const elapsed = this.sessionStartedAt > 0 ? Date.now() - this.sessionStartedAt : 0
    console.info(`${HOME_PERF_DIAG_PREFIX} sid=${this.sessionId} t=${elapsed}ms ${message}`)
  }

  loadMore(message: string): void {
    if (!HOME_LOAD_MORE_DEBUG_ENABLED) {
      return
    }
    console.info(`${HOME_LOAD_MORE_DEBUG_PREFIX} ${message}`)
  }

  loadState(message: string): void {
    if (!HOME_LOAD_STATE_DIAG_ENABLED) {
      return
    }
    const elapsed = this.sessionStartedAt > 0 ? Date.now() - this.sessionStartedAt : 0
    console.info(`${HOME_LOAD_STATE_DIAG_PREFIX} sid=${this.sessionId} t=${elapsed}ms ${message}`)
  }
}
