import { SubscriptionMode, SUBSCRIPTION_MODES, HomeModeScrollOffsetMap, MODE_SWIPE_TRIGGER_OFFSET, HOME_MODE_SCENE_TRANSITION_DURATION, HOME_MODE_DEBUG_ENABLED, HOME_MODE_DEBUG_PREFIX } from '../components/HomeRootConfig'
import { shouldAcceptModeSwitch } from './ModeSwitchGuard'
import { rememberVisitedMode } from './HomeModeVisitedCache'

export interface HomeModeDelegate {
  getMode(): SubscriptionMode
  getRenderedMode(): SubscriptionMode
  getPreviousMode(): SubscriptionMode
  getVisitedModes(): SubscriptionMode[]
  isModeTransitioning(): boolean
  getModeTransitionDirection(): number
  getScrollOffsetForMode(mode: SubscriptionMode): number
  getEntryCountForMode(mode: SubscriptionMode): number
  getFirstEntryIdForMode(mode: SubscriptionMode): string
  getLastEntryIdForMode(mode: SubscriptionMode): string

  setMode(mode: SubscriptionMode): void
  setRenderedMode(mode: SubscriptionMode): void
  setPreviousMode(mode: SubscriptionMode): void
  setVisitedModes(modes: SubscriptionMode[]): void
  setModeTransitioning(v: boolean): void
  setModeTransitionDirection(v: number): void
  setScrollInteracting(interacting: boolean, mode: SubscriptionMode): void
  setHomeModeRailExpandedLockOffset(v: number): void
  setHomeModeRailExpandedOverride(v: boolean): void
  setCurrentHomeModeScrollOffset(v: number): void
  setHomeModeRailDismissedByScroll(v: boolean): void
  updateHeaderBlurProgress(offset: number): void
  resetScrollIntent(mode: SubscriptionMode): void
  ensureModeEntriesLoaded(mode: SubscriptionMode): void
  runManagedTimeout(cb: () => void, delayMs: number): void
}

export class HomeModeController {
  private readonly delegate: HomeModeDelegate

  constructor(delegate: HomeModeDelegate) {
    this.delegate = delegate
  }

  modeIndex(mode: SubscriptionMode): number {
    return SUBSCRIPTION_MODES.indexOf(mode)
  }

  requestModeSwitch(nextMode: SubscriptionMode): void {
    if (!shouldAcceptModeSwitch({
      currentMode: this.delegate.getMode(),
      nextMode,
      isTransitioning: this.delegate.isModeTransitioning(),
    })) {
      return
    }

    const nextModeOffset = this.delegate.getScrollOffsetForMode(nextMode)
    this.delegate.setMode(nextMode)
    this.delegate.setVisitedModes(rememberVisitedMode(this.delegate.getVisitedModes(), nextMode))
    this.delegate.setScrollInteracting(false, nextMode)
    this.delegate.resetScrollIntent(nextMode)
    this.delegate.setHomeModeRailExpandedLockOffset(nextModeOffset)
    this.delegate.setHomeModeRailExpandedOverride(true)
    this.delegate.setCurrentHomeModeScrollOffset(nextModeOffset)
    this.delegate.setHomeModeRailDismissedByScroll(false)
    this.delegate.updateHeaderBlurProgress(nextModeOffset)
    this.startModeTransition(nextMode)
    this.delegate.ensureModeEntriesLoaded(nextMode)
  }

  startModeTransition(nextMode: SubscriptionMode): void {
    const previousRenderedMode = this.delegate.getRenderedMode()
    this.delegate.setModeTransitionDirection(
      this.modeIndex(nextMode) > this.modeIndex(previousRenderedMode) ? 1 : -1,
    )
    this.delegate.setPreviousMode(previousRenderedMode)
    this.delegate.setRenderedMode(nextMode)
    this.delegate.setModeTransitioning(true)
    this.delegate.runManagedTimeout(() => {
      if (this.delegate.getRenderedMode() !== nextMode || this.delegate.getPreviousMode() !== previousRenderedMode) {
        return
      }
      this.delegate.setModeTransitioning(false)
    }, HOME_MODE_SCENE_TRANSITION_DURATION)
  }

  adjacentMode(offsetX: number): SubscriptionMode | undefined {
    const currentIndex = this.modeIndex(this.delegate.getMode())
    if (currentIndex < 0) {
      return undefined
    }
    const nextIndex = offsetX < 0 ? currentIndex + 1 : currentIndex - 1
    if (nextIndex < 0 || nextIndex >= SUBSCRIPTION_MODES.length) {
      return undefined
    }
    return SUBSCRIPTION_MODES[nextIndex]
  }

  handleModeSwipe(event: GestureEvent): void {
    if (this.delegate.isModeTransitioning()) {
      return
    }
    const offsetX = event.offsetX
    const offsetY = event.offsetY
    if (Math.abs(offsetX) < MODE_SWIPE_TRIGGER_OFFSET || Math.abs(offsetX) <= Math.abs(offsetY)) {
      return
    }
    const nextMode = this.adjacentMode(offsetX)
    if (nextMode) {
      this.requestModeSwitch(nextMode)
    }
  }

  logModeSwitchSnapshot(stage: string, mode: SubscriptionMode): void {
    if (!HOME_MODE_DEBUG_ENABLED) {
      return
    }
    const count = this.delegate.getEntryCountForMode(mode)
    const currentOffset = this.delegate.getScrollOffsetForMode(mode)
    console.info(
      `${HOME_MODE_DEBUG_PREFIX} stage=${stage} target=${mode} count=${count} `
      + `activeMode=${this.delegate.getMode()} renderedMode=${this.delegate.getRenderedMode()} offset=${currentOffset.toFixed(1)} `
      + `firstId=${this.delegate.getFirstEntryIdForMode(mode)} lastId=${this.delegate.getLastEntryIdForMode(mode)}`,
    )
  }
}
