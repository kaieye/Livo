import { ModeSceneRenderState, resolveModeSceneRenderState } from '../../utils/ModeSceneTransition'
import { SubscriptionMode } from '../../components/HomeRootConfig'

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

  getSceneProps(mode: SubscriptionMode): ModeSceneRenderState {
    return resolveModeSceneRenderState({
      mode,
      renderedMode: this.owner.renderedMode,
      previousMode: this.owner.previousMode,
      isTransitioning: this.owner.isModeTransitioning,
      direction: this.owner.modeTransitionDirection,
    })
  }

  modeListSwapTranslateY(mode: SubscriptionMode): number {
    if (this.owner.homeListSwapAnimating && mode === this.owner.homeListSwapMode) {
      return this.owner.homeListSwapTranslateY
    }
    return 0
  }
}
