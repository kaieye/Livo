export interface ModeSwitchGuardInput<TMode extends string> {
  currentMode: TMode
  nextMode: TMode
  isTransitioning: boolean
}

export function shouldAcceptModeSwitch<TMode extends string>(
  input: ModeSwitchGuardInput<TMode>,
): boolean {
  // 允许在过渡动画期间接管：用户快速来回切换时若硬等 180ms 过渡结束，超过一半的点击
  // 会被丢弃。startModeTransition 内的 timeout 通过 renderedMode/previousMode 校验避免
  // 旧 timer 错误重置新过渡状态，所以这里放开 isTransitioning 拒绝是安全的。
  return input.nextMode !== input.currentMode
}
