import { HOME_PULL_DEBUG_LOG_ENABLED, HOME_PULL_DEBUG_LOG_PREFIX } from '../components/HomeRootConfig'
import { SubscriptionMode } from '../components/HomeRootConfig'

export class HomePullDebugSession {
  sessionId: number = 0
  mode: SubscriptionMode = 'articles'
  startedAt: number = 0
  releasedAt: number = 0
  willScrollCount: number = 0
  postReleaseWillScrollCount: number = 0
  ignoredWillScrollCount: number = 0
  stateWriteCount: number = 0
  finalizeScheduleCount: number = 0
  finalizeRunCount: number = 0

  log(message: string): void {
    if (!HOME_PULL_DEBUG_LOG_ENABLED) {
      return
    }
    console.info(`${HOME_PULL_DEBUG_LOG_PREFIX} ${message}`)
  }

  start(mode: SubscriptionMode): void {
    this.sessionId += 1
    this.mode = mode
    this.startedAt = Date.now()
    this.releasedAt = 0
    this.willScrollCount = 0
    this.postReleaseWillScrollCount = 0
    this.ignoredWillScrollCount = 0
    this.stateWriteCount = 0
    this.finalizeScheduleCount = 0
    this.finalizeRunCount = 0
    this.log(`session=${this.sessionId} start mode=${mode}`)
  }

  markReleased(mode: SubscriptionMode): void {
    if (this.startedAt <= 0) {
      return
    }
    this.releasedAt = Date.now()
    const activeDuration = this.releasedAt - this.startedAt
    this.log(
      `session=${this.sessionId} release mode=${mode} activeMs=${activeDuration} `
      + `willScroll=${this.willScrollCount} stateWrites=${this.stateWriteCount}`,
    )
  }

  flushSummary(outcome: string): void {
    if (this.startedAt <= 0) {
      return
    }
    const now = Date.now()
    const totalMs = now - this.startedAt
    const releaseToFinalizeMs = this.releasedAt > 0 ? now - this.releasedAt : -1
    this.log(
      `session=${this.sessionId} summary mode=${this.mode} outcome=${outcome} `
      + `totalMs=${totalMs} releaseToFinalizeMs=${releaseToFinalizeMs} willScroll=${this.willScrollCount} `
      + `postReleaseWillScroll=${this.postReleaseWillScrollCount} ignoredWillScroll=${this.ignoredWillScrollCount} `
      + `stateWrites=${this.stateWriteCount} finalizeScheduled=${this.finalizeScheduleCount} `
      + `finalizeRun=${this.finalizeRunCount}`,
    )
    this.startedAt = 0
    this.releasedAt = 0
  }
}
