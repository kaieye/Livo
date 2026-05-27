import { SubscriptionMode, SUBSCRIPTION_MODES, MODE_SWIPE_TRIGGER_OFFSET, HOME_MODE_SCENE_TRANSITION_DURATION, HOME_MODE_DEBUG_ENABLED, HOME_MODE_DEBUG_PREFIX, HOME_MODE_SCENE_TOP_INSET, HOME_MODE_CONTENT_TOP_SPACER_HEIGHT } from '../../config/HomeRootConfig'
import { shouldAcceptModeSwitch } from '../../utils/ModeTransition'
import { rememberVisitedMode } from './HomeModeVisitedCache'
import { EntryCardModel } from '../../models/LivoModels'

export interface HomeModeState {
  mode: SubscriptionMode
  renderedMode: SubscriptionMode
  previousMode: SubscriptionMode
  visitedModes: SubscriptionMode[]
  isModeTransitioning: boolean
  modeTransitionDirection: number
  homeModeRailExpandedLockOffset: number
  homeModeRailExpandedOverride: boolean
  currentHomeModeScrollOffset: number
  homeModeRailCollapseReady: boolean
  homeModeRailDismissedByScroll: boolean
  homeModeRailDismissProgress: number
}

export interface HomeModeActions {
  readHomeModeScrollOffset(mode: SubscriptionMode): number
  totalEntryCountFor(mode: SubscriptionMode): number
  filteredEntriesFor(mode: SubscriptionMode): EntryCardModel[]
  setHomeScrollInteracting(interacting: boolean, mode: SubscriptionMode): void
  updateHeaderBlurProgress(offset: number): void
  resetModeScrollIntent(mode: SubscriptionMode): void
  ensureModeEntriesLoaded(mode: SubscriptionMode): void
  runManagedTimeout(callback: () => void, delayMs: number): void
  // 收到 rail 状态变化(override/collapseReady/dismissProgress)后,把门控后的进度写入 AppStorage。
  syncHomeModeRailEffectiveProgress(): void
}

export class HomeModeController {
  private readonly state: HomeModeState
  private readonly actions: HomeModeActions

  constructor(state: HomeModeState, actions: HomeModeActions) {
    this.state = state
    this.actions = actions
  }

  modeIndex(mode: SubscriptionMode): number {
    return SUBSCRIPTION_MODES.indexOf(mode)
  }

  requestModeSwitch(nextMode: SubscriptionMode): void {
    if (!shouldAcceptModeSwitch({
      currentMode: this.state.mode,
      nextMode,
      isTransitioning: this.state.isModeTransitioning,
    })) {
      return
    }

    const nextModeOffset = this.actions.readHomeModeScrollOffset(nextMode)
    this.state.mode = nextMode
    this.state.visitedModes = rememberVisitedMode(this.state.visitedModes, nextMode)
    this.actions.setHomeScrollInteracting(false, nextMode)
    this.actions.resetModeScrollIntent(nextMode)
    this.state.homeModeRailExpandedLockOffset = nextModeOffset
    this.state.homeModeRailExpandedOverride = true
    this.state.currentHomeModeScrollOffset = nextModeOffset
    // 模式切换时 currentHomeModeScrollOffset 是普通字段不会触发反应,需要主动同步
    // collapseReady 快照,让 build 路径能正确决定折叠/展开。
    const nextCollapseReady =
      HOME_MODE_SCENE_TOP_INSET - nextModeOffset <= HOME_MODE_CONTENT_TOP_SPACER_HEIGHT
    if (this.state.homeModeRailCollapseReady !== nextCollapseReady) {
      this.state.homeModeRailCollapseReady = nextCollapseReady
    }
    this.state.homeModeRailDismissedByScroll = false
    this.state.homeModeRailDismissProgress = 0
    this.actions.updateHeaderBlurProgress(nextModeOffset)
    this.actions.syncHomeModeRailEffectiveProgress()
    this.startModeTransition(nextMode)
    this.actions.runManagedTimeout(() => {
      if (this.state.mode !== nextMode) {
        return
      }
      this.actions.ensureModeEntriesLoaded(nextMode)
    }, 16)
  }

  startModeTransition(nextMode: SubscriptionMode): void {
    const previousRenderedMode = this.state.renderedMode
    this.state.modeTransitionDirection =
      this.modeIndex(nextMode) > this.modeIndex(previousRenderedMode) ? 1 : -1
    this.state.previousMode = previousRenderedMode
    this.state.renderedMode = nextMode
    this.state.isModeTransitioning = true
    this.actions.runManagedTimeout(() => {
      if (this.state.renderedMode !== nextMode || this.state.previousMode !== previousRenderedMode) {
        return
      }
      this.state.isModeTransitioning = false
    }, HOME_MODE_SCENE_TRANSITION_DURATION)
  }

  adjacentMode(offsetX: number): SubscriptionMode | undefined {
    const currentIndex = this.modeIndex(this.state.mode)
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
    if (this.state.isModeTransitioning) {
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
    const entries = this.actions.filteredEntriesFor(mode)
    const count = this.actions.totalEntryCountFor(mode)
    const currentOffset = this.actions.readHomeModeScrollOffset(mode)
    const firstId = (entries[0]?.id || '').trim()
    const lastId = (entries[entries.length - 1]?.id || '').trim()
    console.info(
      `${HOME_MODE_DEBUG_PREFIX} stage=${stage} target=${mode} count=${count} `
      + `activeMode=${this.state.mode} renderedMode=${this.state.renderedMode} offset=${currentOffset.toFixed(1)} `
      + `firstId=${firstId} lastId=${lastId}`,
    )
  }
}
