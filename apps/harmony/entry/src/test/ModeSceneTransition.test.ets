import { describe, it, expect } from '@ohos/hypium'
import { resolveModeSceneRenderState } from '../main/ets/common/utils/ModeSceneTransition'

export default function modeSceneTransitionTest() {
  describe('modeSceneTransitionTest', () => {
    it('mounts only the active scene when not transitioning', 0, () => {
      expect(resolveModeSceneRenderState({
        mode: 'articles',
        renderedMode: 'articles',
        previousMode: 'articles',
        isTransitioning: false,
        direction: 1,
      }).shouldMount).assertEqual(true)

      expect(resolveModeSceneRenderState({
        mode: 'social',
        renderedMode: 'articles',
        previousMode: 'articles',
        isTransitioning: false,
        direction: 1,
      }).shouldMount).assertEqual(false)
    })

    it('keeps the previous scene mounted during a transition', 0, () => {
      expect(resolveModeSceneRenderState({
        mode: 'articles',
        renderedMode: 'social',
        previousMode: 'articles',
        isTransitioning: true,
        direction: 1,
      }).shouldMount).assertEqual(true)
    })
  })
}
