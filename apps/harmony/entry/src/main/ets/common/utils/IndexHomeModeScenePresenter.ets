import { resolveModeSceneRenderState } from './ModeSceneTransition'
import { SubscriptionMode } from '../components/HomeRootConfig'

export interface IndexHomeModeSceneOwner {
  renderedMode: SubscriptionMode
  previousMode: SubscriptionMode
  isModeTransitioning: boolean
  modeTransitionDirection: number
  homeListSwapAnimating: boolean
  homeListSwapMode: SubscriptionMode
  homeListSwapTranslateY: number
}

export class IndexHomeModeScenePresenter {
  private readonly owner: IndexHomeModeSceneOwner

  constructor(owner: IndexHomeModeSceneOwner) {
    this.owner = owner
  }

  modeSceneVisible(mode: SubscriptionMode): Visibility {
    const state = resolveModeSceneRenderState({
      mode,
      renderedMode: this.owner.renderedMode,
      previousMode: this.owner.previousMode,
      isTransitioning: this.owner.isModeTransitioning,
      direction: this.owner.modeTransitionDirection,
    })
    return state.visibility === 'visible' ? Visibility.Visible : Visibility.Hidden
  }

  modeSceneOpacity(mode: SubscriptionMode): number {
    return resolveModeSceneRenderState({
      mode,
      renderedMode: this.owner.renderedMode,
      previousMode: this.owner.previousMode,
      isTransitioning: this.owner.isModeTransitioning,
      direction: this.owner.modeTransitionDirection,
    }).opacity
  }

  modeSceneOffset(mode: SubscriptionMode): number {
    return resolveModeSceneRenderState({
      mode,
      renderedMode: this.owner.renderedMode,
      previousMode: this.owner.previousMode,
      isTransitioning: this.owner.isModeTransitioning,
      direction: this.owner.modeTransitionDirection,
    }).offset
  }

  modeSceneZIndex(mode: SubscriptionMode): number {
    return resolveModeSceneRenderState({
      mode,
      renderedMode: this.owner.renderedMode,
      previousMode: this.owner.previousMode,
      isTransitioning: this.owner.isModeTransitioning,
      direction: this.owner.modeTransitionDirection,
    }).zIndex
  }

  modeListSwapTranslateY(mode: SubscriptionMode): number {
    if (this.owner.homeListSwapAnimating && mode === this.owner.homeListSwapMode) {
      return this.owner.homeListSwapTranslateY
    }
    return 0
  }
}
