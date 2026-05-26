import { shouldAcceptModeSwitch } from '../../utils/ModeSwitchGuard'
import {
  SUBSCRIPTION_MODES,
  SubscriptionMode,
  MODE_SWIPE_TRIGGER_OFFSET,
} from '../../config/HomeRootConfig'

export function resolveSubscriptionModeLabel(mode: SubscriptionMode): string {
  switch (mode) {
    case 'social':
      return '社交'
    case 'pictures':
      return '图片'
    case 'videos':
      return '视频'
    default:
      return '文章'
  }
}

export function subscriptionModeIndex(mode: SubscriptionMode): number {
  return SUBSCRIPTION_MODES.indexOf(mode)
}

export function adjacentSubscriptionMode(
  currentMode: SubscriptionMode,
  offsetX: number,
): SubscriptionMode | undefined {
  const currentIndex = subscriptionModeIndex(currentMode)
  if (currentIndex < 0) {
    return undefined
  }

  const nextIndex = offsetX < 0 ? currentIndex + 1 : currentIndex - 1
  if (nextIndex < 0 || nextIndex >= SUBSCRIPTION_MODES.length) {
    return undefined
  }

  return SUBSCRIPTION_MODES[nextIndex]
}

export interface SubscriptionSwipeAnalysisInput {
  currentMode: SubscriptionMode
  isTransitioning: boolean
  offsetX: number
  offsetY: number
}

export function resolveSubscriptionSwipeTarget(
  input: SubscriptionSwipeAnalysisInput,
): SubscriptionMode | undefined {
  if (input.isTransitioning) {
    return undefined
  }

  if (
    Math.abs(input.offsetX) < MODE_SWIPE_TRIGGER_OFFSET ||
    Math.abs(input.offsetX) <= Math.abs(input.offsetY)
  ) {
    return undefined
  }

  const candidate: SubscriptionMode | undefined = adjacentSubscriptionMode(input.currentMode, input.offsetX)
  if (!candidate) {
    return undefined
  }

  if (
    !shouldAcceptModeSwitch({
      currentMode: input.currentMode,
      nextMode: candidate,
      isTransitioning: input.isTransitioning,
    })
  ) {
    return undefined
  }

  return candidate
}

export function subscriptionSceneVisibility(
  sceneMode: SubscriptionMode,
  activeMode: SubscriptionMode,
): Visibility {
  return sceneMode === activeMode ? Visibility.Visible : Visibility.Hidden
}

export function subscriptionSceneOpacity(
  sceneMode: SubscriptionMode,
  activeMode: SubscriptionMode,
): number {
  return sceneMode === activeMode ? 1 : 0
}

export function subscriptionSceneZIndex(
  sceneMode: SubscriptionMode,
  activeMode: SubscriptionMode,
): number {
  return sceneMode === activeMode ? 2 : 0
}
