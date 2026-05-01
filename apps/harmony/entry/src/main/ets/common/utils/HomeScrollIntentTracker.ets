import {
  HOME_LOAD_MORE_TRIGGER_SCROLL_WINDOW_MS,
  HomeModeScrollOffsetMap,
  SubscriptionMode,
} from '../components/HomeRootConfig'
import {
  createHomeScrollOffsetMap,
  homeModeNumberValue,
  withHomeModeNumberValue,
} from './IndexHomeStateFactory'

export class HomeScrollIntentTracker {
  isInteracting: boolean = false
  lastUserScrollAt: number = 0
  private intentVersions: HomeModeScrollOffsetMap = createHomeScrollOffsetMap()
  private consumedIntentVersions: HomeModeScrollOffsetMap = createHomeScrollOffsetMap()

  markUserScroll(currentMode: SubscriptionMode, mode: SubscriptionMode, scrollSource: ScrollSource): void {
    if (mode !== currentMode || !this.isUserDrivenSource(scrollSource)) {
      return
    }
    this.lastUserScrollAt = Date.now()
    if (scrollSource === ScrollSource.DRAG || scrollSource === ScrollSource.SCROLL_BAR) {
      if (!this.isInteracting) {
        this.bumpVersion(mode)
      }
      this.setInteracting(true)
      return
    }
    if (scrollSource === ScrollSource.OTHER_USER_INPUT) {
      this.bumpVersion(mode)
    }
  }

  intentVersion(mode: SubscriptionMode): number {
    return homeModeNumberValue(mode, this.intentVersions)
  }

  consumedVersion(mode: SubscriptionMode): number {
    return homeModeNumberValue(mode, this.consumedIntentVersions)
  }

  setConsumedVersion(mode: SubscriptionMode, value: number): void {
    this.consumedIntentVersions = withHomeModeNumberValue(mode, value, this.consumedIntentVersions)
  }

  setInteracting(interacting: boolean): void {
    if (interacting) {
      this.lastUserScrollAt = Date.now()
    }
    this.isInteracting = interacting
  }

  reset(mode: SubscriptionMode): void {
    this.lastUserScrollAt = 0
    this.intentVersions = withHomeModeNumberValue(mode, 0, this.intentVersions)
    this.setConsumedVersion(mode, 0)
  }

  hasRecentIntent(): boolean {
    return Date.now() - this.lastUserScrollAt <= HOME_LOAD_MORE_TRIGGER_SCROLL_WINDOW_MS
  }

  private bumpVersion(mode: SubscriptionMode): void {
    this.intentVersions = withHomeModeNumberValue(mode, this.intentVersion(mode) + 1, this.intentVersions)
  }

  private isUserDrivenSource(source: ScrollSource): boolean {
    return source === ScrollSource.DRAG
      || source === ScrollSource.FLING
      || source === ScrollSource.OTHER_USER_INPUT
      || source === ScrollSource.SCROLL_BAR
      || source === ScrollSource.SCROLL_BAR_FLING
  }
}
