import { curves } from '@kit.ArkUI'

export class MotionUtil {
  public rootSceneDuration(): number {
    return 180
  }

  public rootSceneCurve(): Curve {
    return Curve.EaseOut
  }

  public rootSceneOffset(activeIndex: number, sceneIndex: number): number {
    if (sceneIndex === activeIndex) {
      return 0
    }

    return sceneIndex > activeIndex ? 12 : -12
  }

  public rootSceneScale(isActive: boolean): number {
    return isActive ? 1 : 0.998
  }

  public rootSceneOpacity(isActive: boolean): number {
    return isActive ? 1 : 0
  }

  public enterScale(delay: number = 0): TransitionEffect {
    return TransitionEffect.OPACITY
      .combine(TransitionEffect.scale({ x: 0.92, y: 0.92 }))
      .animation({ duration: 260, curve: Curve.EaseOut, delay })
  }

  public enterRise(delay: number = 0): TransitionEffect {
    return TransitionEffect.OPACITY
      .combine(TransitionEffect.translate({ y: 20 }))
      .animation({ duration: 240, curve: Curve.EaseOut, delay })
  }

  public enterFromBottom(delay: number = 0): TransitionEffect {
    return TransitionEffect.OPACITY
      .combine(TransitionEffect.translate({ y: 36 }))
      .animation({ duration: 280, curve: Curve.FastOutSlowIn, delay })
  }

  public enterFromRight(delay: number = 0): TransitionEffect {
    return TransitionEffect.OPACITY
      .combine(TransitionEffect.translate({ x: 22 }))
      .animation({ duration: 240, curve: Curve.EaseOut, delay })
  }

  public enterSoft(delay: number = 0): TransitionEffect {
    return TransitionEffect.OPACITY
      .combine(TransitionEffect.scale({ x: 0.97, y: 0.97 }))
      .combine(TransitionEffect.translate({ y: 12 }))
      .animation({ duration: 280, curve: Curve.FastOutSlowIn, delay })
  }

  public enterIconSpin(step: number = 0): TransitionEffect {
    return TransitionEffect.scale({ x: 0, y: 0 })
      .combine(TransitionEffect.rotate({ angle: 360 }))
      .animation({ duration: 300, curve: curves.springMotion(), delay: step * 10 + 50 })
  }

  public enterClashScale(step: number = 0): TransitionEffect {
    return TransitionEffect.OPACITY
      .combine(TransitionEffect.scale({ x: 0, y: 0 }))
      .animation({ duration: 300, curve: curves.springMotion(), delay: step * 10 + 30 })
  }
}

export const livoMotion = new MotionUtil()
