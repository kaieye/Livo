/**
 * Shared toast presentation helper — eliminates duplicated showToast implementations
 * across pages and components.
 */
export const TOAST_DURATION_SHORT: number = 1800
export const TOAST_DURATION_DEFAULT: number = 2000
export const TOAST_DURATION_OK: number = 2000
export const TOAST_DURATION_LONG: number = 2600
export const TOAST_DURATION_ERROR: number = 3000

export function showToast(
  uiContext: UIContext,
  message: string,
  duration: number = TOAST_DURATION_DEFAULT,
): void {
  try {
    uiContext.getPromptAction().showToast({ message, duration })
  } catch (error) {
    console.error(`showToast failed: ${error instanceof Error ? error.message : error}`)
  }
}
