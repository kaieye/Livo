export type TransitionMode = 'articles' | 'social' | 'pictures' | 'videos'

export interface ModeSceneRenderStateInput {
  mode: TransitionMode
  renderedMode: TransitionMode
  previousMode: TransitionMode
  isTransitioning: boolean
  direction: number
}

export interface ModeSceneRenderState {
  shouldMount: boolean
  visibility: 'visible' | 'hidden'
  opacity: number
  offset: number
  zIndex: number
}

export function resolveModeSceneRenderState(
  input: ModeSceneRenderStateInput,
): ModeSceneRenderState {
  const isCurrent = input.mode === input.renderedMode
  const isPrevious = input.isTransitioning && input.mode === input.previousMode
  const shouldMount = isCurrent || isPrevious

  if (isCurrent) {
    return {
      shouldMount: true,
      visibility: 'visible',
      opacity: 1,
      offset: 0,
      zIndex: 2,
    }
  }

  if (isPrevious) {
    return {
      shouldMount: true,
      visibility: 'visible',
      opacity: 0,
      offset: input.direction > 0 ? -16 : 16,
      zIndex: 1,
    }
  }

  return {
    shouldMount,
    visibility: 'hidden',
    opacity: 0,
    offset: 0,
    zIndex: 0,
  }
}

export interface ModeSwitchGuardInput<TMode extends string> {
  currentMode: TMode
  nextMode: TMode
  isTransitioning: boolean
}

export function shouldAcceptModeSwitch<TMode extends string>(
  input: ModeSwitchGuardInput<TMode>,
): boolean {
  return input.nextMode !== input.currentMode
}
