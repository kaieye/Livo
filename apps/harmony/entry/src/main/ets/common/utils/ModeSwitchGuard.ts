export interface ModeSwitchGuardInput<TMode extends string> {
  currentMode: TMode
  nextMode: TMode
  isTransitioning: boolean
}

export function shouldAcceptModeSwitch<TMode extends string>(
  input: ModeSwitchGuardInput<TMode>,
): boolean {
  if (input.nextMode === input.currentMode) {
    return false
  }

  if (input.isTransitioning) {
    return false
  }

  return true
}
