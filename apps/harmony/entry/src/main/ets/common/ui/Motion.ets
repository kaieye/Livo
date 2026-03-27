export class MotionUtil {
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
}

export const livoMotion = new MotionUtil()
